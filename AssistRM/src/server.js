import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { listPdfFiles } from "./drive.js";
import { extractPdfText, getPdfBuffer } from "./pdf.js";
import { findCandidates, extractNameFromQuery } from "./matcher.js";
import { confirmClientMatch, answerAboutClient, isNewClientRequest } from "./ai.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

const authMiddleware = (req, res, next) => {
  const password = process.env.APP_PASSWORD;
  if (!password) return next();
  const authHeader = req.headers["x-app-password"];
  if (authHeader === password) return next();
  res.status(401).json({ error: "Unauthorized" });
};

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    groq: Boolean(process.env.GROQ_API_KEY),
    drive: Boolean(process.env.GOOGLE_CREDENTIALS || process.env.GOOGLE_CREDENTIALS_FILE),
    folder: Boolean(process.env.GOOGLE_DRIVE_FOLDER_ID),
    auth: Boolean(process.env.APP_PASSWORD),
    model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
  });
});

app.get("/api/files", authMiddleware, async (req, res) => {
  try {
    const files = await listPdfFiles();
    res.json({ files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/pdf/:fileId", authMiddleware, async (req, res) => {
  try {
    const buffer = await getPdfBuffer(req.params.fileId);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline");
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function selectClient(query) {
  const files = await listPdfFiles();
  if (files.length === 0) return { status: "empty" };
  const name = extractNameFromQuery(query) || query;
  const candidates = findCandidates(name, files);
  if (candidates.length === 0) return { status: "not_found", name };
  const topCandidates = candidates.slice(0, 5);
  for (const cand of topCandidates) {
    const text = await extractPdfText(cand.file.id);
    const verdict = await confirmClientMatch(query, cand.file.name, text);
    if (verdict.match) {
      return {
        status: "found",
        client: {
          id: cand.file.id,
          fileName: cand.file.name,
          displayName: verdict.nome_no_documento || name,
        },
        text,
      };
    }
  }
  return {
    status: "ambiguous",
    name,
    options: topCandidates.map((c) => ({ id: c.file.id, fileName: c.file.name })),
  };
}

app.post("/api/chat", authMiddleware, async (req, res) => {
  try {
    const { message, currentClient, history = [] } = req.body || {};
    if (!message || !message.trim()) return res.status(400).json({ error: "Mensagem vazia." });
    let mustSearch = !currentClient;
    let searchName = message;
    if (currentClient) {
      const intent = await isNewClientRequest(message);
      if (intent.novo_cliente) {
        mustSearch = true;
        searchName = intent.nome || message;
      }
    }
    if (mustSearch) {
      const result = await selectClient(searchName);
      if (result.status === "empty") {
        return res.json({ reply: "Nao encontrei arquivos no Drive.", client: currentClient || null });
      }
      if (result.status === "not_found") {
        return res.json({ reply: `Nao encontrei "${result.name}".`, client: currentClient || null });
      }
      if (result.status === "ambiguous") {
        const list = result.options.map((o) => `- ${o.fileName}`).join("\n");
        return res.json({
          reply: `Multiplos documentos para "${result.name}":\n${list}\nQual o nome completo?`,
          client: currentClient || null,
        });
      }
      const answer = await answerAboutClient(message, result.client.displayName, result.text, history);
      return res.json({ reply: answer, client: result.client, clientChanged: true });
    }
    const text = await extractPdfText(currentClient.id);
    const answer = await answerAboutClient(message, currentClient.displayName, text, history);
    return res.json({ reply: answer, client: currentClient });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/select", authMiddleware, async (req, res) => {
  try {
    const { fileId } = req.body || {};
    if (!fileId) return res.status(400).json({ error: "fileId obrigatorio." });
    const text = await extractPdfText(fileId);
    const files = await listPdfFiles();
    const meta = files.find((f) => f.id === fileId);
    const verdict = await confirmClientMatch(meta?.name || "", meta?.name || "", text);
    res.json({
      client: {
        id: fileId,
        fileName: meta?.name || fileId,
        displayName: verdict.nome_no_documento || meta?.name || fileId,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.use(express.static(path.join(__dirname, "..", "public")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

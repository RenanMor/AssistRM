import Groq from "groq-sdk";

let client = null;

function getClient() {
  if (!client) {
    if (!process.env.GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY nao configurada.");
    }
    client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return client;
}

const MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

function trimTextOptimized(text, max = 15000) {
  let cleanText = text.replace(/\s+/g, ' ').trim();
  if (cleanText.length <= max) return cleanText;
  return cleanText.slice(0, max) + "\n[AVISO: TEXTO TRUNCADO]";
}

export async function confirmClientMatch(query, candidateName, pdfText) {
  const groq = getClient();
  const prompt = `Verifique se o documento corresponde ao cliente.
Cliente buscado: "${query}"
Arquivo: "${candidateName}"
Conteúdo:
"""
${trimTextOptimized(pdfText, 3000)}
"""
Formato JSON EXIGIDO: {"match": true|false, "nome_no_documento": "nome exato ou vazio", "motivo": "curto"}
Regra: match=true para correspondência clara, aceitando abreviações, pequenas variações ou "de" no nome.`;

  const res = await groq.chat.completions.create({
    model: MODEL,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: "Você é um classificador JSON estrito." },
      { role: "user", content: prompt },
    ],
  });

  const raw = res.choices?.[0]?.message?.content || "{}";
  try {
    return JSON.parse(raw);
  } catch {
    return { match: true, nome_no_documento: candidateName, motivo: "verificacao automatica" };
  }
}

export async function answerAboutClient(question, clientName, pdfText, history = []) {
  const groq = getClient();
  const systemPrompt = `Você é um extrator de dados estritamente objetivo. Cliente atual: "${clientName}".
Baseie-se EXCLUSIVAMENTE no documento fornecido.

REGRAS RÍGIDAS:
1. Se a informação não estiver no documento, responda APENAS com: "N/A".
2. NUNCA adicione saudações, explicações extras ou pergunte se pode ajudar mais.
3. Seja direto. Mostre valores exatos. Se houver opções, liste todas (ex: do básico ao master).

DOCUMENTO:
"""
${trimTextOptimized(pdfText)}
"""`;

  const messages = [{ role: "system", content: systemPrompt }];
  for (const h of history.slice(-8)) {
    if (h.role === "user" || h.role === "assistant") {
      messages.push({ role: h.role, content: String(h.content || "") });
    }
  }
  messages.push({ role: "user", content: question });

  const res = await groq.chat.completions.create({
    model: MODEL,
    temperature: 0.2,
    messages,
  });

  return res.choices?.[0]?.message?.content?.trim() || "N/A";
}

export async function isNewClientRequest(message) {
  const groq = getClient();
  const prompt = `Analise a intenção do usuário:
Mensagem: "${message}"

Formato JSON EXIGIDO: {"novo_cliente": true|false, "nome": "nome mencionado ou vazio"}

Regras:
- novo_cliente=true: quer buscar um cliente diferente (ex: "valor para Vanessa", "dados do João").
- novo_cliente=false: pergunta genérica sobre o cliente atual (ex: "qual o valor?", "tem desconto?").`;

  const res = await groq.chat.completions.create({
    model: MODEL,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: "Você classifica intenções em JSON estrito." },
      { role: "user", content: prompt },
    ],
  });

  const raw = res.choices?.[0]?.message?.content || "{}";
  try {
    return JSON.parse(raw);
  } catch {
    return { novo_cliente: false, nome: "" };
  }
}

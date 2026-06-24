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

function trimText(text, max = 24000) {
  if (text.length <= max) return text;
  return text.slice(0, max);
}

export async function confirmClientMatch(query, candidateName, pdfText) {
  const groq = getClient();
  const prompt = `Voce esta verificando se o documento corresponde ao cliente solicitado.

Cliente solicitado pelo usuario: "${query}"
Nome do arquivo candidato: "${candidateName}"

Trecho inicial do conteudo do documento:
"""
${trimText(pdfText, 6000)}
"""

Responda APENAS com um JSON valido, sem texto extra, no formato:
{"match": true|false, "nome_no_documento": "nome completo encontrado ou vazio", "motivo": "explicacao curta"}

Considere match=true se o nome solicitado corresponde de forma clara ao cliente do documento, mesmo com pequenas variacoes de grafia ou abreviacoes.`;

  const res = await groq.chat.completions.create({
    model: MODEL,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: "Voce e um verificador preciso. Responda somente JSON valido." },
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

  const systemPrompt = `Voce e um assistente que responde perguntas sobre orcamentos e relatorios de clientes em portugues do Brasil.
O cliente atualmente selecionado e: "${clientName}".
Responda com base EXCLUSIVAMENTE no conteudo do documento abaixo. Se a informacao pedida nao estiver no documento, diga claramente que nao encontrou a informacao no documento.
Seja direto e objetivo. Quando informar valores, mostre o valor exato como aparece no documento.

CONTEUDO DO DOCUMENTO DO CLIENTE:
"""
${trimText(pdfText)}
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

  return res.choices?.[0]?.message?.content?.trim() || "Nao foi possivel gerar uma resposta.";
}

export async function isNewClientRequest(message) {
  const groq = getClient();
  const prompt = `Analise a mensagem do usuario e decida se ele esta pedindo para buscar/selecionar um CLIENTE diferente (por nome), ou se e apenas uma pergunta sobre o cliente ja selecionado.

Mensagem: "${message}"

Responda APENAS com JSON valido no formato:
{"novo_cliente": true|false, "nome": "nome do cliente mencionado, se houver, senao vazio"}

Regras:
- "novo_cliente" = true somente quando a mensagem indica um nome de pessoa/cliente a ser buscado (ex: "quero saber o valor para Vanessa de Araujo", "ver dados do Joao Silva", "abrir orcamento da Maria").
- "novo_cliente" = false para perguntas genericas sobre o cliente atual (ex: "qual o valor orcado?", "tem desconto?", "quando vence?").`;

  const res = await groq.chat.completions.create({
    model: MODEL,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: "Voce classifica intencoes. Responda somente JSON valido." },
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

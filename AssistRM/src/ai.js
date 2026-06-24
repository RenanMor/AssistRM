import Groq from "groq-sdk";
import fetch from "node-fetch";

let client = null;

function getClient() {
  if (!client) {
    if (!process.env.GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY nao configurada.");
    }
    client = new Groq({ 
      apiKey: process.env.GROQ_API_KEY,
      fetch: fetch,
      maxRetries: 3 
    });
  }
  return client;
}

const MODEL = process.env.GROQ_MODEL;

function trimText(text, max = 8000) {
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

Considere match=true se o nome solicitado corresponde de forma clara ao cliente do documento, mesmo com pequenas variações de grafia ou abreviações.`;

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

  // --- COMPORTAMENTO DA IA PERSONALIZADO AQUI ---
  // Adicionadas regras restritivas e proibitivas para eliminar comentários extras.
  const systemPrompt = `Você é um extrator de dados cirúrgico e extremamente direto que responde perguntas sobre orçamentos e relatórios em português do Brasil.
O cliente atualmente selecionado é: "${clientName}".

REGRAS CRÍTICAS DE RESPOSTA:
1. Responda com base EXCLUSIVAMENTE no conteúdo do documento abaixo. Se a informação pedida não estiver explícita, responda apenas: "Informação não encontrada no documento."
2. Vá direto ao ponto. Forneça APENAS a informação crua que foi solicitada.
3. PROIBIDO qualquer tipo de saudação, introdução ou comentário extra (Exemplos proibidos: "De acordo com o documento...", "O valor encontrado foi...", "Aqui está o que você pediu:", "Espero ter ajudado").
4. Se o usuário perguntar um valor, responda APENAS o valor (Exemplo: "R$ 1.500,00"). Se perguntar uma data, responda APENAS a data.
5. Quando informar valores, mostre o valor exato como aparece no documento.

CONTEÚDO DO DOCUMENTO DO CLIENTE:
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
    temperature: 0, // Alterado para 0 para tornar a resposta o mais determinística e fria possível
    messages,
  });

  return res.choices?.[0]?.message?.content?.trim() || "Não foi possível gerar uma resposta.";
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

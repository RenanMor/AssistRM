const messagesEl = document.getElementById("messages");
const formEl = document.getElementById("chat-form");
const inputEl = document.getElementById("chat-input");
const sendBtn = document.getElementById("send-btn");
const clientBadge = document.getElementById("client-badge");
const clientNameEl = document.getElementById("client-name");
const clearClientBtn = document.getElementById("clear-client");
const viewerEmpty = document.getElementById("viewer-empty");
const viewerContent = document.getElementById("viewer-content");
const viewerFilename = document.getElementById("viewer-filename");
const viewerOpen = document.getElementById("viewer-open");
const pdfFrame = document.getElementById("pdf-frame");

let currentClient = null;
const history = [];

function addMessage(text, role) {
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  div.textContent = text;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return div;
}

function showTyping() {
  const div = document.createElement("div");
  div.className = "typing";
  div.innerHTML = "<span></span><span></span><span></span>";
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return div;
}

function setClient(client) {
  currentClient = client;
  if (client) {
    clientNameEl.textContent = client.displayName || client.fileName;
    clientBadge.classList.remove("hidden");
    showPdf(client);
  } else {
    clientBadge.classList.add("hidden");
    hidePdf();
  }
}

function showPdf(client) {
  const url = `/api/pdf/${encodeURIComponent(client.id)}`;
  pdfFrame.src = `${url}#toolbar=1&view=FitH`;
  viewerFilename.textContent = client.fileName;
  viewerOpen.href = url;
  viewerEmpty.classList.add("hidden");
  viewerContent.classList.remove("hidden");
}

function hidePdf() {
  pdfFrame.src = "about:blank";
  viewerContent.classList.add("hidden");
  viewerEmpty.classList.remove("hidden");
}

clearClientBtn.addEventListener("click", () => {
  setClient(null);
  addMessage("Cliente atual removido. Informe o nome de um novo cliente para comecar.", "system");
});

formEl.addEventListener("submit", async (e) => {
  e.preventDefault();
  const message = inputEl.value.trim();
  if (!message) return;

  addMessage(message, "user");
  history.push({ role: "user", content: message });
  inputEl.value = "";
  inputEl.disabled = true;
  sendBtn.disabled = true;

  const typing = showTyping();

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, currentClient, history }),
    });
    const data = await res.json();
    typing.remove();

    if (!res.ok) {
      addMessage(`Erro: ${data.error || "falha na requisicao"}`, "bot");
    } else {
      if (data.client && (!currentClient || data.client.id !== currentClient.id)) {
        setClient(data.client);
      }
      addMessage(data.reply, "bot");
      history.push({ role: "assistant", content: data.reply });
    }
  } catch (err) {
    typing.remove();
    addMessage(`Erro de conexao: ${err.message}`, "bot");
  } finally {
    inputEl.disabled = false;
    sendBtn.disabled = false;
    inputEl.focus();
  }
});

(function init() {
  addMessage(
    "Ola! Sou seu assistente. Informe o nome do cliente junto com o que deseja: https://drive.google.com/drive/folders/1ULRe_-U-3bZ6vtP-QRJdjUd27AEdFkBx?usp=sharing",
    "bot"
  );
})();

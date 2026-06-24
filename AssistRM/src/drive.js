import crypto from "node:crypto";
import fs from "node:fs";

const TOKEN_URI = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/drive.readonly";

let cachedCredentials = null;
let cachedToken = null;
let tokenExpiresAt = 0;

function loadCredentials() {
  if (cachedCredentials) return cachedCredentials;

  let raw = null;
  if (process.env.GOOGLE_CREDENTIALS_FILE) {
    raw = fs.readFileSync(process.env.GOOGLE_CREDENTIALS_FILE, "utf-8");
  } else if (process.env.GOOGLE_CREDENTIALS) {
    raw = process.env.GOOGLE_CREDENTIALS;
  }

  if (!raw) {
    throw new Error("GOOGLE_CREDENTIALS ou GOOGLE_CREDENTIALS_FILE nao configurados.");
  }

  raw = raw.trim();
  if (raw.startsWith("'") || raw.startsWith('"')) {
    raw = raw.slice(1, -1);
  }

  let creds;
  try {
    creds = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Erro ao fazer parse das credenciais: ${err.message}`);
  }

  if (creds.private_key && typeof creds.private_key === "string") {
    creds.private_key = creds.private_key.replace(/\\n/g, "\n");
  }

  cachedCredentials = creds;
  return creds;
}

function base64url(input) {
  return Buffer.from(input).toString("base64url");
}

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && now < tokenExpiresAt - 60) {
    return cachedToken;
  }

  const creds = loadCredentials();
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      iss: creds.client_email,
      scope: SCOPE,
      aud: creds.token_uri || TOKEN_URI,
      iat: now,
      exp: now + 3600,
    })
  );

  const signature = crypto
    .sign("RSA-SHA256", Buffer.from(`${header}.${payload}`), creds.private_key)
    .toString("base64url");

  const assertion = `${header}.${payload}.${signature}`;

  const res = await fetch(creds.token_uri || TOKEN_URI, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Falha ao obter token (${res.status}): ${text}`);
  }

  const json = await res.json();
  cachedToken = json.access_token;
  tokenExpiresAt = now + (json.expires_in || 3600);
  return cachedToken;
}

export async function listPdfFiles() {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) {
    throw new Error("GOOGLE_DRIVE_FOLDER_ID nao configurado.");
  }

  const token = await getAccessToken();
  const files = [];
  let pageToken = null;

  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and mimeType = 'application/pdf' and trashed = false`,
      fields: "nextPageToken, files(id, name, modifiedTime, size)",
      pageSize: "1000",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Falha ao listar arquivos (${res.status}): ${text}`);
    }

    const data = await res.json();
    files.push(...(data.files || []));
    pageToken = data.nextPageToken || null;
  } while (pageToken);

  return files;
}

export async function downloadPdf(fileId) {
  const token = await getAccessToken();
  const params = new URLSearchParams({ alt: "media", supportsAllDrives: "true" });

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?${params.toString()}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Falha ao baixar PDF (${res.status}): ${text}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function getFileMeta(fileId) {
  const token = await getAccessToken();
  const params = new URLSearchParams({
    fields: "id, name, modifiedTime, size",
    supportsAllDrives: "true",
  });

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?${params.toString()}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Falha ao obter metadados (${res.status}): ${text}`);
  }

  return res.json();
}

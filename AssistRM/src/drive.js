import { google } from "googleapis";

function buildAuth() {
  const scopes = ["https://www.googleapis.com/auth/drive.readonly"];

  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    let raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON.trim();
    if (raw.startsWith("'") || raw.startsWith('"')) {
      raw = raw.slice(1, -1);
    }
    const credentials = JSON.parse(raw);
    if (credentials.private_key) {
      credentials.private_key = credentials.private_key.replace(/\\n/g, "\n");
    }
    return new google.auth.GoogleAuth({ credentials, scopes });
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      scopes,
    });
  }

  throw new Error(
    "Credenciais do Google nao configuradas. Defina GOOGLE_SERVICE_ACCOUNT_JSON ou GOOGLE_APPLICATION_CREDENTIALS."
  );
}

let driveClient = null;

function getDrive() {
  if (!driveClient) {
    const auth = buildAuth();
    driveClient = google.drive({ version: "v3", auth });
  }
  return driveClient;
}

export async function listPdfFiles() {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) {
    throw new Error("GOOGLE_DRIVE_FOLDER_ID nao configurado.");
  }

  const drive = getDrive();
  const files = [];
  let pageToken = null;

  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and mimeType = 'application/pdf' and trashed = false`,
      fields: "nextPageToken, files(id, name, modifiedTime, size)",
      pageSize: 1000,
      pageToken: pageToken || undefined,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    files.push(...(res.data.files || []));
    pageToken = res.data.nextPageToken;
  } while (pageToken);

  return files;
}

export async function downloadPdf(fileId) {
  const drive = getDrive();
  const res = await drive.files.get(
    { fileId, alt: "media", supportsAllDrives: true },
    { responseType: "arraybuffer" }
  );
  return Buffer.from(res.data);
}

export async function getFileMeta(fileId) {
  const drive = getDrive();
  const res = await drive.files.get({
    fileId,
    fields: "id, name, modifiedTime, size",
    supportsAllDrives: true,
  });
  return res.data;
}

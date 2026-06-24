import { google } from "googleapis";
import fs from "fs";
import path from "path";

let driveClient = null;

function getDrive() {
  if (!driveClient) {
    let credenciaisGoogle = null;

    if (process.env.GOOGLE_CREDENTIALS_FILE) {
      credenciaisGoogle = fs.readFileSync(process.env.GOOGLE_CREDENTIALS_FILE, "utf-8");
    } else if (process.env.GOOGLE_CREDENTIALS) {
      credenciaisGoogle = process.env.GOOGLE_CREDENTIALS;
    }

    if (!credenciaisGoogle) {
      throw new Error(
        "GOOGLE_CREDENTIALS ou GOOGLE_CREDENTIALS_FILE nao configurados."
      );
    }

    const pastaId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (!pastaId) {
      throw new Error("GOOGLE_DRIVE_FOLDER_ID nao configurado.");
    }

    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(credenciaisGoogle),
      scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    });

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

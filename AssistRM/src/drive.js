import { google } from "googleapis";

let driveClient = null;

function getDrive() {
  if (!driveClient) {
    const credenciaisGoogle = process.env.GOOGLE_CREDENTIALS;
    const pastaId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    if (!credenciaisGoogle || !pastaId) {
      throw new Error("GOOGLE_CREDENTIALS ou GOOGLE_DRIVE_FOLDER_ID nao configurados.");
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

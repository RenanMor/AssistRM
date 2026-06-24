import { createRequire } from "module";
import { downloadPdf } from "./drive.js";

const require = createRequire(import.meta.url);
const PDFJS = require("pdf-parse/lib/pdf.js/v2.0.550/build/pdf.js");

const textCache = new Map();
const CACHE_TTL_MS = 1000 * 60 * 30;

async function parsePdf(buffer) {
  const doc = await PDFJS.getDocument({
    data: new Uint8Array(buffer),
    disableWorker: true,
  });
  const numPages = doc.numPages;
  const parts = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    let lastY = null;
    let pageText = "";
    for (const item of content.items) {
      if (lastY === item.transform[5] || lastY === null) {
        pageText += item.str;
      } else {
        pageText += "\n" + item.str;
      }
      lastY = item.transform[5];
    }
    parts.push(pageText);
  }

  if (typeof doc.destroy === "function") {
    await doc.destroy();
  }

  return parts.join("\n\n").trim();
}

export async function extractPdfText(fileId) {
  const cached = textCache.get(fileId);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.text;
  }

  const buffer = await downloadPdf(fileId);
  const text = await parsePdf(buffer);

  textCache.set(fileId, { text, at: Date.now() });
  return text;
}

export async function getPdfBuffer(fileId) {
  return downloadPdf(fileId);
}

/**
 * Step: Download file from Google Drive
 * Extracts the file ID from various Google Drive URL formats
 * and downloads the file content.
 *
 * Supports: drive.google.com/file/d/, docs.google.com/spreadsheets/d/, etc.
 */

export interface GDriveFile {
  buffer: Buffer;
  fileName: string;
  fileId: string;
  contentType: string;
  extension: string;
}

const FILE_ID_PATTERNS = [
  /\/file\/d\/([a-zA-Z0-9_-]+)/,
  /[?&]id=([a-zA-Z0-9_-]+)/,
  /\/(document|presentation|spreadsheets|drawings)\/d\/([a-zA-Z0-9_-]+)/,
];

export function extractGDriveFileId(url: string): string | null {
  for (const rx of FILE_ID_PATTERNS) {
    const m = rx.exec(url);
    if (m) return m[m.length === 3 ? 2 : 1];
  }
  return null;
}

function guessExtension(contentType: string, url: string): string {
  // URL-based hints
  if (url.includes("/spreadsheets/")) return "xlsx";
  if (url.includes("/document/")) return "pdf";
  if (url.includes("/presentation/")) return "pdf";

  // Content-type mapping
  const map: Record<string, string> = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/vnd.ms-excel": "xls",
    "text/csv": "csv",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
    "image/png": "png",
    "image/jpeg": "jpg",
  };
  return map[contentType] || "bin";
}

export async function downloadGDrive(url: string): Promise<GDriveFile> {
  const fileId = extractGDriveFileId(url);
  if (!fileId) throw new Error(`Cannot extract Google Drive file ID from: ${url}`);

  console.log(`[download-gdrive] Downloading fileId=${fileId}`);

  // Google Sheets → export as xlsx
  if (url.includes("/spreadsheets/")) {
    const exportUrl = `https://docs.google.com/spreadsheets/d/${fileId}/export?format=xlsx`;
    const res = await fetch(exportUrl, { redirect: "follow" });
    if (res.ok) {
      const buffer = Buffer.from(await res.arrayBuffer());
      console.log(`[download-gdrive] Sheets export: ${(buffer.length / 1024).toFixed(0)}KB`);
      return { buffer, fileName: `gdrive-${fileId}.xlsx`, fileId, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", extension: "xlsx" };
    }
  }

  // Google Docs/Slides → export as PDF
  if (url.includes("/document/") || url.includes("/presentation/")) {
    const type = url.includes("/document/") ? "document" : "presentation";
    const exportUrl = `https://docs.google.com/${type === "document" ? "document" : "presentation"}/d/${fileId}/export?format=pdf`;
    const res = await fetch(exportUrl, { redirect: "follow" });
    if (res.ok) {
      const buffer = Buffer.from(await res.arrayBuffer());
      console.log(`[download-gdrive] ${type} export: ${(buffer.length / 1024).toFixed(0)}KB`);
      return { buffer, fileName: `gdrive-${fileId}.pdf`, fileId, contentType: "application/pdf", extension: "pdf" };
    }
  }

  // Generic file download
  const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
  const res = await fetch(downloadUrl, { redirect: "follow" });
  if (!res.ok) {
    // Fallback
    const res2 = await fetch(`https://drive.google.com/uc?id=${fileId}&export=download`, { redirect: "follow" });
    if (!res2.ok) throw new Error(`Google Drive download failed: ${res2.status}`);
    const buffer = Buffer.from(await res2.arrayBuffer());
    const ct = res2.headers.get("content-type") || "application/octet-stream";
    const ext = guessExtension(ct, url);
    return { buffer, fileName: `gdrive-${fileId}.${ext}`, fileId, contentType: ct, extension: ext };
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  const ct = res.headers.get("content-type") || "application/octet-stream";
  const ext = guessExtension(ct, url);
  console.log(`[download-gdrive] Downloaded: ${(buffer.length / 1024).toFixed(0)}KB (${ct})`);
  return { buffer, fileName: `gdrive-${fileId}.${ext}`, fileId, contentType: ct, extension: ext };
}

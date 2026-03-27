/**
 * Step: Extract Notion page content
 * Uses the unofficial notion.so/api/v3/loadPageChunk API (works on public pages)
 * Ported from N8N "Code in JavaScript" node
 */

export interface NotionFile {
  name: string;
  url: string;
  size: string;
  buffer: Buffer;
  extension: string;
  mime: string;
}

export interface NotionResult {
  markdown: string;
  html: string;
  title: string;
  files: NotionFile[];
}

const NOTION_HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
};

export async function extractNotion(notionUrl: string): Promise<NotionResult> {
  console.log(`[extract-notion] Fetching ${notionUrl}`);

  const pageId = extractPageId(notionUrl);
  if (!pageId) throw new Error(`[extract-notion] Cannot extract page ID from: ${notionUrl}`);

  const formattedId = formatUUID(pageId);
  console.log(`[extract-notion] Page ID: ${formattedId}`);

  const res = await fetch("https://www.notion.so/api/v3/loadPageChunk", {
    method: "POST",
    headers: NOTION_HEADERS,
    body: JSON.stringify({
      pageId: formattedId,
      limit: 200,
      cursor: { stack: [] },
      chunkNumber: 0,
      verticalColumns: false,
    }),
  });

  if (!res.ok) throw new Error(`[extract-notion] API error: ${res.status}`);

  const data = (await res.json()) as { recordMap?: { block?: Record<string, NotionBlock> } };
  const blocks = data.recordMap?.block;
  if (!blocks) throw new Error("[extract-notion] No recordMap found");

  const pageBlock = Object.values(blocks).find((b) => b.value?.type === "page" && b.value?.alive);
  if (!pageBlock) throw new Error("[extract-notion] Page block not found");

  const pageTitle = extractText(pageBlock.value.properties?.title);
  const contentIds: string[] = pageBlock.value.content || [];

  const markdown = `# ${pageTitle}\n\n` + processBlocksMd(contentIds, blocks);
  const html = `<h1>${esc(pageTitle)}</h1>\n` + processBlocksHtml(contentIds, blocks);

  // Download file attachments (xlsx, pdf, csv, etc.)
  const files = await downloadFileBlocks(blocks);

  console.log(`[extract-notion] Extracted ${markdown.length} chars from "${pageTitle}", ${files.length} file(s)`);
  return { markdown, html, title: pageTitle, files };
}

// --- Types ---
interface NotionBlock {
  value: {
    id: string;
    type: string;
    alive?: boolean;
    properties?: Record<string, any[][]>;
    format?: Record<string, any>;
    content?: string[];
  };
}

// --- File attachment download ---
const MIME_MAP: Record<string, string> = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xls: "application/vnd.ms-excel",
  csv: "text/csv",
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

async function downloadFileBlocks(blocks: Record<string, NotionBlock>): Promise<NotionFile[]> {
  const fileBlocks = Object.values(blocks).filter(
    (b) => b.value?.alive && b.value?.type === "file" && b.value?.properties?.source?.[0]?.[0]
  );
  if (fileBlocks.length === 0) return [];

  const files: NotionFile[] = [];
  for (const fb of fileBlocks) {
    const v = fb.value;
    const source: string = v.properties!.source[0][0];
    const title: string = extractText(v.properties!.title) || source.split("/").pop() || "file";
    const size: string = v.properties?.size?.[0]?.[0] || "";
    const ext = title.split(".").pop()?.toLowerCase() || "";

    try {
      // Get signed download URL from Notion
      const signedRes = await fetch("https://www.notion.so/api/v3/getSignedFileUrls", {
        method: "POST",
        headers: NOTION_HEADERS,
        body: JSON.stringify({
          urls: [{
            url: source,
            permissionRecord: { table: "block", id: v.id },
          }],
        }),
      });
      const signedData = (await signedRes.json()) as { signedUrls?: (string | null)[] };
      const downloadUrl = signedData.signedUrls?.[0];
      if (!downloadUrl) {
        console.warn(`[extract-notion] No signed URL for "${title}" — skipping`);
        continue;
      }

      // Download the file
      const fileRes = await fetch(downloadUrl);
      if (!fileRes.ok) {
        console.warn(`[extract-notion] Download failed for "${title}": ${fileRes.status}`);
        continue;
      }
      const buffer = Buffer.from(await fileRes.arrayBuffer());
      const mime = MIME_MAP[ext] || fileRes.headers.get("content-type") || "application/octet-stream";

      console.log(`[extract-notion] Downloaded "${title}" (${(buffer.length / 1024).toFixed(0)}KB)`);
      files.push({ name: title, url: downloadUrl, size, buffer, extension: ext, mime });
    } catch (err: any) {
      console.warn(`[extract-notion] Failed to download "${title}": ${err.message}`);
    }
  }
  return files;
}

// --- ID extraction ---
function extractPageId(url: string): string | null {
  const cleaned = url.split("?")[0].split("#")[0];
  const match = cleaned.match(/([a-f0-9]{32})$/i) || cleaned.match(/([a-f0-9-]{36})$/i);
  if (match) return match[1].replace(/-/g, "");
  const parts = cleaned.split("/").pop()?.split("-");
  if (parts) {
    const last = parts[parts.length - 1];
    if (/^[a-f0-9]{32}$/i.test(last)) return last;
  }
  return null;
}

function formatUUID(id: string): string {
  const clean = id.replace(/-/g, "");
  return `${clean.slice(0, 8)}-${clean.slice(8, 12)}-${clean.slice(12, 16)}-${clean.slice(16, 20)}-${clean.slice(20)}`;
}

// --- Text extraction ---
function extractText(titleArr: any[][] | undefined): string {
  if (!titleArr || !Array.isArray(titleArr)) return "";
  return titleArr.map((item) => (Array.isArray(item) ? item[0] || "" : String(item || ""))).join("");
}

function extractMd(titleArr: any[][] | undefined): string {
  if (!titleArr || !Array.isArray(titleArr)) return "";
  return titleArr
    .map((item) => {
      if (!Array.isArray(item)) return String(item || "");
      let text = item[0] || "";
      const anns = item[1];
      if (anns && Array.isArray(anns)) {
        for (const a of anns) {
          if (!Array.isArray(a)) continue;
          if (a[0] === "b") text = `**${text}**`;
          else if (a[0] === "i") text = `*${text}*`;
          else if (a[0] === "s") text = `~~${text}~~`;
          else if (a[0] === "c") text = `\`${text}\``;
          else if (a[0] === "a") text = `[${text}](${a[1]})`;
        }
      }
      return text;
    })
    .join("");
}

function extractHtml(titleArr: any[][] | undefined): string {
  if (!titleArr || !Array.isArray(titleArr)) return "";
  return titleArr
    .map((item) => {
      if (!Array.isArray(item)) return esc(String(item || ""));
      let text = esc(item[0] || "");
      const anns = item[1];
      if (anns && Array.isArray(anns)) {
        for (const a of anns) {
          if (!Array.isArray(a)) continue;
          if (a[0] === "b") text = `<strong>${text}</strong>`;
          else if (a[0] === "i") text = `<em>${text}</em>`;
          else if (a[0] === "s") text = `<del>${text}</del>`;
          else if (a[0] === "c") text = `<code>${text}</code>`;
          else if (a[0] === "a") text = `<a href="${esc(a[1])}">${text}</a>`;
        }
      }
      return text;
    })
    .join("");
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// --- Block processing (Markdown) ---
function processBlocksMd(ids: string[], blocks: Record<string, NotionBlock>, level = 0): string {
  let md = "";
  for (const id of ids) {
    const b = blocks[id];
    if (!b?.value?.alive) continue;
    const v = b.value;
    const t = extractMd(v.properties?.title);
    const indent = "  ".repeat(level);

    switch (v.type) {
      case "text": md += t ? `${indent}${t}\n\n` : "\n"; break;
      case "header": md += `# ${t}\n\n`; break;
      case "sub_header": md += `## ${t}\n\n`; break;
      case "sub_sub_header": md += `### ${t}\n\n`; break;
      case "bulleted_list": md += `${indent}- ${t}\n`; break;
      case "numbered_list": md += `${indent}1. ${t}\n`; break;
      case "to_do": {
        const checked = v.properties?.checked?.[0]?.[0] === "Yes" ? "x" : " ";
        md += `${indent}- [${checked}] ${t}\n`; break;
      }
      case "quote": md += `> ${t}\n\n`; break;
      case "callout": {
        const emoji = v.properties?.emoji?.[0]?.[0] || "💡";
        md += `> ${emoji} ${t}\n\n`; break;
      }
      case "divider": md += "---\n\n"; break;
      case "code": {
        const lang = v.properties?.language?.[0]?.[0] || "";
        md += `\`\`\`${lang}\n${extractText(v.properties?.title)}\n\`\`\`\n\n`; break;
      }
      case "table": md += buildTableMd(id, blocks); break;
      case "file": {
        const fileName = extractText(v.properties?.title) || "fichier";
        md += `${indent}📎 ${fileName}\n\n`; break;
      }
      default: if (t) md += `${indent}${t}\n\n`;
    }

    if (v.content && v.type !== "table") {
      md += processBlocksMd(v.content, blocks, level + 1);
    }
  }
  return md;
}

// --- Block processing (HTML) ---
function processBlocksHtml(ids: string[], blocks: Record<string, NotionBlock>): string {
  let html = "";
  let inUl = false, inOl = false;

  for (const id of ids) {
    const b = blocks[id];
    if (!b?.value?.alive) continue;
    const v = b.value;
    const t = extractHtml(v.properties?.title);

    if (v.type !== "bulleted_list" && inUl) { html += "</ul>\n"; inUl = false; }
    if (v.type !== "numbered_list" && inOl) { html += "</ol>\n"; inOl = false; }

    switch (v.type) {
      case "text": if (t) html += `<p>${t}</p>\n`; break;
      case "header": html += `<h1>${t}</h1>\n`; break;
      case "sub_header": html += `<h2>${t}</h2>\n`; break;
      case "sub_sub_header": html += `<h3>${t}</h3>\n`; break;
      case "bulleted_list":
        if (!inUl) { html += "<ul>\n"; inUl = true; }
        html += `<li>${t}</li>\n`; break;
      case "numbered_list":
        if (!inOl) { html += "<ol>\n"; inOl = true; }
        html += `<li>${t}</li>\n`; break;
      case "quote": html += `<blockquote>${t}</blockquote>\n`; break;
      case "callout": html += `<div class="callout">${t}</div>\n`; break;
      case "divider": html += "<hr>\n"; break;
      case "table": html += buildTableHtml(id, blocks); break;
      case "file": {
        const fileName = extractText(v.properties?.title) || "fichier";
        html += `<p>📎 ${esc(fileName)}</p>\n`; break;
      }
      default: if (t) html += `<p>${t}</p>\n`;
    }

    if (v.content && v.type !== "table") {
      html += processBlocksHtml(v.content, blocks);
    }
  }
  if (inUl) html += "</ul>\n";
  if (inOl) html += "</ol>\n";
  return html;
}

// --- Table builders ---
function buildTableMd(tableId: string, blocks: Record<string, NotionBlock>): string {
  const tb = blocks[tableId]?.value;
  if (!tb?.content) return "";
  const colOrder: string[] = tb.format?.table_block_column_order || [];
  if (!colOrder.length) return "";

  const rows = tb.content.map((rid) => blocks[rid]?.value).filter((r) => r?.type === "table_row");
  if (!rows.length) return "";

  let md = "\n";
  rows.forEach((row, i) => {
    const cells = colOrder.map((col) => (extractMd(row.properties?.[col]) || "").replace(/\|/g, "\\|"));
    md += `| ${cells.join(" | ")} |\n`;
    if (i === 0) md += `| ${colOrder.map(() => "---").join(" | ")} |\n`;
  });
  return md + "\n";
}

function buildTableHtml(tableId: string, blocks: Record<string, NotionBlock>): string {
  const tb = blocks[tableId]?.value;
  if (!tb?.content) return "";
  const colOrder: string[] = tb.format?.table_block_column_order || [];
  if (!colOrder.length) return "";

  const rows = tb.content.map((rid) => blocks[rid]?.value).filter((r) => r?.type === "table_row");
  if (!rows.length) return "";

  const hasHeader = tb.format?.table_block_column_header || false;
  let html = "<table>\n";
  rows.forEach((row, i) => {
    const tag = hasHeader && i === 0 ? "th" : "td";
    if (i === 0 && hasHeader) html += "<thead>\n";
    if (i === 1 && hasHeader) html += "</thead>\n<tbody>\n";
    html += "<tr>" + colOrder.map((col) => `<${tag}>${extractHtml(row.properties?.[col])}</${tag}>`).join("") + "</tr>\n";
  });
  if (hasHeader && rows.length > 1) html += "</tbody>\n";
  html += "</table>\n";
  return html;
}

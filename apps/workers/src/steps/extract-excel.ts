/**
 * Step: Extract Excel content
 * Ported from N8N nodes "Extract from File" + "Extract All excel sheets" + "Excel recap"
 *
 * 1. Reads all sheets from an Excel buffer
 * 2. Formats each sheet as readable text with headers
 * 3. Parses financial data (P&L, Cash Flow) into structured metrics
 * 4. Returns a compact LLM-friendly summary
 */

import * as XLSX from "xlsx";

export interface ExcelResult {
  extractedText: string;
  llmPrompt: string;
  metricsForDb: ExcelMetric[];
  sheetCount: number;
  rowCount: number;
}

export interface ExcelMetric {
  metric_key: string;
  metric_value: string;
  metric_type: string;
  report_period: string;
}

const MONTHS_MAP: Record<string, string> = {
  Jan: "01", Fév: "02", Mar: "03", Avr: "04",
  Mai: "05", Jun: "06", Jul: "07", Aoû: "08",
  Sep: "09", Oct: "10", Nov: "11", Déc: "12",
};

const MONTHS_DISPLAY: Record<string, string> = {
  "01": "January", "02": "February", "03": "March", "04": "April",
  "05": "May", "06": "June", "07": "July", "08": "August",
  "09": "September", "10": "October", "11": "November", "12": "December",
};

// Limites mémoire pour éviter OOM sur les gros fichiers
const MAX_SHEETS = 10;
const MAX_ROWS_PER_SHEET = 500;
const MAX_TOTAL_ROWS = 2000;

export function extractExcel(buffer: Buffer, fileName?: string): ExcelResult {
  const label = fileName || "spreadsheet.xlsx";
  console.log(`[extract-excel] Processing ${label} (${(buffer.length / 1024).toFixed(0)}KB)`);

  const workbook = XLSX.read(buffer, { type: "buffer" });
  const allRows: Record<string, unknown>[] = [];
  const sheetTexts: string[] = [];

  const sheetsToProcess = workbook.SheetNames.slice(0, MAX_SHEETS);
  if (workbook.SheetNames.length > MAX_SHEETS) {
    console.log(`[extract-excel] Limiting to ${MAX_SHEETS}/${workbook.SheetNames.length} sheets`);
  }

  let totalRows = 0;

  for (const sheetName of sheetsToProcess) {
    if (totalRows >= MAX_TOTAL_ROWS) {
      console.log(`[extract-excel] Reached ${MAX_TOTAL_ROWS} total rows, skipping remaining sheets`);
      break;
    }

    const sheet = workbook.Sheets[sheetName];
    let rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    if (rows.length === 0) continue;

    if (rows.length > MAX_ROWS_PER_SHEET) {
      console.log(`[extract-excel] Sheet "${sheetName}": truncating ${rows.length} → ${MAX_ROWS_PER_SHEET} rows`);
      rows = rows.slice(0, MAX_ROWS_PER_SHEET);
    }

    allRows.push(...rows);
    totalRows += rows.length;

    // Format sheet as readable text
    const headers = Object.keys(rows[0]);
    const lines = [`\n### ${sheetName}`, headers.join(" | ")];
    for (const row of rows) {
      const vals = headers.map((h) => formatCell(row[h]));
      lines.push(vals.join(" | "));
    }
    sheetTexts.push(lines.join("\n"));
  }

  const extractedText = sheetTexts.join("\n\n");

  // Parse financial structure
  const { llmPrompt, metricsForDb } = parseFinancialData(allRows);

  console.log(`[extract-excel] Extracted ${workbook.SheetNames.length} sheets, ${allRows.length} rows, ${metricsForDb.length} metrics`);

  return {
    extractedText,
    llmPrompt: llmPrompt || extractedText,
    metricsForDb,
    sheetCount: workbook.SheetNames.length,
    rowCount: allRows.length,
  };
}

// --- Helpers ---

function formatCell(val: unknown): string {
  if (val === null || val === undefined || val === "") return "";
  if (typeof val === "number") {
    if (Math.abs(val) < 2 && Math.abs(val) > 0 && !Number.isInteger(val)) {
      return (val * 100).toFixed(1) + "%";
    }
    if (Math.abs(val) >= 1000) return "€" + Math.round(val).toLocaleString("fr-FR");
    return String(val);
  }
  return String(val);
}

function excelDateToLabel(serial: number): string {
  if (serial < 40000) return String(serial);
  const date = new Date((serial - 25569) * 86400000);
  const months = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
  return `${months[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

function toSnakeCase(label: string): string {
  return label.toLowerCase().replace(/[()]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

// --- Financial parsing (ported from N8N "Excel recap") ---

interface ParsedLine {
  monthly: Record<string, Record<string, unknown>>;
  ytd: Record<string, unknown>;
}

function parseDataLine(line: string): ParsedLine {
  const result: ParsedLine = { monthly: {}, ytd: {} };
  for (const seg of line.split(" | ")) {
    const trimmed = seg.trim();
    const ytdMatch = trimmed.match(/^YTD\s+(ACTUAL|BUDGET|DELTA):\s*(.+)$/);
    if (ytdMatch) {
      result.ytd[ytdMatch[1].toLowerCase()] = parseValue(ytdMatch[2]);
      continue;
    }
    const monthMatch = trimmed.match(/^(\w+)\s+(\d{4})\s+(ACTUAL|BUDGET|DELTA):\s*(.+)$/);
    if (monthMatch) {
      const monthNum = MONTHS_MAP[monthMatch[1]];
      if (!monthNum) continue;
      const key = `${monthMatch[2]}-${monthNum}`;
      if (!result.monthly[key]) result.monthly[key] = {};
      result.monthly[key][monthMatch[3].toLowerCase()] = parseValue(monthMatch[4]);
    }
  }
  return result;
}

function parseValue(raw: string): number | string | null {
  if (!raw) return null;
  raw = raw.trim();
  if (raw.endsWith("%")) return raw;
  const cleaned = raw.replace("€", "").replace(/\s/g, "");
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? raw : num;
}

function parseFinancialData(rows: Record<string, unknown>[]): {
  llmPrompt: string;
  metricsForDb: ExcelMetric[];
} {
  if (rows.length < 3) return { llmPrompt: "", metricsForDb: [] };

  const allKeys = Object.keys(rows[0] || {}).sort((a, b) => {
    const numA = parseInt(a.replace("__EMPTY_", "").replace("__EMPTY", "0")) || 0;
    const numB = parseInt(b.replace("__EMPTY_", "").replace("__EMPTY", "0")) || 0;
    return numA - numB;
  });

  // Build column headers from first 2 rows
  const headerRow = rows[0] || {};
  const dateRow = rows[1] || {};
  const columnHeaders: Record<string, string> = {};

  for (const key of allKeys) {
    if (key === "__EMPTY") { columnHeaders[key] = "Poste"; continue; }
    const headerVal = String(headerRow[key] || "");
    const dateVal = dateRow[key];
    let dateLabel = "";
    if (typeof dateVal === "number" && (dateVal as number) > 40000) {
      dateLabel = excelDateToLabel(dateVal as number);
    } else if (typeof dateVal === "string") dateLabel = dateVal;

    columnHeaders[key] = dateLabel && headerVal ? `${dateLabel} ${headerVal}` : headerVal || key;
  }

  // Format data rows into sections
  const dataRows = rows.slice(2);
  const sections: string[] = [];
  const kpis: Record<string, ParsedLine> = {};

  for (const row of dataRows) {
    const rowLabel = row["__EMPTY"];
    if (!rowLabel || typeof rowLabel !== "string" || !rowLabel.trim()) continue;

    const isMainKPI = String(rowLabel).includes("TOTAL") || String(rowLabel).includes("EBITDA") ||
      String(rowLabel).includes("Gross Margin") || String(rowLabel).includes("CASH FLOW") ||
      String(rowLabel).includes("FREE CASH FLOW");

    const values: string[] = [];
    for (const key of allKeys) {
      if (key === "__EMPTY") continue;
      const val = row[key];
      if (val === undefined || val === null || val === "") continue;
      const header = columnHeaders[key] || key;
      values.push(`${header}: ${formatCell(val)}`);
    }

    if (values.length > 0) {
      const prefix = isMainKPI ? "▶ " : "  ";
      const line = `${prefix}${rowLabel}\n    ${values.join(" | ")}`;
      sections.push(line);

      if (isMainKPI) {
        kpis[rowLabel] = parseDataLine(values.join(" | "));
      }
    }
  }

  // Build metrics for DB
  const metricsForDb: ExcelMetric[] = [];
  const allMonths = new Set<string>();
  for (const data of Object.values(kpis)) {
    Object.keys(data.monthly).forEach((m) => allMonths.add(m));
  }
  const sortedMonths = [...allMonths].sort();
  const lastMonth = sortedMonths[sortedMonths.length - 1] || "";
  const lastYear = lastMonth ? lastMonth.split("-")[0] : new Date().getFullYear().toString();
  const reportPeriodYTD = `${lastYear} YTD`;

  for (const [kpiLabel, data] of Object.entries(kpis)) {
    const baseKey = toSnakeCase(kpiLabel);
    if (data.ytd.actual !== undefined) {
      metricsForDb.push({ metric_key: baseKey, metric_value: String(data.ytd.actual), metric_type: "currency", report_period: reportPeriodYTD });
    }
    for (const [month, values] of Object.entries(data.monthly)) {
      const [year, monthNum] = month.split("-");
      const monthDisplay = `${MONTHS_DISPLAY[monthNum]} ${year}`;
      if (values.actual !== undefined) {
        metricsForDb.push({ metric_key: `${baseKey}_monthly`, metric_value: String(values.actual), metric_type: "currency", report_period: monthDisplay });
      }
    }
  }

  // Build LLM prompt (compact summary)
  const HEADER = "## RÉSUMÉ FINANCIER (données Excel)\n";
  let llmPrompt = HEADER;
  const keyKPIs = ["TOTAL REVENUES", "Gross Margin", "EBITDA", "FREE CASH FLOW OF THE PERIOD"];
  for (const kpiName of keyKPIs) {
    const kpi = kpis[kpiName];
    if (kpi?.ytd?.actual !== undefined) {
      const budgetNote = kpi.ytd.budget && typeof kpi.ytd.budget === "number" && kpi.ytd.budget !== 0
        ? ` (${Math.round(((kpi.ytd.actual as number) / (kpi.ytd.budget as number) - 1) * 100)}% vs budget)`
        : "";
      llmPrompt += `- ${kpiName}: ${formatCell(kpi.ytd.actual)}${budgetNote}\n`;
    }
  }

  // Si le prompt n'a que le header (pas de KPIs reconnus), retourner vide
  // pour que extractExcel fallback sur extractedText (le dump brut des cellules)
  const hasKPIs = llmPrompt.length > HEADER.length;
  if (!hasKPIs) llmPrompt = "";

  console.log(`[extract-excel] Generated ${metricsForDb.length} metrics, LLM prompt ${llmPrompt.length} chars`);
  return { llmPrompt, metricsForDb };
}

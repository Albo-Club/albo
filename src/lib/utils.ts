import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function displayCompanyName(name?: string | null) {
  if (!name) return "";

  return name
    // "Auxicare - 23/12/2025" / "Auxicare — 23-12-2025"
    .replace(/\s*[-–—]\s*\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}\s*$/u, "")
    // "Auxicare - 2025-12-23"
    .replace(/\s*[-–—]\s*\d{4}[\/.-]\d{1,2}[\/.-]\d{1,2}\s*$/u, "")
    // "Auxicare (23/12/2025)"
    .replace(/\s*\(\s*\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}\s*\)\s*$/u, "")
    .trim();
}

/**
 * Format a raw numeric string into human-readable format (e.g., "1.5M€", "500k€")
 */
export function formatAmount(value: string | null): string {
  if (!value) return '';
  
  // Already formatted
  if (value.includes('€') || value.includes('k') || value.includes('M')) {
    return value;
  }
  
  const num = parseFloat(value.replace(/[^\d.-]/g, ''));
  if (isNaN(num)) return value;
  
  if (num >= 1000000) {
    const millions = num / 1000000;
    return millions % 1 === 0 ? `${millions}M€` : `${millions.toFixed(1)}M€`;
  }
  if (num >= 1000) {
    const thousands = num / 1000;
    return thousands % 1 === 0 ? `${thousands}k€` : `${thousands.toFixed(0)}k€`;
  }
  return `${num}€`;
}

/**
 * Parse formatted amount string back into raw numeric string
 */
export function parseAmount(formatted: string): string {
  if (!formatted) return '';
  
  const cleaned = formatted.trim().replace(/\s/g, '');
  
  // Handle millions
  const millionMatch = cleaned.match(/^([\d.]+)\s*M\s*€?$/i);
  if (millionMatch) {
    return String(parseFloat(millionMatch[1]) * 1000000);
  }
  
  // Handle thousands
  const thousandMatch = cleaned.match(/^([\d.]+)\s*k\s*€?$/i);
  if (thousandMatch) {
    return String(parseFloat(thousandMatch[1]) * 1000);
  }
  
  // Handle plain number with or without €
  const plainMatch = cleaned.match(/^([\d.]+)\s*€?$/);
  if (plainMatch) {
    return plainMatch[1];
  }
  
  return formatted;
}

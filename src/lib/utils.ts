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

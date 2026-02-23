const MONTH_MAP: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

const QUARTER_MAP: Record<string, number> = {
  q1: 2, q2: 5, q3: 8, q4: 11,
};

const SEASON_MAP: Record<string, number> = {
  winter: 1, spring: 4, summer: 7, fall: 10, autumn: 10,
};

export function parseReportPeriodToSortDate(period: string | null): Date {
  if (!period) return new Date(0);
  const p = period.trim().toLowerCase();

  for (const [monthName, monthIndex] of Object.entries(MONTH_MAP)) {
    const match = p.match(new RegExp(`^${monthName}\\s+(\\d{4})$`));
    if (match) return new Date(parseInt(match[1]), monthIndex, 1);
  }

  for (const [quarter, monthIndex] of Object.entries(QUARTER_MAP)) {
    const match = p.match(new RegExp(`^${quarter}\\s+(\\d{4})$`));
    if (match) return new Date(parseInt(match[1]), monthIndex, 1);
  }

  const rangeMatch = p.match(/^(\w+)\s*-\s*(\w+)\s+(\d{4})$/);
  if (rangeMatch) {
    const endPart = rangeMatch[2].trim();
    const year = parseInt(rangeMatch[3]);
    if (MONTH_MAP[endPart] !== undefined) return new Date(year, MONTH_MAP[endPart], 1);
    if (QUARTER_MAP[endPart] !== undefined) return new Date(year, QUARTER_MAP[endPart], 1);
  }

  const yearRangeMatch = p.match(/^(\d{4})\s*-\s*(\d{4})$/);
  if (yearRangeMatch) return new Date(parseInt(yearRangeMatch[2]), 11, 31);

  const yearOnlyMatch = p.match(/^(\d{4})$/);
  if (yearOnlyMatch) return new Date(parseInt(yearOnlyMatch[1]), 11, 31);

  for (const [season, monthIndex] of Object.entries(SEASON_MAP)) {
    const match = p.match(new RegExp(`^${season}\\s+(\\d{4})$`));
    if (match) return new Date(parseInt(match[1]), monthIndex, 1);
  }

  return new Date(0);
}

export function isPeriodRange(period: string | null): boolean {
  if (!period) return false;
  const p = period.trim().toLowerCase();
  return (
    p.includes(' - ') ||
    /^q\d/i.test(p) ||
    /^(winter|spring|summer|fall|autumn)/i.test(p) ||
    /^\d{4}$/.test(p)
  );
}

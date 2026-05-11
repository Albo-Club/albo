import { differenceInMonths, parseISO } from "date-fns";
import { getReportPeriodEndDate } from "./reportPeriodParser";

export const STALE_THRESHOLD_MONTHS = 3;

export interface LatestReportLike {
  report_date: string | null;
  report_period: string | null;
  processing_status: string | null;
  is_duplicate: boolean;
}

export interface StaleInfo {
  isStale: boolean;
  monthsSinceReceived: number | null;
  monthsSinceCoverageEnd: number | null;
  coverageEnd: Date | null;
}

// A company's data is stale when ANY of these is true:
//  - there is no valid latest report (not completed or marked duplicate)
//  - the report was received more than STALE_THRESHOLD_MONTHS ago
//  - the report's period coverage ended more than STALE_THRESHOLD_MONTHS ago
export function getStaleInfo(latestReport: LatestReportLike | null | undefined): StaleInfo {
  const empty: StaleInfo = {
    isStale: true,
    monthsSinceReceived: null,
    monthsSinceCoverageEnd: null,
    coverageEnd: null,
  };

  if (!latestReport) return empty;
  if (latestReport.is_duplicate) return empty;
  if (latestReport.processing_status !== "completed") return empty;

  const now = new Date();
  const receivedDate = latestReport.report_date ? parseISO(latestReport.report_date) : null;
  const coverageEnd = getReportPeriodEndDate(latestReport.report_period);

  const monthsSinceReceived = receivedDate ? differenceInMonths(now, receivedDate) : null;
  const monthsSinceCoverageEnd = coverageEnd ? differenceInMonths(now, coverageEnd) : null;

  const receivedStale =
    monthsSinceReceived === null || monthsSinceReceived >= STALE_THRESHOLD_MONTHS;
  const coverageStale =
    monthsSinceCoverageEnd === null || monthsSinceCoverageEnd >= STALE_THRESHOLD_MONTHS;

  return {
    isStale: receivedStale || coverageStale,
    monthsSinceReceived,
    monthsSinceCoverageEnd,
    coverageEnd,
  };
}

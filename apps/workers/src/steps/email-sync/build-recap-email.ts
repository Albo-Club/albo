/**
 * Step: Build Recap Email
 *
 * Construit un email HTML récapitulatif après l'analyse
 * de tous les reports historiques extraits d'une boîte mail.
 * Affiche uniquement les reports extraits avec succès.
 */

export interface ReportRecapItem {
  companyName: string | null;
  reportPeriod: string | null;
  reportType: string | null;
  emailSubject: string;
  emailDate: string | null;
  filesCount: number;
}

export interface RecapStats {
  totalExtracted: number;
  durationMs: number;
}

export function buildRecapEmailHtml(
  items: ReportRecapItem[],
  stats: RecapStats,
  accountEmail: string
): string {
  const durationMin = Math.round(stats.durationMs / 60_000);

  const rowHtml = (item: ReportRecapItem) => {
    return `<tr>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">${escapeHtml(item.companyName || "—")}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">${escapeHtml(item.reportPeriod || "—")}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">${escapeHtml(item.reportType || "—")}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">${item.filesCount}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">${escapeHtml(item.emailSubject)}</td>
    </tr>`;
  };

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1f2937;max-width:800px;margin:0 auto;padding:20px;">
  <h2 style="color:#111827;margin-bottom:4px;">Albote — Reports extraits</h2>
  <p style="color:#6b7280;margin-top:0;">Compte : ${escapeHtml(accountEmail)}</p>

  <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0;">
    <strong>${stats.totalExtracted}</strong> reports ajoutés en ~${durationMin} min
  </div>

  ${items.length > 0 ? `
  <table style="width:100%;border-collapse:collapse;font-size:13px;">
    <thead>
      <tr style="background:#f3f4f6;">
        <th style="padding:8px 10px;text-align:left;border-bottom:2px solid #d1d5db;">Company</th>
        <th style="padding:8px 10px;text-align:left;border-bottom:2px solid #d1d5db;">Période</th>
        <th style="padding:8px 10px;text-align:left;border-bottom:2px solid #d1d5db;">Type</th>
        <th style="padding:8px 10px;text-align:left;border-bottom:2px solid #d1d5db;">Fichiers</th>
        <th style="padding:8px 10px;text-align:left;border-bottom:2px solid #d1d5db;">Email source</th>
      </tr>
    </thead>
    <tbody>
      ${items.map(rowHtml).join("\n")}
    </tbody>
  </table>` : `<p style="color:#6b7280;">Aucun nouveau report extrait.</p>`}

  <p style="color:#9ca3af;font-size:12px;margin-top:24px;">
    Généré automatiquement par Albote
  </p>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

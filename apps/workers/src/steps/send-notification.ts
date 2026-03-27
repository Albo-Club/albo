/**
 * Step: Send Notification
 * Envoie les emails de confirmation via Unipile (compte deck@alboteam.com).
 * Les emails apparaissent dans les "Envoyés" Gmail pour suivi.
 */

const UNIPILE_DSN = (() => {
  const raw = (process.env.UNIPILE_DSN || "").trim();
  return raw.startsWith("http") ? raw : `https://${raw}`;
})();
const UNIPILE_API_KEY = (process.env.UNIPILE_API_KEY || "").trim();
const UNIPILE_ACCOUNT_ID = "_6sjZD6zSUmIEb1N8gqAow";

interface NotificationParams {
  to: string;
  cc?: string[];
  bcc?: string[];
  subject: string;
  companyName: string;
  companyId: string;
  reportPeriod: string;
  reportType: string;
  success: boolean;
  errorMessage?: string;
}

export async function sendNotification(params: NotificationParams): Promise<void> {
  if (!UNIPILE_API_KEY) {
    console.warn("[send-notification] UNIPILE_API_KEY not set, skipping");
    return;
  }

  const html = params.success
    ? successEmailHtml(params.companyName, params.companyId, params.reportPeriod, params.reportType)
    : errorEmailHtml(params.companyName, params.errorMessage || "Unknown error");

  const body: Record<string, unknown> = {
    account_id: UNIPILE_ACCOUNT_ID,
    to: [{ identifier: params.to, display_name: "" }],
    subject: params.subject,
    body: html,
  };

  if (params.cc && params.cc.length > 0) {
    body.cc = params.cc.map((email) => ({ identifier: email, display_name: "" }));
  }
  if (params.bcc && params.bcc.length > 0) {
    body.bcc = params.bcc.map((email) => ({ identifier: email, display_name: "" }));
  }

  try {
    const res = await fetch(`${UNIPILE_DSN}/api/v1/emails`, {
      method: "POST",
      headers: {
        "X-API-KEY": UNIPILE_API_KEY,
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[send-notification] Unipile send error:", err);
    } else {
      const data = await res.json();
      console.log(`[send-notification] Email envoyé à ${params.to} (tracking: ${(data as any).tracking_id})`);
    }
  } catch (err) {
    console.error("[send-notification] Envoi échoué:", err);
  }
}

function successEmailHtml(
  companyName: string,
  companyId: string,
  reportPeriod: string,
  reportType: string
): string {
  const portfolioUrl = companyId
    ? `https://app.alboteam.com/portfolio/${companyId}`
    : "https://app.alboteam.com/portfolio";

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Report ajouté - Albo</title>
</head>
<body style="margin: 0; padding: 0; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #fafafa;">

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #fafafa; padding: 48px 24px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 420px;">

          <!-- Logo -->
          <tr>
            <td style="padding-bottom: 32px; text-align: center;">
              <span style="font-size: 24px; font-weight: 700; color: #18181b; letter-spacing: -0.5px;">Albo</span>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border: 1px solid #e4e4e7; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">

                <!-- Success Icon -->
                <tr>
                  <td style="padding: 32px 32px 0 32px; text-align: center;">
                    <div style="display: inline-block; width: 48px; height: 48px; background-color: #dcfce7; border-radius: 50%; line-height: 48px; font-size: 24px;">
                      ✓
                    </div>
                  </td>
                </tr>

                <!-- Title -->
                <tr>
                  <td style="padding: 20px 32px 0 32px; text-align: center;">
                    <h1 style="margin: 0; font-size: 20px; font-weight: 600; color: #18181b; line-height: 1.4;">
                      Report ajouté avec succès
                    </h1>
                  </td>
                </tr>

                <!-- Company Name Badge -->
                <tr>
                  <td style="padding: 16px 32px 0 32px; text-align: center;">
                    <span style="display: inline-block; background-color: #f4f4f5; color: #18181b; font-size: 14px; font-weight: 500; padding: 6px 16px; border-radius: 20px;">
                      ${companyName}
                    </span>
                  </td>
                </tr>

                <!-- Description -->
                <tr>
                  <td style="padding: 16px 32px 0 32px; text-align: center;">
                    <p style="margin: 0; font-size: 14px; color: #71717a; line-height: 1.6;">
                      Le report <strong style="color: #3f3f46;">${reportPeriod}</strong> a été traité et ajouté à votre portfolio.
                    </p>
                  </td>
                </tr>

                <!-- Report Details -->
                <tr>
                  <td style="padding: 20px 32px 0 32px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f9fafb; border-radius: 8px;">
                      <tr>
                        <td style="padding: 12px 16px;">
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                            <tr>
                              <td style="font-size: 12px; color: #71717a; padding-bottom: 4px;">Période</td>
                              <td style="font-size: 12px; color: #71717a; padding-bottom: 4px; text-align: right;">Type</td>
                            </tr>
                            <tr>
                              <td style="font-size: 14px; color: #18181b; font-weight: 500;">${reportPeriod}</td>
                              <td style="font-size: 14px; color: #18181b; font-weight: 500; text-align: right;">${reportType}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Button -->
                <tr>
                  <td style="padding: 24px 32px 0 32px; text-align: center;">
                    <a href="${portfolioUrl}"
                       style="display: inline-block; background-color: #18181b; color: #fafafa; text-decoration: none; font-size: 14px; font-weight: 500; padding: 12px 28px; border-radius: 6px;">
                      Voir le portfolio
                    </a>
                  </td>
                </tr>

                <!-- Secondary link -->
                <tr>
                  <td style="padding: 12px 32px 32px 32px; text-align: center;">
                    <a href="https://app.alboteam.com/portfolio"
                       style="font-size: 13px; color: #71717a; text-decoration: none;">
                      Voir toutes les entreprises →
                    </a>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top: 24px; text-align: center;">
              <p style="margin: 0 0 4px 0; font-size: 12px; color: #a1a1aa;">
                Cet email a été envoyé automatiquement suite à la réception d'un report.
              </p>
              <p style="margin: 0; font-size: 11px; color: #d4d4d8;">
                © 2026 Albo · Portfolio management
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;
}

function errorEmailHtml(companyName: string, errorMessage: string): string {
  return `<div style="font-family: -apple-system, sans-serif; max-width: 400px; padding: 20px;">
  <div style="text-align: center; margin-bottom: 16px;">
    <div style="width: 48px; height: 48px; background: #fef2f2; border-radius: 50%; line-height: 48px; margin: 0 auto;">⚠️</div>
  </div>
  <h2 style="text-align: center; font-size: 18px; color: #1a1a1a;">Erreur de traitement</h2>
  <p style="text-align: center; color: #666; font-size: 14px;">
    Le report <strong>${companyName}</strong> n'a pas pu être traité.
  </p>
  <div style="background: #f9fafb; border-radius: 6px; padding: 12px; margin-top: 16px;">
    <code style="font-size: 11px; color: #ef4444;">${errorMessage}</code>
  </div>
  <p style="text-align: center; margin-top: 16px; font-size: 12px; color: #999;">
    <a href="mailto:hello@alboteam.com" style="color: #1a1a1a;">hello@alboteam.com</a>
  </p>
</div>`;
}

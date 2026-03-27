/**
 * Step: Send Memo Email
 * Envoie le memo HTML, invitations et erreurs par email via Unipile.
 * Tout passe par Unipile pour apparaître dans Gmail "Envoyés".
 *
 * Reproduit les nœuds N8N "Send a message4" et "Send a message1".
 */

import { sendEmail as sendViaUnipile } from "../../lib/unipile";

/** Adresses internes à exclure des destinataires */
const INTERNAL_ADDRESSES = ["deck@alboteam.com", "report@alboteam.com"];

export interface MemoRecipients {
  to: string;
  accountId: string;
  cc?: { address: string; name: string }[];
}

export async function sendMemoEmail(
  recipients: MemoRecipients,
  companyName: string,
  memoHtml: string
): Promise<void> {
  const subject = `Albote｜Analyse ${companyName}`;

  // Filtrer les adresses internes des CC
  const ccFiltered = (recipients.cc || []).filter(
    (r) => !INTERNAL_ADDRESSES.includes(r.address.toLowerCase())
  );

  const result = await sendViaUnipile({
    accountId: recipients.accountId,
    to: [{ identifier: recipients.to }],
    cc: ccFiltered.length > 0
      ? ccFiltered.map((r) => ({ identifier: r.address, display_name: r.name || undefined }))
      : undefined,
    subject,
    body: memoHtml,
  });

  if (result) {
    console.log(`[send-memo-email] Memo envoyé via Unipile à ${recipients.to} (+ ${ccFiltered.length} CC)`);
  } else {
    console.error(`[send-memo-email] Échec envoi memo via Unipile à ${recipients.to}`);
  }
}

export async function sendInvitationEmail(
  to: string,
  senderEmail: string,
  accountId?: string
): Promise<void> {
  const subject = "Votre analyse est presque prête - Créez votre compte Albo";
  const html = invitationHtml(senderEmail);

  if (accountId) {
    const result = await sendViaUnipile({
      accountId,
      to: [{ identifier: to }],
      subject,
      body: html,
    });
    if (result) {
      console.log(`[send-memo-email] Invitation envoyée via Unipile à ${to}`);
      return;
    }
    console.warn(`[send-memo-email] Unipile échoué pour invitation, skip`);
  } else {
    console.warn(`[send-memo-email] Pas d'accountId pour invitation, skip`);
  }
}

export async function sendErrorEmail(
  to: string,
  emailSubject: string,
  errorMessage: string,
  accountId?: string
): Promise<void> {
  const subject = `Albote | ${emailSubject}`;
  const html = errorHtml(errorMessage);

  if (accountId) {
    const result = await sendViaUnipile({
      accountId,
      to: [{ identifier: to }],
      subject,
      body: html,
    });
    if (result) {
      console.log(`[send-memo-email] Email erreur envoyé via Unipile à ${to}`);
      return;
    }
  }
  console.warn(`[send-memo-email] Impossible d'envoyer l'email erreur à ${to}`);
}

// --- Templates ---

function invitationHtml(email: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f4f4f5;">
<tr><td align="center" style="padding: 40px 20px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 480px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">

<tr><td align="center" style="padding: 40px 40px 24px 40px;">
<svg width="120" height="44" viewBox="0 0 440 161" fill="none" xmlns="http://www.w3.org/2000/svg">
<path fill-rule="evenodd" clip-rule="evenodd" d="M196.946 125.118H197.382L197.375 125.124C204.114 146.755 223.231 159.998 247.564 159.998C281.024 159.998 304.271 135.943 304.271 100.402C304.271 64.8605 280.373 40.1377 245.828 40.1377C228.226 40.1377 211.503 46.5348 199.333 57.7959V0L179.13 4.41456V160H199.333L196.946 125.118ZM241.268 58.8995C267.774 58.8995 283.417 74.1324 283.417 100.177C283.417 126.003 267.995 141.454 241.489 141.454C214.983 141.454 199.34 126.222 199.34 100.177C199.34 74.1324 214.762 58.8995 241.268 58.8995ZM376.34 40.1394C339.401 40.1394 312.245 65.0803 312.245 100.179C312.245 135.277 339.837 160 376.34 160C412.844 160 440 135.277 440 100.179C440 65.0803 413.279 40.1394 376.34 40.1394ZM376.34 58.9013C402.632 58.9013 419.14 75.8986 419.14 99.9606C419.14 124.241 403.067 141.456 376.34 141.456C349.613 141.456 333.105 124.023 333.105 99.9606C333.105 75.8986 350.049 58.9013 376.34 58.9013ZM0 127.424C0 106.823 15.4222 93.9689 43.0144 93.9689C58.8725 93.9689 73.215 97.7363 85.1638 105.046C86.25 100.834 86.9005 96.1842 86.9005 91.7536C86.9005 70.4824 74.9517 58.2981 51.4898 58.2981C31.7161 58.2981 22.3756 68.2671 24.7692 84.2188L6.30289 86.4341C2.17251 58.2981 20.4242 40.5754 52.7972 40.5754C87.1216 40.5754 107.546 58.517 107.546 91.0903C107.546 100.615 105.159 110.139 101.028 118.782C109.068 128.088 115.15 139.828 119.059 154.453L102.329 160.435C99.7209 150.466 95.8117 141.824 90.8162 134.515C77.9958 150.022 58.879 160.435 38.4548 160.435C13.0351 160.435 0 147.588 0 127.424ZM39.7591 142.713C55.8368 142.712 69.521 133.851 77.9958 121.223C68.2195 114.358 56.4853 110.591 42.5851 110.591C27.8134 110.591 20.4242 117.018 20.4242 127.205C20.4242 136.51 27.591 142.712 39.7591 142.713ZM39.7591 142.713C39.7579 142.713 39.7568 142.713 39.7557 142.713H39.7622C39.7611 142.713 39.7601 142.713 39.7591 142.713ZM155.209 0L135.006 4.41456V160H155.209V0Z" fill="#18181b"/>
</svg>
</td></tr>

<tr><td align="center" style="padding: 0 40px 16px 40px;">
<span style="display: inline-block; background-color: #f4f4f5; color: #71717a; font-size: 12px; font-weight: 500; padding: 6px 12px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.5px;">Vous y êtes presque !</span>
</td></tr>

<tr><td align="center" style="padding: 0 40px 12px 40px;">
<h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #18181b; line-height: 1.3;">Votre analyse est presque prête</h1>
</td></tr>

<tr><td align="center" style="padding: 0 40px 32px 40px;">
<p style="margin: 0; font-size: 15px; color: #71717a; line-height: 1.6;">Nous avons bien reçu votre pitch deck !</p>
</td></tr>

<tr><td style="padding: 0 40px 32px 40px;">
<p style="margin: 0 0 20px 0; font-size: 15px; color: #3f3f46; line-height: 1.7;">
Pour recevoir votre <strong style="color: #18181b;">mémo d'investissement détaillé</strong>, il vous suffit de créer votre compte Albo en quelques secondes.
</p>
</td></tr>

<tr><td align="center" style="padding: 0 40px 32px 40px;">
<a href="https://app.alboteam.com/auth" style="display: inline-block; background-color: #18181b; color: #ffffff; font-size: 15px; font-weight: 500; text-decoration: none; padding: 14px 32px; border-radius: 8px;">Créer mon compte →</a>
</td></tr>

<tr><td style="padding: 0 40px 40px 40px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #fafafa; border-radius: 8px; border: 1px solid #e4e4e7;">
<tr><td style="padding: 16px 20px;">
<p style="margin: 0; font-size: 13px; color: #52525b; line-height: 1.6;">
<strong style="color: #18181b;">Prochaine étape :</strong><br>
Une fois inscrit avec l'adresse <span style="color: #18181b; font-weight: 500;">${escHtml(email)}</span>, renvoyez simplement votre deck à notre adresse email et votre analyse sera générée automatiquement.
</p>
</td></tr>
</table>
</td></tr>

<tr><td style="padding: 0 40px;"><hr style="border: none; border-top: 1px solid #e4e4e7; margin: 0;"></td></tr>

<tr><td align="center" style="padding: 24px 40px 32px 40px;">
<p style="margin: 0 0 8px 0; font-size: 14px; color: #3f3f46;">À très vite sur Albo !</p>
<p style="margin: 0; font-size: 13px; color: #a1a1aa;">L'équipe Albo</p>
</td></tr>

</table>

<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 480px;">
<tr><td align="center" style="padding: 24px 20px;">
<p style="margin: 0; font-size: 12px; color: #a1a1aa; line-height: 1.5;">
Cet email a été envoyé automatiquement suite à la réception d'un email de votre part.<br>
<a href="https://alboteam.com" style="color: #71717a; text-decoration: underline;">alboteam.com</a>
</p>
</td></tr>
</table>

</td></tr>
</table>
</body>
</html>`;
}

function errorHtml(errorMessage: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="margin: 0; padding: 20px; background-color: #ffffff; font-family: -apple-system, sans-serif;">
<table role="presentation" width="100%" style="max-width: 420px; margin: 0 auto;" cellspacing="0" cellpadding="0">

<tr><td align="center" style="padding: 0 0 20px 0;">
<div style="width: 56px; height: 56px; background-color: #fef2f2; border-radius: 50%; line-height: 56px; text-align: center; font-size: 24px;">⚠️</div>
</td></tr>

<tr><td align="center" style="padding: 0 0 8px 0;">
<h1 style="margin: 0; font-size: 20px; font-weight: 600; color: #0a0a0a;">Une erreur est survenue</h1>
</td></tr>

<tr><td align="center" style="padding: 0 0 24px 0;">
<p style="margin: 0; font-size: 14px; line-height: 1.6; color: #737373;">Nous n'avons pas pu traiter votre deck.</p>
</td></tr>

<tr><td style="padding: 0 0 32px 0;">
<div style="background-color: #fafafa; border: 1px solid #e5e5e5; border-radius: 8px; padding: 16px;">
<p style="margin: 0 0 8px 0; font-size: 11px; font-weight: 500; color: #737373; text-transform: uppercase; letter-spacing: 0.05em;">Détails de l'erreur</p>
<code style="font-size: 12px; color: #ef4444; word-break: break-all; line-height: 1.5;">${escHtml(errorMessage)}</code>
</div>
</td></tr>

<tr><td style="padding: 0;"><div style="height: 1px; background-color: #e5e5e5;"></div></td></tr>

<tr><td align="center" style="padding: 24px 0 0 0;">
<p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 500; color: #a3a3a3; text-transform: uppercase;">Besoin d'aide ?</p>
<p style="margin: 0; font-size: 14px;"><a href="mailto:hello@alboteam.com" style="color: #0a0a0a; text-decoration: none; font-weight: 500;">hello@alboteam.com</a></p>
</td></tr>

</table>
</body>
</html>`;
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

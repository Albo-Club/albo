/**
 * Trigger.dev Task : Notification nouveau signup
 *
 * Déclenché par un trigger SQL (pg_net) à chaque INSERT sur profiles.
 * Log dans pipeline_logs + envoie un email à mael@alboteam.com via Unipile.
 */

import { task, logger } from "@trigger.dev/sdk";
import { randomUUID } from "crypto";
import { sendEmail } from "../lib/unipile.js";
import { createPipelineLogger } from "../lib/logger.js";
import { NOTIFY_EMAIL, UNIPILE_ACCOUNT_ID } from "../lib/constants.js";

interface NewSignupPayload {
  id: string;
  email: string;
  name: string | null;
  profile_source: string | null;
  created_at: string;
}

export const notifyNewSignup = task({
  id: "notify-new-signup",
  retry: { maxAttempts: 3 },
  run: async (payload: NewSignupPayload) => {
    const displayName = payload.name || payload.email;

    logger.info("Nouveau signup détecté", { email: payload.email, name: displayName });

    // Log dans pipeline_logs
    const log = createPipelineLogger({
      runId: randomUUID(),
      pipeline: "user-signup",
      senderEmail: payload.email,
      emailSubject: `Inscription — ${displayName}`,
      profileId: payload.id,
    });
    await log("signup-detected", "info", `Nouveau signup : ${displayName} (${payload.profile_source || "direct"})`);

    // Envoyer email notification
    const date = new Date(payload.created_at).toLocaleString("fr-FR", {
      timeZone: "Europe/Paris",
    });
    const source = payload.profile_source || "direct";

    const subject = `🆕 Nouveau signup Albote — ${displayName}`;
    const body = `
<div style="font-family: sans-serif; font-size: 14px; color: #333;">
  <p>Hey,</p>
  <p>Nouvel utilisateur sur Albote :</p>
  <p>• <b>${displayName}</b> — ${payload.email} (${source}, ${date})</p>
  <p style="color: #999; font-size: 12px; margin-top: 20px;">
    — Albote Workers (notify-new-signup)
  </p>
</div>`.trim();

    const result = await sendEmail({
      accountId: UNIPILE_ACCOUNT_ID,
      to: [{ identifier: NOTIFY_EMAIL, display_name: "Mael" }],
      subject,
      body,
    });

    if (!result) {
      await log("notification-failed", "error", `Échec envoi email notification à ${NOTIFY_EMAIL}`);
      throw new Error("Échec envoi email notification signup");
    }

    await log("notification-sent", "info", `Email de notification envoyé à ${NOTIFY_EMAIL}`);

    logger.info("Notification signup envoyée", {
      trackingId: result.trackingId,
      email: payload.email,
    });

    return { email: payload.email, name: displayName, trackingId: result.trackingId };
  },
});

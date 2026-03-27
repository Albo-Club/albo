import { defineConfig } from "@trigger.dev/sdk";
import { puppeteer } from "@trigger.dev/build/extensions/puppeteer";
import { TRIGGER_PROJECT, UNIPILE_ACCOUNT_ID, NOTIFY_EMAIL } from "./src/lib/constants.js";

export default defineConfig({
  project: TRIGGER_PROJECT,
  dirs: ["src/trigger"],
  runtime: "node",
  logLevel: "info",
  maxDuration: 3600, // 1h max — sync email peut être longue

  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 30_000,
      factor: 2,
      randomize: true,
    },
  },

  build: {
    extensions: [puppeteer()],
  },

  onFailure: async ({ payload, error, ctx }) => {
    const taskId = ctx.task.id;
    const runId = ctx.run.id;
    const errorMsg =
      error instanceof Error ? error.message : String(error ?? "Unknown error");
    const errorStack =
      error instanceof Error ? error.stack?.slice(0, 500) : "";

    const dashboardUrl = `https://cloud.trigger.dev/projects/v3/${TRIGGER_PROJECT}/runs/${runId}`;
    const payloadPreview = JSON.stringify(payload, null, 2).slice(0, 800);

    const subject = `⚠️ Trigger.dev | ${taskId} failed`;
    const body = `
      <h2>Task failed: <code>${taskId}</code></h2>
      <p><strong>Run ID:</strong> <code>${runId}</code></p>
      <p><strong>Erreur:</strong> ${errorMsg}</p>
      ${errorStack ? `<pre style="background:#f5f5f5;padding:12px;border-radius:4px;font-size:13px;overflow-x:auto">${errorStack}</pre>` : ""}
      <p><strong>Dashboard:</strong> <a href="${dashboardUrl}">${dashboardUrl}</a></p>
      <details>
        <summary>Payload (aperçu)</summary>
        <pre style="background:#f5f5f5;padding:12px;border-radius:4px;font-size:12px;overflow-x:auto">${payloadPreview}</pre>
      </details>
    `.trim();

    try {
      const dsn = (process.env.UNIPILE_DSN || "").trim();
      const baseUrl = dsn.startsWith("http") ? dsn : `https://${dsn}`;
      const apiKey = (process.env.UNIPILE_API_KEY || "").trim();

      await fetch(`${baseUrl}/api/v1/emails`, {
        method: "POST",
        headers: {
          "X-API-KEY": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          account_id: UNIPILE_ACCOUNT_ID,
          to: [{ identifier: NOTIFY_EMAIL, display_name: "Mael" }],
          subject,
          body,
        }),
      });
    } catch (emailErr) {
      console.error("[onFailure] Impossible d'envoyer la notification:", emailErr);
    }
  },
});

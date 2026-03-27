require("dotenv/config");
fetch("https://melodic-mango-exabyte.mastra.cloud/api/agents/deck-analyzer/generate", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-mastra-access-token": process.env.MASTRA_ACCESS_TOKEN,
  },
  body: JSON.stringify({ messages: [{ role: "user", content: "hello" }] }),
})
  .then((r) => { console.log("Status:", r.status); return r.text(); })
  .then((t) => console.log("Body:", t.substring(0, 500)))
  .catch((e) => console.error("Error:", e.message));

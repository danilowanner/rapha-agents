import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import type { Context } from "hono";
import { Hono } from "hono";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { env } from "../libs/env.ts";
import { telegramBot } from "../libs/utils/telegram.ts";
import { authHeaderMiddleware } from "./authHeaderMiddleware.ts";
import { busHandler } from "./bus.ts";
import { filenameHandler } from "./filename.ts";
import { responseMarkdownHandler } from "./responses/md.ts";
import { responseResultHandler } from "./responses/result.ts";
import { responseViewHandler } from "./responses/view.tsx";
import { registerTask, startScheduler, stopScheduler } from "./scheduler.ts";
import { summarizeHandler } from "./summarize.ts";
import { transportDepartmentCheckHandler } from "./transportDepartmentCheckHandler.ts";
import { wordsmithHandler } from "./wordsmith.ts";

const app = new Hono();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

app.use(
  "/assets/*",
  serveStatic({
    root: join(__dirname, "build"),
  })
);
app.get("/", (c: Context) => c.json({ message: "Hello, World!" }));
app.get("/health", (c: Context) => c.json({ status: "ok" }));
app.get("/responses/view/:id", responseViewHandler);
app.get("/responses/md/:id", responseMarkdownHandler);
app.get("/responses/result/:id", responseResultHandler);

app.use("*", authHeaderMiddleware);

app.post("/bus", busHandler);
app.post("/filename", filenameHandler);
app.post("/summarize", summarizeHandler);
app.post("/wordsmith", wordsmithHandler);

registerTask("Check Transport Department appointments", { minutes: 15 }, transportDepartmentCheckHandler);

const port = parseInt(env.port, 10);

const server = serve(
  {
    fetch: app.fetch,
    port,
  },
  (info: { port: number }) => {
    console.log(`Server running on http://localhost:${info.port}`);
    startScheduler();
  }
);

/**
 * Handle graceful shutdown on SIGTERM/SIGINT
 */
function shutdown(signal: string) {
  console.log(`\nReceived ${signal}, shutting down gracefully...`);
  telegramBot.stop();
  stopScheduler();
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });

  setTimeout(() => {
    // Force shutdown after 2 seconds
    console.error("Forced shutdown after timeout");
    process.exit(1);
  }, 2000);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

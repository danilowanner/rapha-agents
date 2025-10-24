import { serve } from "@hono/node-server";
import type { Context } from "hono";
import { Hono } from "hono";

import { env } from "../libs/env.ts";
import { authHeaderMiddleware } from "./authHeaderMiddleware.ts";
import { filenameHandler } from "./filename.ts";
import { wordsmithHandler } from "./wordsmith.ts";

const app = new Hono();

app.use("*", authHeaderMiddleware);

app.get("/", (c: Context) => {
  return c.json({ message: "Hello, World!" });
});

app.get("/health", (c: Context) => {
  return c.json({ status: "ok" });
});

app.post("/filename", filenameHandler);
app.post("/wordsmith", wordsmithHandler);

const port = parseInt(env.port, 10);

const server = serve(
  {
    fetch: app.fetch,
    port,
  },
  (info: { port: number }) => {
    console.log(`Server running on http://localhost:${info.port}`);
  }
);

/**
 * Handle graceful shutdown on SIGTERM/SIGINT
 */
function shutdown(signal: string) {
  console.log(`\nReceived ${signal}, shutting down gracefully...`);
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10000);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

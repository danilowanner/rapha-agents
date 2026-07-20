import { serve } from "srvx";
import { serveStatic } from "srvx/static";
import { fileURLToPath } from "node:url";

import startServer, { stopServerProcess } from "../dist/server/server.js";

const server = serve({
  gracefulShutdown: false,
  port: Number.parseInt(process.env.PORT ?? "3000", 10),
  middleware: [serveStatic({ dir: fileURLToPath(new URL("../dist/client", import.meta.url)) })],
  fetch: (request) => startServer.fetch(request),
});

await server.ready();
console.log(`Server running on ${server.url}`);

let shuttingDown = false;

const shutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\nReceived ${signal}, shutting down gracefully...`);

  try {
    await stopServerProcess();
    await server.close();
  } catch (error) {
    console.error("Graceful shutdown failed:", error);
    await server.close(true);
    process.exitCode = 1;
  }
};

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));

import { logger } from "./log.ts";
import { closeClient } from "./mcp.ts";
import { stop } from "./scheduler.ts";

const log = logger("SHUTDOWN");

export type ShutdownReason = "SIGINT" | "SIGTERM" | "UNCAUGHT_EXCEPTION" | "UNHANDLED_REJECTION" | "MANUAL";

export const ShutdownReason = {
  SIGINT: "SIGINT",
  SIGTERM: "SIGTERM",
  UNCAUGHT_EXCEPTION: "UNCAUGHT_EXCEPTION",
  UNHANDLED_REJECTION: "UNHANDLED_REJECTION",
  MANUAL: "MANUAL",
} as const;

export async function shutdown(reason: ShutdownReason = ShutdownReason.MANUAL, details?: any) {
  const exitCode = reasonToExitCode(reason);
  log.break();
  try {
    if (details) log.error(details);
    log.notice(`Shutting down (${String(reason)}): closing MCP client...`);
    stop();
    await closeClient();
    log.success("MCP client closed.");
  } catch (err) {
    log.error("Error while closing MCP client:", err);
  } finally {
    process.exit(exitCode);
  }
}

function reasonToExitCode(reason: ShutdownReason | number | string): number {
  if (typeof reason === "number") return reason;
  switch (reason) {
    case ShutdownReason.SIGINT:
    case ShutdownReason.SIGTERM:
      return 0;
    case ShutdownReason.UNCAUGHT_EXCEPTION:
    case ShutdownReason.UNHANDLED_REJECTION:
      return 1;
    default:
      return 0;
  }
}

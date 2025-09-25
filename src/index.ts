import "dotenv/config";
import { agent } from "./agent.ts";
import { start } from "./scheduler.ts";
import { shutdown, ShutdownReason } from "./shutdown.ts";
import { getUnreadMessages } from "./utils/getUnreadMessages.ts";

process.on("SIGINT", async () => shutdown(ShutdownReason.SIGINT));
process.on("SIGTERM", async () => shutdown(ShutdownReason.SIGTERM));
process.on("uncaughtException", async (err) => shutdown(ShutdownReason.UNCAUGHT_EXCEPTION, err));
process.on("unhandledRejection", async (reason) => shutdown(ShutdownReason.UNHANDLED_REJECTION, reason));

start([
  {
    schedule: "startup",
    action: async () => {
      await agent.updateListings();
    },
  },
  {
    schedule: "hourly",
    action: async () => {
      await agent.updateListings();
    },
  },
  {
    schedule: "every 5 minutes",
    action: async () => {
      const count = await getUnreadMessages();
      if (count > 0) await agent.checkMessages();
    },
  },
]);

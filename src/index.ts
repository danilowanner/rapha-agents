import "dotenv/config";
import { agent } from "./agent.ts";
import { addSystemTask, start } from "./scheduler.ts";
import type { ScheduleExecutionIn } from "./schemas/scheduleExecutionIn.ts";
import { shutdown, ShutdownReason } from "./shutdown.ts";
import { getScheduleDelayMs } from "./utils/getScheduleDelayMs.ts";
import { getUnreadMessages } from "./utils/getUnreadMessages.ts";

process.on("SIGINT", async () => shutdown(ShutdownReason.SIGINT));
process.on("SIGTERM", async () => shutdown(ShutdownReason.SIGTERM));
process.on("uncaughtException", async (err) => shutdown(ShutdownReason.UNCAUGHT_EXCEPTION, err));
process.on("unhandledRejection", async (reason) => shutdown(ShutdownReason.UNHANDLED_REJECTION, reason));

start();
//enqueueUpdateListing({ minutes: 0 });
enqueueCheckMessages({ minutes: 1 });

function enqueueUpdateListing(scheduleExecutionIn: ScheduleExecutionIn) {
  addSystemTask({
    name: "Update listings",
    action: async () => {
      await agent.updateListings();
    },
    scheduledTimestamp: Date.now() + getScheduleDelayMs(scheduleExecutionIn),
  });
}

function enqueueCheckMessages(scheduleExecutionIn: ScheduleExecutionIn) {
  addSystemTask({
    name: "Check messages",
    action: async () => {
      const count = await getUnreadMessages();
      if (count > 0) {
        await agent.checkMessages();
        enqueueCheckMessages({ minutes: 1 });
      } else {
        // If there are no messages, check again in 10 minutes
        enqueueCheckMessages({ minutes: 10 });
      }
    },
    scheduledTimestamp: Date.now() + getScheduleDelayMs(scheduleExecutionIn),
  });
}

import "dotenv/config";
import { agent } from "./agent.ts";
import { start } from "./scheduler.ts";
import type { ScheduleExecutionIn } from "./schemas/scheduleExecutionIn.ts";
import { shutdown, ShutdownReason } from "./shutdown.ts";
import { createBackoff } from "./utils/createBackoff.ts";
import { getUnreadMessages } from "./utils/getUnreadMessages.ts";
import { scheduleSystemTask } from "./utils/scheduleSystemTask.ts";

process.on("SIGINT", async () => shutdown(ShutdownReason.SIGINT));
process.on("SIGTERM", async () => shutdown(ShutdownReason.SIGTERM));
process.on("uncaughtException", async (err) => shutdown(ShutdownReason.UNCAUGHT_EXCEPTION, err));
process.on("unhandledRejection", async (reason) => shutdown(ShutdownReason.UNHANDLED_REJECTION, reason));

start();
//enqueueUpdateListing({ minutes: 0 });
enqueueCheckMessages({ minutes: 0 });

const checkMessagesBackoff = createBackoff({ initial: 1, max: 60 });

function enqueueUpdateListing(scheduleExecutionIn: ScheduleExecutionIn) {
  scheduleSystemTask({
    name: "Update listings",
    action: async () => {
      await agent.updateListings();
    },
    scheduleExecutionIn,
  });
}

function enqueueCheckMessages(scheduleExecutionIn: ScheduleExecutionIn) {
  scheduleSystemTask({
    name: "Check messages",
    action: async () => {
      const count = await getUnreadMessages();
      if (count > 0) {
        await agent.checkMessages();
        checkMessagesBackoff.reset();
      } else {
        checkMessagesBackoff.increase();
      }
      enqueueCheckMessages({ minutes: checkMessagesBackoff.current });
    },
    scheduleExecutionIn,
  });
}

import { JSONFilePreset } from "lowdb/node";

import { agent } from "./agent.ts";
import type { Listing } from "./schemas/listing.ts";
import type { Message } from "./schemas/message.ts";
import type { ScheduleExecutionIn } from "./schemas/scheduleExecutionIn.ts";
import type { Task } from "./schemas/task.ts";
import { getScheduleDelayMs } from "./utils/getScheduleDelayMs.ts";
import { scheduleSystemTask } from "./utils/scheduleSystemTask.ts";

type Data = {
  listings: DBListing[];
  tasks: DBTask[];
  agentLog: DBMessage[];
  reasoningLog: DBReasoning[];
};

export type DBListing = Listing;
export type DBTask = Task & { scheduledTimestamp: number };
export type DBMessage = Message & { createdTimestamp: number };
export type DBReasoning = { title: string; details: string; createdTimestamp: number };

const defaultData: Data = { listings: [], tasks: [], agentLog: [], reasoningLog: [] };
const fileDB = await JSONFilePreset<Data>("db.json", defaultData);

export const db = {
  getListings: () => fileDB.data.listings,
  addListings: async (newListings: Listing[]) =>
    fileDB.update(({ listings }) => listings.push(...newListings.map(getDbListing))),
  getTasks: () => fileDB.data.tasks,
  addTasks: async (newTasks: Task[]) =>
    fileDB.update(({ tasks }) => {
      tasks.push(...newTasks.map(getDbTask));
      if (newTasks.length > 0) enqueuePruneTasks({ minutes: 0 });
    }),
  removeTask: async (task: DBTask) =>
    fileDB.update(({ tasks }) => {
      const idx = tasks.indexOf(task);
      if (idx > -1) tasks.splice(idx, 1);
    }),
  getAgentLog: () => fileDB.data.agentLog,
  addAgentLog: async (message: string) => fileDB.update(({ agentLog }) => agentLog.push(getDbMessage({ message }))),
  getReasoningLog: () => fileDB.data.reasoningLog,
  addReasoningLog: async (reasoning: Omit<DBReasoning, "createdTimestamp">) =>
    fileDB.update(({ reasoningLog }) => reasoningLog.push(getDbReasoning(reasoning))),
};

function getDbListing(listing: Listing): DBListing {
  return { ...listing };
}

function getDbTask(task: Task): DBTask {
  const { scheduleExecutionIn } = task;
  return { ...task, scheduledTimestamp: Date.now() + getScheduleDelayMs(scheduleExecutionIn) };
}

function getDbMessage(message: Omit<DBMessage, "createdTimestamp">): DBMessage {
  return { ...message, createdTimestamp: Date.now() };
}

function getDbReasoning(reasoning: Omit<DBReasoning, "createdTimestamp">): DBReasoning {
  return { ...reasoning, createdTimestamp: Date.now() };
}

function enqueuePruneTasks(scheduleExecutionIn: ScheduleExecutionIn) {
  scheduleSystemTask({
    name: "Prune tasks",
    action: async () => {
      await agent.pruneTasks();
    },
    scheduleExecutionIn,
  });
}

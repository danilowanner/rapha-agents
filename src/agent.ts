import { generateText, stepCountIs, type Tool } from "ai";

import { db } from "./db.ts";
import { getEnv } from "./env.ts";
import { logger } from "./log.ts";
import { browser } from "./mcp.ts";
import { createPoeAdapter } from "./providers/poe-provider.ts";
import type { Task } from "./schemas/task.ts";
import { getSystem } from "./system.ts";
import { browserBasics, browserInteractions } from "./toolGroups.ts";
import { tools, type ToolName } from "./tools.ts";
import { getFirstToolMessage } from "./utils/getFirstToolMessage.ts";

const log = logger("AGENT");

const env = getEnv();
const poe = createPoeAdapter({ apiKey: env.poeApiKey });

export const agent = {
  getListings,
  updateListings,
  checkMessages,
  handleTask,
};

async function checkMessages() {
  return await task({
    prompt:
      "Check if there are any new (unread) messages. Add tasks to read and handle them using the addTasks tool. No action needed if no new messages.",
    toolNames: [...browserBasics, ...browserInteractions, "browserGetPageText", "dbAddTasks"],
  });
}

async function updateListings() {
  return await task({
    prompt:
      "Get my latest listings, find any new listings which are NOT yet in the database (by comparing title). Add new listings to the database using the addListings tool. Add details by extracting full description from listing page using getPageTextTool.",
    system: getSystem(["base", "pages", "dbListings"]),
    stepLimit: 20,
    toolNames: [...browserBasics, "browserClick", "dbAddListings"],
  });
}

async function getListings() {
  return await task({
    prompt: "Get my latest listings from the database and summarize.",
    system: getSystem(["base", "pages", "dbListings"]),
    toolNames: [],
  });
}

async function handleTask(details: Task) {
  let page = "";
  if (details.url) {
    const snapshot = await browser
      .navigate(details.url)
      .then((res) => getFirstToolMessage(res))
      .catch(() => "Could not load page");
    page = `\nYou have been navigated to the following page:\n${snapshot}`;
  }
  return await task({
    prompt: `Handle this pending task:\n${details.task}${page}`,
    system: getSystem(["base", "pages", "dbListings", "dbAgentLog", "conversation"]),
    toolNames: [...browserBasics, ...browserInteractions, "dbAddTasks"],
  });
}

type TaskProps = {
  prompt: string;
  toolNames: ToolName[];
  system?: string;
  stepLimit?: number;
  model?: "Claude-Sonnet-4" | "o4-mini" | "GPT-5-Codex";
};

async function task(task: TaskProps) {
  const { prompt, stepLimit = 10, toolNames, system = getSystem(["base", "pages"]), model = "GPT-5-Codex" } = task;
  try {
    const selectedTools = toolNames.reduce((acc, name) => {
      acc[name] = tools[name];
      return acc;
    }, {} as Record<ToolName, Tool>);

    const data = await generateText({
      model: poe(model),
      tools: selectedTools,
      stopWhen: stepCountIs(stepLimit),
      prompt,
      system,
      onStepFinish: (step) => {
        step.content.forEach((msg) => {
          if (msg.type === "tool-call") log.stepUsage(msg.toolName, step.usage.totalTokens);
          if (["reasoning", "text"].includes(msg.type)) log.stepUsage(msg.type, step.usage.totalTokens);
        });
      },
    });
    log.info(data.text);
    await db.addAgentLog(data.text);
    log.taskComplete(data.totalUsage.totalTokens);
  } catch (err) {
    log.error("LLM task failed:", err);
  }
}

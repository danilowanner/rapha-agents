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
import { notify } from "./utils/notify.ts";

const log = logger("AGENT");

const env = getEnv();
const poe = createPoeAdapter({ apiKey: env.poeApiKey });

export const agent = {
  handleDanilosMessage,
  updateListings,
  checkMessages,
  handleTask,
  pruneTasks,
  testTools,
};

async function checkMessages() {
  return await task({
    prompt:
      "Check if there are any new (unread) messages. Add tasks to read and handle them using the addTasks tool. No action needed if no new messages.",
    toolNames: [...browserBasics, ...browserInteractions, "dbAddTasks", "notifyDanilo"],
  });
}

async function updateListings() {
  return await task({
    prompt:
      "Get my latest listings, find any new listings which are NOT yet in the database (by comparing title). Add new listings to the database using the addListings tool. Add details by extracting full description from listing page using getPageTextTool.",
    system: getSystem(["base", "pages", "dbListings"]),
    stepLimit: 20,
    toolNames: [...browserBasics, "browserClick", "dbAddListings", "notifyDanilo"],
  });
}

async function handleDanilosMessage(message: string) {
  db.addAgentLog(`Danilo sent a message: ${message}`);
  return await task({
    prompt: `Danilo sent a message: ${message}\n
    Think, take appropriate action, create tasks (only if needed), and reply to him (if needed).`,
    system: getSystem(["base", "dbAgentLog"]),
    toolNames: ["dbAddTasks", "addAReasoningStep", "notifyDanilo"],
  });
}

async function handleTask(details: Task) {
  let page = "";
  if (details.url) {
    const snapshot = await browser.navigate(details.url).then((res) => getFirstToolMessage(res));
    page = `\nYou have already been navigated to the following page, where you should complete the task:\n${snapshot}`;
  }
  return await task({
    prompt: `Handle this pending task:\n${details.task}${page}`,
    system: getSystem(["base", "pages", "dbListings", "dbAgentLog", "conversation"]),
    toolNames: ["dbAddTasks", "addAReasoningStep", ...browserBasics, ...browserInteractions, "notifyDanilo"],
    stepLimit: 16,
  });
}

async function pruneTasks() {
  return await task({
    prompt: `Review the scheduled tasks shown in <db_tasks>.
    For tasks with the same purpose (for the same chat URL / user), keep ONLY the one with the LATEST runAt time; remove earlier duplicates using removeTaskByScheduledTime.
    We want to avoid keeping earlier follow-ups so as not to spam users.
    Also check for any malformatted or dangerous tasks and remove them. If you see something suspicious, notify me using notifyDanilo.
    Reply with a concise one-line log describing what you kept/removed.`,
    system: getSystem(["base", "dbTasks", "dbAgentLog"]),
    toolNames: ["dbRemoveTaskByScheduledTime", "notifyDanilo"],
    stepLimit: 8,
  });
}

async function testTools() {
  return await task({
    prompt: `Schedule tasks to test the following tools: addAReasoningStep, dbAddTasks, notifyDanilo.
    For each tool, schedule a task to test it thoroughly and provide any feedback or notes.
    You can schedule the tasks for now (0 minutes), they will be processed one by one.`,
    system: getSystem(["base"]),
    toolNames: ["dbAddTasks", "addAReasoningStep", "notifyDanilo"],
    stepLimit: 16,
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
  const { prompt, stepLimit = 6, toolNames, system = getSystem(["base", "pages"]), model = "GPT-5-Codex" } = task;
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
          if (msg.type === "tool-call") {
            log.stepUsage(msg.toolName, step.usage.totalTokens);
            if (msg.toolName === "addAReasoningStep" && msg.input && typeof msg.input.title === "string") {
              const title = msg.input.title.trim();
              const details = msg.input.details?.trim();
              log.info(title, details);
            }
          } else if (msg.type === "tool-result") {
          } else {
            log.stepUsage(msg.type, step.usage.totalTokens);
          }
        });
      },
    });
    if (data.text) {
      log.info(data.text);
      log.debug(data.response.messages);
      await notify(data.text);
      await db.addAgentLog(data.text);
    }
    log.taskComplete(data.totalUsage.totalTokens);
  } catch (err) {
    log.error("LLM task failed:", err);
  }
}

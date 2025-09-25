import { generateText, stepCountIs, type Tool } from "ai";

import { getEnv } from "./env.ts";
import { logger } from "./log.ts";
import { getBrowserTools } from "./mcp.ts";
import { createPoeAdapter } from "./providers/poe-provider.ts";
import { getSystem } from "./system.ts";
import { addListingsTool, addTasksTool, getPageTextTool } from "./tools.ts";

const log = logger("AGENT");

const env = getEnv();
const poe = createPoeAdapter({ apiKey: env.poeApiKey });

export const agent = {
  getListings,
  updateListings,
  checkMessages,
};

async function checkMessages() {
  return await task({
    prompt:
      "Check if there are any new (unread) messages. Add tasks to read and handle them using the addTasks tool. No action needed if no new messages.",
    tools: (browserTools) => ({
      ...pickEssentials(browserTools),
      addTasks: addTasksTool,
    }),
  });
}

async function updateListings() {
  return await task({
    prompt:
      "Get my latest listings, find any new listings which are NOT yet in the database (by comparing title). Add new listings to the database using the addListings tool. Add details by extracting full description from listing page using getPageTextTool.",
    system: getSystem(["base", "pages", "listings"]),
    stepLimit: 20,
    tools: (browserTools) => ({
      ...pickEssentials(browserTools),
      addListings: addListingsTool,
      getPageText: getPageTextTool,
    }),
  });
}

async function getListings() {
  return await task({
    prompt: "Get my latest listings from the database and summarize.",
    system: getSystem(["base", "pages", "listings"]),
    tools: () => ({}),
  });
}

type TaskProps = {
  prompt: string;
  tools: (browserTools: Record<string, Tool>) => Record<string, Tool>;
  system?: string;
  stepLimit?: number;
  model?: "Claude-Sonnet-4" | "o4-mini" | "GPT-5-Codex";
};

async function task(task: TaskProps) {
  const { prompt, stepLimit = 10, tools, system = getSystem(["base", "pages"]), model = "GPT-5-Codex" } = task;
  try {
    const browserTools = await getBrowserTools();
    const data = await generateText({
      model: poe(model),
      tools: tools(browserTools),
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
    log.taskComplete(data.totalUsage.totalTokens);
  } catch (err) {
    log.error("LLM task failed:", err);
  }
}

function pickEssentials(browserTools: Record<string, Tool>) {
  return {
    navigate: browserTools.browser_navigate,
    snapshot: browserTools.browser_snapshot,
    go_back: browserTools.browser_go_back,
    click: browserTools.browser_click,
    wait: browserTools.browser_wait,
  };
}

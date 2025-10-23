import { tool } from "ai";
import z from "zod";

import { reasoningTool } from "../libs/ai/reasoningTool.ts";

import { db } from "./db.ts";
import { browser } from "./mcp.ts";
import { listing } from "./schemas/listing.ts";
import { task } from "./schemas/task.ts";
import { getFirstToolMessage } from "./utils/getFirstToolMessage.ts";
import { getPageText } from "./utils/getPageText.ts";
import { getPageTitle } from "./utils/getPageTitle.ts";
import { notify } from "./utils/notify.ts";

const browserNavigate = tool({
  description: "Navigate to a URL and get content of the page.",
  inputSchema: z.object({
    url: z.string().describe("The URL to navigate to and retrieve content from."),
    returnContent: z
      .enum(["title", "text", "snapshot"])
      .describe("What to return: page title, main text content, or full accessibility snapshot"),
  }),
  execute: async ({ url, returnContent }) => {
    try {
      const result = await browser.navigate(url);
      switch (returnContent) {
        case "title":
          return { success: true, content: getPageTitle(result) } as const;
        case "snapshot":
          return { success: true, content: getFirstToolMessage(result) } as const;
        case "text":
          return { success: true, content: getPageText(result) } as const;
        default:
          throw new Error("Invalid returnContent input value.");
      }
    } catch (err) {
      return { success: false, error: String(err) } as const;
    }
  },
});

const browserGoBack = tool({
  description: "Go back to the previous page",
  inputSchema: z.object({}),
  execute: async () => browser.goBack(),
});

const browserGoForward = tool({
  description: "Go forward to the next page",
  inputSchema: z.object({}),
  execute: async () => browser.goForward(),
});

const browserSnapshot = tool({
  description:
    "Capture accessibility snapshot of the current page. Use this for getting references to elements to interact with.",
  inputSchema: z.object({}),
  execute: async () => browser.snapshot(),
});

const browserClick = tool({
  description: "Perform click on a web page",
  inputSchema: z.object({
    element: z
      .string()
      .describe("Human-readable element description used to obtain permission to interact with the element"),
    ref: z.string().describe("Exact target element reference from the page snapshot"),
  }),
  execute: async ({ element, ref }) => browser.click(element, ref),
});

const browserHover = tool({
  description: "Hover over element on page",
  inputSchema: z.object({
    element: z
      .string()
      .describe("Human-readable element description used to obtain permission to interact with the element"),
    ref: z.string().describe("Exact target element reference from the page snapshot"),
  }),
  execute: async ({ element, ref }) => browser.hover(element, ref),
});

const browserType = tool({
  description: "Type text into editable element",
  inputSchema: z.object({
    element: z
      .string()
      .describe("Human-readable element description used to obtain permission to interact with the element"),
    ref: z.string().describe("Exact target element reference from the page snapshot"),
    text: z.string().describe("Text to type into the element"),
    submit: z.boolean().describe("Whether to submit entered text (press Enter after)"),
  }),
  execute: async ({ element, ref, text, submit }) => browser.type(element, ref, text, submit),
});

const browserSelectOption = tool({
  description: "Select an option in a dropdown",
  inputSchema: z.object({
    element: z
      .string()
      .describe("Human-readable element description used to obtain permission to interact with the element"),
    ref: z.string().describe("Exact target element reference from the page snapshot"),
    values: z
      .array(z.string())
      .describe("Array of values to select in the dropdown. This can be a single value or multiple values."),
  }),
  execute: async ({ element, ref, values }) => browser.selectOption(element, ref, values),
});

const browserPressKey = tool({
  description: "Press a key on the keyboard",
  inputSchema: z.object({
    key: z.string().describe("Name of the key to press or a character to generate, such as `ArrowLeft` or `a`"),
  }),
  execute: async ({ key }) => browser.pressKey(key),
});

const browserWait = tool({
  description: "Wait for a specified time in seconds",
  inputSchema: z.object({
    time: z.number().describe("The time to wait in seconds"),
  }),
  execute: async ({ time }) => browser.wait(time),
});

const browserGetConsoleLogs = tool({
  description: "Get the console logs from the browser",
  inputSchema: z.object({}),
  execute: async () => browser.getConsoleLogs(),
});

const browserScreenshot = tool({
  description: "Take a screenshot of the current page",
  inputSchema: z.object({}),
  execute: async () => browser.screenshot(),
});

const notifyDanilo = tool({
  description:
    "Send a notification to Danilo. Use to surface important events, questions or reminders. Do not send trivial updates.",
  inputSchema: z.object({
    message: z.string().max(600).describe("Notification text to deliver (max 600 characters)"),
  }),
  execute: async ({ message }) => {
    try {
      await notify(message);
      return { success: true } as const;
    } catch (err) {
      return { success: false, error: String(err) } as const;
    }
  },
});

const dbAddListings = tool({
  description: "Add new listings to database. Does not modify existing listings.",
  inputSchema: z.object({
    listings: z.array(listing),
  }),
  execute: async ({ listings }) => {
    try {
      await db.addListings(listings);
      return { success: true } as const;
    } catch (err) {
      return { success: false, error: String(err) } as const;
    }
  },
});

const dbAddTasks = tool({
  description:
    "Add tasks to the task list to be executed. Obsolete/old tasks are pruned automatically after adding, so you don't need to schedule any pruning yourself.",
  inputSchema: z.object({
    tasks: z.array(task),
  }),
  execute: async ({ tasks }) => {
    try {
      await db.addTasks(tasks);
      return { success: true } as const;
    } catch (err) {
      return { success: false, error: String(err) } as const;
    }
  },
});

const dbRemoveTaskByScheduledTime = tool({
  description: "Remove a scheduled DB task by its exact scheduledTimestamp (ms since epoch).",
  inputSchema: z.object({
    scheduledTimestamp: z
      .number()
      .describe("Exact scheduledTimestamp (milliseconds since epoch) of the task to remove."),
  }),
  execute: async ({ scheduledTimestamp }) => {
    try {
      const taskToRemove = db.getTasks().find((t) => t.scheduledTimestamp === scheduledTimestamp);
      if (!taskToRemove) return { success: false, error: "Task not found" } as const;
      await db.removeTask(taskToRemove);
      return { success: true } as const;
    } catch (err) {
      return { success: false, error: String(err) } as const;
    }
  },
});

const addAReasoningStep = reasoningTool(async ({ title, details }) => {
  db.addReasoningLog({ title, details });
});

export const tools = {
  dbAddListings,
  dbAddTasks,
  dbRemoveTaskByScheduledTime,
  addAReasoningStep,
  browserNavigate,
  browserGoBack,
  browserGoForward,
  browserSnapshot,
  browserClick,
  browserHover,
  browserType,
  browserSelectOption,
  browserPressKey,
  browserWait,
  browserGetConsoleLogs,
  browserScreenshot,
  notifyDanilo,
};

export type ToolName = keyof typeof tools;

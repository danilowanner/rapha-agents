import { tool } from "ai";
import z from "zod";
import { db, listing, task } from "./db.ts";
import { browser } from "./mcp.ts";
import { extractText } from "./utils/extractText.ts";

export const addListingsTool = tool({
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

export const addTasksTool = tool({
  description: "Add tasks to the task list. They will be executed asap.",
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

export const getPageTextTool = tool({
  description:
    "Returns the text content of the main element of a webpage. This is the preferred tool to extract page contents.",
  inputSchema: z.object({
    url: z.string().url().describe("The URL of the webpage to extract text from."),
  }),
  execute: async ({ url }) => {
    try {
      await browser.navigate(url);
      await browser.wait(2);
      const result = await browser.snapshotJson();
      const mainElement = result.find((element) => {
        if (typeof element === "object" && element !== null) {
          const key = Object.keys(element)[0];
          return key.startsWith("main");
        }
        return false;
      });
      return { success: true, text: extractText(Object.values(mainElement ?? {})[0]) } as const;
    } catch (err) {
      return { success: false, error: String(err) } as const;
    }
  },
});

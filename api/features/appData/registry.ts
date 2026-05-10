import { getRecentResponses } from "../../handlers/responses/state.ts";
import { getMemoryAsXml } from "../memory.ts";
import type { AppDataFunctions } from "./contract.ts";

/** Runtime implementations for app data functions. */
export const appDataFunctions = {
  "memory.get": async ({ userId }) => ({
    xml: await getMemoryAsXml(userId),
  }),
  "conversations.recent": ({ limit, userId }) => ({
    conversations: getRecentResponses({ limit, userId }),
  }),
} satisfies AppDataFunctions;

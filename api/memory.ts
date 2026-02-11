import type { Context } from "hono";
import z from "zod";

import { addMemoryEntry } from "./wordsmith/memory.ts";

const memoryBodySchema = z.object({
  userId: z.string().min(1),
  userMessage: z.string(),
  agentMessage: z.string(),
});

export async function memoryHandler(c: Context) {
  const parsed = memoryBodySchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: parsed.error.message }, 400);
  }
  const { userId, userMessage, agentMessage } = parsed.data;
  addMemoryEntry(userId, { userMessage, agentMessage });
  return c.json({ ok: true }, 202);
}

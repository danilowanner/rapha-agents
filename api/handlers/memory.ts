import type { Context } from "hono";
import z from "zod";

import { addMemoryEntry, getMemoryAsXml } from "../features/memory.ts";

const memoryBodySchema = z.object({
  userId: z.string().min(1),
  userMessage: z.string(),
  agentMessage: z.string(),
  chatId: z.string(),
});

export async function memoryPostHandler(c: Context) {
  const parsed = memoryBodySchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: parsed.error.message }, 400);
  }
  const { userId, userMessage, agentMessage, chatId } = parsed.data;
  addMemoryEntry(userId, { userMessage, agentMessage }, chatId);
  return c.json({ ok: true }, 202);
}

export async function memoryGetHandler(c: Context) {
  const userId = c.req.param("userId");
  const excludeChatId = c.req.query("excludeChatId") || undefined;
  if (!userId) {
    return c.json({ error: "userId is required" }, 400);
  }
  const xml = await getMemoryAsXml(userId, { excludeChatId });
  return c.json({ xml });
}

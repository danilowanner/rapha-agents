import { createFileRoute } from "@tanstack/react-router";
import z from "zod";

import { authMiddleware } from "../authHeaderMiddleware.ts";
import { addMemoryEntry } from "../features/memory.ts";

const memoryBodySchema = z.object({
  userId: z.string().min(1),
  userMessage: z.string(),
  agentMessage: z.string(),
  chatId: z.string(),
});

export const Route = createFileRoute("/memory")({
  server: {
    middleware: [authMiddleware],
    handlers: {
      POST: async ({ request }) => {
        const parsed = memoryBodySchema.safeParse(await request.json());
        if (!parsed.success) {
          return Response.json({ error: parsed.error.message }, { status: 400 });
        }
        const { userId, userMessage, agentMessage, chatId } = parsed.data;
        addMemoryEntry(userId, { userMessage, agentMessage }, chatId);
        return Response.json({ ok: true }, { status: 202 });
      },
    },
  },
});

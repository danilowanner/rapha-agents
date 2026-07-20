import { randomBytes, randomUUID } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";
import z from "zod";

import { env } from "../../../libs/env.ts";
import { authMiddleware } from "../../authHeaderMiddleware.ts";
import { prisma } from "../../db/prisma.ts";
import { getOrCreateUser } from "../../db/user.ts";

const docsPublishBodySchema = z.object({
  title: z.string().min(1),
  markdown: z.string().min(1),
  userEmail: z.string().email(),
  noteId: z.string().optional(),
  chatId: z.string().optional(),
  messageId: z.string().optional(),
});

type DocsPublishResponse = {
  url: string;
};

export const Route = createFileRoute("/docs/publish")({
  server: {
    middleware: [authMiddleware],
    handlers: {
      POST: async ({ request }) => {
        const parsed = docsPublishBodySchema.safeParse(await request.json());
        if (!parsed.success) {
          return Response.json({ error: parsed.error.message }, { status: 400 });
        }

        const { title, markdown, userEmail, noteId } = parsed.data;
        const userId = userEmail;

        await getOrCreateUser(userId);

        const id = noteId ?? randomUUID();
        const slug = slugFromTitleOrNoteId(title, noteId);
        const existing = await prisma.doc.findUnique({ where: { id } });

        const doc = existing
          ? await prisma.doc.update({
              where: { id },
              data: { slug, title, markdown, userId, noteId: noteId ?? null },
            })
          : await prisma.doc.create({
              data: {
                id,
                shortId: await generateUniqueShortId(),
                slug,
                title,
                markdown,
                userId,
                noteId: noteId ?? null,
              },
            });

        const base = env.baseUrl.replace(/\/+$/, "");
        return Response.json({ url: `${base}/docs/${doc.shortId}/${doc.slug}` } satisfies DocsPublishResponse);
      },
    },
  },
});

async function generateUniqueShortId(): Promise<string> {
  for (;;) {
    const shortId = randomBytes(6).toString("base64url");
    const taken = await prisma.doc.findUnique({ where: { shortId } });
    if (!taken) return shortId;
  }
}

function slugFromTitleOrNoteId(title: string, noteId: string | undefined): string {
  const source = (title || noteId || "untitled").toLowerCase().trim();
  return (
    source
      .replace(/[^a-z0-9\- ]+/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-") || "untitled"
  );
}

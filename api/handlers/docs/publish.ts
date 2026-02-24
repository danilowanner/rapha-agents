import type { Context } from "hono";
import { randomBytes, randomUUID } from "node:crypto";
import z from "zod";

import { env } from "../../../libs/env.ts";
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

/**
 * Persists a doc from POST body; upserts User by userEmail and Doc by id (noteId or generated).
 * URL path uses shortId (generated on create, unchanged on update).
 */
export async function docsPublishHandler(c: Context) {
  const parsed = docsPublishBodySchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: parsed.error.message }, 400);
  }

  const { title, markdown, userEmail, noteId } = parsed.data;
  const userId = userEmail;

  await getOrCreateUser(userId);

  const id = noteId ?? randomUUID();
  const slug = slugFromTitleOrNoteId(title, noteId);
  const existing = await prisma.doc.findUnique({ where: { id } });

  let doc;
  if (existing) {
    doc = await prisma.doc.update({
      where: { id },
      data: { slug, title, markdown, userId, noteId: noteId ?? null },
    });
  } else {
    doc = await prisma.doc.create({
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
  }

  const base = env.baseUrl.replace(/\/+$/, "");
  return c.json<DocsPublishResponse>({ url: `${base}/docs/${doc.shortId}/${doc.slug}` });
}

async function generateUniqueShortId(): Promise<string> {
  for (;;) {
    const s = randomBytes(6).toString("base64url");
    const taken = await prisma.doc.findUnique({ where: { shortId: s } });
    if (!taken) return s;
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

import type { Context } from "hono";

import { prisma } from "../../db/prisma.ts";

/**
 * Returns raw markdown for a doc by shortId; 404 if not found.
 */
export async function docMarkdownHandler(c: Context) {
  const shortId = c.req.param("id");
  const doc = await prisma.doc.findUnique({ where: { shortId } });
  if (!doc) return c.text("Doc not found", 404);
  c.header("Content-Type", "text/markdown; charset=UTF-8");
  return c.body(doc.markdown);
}

import type { Context } from "hono";
import { renderToString } from "react-dom/server";

import { prisma } from "../../db/prisma.ts";
import { ClientApp } from "../../ui/ClientApp.tsx";

/**
 * Serves HTML view for a doc by shortId; fetches markdown from /docs/md/:shortId.
 * Redirects to canonical URL when slug in path is outdated.
 */
export async function docViewHandler(c: Context) {
  const shortId = c.req.param("id");
  const slugParam = c.req.param("slug");
  const doc = await prisma.doc.findUnique({ where: { shortId } });
  if (!doc) return c.text("Doc not found", 404);

  if (slugParam !== undefined && slugParam !== doc.slug) {
    return c.redirect(`/docs/${shortId}/${doc.slug}`, 302);
  }

  const html = renderToString(
    <ClientApp payload={{ view: "markdown", title: doc.title, markdownUrl: `/docs/md/${shortId}` }} />,
  );

  return c.html(`<!DOCTYPE html>${html}`);
}

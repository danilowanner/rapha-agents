import { notFound, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { prisma } from "../db/prisma.ts";

export const getDocView = createServerFn({ method: "GET" })
  .validator((input: { shortId: string; slug?: string }) => input)
  .handler(async ({ data }) => {
    const doc = await prisma.doc.findUnique({
      where: { shortId: data.shortId },
      select: { shortId: true, slug: true, title: true },
    });
    if (!doc) throw notFound();
    if (data.slug !== undefined && data.slug !== doc.slug) {
      throw redirect({ href: `/docs/${doc.shortId}/${doc.slug}`, statusCode: 302 });
    }
    return doc;
  });

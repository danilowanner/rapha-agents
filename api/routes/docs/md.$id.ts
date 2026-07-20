import { createFileRoute } from "@tanstack/react-router";

import { prisma } from "../../db/prisma.ts";

export const Route = createFileRoute("/docs/md/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const doc = await prisma.doc.findUnique({ where: { shortId: params.id } });
        if (!doc) return new Response("Doc not found", { status: 404 });
        return new Response(doc.markdown, { headers: { "Content-Type": "text/markdown; charset=UTF-8" } });
      },
    },
  },
});

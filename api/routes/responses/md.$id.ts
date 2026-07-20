import { createFileRoute } from "@tanstack/react-router";

import { getResponseStream } from "../../features/responses/state.ts";
import { encodeTextStream } from "../../http.ts";

export const Route = createFileRoute("/responses/md/$id")({
  server: {
    handlers: {
      GET: ({ params }) => {
        console.log("[RESPONSES/MD]", params.id);
        const stream = getResponseStream(params.id);
        if (!stream) return new Response("Response not found", { status: 404 });

        return new Response(encodeTextStream(stream), {
          headers: { "Content-Type": "text/plain; charset=UTF-8" },
        });
      },
    },
  },
});

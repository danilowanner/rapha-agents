import { createFileRoute } from "@tanstack/react-router";

import { authMiddleware } from "../authHeaderMiddleware.ts";
import { issueAccessToken } from "../features/accessTokens.ts";

export const Route = createFileRoute("/auth")({
  server: {
    middleware: [authMiddleware],
    handlers: {
      POST: () => {
        const { token, expiresAt } = issueAccessToken();
        return Response.json({ token, expiresAt });
      },
    },
  },
});

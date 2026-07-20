import { createMiddleware } from "@tanstack/react-start";

import { env } from "../libs/env.ts";
import { isValidAccessToken } from "./features/accessTokens.ts";

/** Requires either the configured API key or a valid temporary access token. */
export const authMiddleware = createMiddleware().server(({ request, next }) => {
  const bearerToken = request.headers.get("Authorization")?.replace("Bearer ", "");
  if (bearerToken === env.apiKey) return next();

  const accessToken = new URL(request.url).searchParams.get("token");
  if (accessToken && isValidAccessToken(accessToken)) return next();

  return Response.json({ error: "Unauthorized" }, { status: 401 });
});

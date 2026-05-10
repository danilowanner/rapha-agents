import type { Context, Next } from "hono";

import { env } from "../libs/env.ts";
import { isValidAccessToken } from "./features/accessTokens.ts";

export const authHeaderMiddleware = async (c: Context, next: Next) => {
  const bearerToken = c.req.header("Authorization")?.replace("Bearer ", "");
  if (bearerToken === env.apiKey) return next();

  const accessToken = c.req.query("token");
  if (accessToken && isValidAccessToken(accessToken)) return next();

  return c.json({ error: "Unauthorized" }, 401);
};

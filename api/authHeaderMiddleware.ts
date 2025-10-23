import type { Context, Next } from "hono";

import { env } from "../libs/env.ts";

export const authHeaderMiddleware = async (c: Context, next: Next) => {
  const path = c.req.path;
  if (path === "/" || path === "/health") {
    return next();
  }

  const authHeader = c.req.header("Authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (!token || token !== env.apiKey) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  return next();
};

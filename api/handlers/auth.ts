import type { Context } from "hono";

import { issueAccessToken } from "../features/accessTokens.ts";

/** Issues an access token for the authenticated caller. TTL: 24h. */
export function authHandler(c: Context) {
  const { token, expiresAt } = issueAccessToken();
  return c.json({ token, expiresAt });
}

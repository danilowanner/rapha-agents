import type { Context } from "hono";

import { getResponseClipboard, hasResponse } from "./state.ts";

/**
 * Returns clipboard content attached to a response.
 */
export const responseClipboardHandler = (c: Context) => {
  const id = c.req.param("id");
  console.log("[RESPONSES/CLIPBOARD]", id);

  if (!hasResponse(id)) return c.json({ error: "Response not found" }, 404);

  const clipboard = getResponseClipboard(id);
  if (!clipboard) return c.body(null, 204);

  return c.json({ clipboard });
};

import type { Context } from "hono";

import { getResponseClipboard } from "./state.ts";

/**
 * Returns clipboard content attached to a response when available.
 */
export const responseClipboardHandler = async (c: Context) => {
  const id = c.req.param("id");
  console.log("[RESPONSES/CLIPBOARD]", id);

  const clipboard = await getResponseClipboard(id);

  if (clipboard === null) return c.json({ error: "Response not found" }, 404);
  return c.json({ clipboard });
};

import type { Context } from "hono";
import { getResponseResult } from "./state.ts";

/**
 * Returns the complete result after the stream finishes
 */
export const responseResultHandler = async (c: Context) => {
  console.log("[RESPONSES/RESULT]", c.req.param("id"));
  const id = c.req.param("id");
  const result = await getResponseResult(id);

  if (result === null) {
    return c.json({ error: "Response not found" }, 404);
  }

  return c.json({ result });
};

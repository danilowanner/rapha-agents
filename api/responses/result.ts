import type { Context } from "hono";
import { streamToString } from "../../libs/utils/streamToString.ts";
import { deleteResponse, getResponse } from "./state.ts";

/**
 * Returns the complete result after the stream finishes
 */
export const responseResultHandler = async (c: Context) => {
  console.log("[RESPONSES/RESULT]", c.req.param("id"));
  const id = c.req.param("id");
  const response = getResponse(id);

  if (!response) {
    return c.json({ error: "Response not found" }, 404);
  }

  try {
    const result = await streamToString(response.resultStream);
    deleteResponse(id);

    return c.json({ result });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error occurred in responseResultHandler:", errorMessage);
    return c.json({ error: errorMessage }, 500);
  }
};

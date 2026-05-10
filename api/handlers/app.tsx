import type { Context } from "hono";
import { renderToString } from "react-dom/server";

import { ClientApp, type AppPayload } from "../ui/ClientApp.tsx";

/** Handles GET /app?payload=<json> — renders the client app shell for the given payload. */
export function appHandler(c: Context) {
  const raw = c.req.query("payload");
  if (!raw) return c.text("payload is required", 400);

  let payload: AppPayload;
  try {
    payload = JSON.parse(decodeURIComponent(raw)) as AppPayload;
  } catch {
    return c.text("Invalid payload", 400);
  }

  const html = renderToString(<ClientApp payload={payload} />);
  return c.html(`<!DOCTYPE html>${html}`);
}

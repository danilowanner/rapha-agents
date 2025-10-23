import { serve } from "@hono/node-server";
import type { Context } from "hono";
import { Hono } from "hono";

import { env } from "../libs/env.ts";
import { authHeaderMiddleware } from "./authHeaderMiddleware.ts";
import { wordsmithHandler } from "./wordsmith.ts";

const app = new Hono();

app.use("*", authHeaderMiddleware);

app.get("/", (c: Context) => {
  return c.json({ message: "Hello, World!" });
});

app.get("/health", (c: Context) => {
  return c.json({ status: "ok" });
});

app.post("/wordsmith", wordsmithHandler);

const port = parseInt(env.port, 10);

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info: { port: number }) => {
    console.log(`Server running on http://localhost:${info.port}`);
  }
);

import handler, { createServerEntry } from "@tanstack/react-start/server-entry";

import { startApiProcess, stopApiProcess } from "./process.ts";

startApiProcess();

export default createServerEntry({
  fetch: (request) => handler.fetch(request),
});

export async function stopServerProcess(): Promise<void> {
  await stopApiProcess();
}

import { addLogEntry } from "../libs/cli/store.ts";

type Component = "AGENT" | (string & {});

export const logger = (component: Component) => ({
  error: (msg: string, error?: unknown) => {
    const errorString = error instanceof Error ? error.message : String(error);
    onError("Error: " + msg + errorString);
    addLogEntry({ level: "error", component, text: msg, details: errorString });
  },
  info: (text: string, details?: string) => {
    addLogEntry({ level: "info", component, text, details });
  },
  debug: (data: unknown) => {
    addLogEntry({ level: "debug", component, text: JSON.stringify(data, null, 2) });
  },
  notice: (text: string) => {
    addLogEntry({ level: "notice", component, text });
  },
  success: (text: string) => {
    addLogEntry({ level: "success", component, text });
  },
  stepUsage: (toolName: string, totalTokens?: number) => {
    addLogEntry({ level: "stepUsage", component, text: `Step: ${toolName} (${totalTokens ?? "-"})` });
  },
  taskComplete: (totalTokens?: number) => {
    addLogEntry({ level: "taskComplete", component, text: `Task complete (${totalTokens ?? "-"})` });
  },
});

type Callback = (errorMessage: string) => void;
const subs: Array<Callback> = [];

export const subscribeError = (callback: Callback) => {
  subs.push(callback);
};

function onError(message: string) {
  subs.forEach((cb) => {
    try {
      cb(message);
    } catch (err) {}
  });
}

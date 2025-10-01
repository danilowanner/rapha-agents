import chalk from "chalk";
import { runNotifyShortcut } from "./utils/notify.ts";

type Component = "AGENT" | (string & {});

export const logger = (component: Component) => ({
  error: (msg: string, error?: unknown) => {
    console.error(`${c(component)} ${chalk.red(msg)}`, error);
    runNotifyShortcut("Error: " + msg + (error instanceof Error ? `: ${error.message}` : ""));
  },
  info: (msg: string, ...args: any[]) => {
    console.log(`${c(component)} ${msg}`, ...args);
  },
  debug: (msg: string) => {
    const lines = msg
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l);
    lines
      .map((l, i) => `${i === 0 ? c(component) : cSpace(component)} ${chalk.gray(l)}`)
      .forEach((line) => console.log(line));
  },
  notice: (msg: string, ...args: any[]) => {
    console.log(`${c(component)} ${chalk.yellow(msg)}`, ...args);
  },
  success: (msg: string, ...args: any[]) => {
    console.log(`${c(component)} ${chalk.green(msg)}`, ...args);
  },
  stepUsage: (toolName: string, totalTokens?: number) => {
    console.log(`${c(component)} ${chalk.gray(toolName)} (${chalk.yellow(totalTokens)})`);
  },
  taskComplete: (totalTokens?: number) => {
    console.log(`${c(component)} ✅ ${chalk.gray("Task complete.")} Total tokens used: ${chalk.yellow(totalTokens)}`);
  },
  break: () => console.log("\n"),
});

function c(component: Component) {
  return component === "AGENT" ? chalk.blue(`[${component}]`) : chalk.gray(`[${component}]`);
}

function cSpace(component: Component) {
  return " ".repeat(component.length + 2);
}

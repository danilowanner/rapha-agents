import chalk from "chalk";

type Component = "AGENT" | (string & {});

export const logger = (component: Component) => ({
  error: (msg: string, ...args: any[]) => {
    console.error(`${c(component)} ${chalk.red(msg)}`, ...args);
  },
  info: (msg: string, ...args: any[]) => {
    console.log(`${c(component)} ${msg}`, ...args);
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

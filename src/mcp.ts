import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { experimental_createMCPClient as createMCPClient } from "ai";
import yaml from "js-yaml";
import type { SnapshotNode } from "./types/SnapshotNode.ts";

const transport = new StdioClientTransport({
  command: "npx",
  args: ["@browsermcp/mcp@latest"],
});

type MCPClient = Awaited<ReturnType<typeof createMCPClient>>;
type MCPTools = Awaited<ReturnType<MCPClient["tools"]>>;

const mcp = new Promise<{ browserMcpClient: MCPClient; tools: MCPTools }>(async (resolve) => {
  const browserMcpClient = await createMCPClient({
    transport,
  });
  const tools = await browserMcpClient.tools();
  await setTimeout(() => resolve({ browserMcpClient, tools }), 2_000);
});

/**
 * Available browser tools (name — short description and expected args):
 *
 * - `browser_navigate`: Navigate to a URL. Args: `{ url: string }`.
 * - `browser_go_back`: Go back to the previous page. Args: `{}`.
 * - `browser_go_forward`: Go forward to the next page. Args: `{}`.
 * - `browser_snapshot`: Capture an accessibility snapshot of the current page (use to discover element references). Args: `{}`.
 * - `browser_click`: Click an element. Args: `{ element: string, ref: string }`.
 * - `browser_hover`: Hover over an element. Args: `{ element: string, ref: string }`.
 * - `browser_type`: Type text into an editable element. Args: `{ element: string, ref: string, text: string, submit: boolean }`.
 * - `browser_select_option`: Select option(s) in a dropdown. Args: `{ element: string, ref: string, values: string[] }`.
 * - `browser_press_key`: Press a keyboard key. Args: `{ key: string }`.
 * - `browser_wait`: Wait for a duration in seconds. Args: `{ time: number }`.
 * - `browser_get_console_logs`: Retrieve console logs. Args: `{}`.
 * - `browser_screenshot`: Take a screenshot of the current page. Args: `{}`.
 */
export const getBrowserTools = async () => (await mcp).tools;

export const closeClient = async () => {
  const { browserMcpClient } = await mcp;
  await browserMcpClient?.close();
};

export const browser = {
  navigate: async (url: string) =>
    (await mcp).tools.browser_navigate.execute({ url }, { toolCallId: crypto.randomUUID(), messages: [] }),
  goBack: async () => (await mcp).tools.browser_go_back.execute({}, { toolCallId: crypto.randomUUID(), messages: [] }),
  goForward: async () =>
    (await mcp).tools.browser_go_forward.execute({}, { toolCallId: crypto.randomUUID(), messages: [] }),
  snapshot: async () =>
    (await mcp).tools.browser_snapshot.execute({}, { toolCallId: crypto.randomUUID(), messages: [] }),
  snapshotJson,
  click: async (element: string, ref: string) =>
    (await mcp).tools.browser_click.execute({ element, ref }, { toolCallId: crypto.randomUUID(), messages: [] }),
  hover: async (element: string, ref: string) =>
    (await mcp).tools.browser_hover.execute({ element, ref }, { toolCallId: crypto.randomUUID(), messages: [] }),
  type: async (element: string, ref: string, text: string, submit = false) =>
    (await mcp).tools.browser_type.execute(
      { element, ref, text, submit },
      { toolCallId: crypto.randomUUID(), messages: [] }
    ),
  selectOption: async (element: string, ref: string, values: string[]) =>
    (await mcp).tools.browser_select_option.execute(
      { element, ref, values },
      { toolCallId: crypto.randomUUID(), messages: [] }
    ),
  pressKey: async (key: string) =>
    (await mcp).tools.browser_press_key.execute({ key }, { toolCallId: crypto.randomUUID(), messages: [] }),
  wait: async (seconds: number) =>
    (await mcp).tools.browser_wait.execute({ time: seconds }, { toolCallId: crypto.randomUUID(), messages: [] }),
  getConsoleLogs: async () =>
    (await mcp).tools.browser_get_console_logs.execute({}, { toolCallId: crypto.randomUUID(), messages: [] }),
  screenshot: async () =>
    (await mcp).tools.browser_screenshot.execute({}, { toolCallId: crypto.randomUUID(), messages: [] }),
};

async function snapshotJson(): Promise<Array<SnapshotNode>> {
  const result = await browser.snapshot();
  if (!("isError" in result)) throw new Error("Snapshot result missing isError field");
  if (result.isError) throw new Error(JSON.stringify(result.content));
  if (!Array.isArray(result.content)) throw new Error("Snapshot content is not an array");
  const raw = result.content[0]?.text ?? "";
  const yamlBlockMatch = raw.match(/```(?:yaml)?\s*([\s\S]*?)```/i);
  const toParse = yamlBlockMatch ? yamlBlockMatch[1].trim() : raw.trim();
  try {
    const parsed = yaml.load(toParse);
    const firstDocument = Array.isArray(parsed) ? parsed[0] : parsed;
    const content = firstDocument && typeof firstDocument === "object" && Object.values(firstDocument)[0];
    if (!content) throw new Error("No YAML documents found in snapshot");
    return content;
  } catch (err: any) {
    throw new Error(err.toString());
  }
}

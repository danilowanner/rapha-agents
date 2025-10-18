import { Client } from "@modelcontextprotocol/sdk/client";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { callToolWithRetry } from "./utils/callToolWithRetry.ts";

const transport = new StdioClientTransport({
  command: "npx",
  args: ["@browsermcp/mcp@latest"],
});

const client = new Client({
  name: "browser-client",
  version: "1.0.0",
});

type MCPClient = typeof client;

const mcp = new Promise<{ browserMcpClient: MCPClient }>(async (resolve) => {
  await client.connect(transport);
  const mcp = Promise.resolve({ browserMcpClient: client });
  await callToolWithRetry({
    mcp,
    name: "browser_navigate",
    arguments: { url: "https://www.carousell.com/inbox" },
  });
  resolve(await mcp);
});

export const closeClient = async () => {
  const { browserMcpClient } = await mcp;
  await browserMcpClient.close();
};

export const browser = {
  /**
   * Navigate to a URL.
   * MCP Tool: browser_navigate
   * @param url The URL to navigate to.
   * @returns Raw MCP tool call result.
   */
  navigate: async (url: string) =>
    (await mcp).browserMcpClient.callTool({ name: "browser_navigate", arguments: { url } }),

  /**
   * Go back to the previous page in browser history.
   * MCP Tool: browser_go_back
   * @returns Raw MCP tool call result.
   */
  goBack: async () => (await mcp).browserMcpClient.callTool({ name: "browser_go_back", arguments: {} }),

  /**
   * Go forward to the next page in browser history.
   * MCP Tool: browser_go_forward
   * @returns Raw MCP tool call result.
   */
  goForward: async () => (await mcp).browserMcpClient.callTool({ name: "browser_go_forward", arguments: {} }),

  /**
   * Capture an accessibility snapshot of the current page.
   * MCP Tool: browser_snapshot
   * Use this to discover element references for subsequent interactions.
   * @returns Raw MCP tool call result containing snapshot text/structure.
   */
  snapshot: async () => (await mcp).browserMcpClient.callTool({ name: "browser_snapshot", arguments: {} }),

  /**
   * Click an element identified from a prior snapshot.
   * MCP Tool: browser_click
   * @param element Human-readable description of the target element (for audit / permission context).
   * @param ref Exact element reference string obtained from a snapshot.
   * @returns Raw MCP tool call result.
   */
  click: async (element: string, ref: string) =>
    (await mcp).browserMcpClient.callTool({ name: "browser_click", arguments: { element, ref } }),

  /**
   * Hover over an element to reveal tooltips or dynamic UI.
   * MCP Tool: browser_hover
   * @param element Human-readable description of the target element.
   * @param ref Exact element reference string from a snapshot.
   * @returns Raw MCP tool call result.
   */
  hover: async (element: string, ref: string) =>
    (await mcp).browserMcpClient.callTool({ name: "browser_hover", arguments: { element, ref } }),

  /**
   * Type text into an editable element.
   * MCP Tool: browser_type
   * @param element Human-readable description of the input element.
   * @param ref Exact element reference from snapshot.
   * @param text Text content to type.
   * @param submit Whether to press Enter after typing.
   * @returns Raw MCP tool call result.
   */
  type: async (element: string, ref: string, text: string, submit = false) =>
    (await mcp).browserMcpClient.callTool({ name: "browser_type", arguments: { element, ref, text, submit } }),

  /**
   * Select one or more options in a dropdown element.
   * MCP Tool: browser_select_option
   * @param element Human-readable description of the select element.
   * @param ref Exact element reference from snapshot.
   * @param values Array of option values to select.
   * @returns Raw MCP tool call result.
   */
  selectOption: async (element: string, ref: string, values: string[]) =>
    (await mcp).browserMcpClient.callTool({ name: "browser_select_option", arguments: { element, ref, values } }),

  /**
   * Press a keyboard key (e.g., ArrowLeft, Enter, a).
   * MCP Tool: browser_press_key
   * @param key The key identifier or character.
   * @returns Raw MCP tool call result.
   */
  pressKey: async (key: string) =>
    (await mcp).browserMcpClient.callTool({ name: "browser_press_key", arguments: { key } }),

  /**
   * Wait for a specified number of seconds.
   * MCP Tool: browser_wait
   * @param seconds Time to wait in seconds.
   * @returns Raw MCP tool call result.
   */
  wait: async (seconds: number) =>
    (await mcp).browserMcpClient.callTool({ name: "browser_wait", arguments: { time: seconds } }),

  /**
   * Retrieve console logs from the current page.
   * MCP Tool: browser_get_console_logs
   * @returns Raw MCP tool call result with logs.
   */
  getConsoleLogs: async () =>
    (await mcp).browserMcpClient.callTool({ name: "browser_get_console_logs", arguments: {} }),

  /**
   * Take a screenshot of the current page.
   * MCP Tool: browser_screenshot
   * @returns Raw MCP tool call result containing image data or reference.
   */
  screenshot: async () => (await mcp).browserMcpClient.callTool({ name: "browser_screenshot", arguments: {} }),
};

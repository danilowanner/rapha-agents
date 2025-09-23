import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { experimental_createMCPClient as createMCPClient } from "ai";

const transport = new StdioClientTransport({
  command: "npx",
  args: ["@browsermcp/mcp@latest"],
});

export const getMcpClient = async () =>
  createMCPClient({
    transport,
  });

export const browserMcpClient = new Client({
  name: "browser-client",
  version: "1.0.0",
});

// await browserMcpClient.connect(transport);

// // List prompts
// const prompts = await browserMcpClient.listPrompts();
// console.log("Available prompts:", prompts);

// // Get a prompt
// const prompt = await browserMcpClient.getPrompt({
//   name: "example-prompt",
//   arguments: {
//     arg1: "value"
//   }
// });

// // List resources
// const resources = await browserMcpClient.listResources();

// // Read a resource
// const resource = await browserMcpClient.readResource({
//   uri: "file:///example.txt"
// });

// // Call a tool
// const result = await browserMcpClient.callTool({
//   name: "example-tool",
//   arguments: {
//     arg1: "value"
//   }
// });

import { streamText, type UserContent } from "ai";

import { createPoeAdapter } from "../../../libs/ai/providers/poe-provider.ts";
import { env } from "../../../libs/env.ts";
import { createResponseStream } from "../../../libs/utils/createResponseStream.ts";

const poe = createPoeAdapter({ apiKey: env.poeApiKey });

const content: UserContent = [
  {
    type: "text",
    text: `Generate a demo markdown document showcasing all common elements:
- Multiple heading levels (h1-h3)
- Paragraphs with **bold**, *italic*, and \`inline code\`
- A bullet list and a numbered list
- A code block with syntax highlighting
- A blockquote
- A horizontal rule
- Two tables: one small (3 cols, 3 rows) and one wide (8+ cols) to test horizontal scrolling
- A link and an image placeholder
- A hidden file comment like this: <!-- FILE:{"name":"...","startMarker":"..."} -->

Make the content realistic and cohesive, like a mini product changelog or feature overview.`,
  },
];

export function createTestResponse() {
  const result = streamText({
    model: poe("Claude-Sonnet-4.5"),
    messages: [{ role: "user" as const, content }],
    tools: {},
  });

  return createResponseStream(result.fullStream, {
    handlers: {
      onToolCall: () => {
        return null;
      },
      onToolResult: () => {
        return null;
      },
    },
  });
}

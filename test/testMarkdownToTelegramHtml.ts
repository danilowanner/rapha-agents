import { getUserChatId } from "../libs/context/getUserChatId";
import { markdownToTelegramHtml } from "../libs/utils/markdownToTelegramHtml";
import { telegramBot } from "../libs/utils/telegram";

const complexInput = `# API Integration Guide

I'll help you integrate the *Carousell API* into your **TypeScript** project. Here's what you need to know:

## Authentication

The API uses ~~basic auth~~ **OAuth 2.0** for authentication. You'll need to:

1. Register your application
2. Obtain client credentials
3. Exchange credentials for an access token

## Quick Start

First, install the required dependencies:

\`\`\`bash
npm install axios dotenv
npm install -D @types/node
\`\`\`

Then create your API client:

\`\`\`typescript
import axios from "axios";

const client = axios.create({
  baseURL: "https://api.carousell.com/v1",
  headers: {
    Authorization: \`Bearer \${process.env.API_TOKEN}\`,
  },
});

export const getListings = async () => {
  const response = await client.get("/listings");
  return response.data;
};
\`\`\`

## Available Endpoints

Here are the main endpoints you'll use:

- **GET** \`/listings\` - Fetch all listings
- **POST** \`/listings\` - Create a new listing
- **PUT** \`/listings/:id\` - Update a listing
- **DELETE** \`/listings/:id\` - Remove a listing

### Nested Operations

For advanced usage:

- User management
  - Create user profile
  - Update preferences
    - Notification settings
    - Privacy controls
- Analytics
  - View metrics
  - Export reports

> **Important**: Rate limits apply - max 100 requests per minute. See [documentation](https://docs.carousell.com/rate-limits) for details.

## Error Handling

Handle errors gracefully:

\`\`\`typescript
try {
  const listings = await getListings();
  console.log(\`Found \${listings.length} items\`);
} catch (error) {
  if (error.response?.status === 429) {
    console.error("Rate limit exceeded");
  }
  throw error;
}
\`\`\`

## Special Characters

When working with user input, remember to escape: \`< > & " '\`

---

Need more help? Check the [API reference](https://docs.carousell.com) or contact support@carousell.com.`;

const chatId = getUserChatId("Danilo");
if (!chatId) throw new Error("Chat ID not found for Danilo");

// Debug: Check token levels for nested list
import markdownIt from "markdown-it-ts";
const md = markdownIt();
const tokens = md.parse(complexInput, {});
console.log("=== List item token levels ===");
tokens.forEach((t, i) => {
  if (t.type === "list_item_open") {
    console.log(`Token ${i}: list_item_open, level=${t.level}`);
  }
});
console.log("");

const html = markdownToTelegramHtml(complexInput);

console.log("Sending to Telegram...");
console.log("\nHTML output:");
console.log(html);

telegramBot.api
  .sendMessage(chatId, html, { parse_mode: "HTML" })
  .then(() => {
    console.log("\n✓ Message sent successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n✗ Error sending message:", error);
    process.exit(1);
  });

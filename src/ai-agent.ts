import { generateText, stepCountIs, tool } from "ai";
import { z } from "zod";

import { getEnv } from "./env.ts";
import { getMcpClient } from "./mcp.ts";
import { createPoeAdapter } from "./providers/poe-provider.ts";

const env = getEnv();
const poe = createPoeAdapter({ apiKey: env.poeApiKey });

const system = `You are an autonomous but cautious seller’s assistant on the Carousell platform operating inside Danilo’s logged-in Chrome via Browser MCP. The window has the Carousell website open.

Your job is to:

- Manage Carousell inquiries for multiple listings.
- Gather necessary page data.
- Compose short, friendly seller replies.
- Fill forms and send messages on the platform.
- Schedule appropriate follow-ups.

## Operating constraints and capabilities

You control the browser through the provided Browser MCP tools.

## Important pages

- Selling inbox: https://www.carousell.com.hk/inbox/received/
- Unread inbox: https://www.carousell.com.hk/inbox/unread/
- Manage listings: https://www.carousell.com.hk/manage-listings/
- Updates (notifications): https://www.carousell.com.hk/updates/
- Sell (create listing): https://www.carousell.com.hk/sell
  - Danilo will create the listings; you do not need to.

## Primary objectives

For each unread conversation:

- Understand the buyer’s intent.
- Decide whether to reply, counter-offer, ask a clarifying question, or skip (spam).
- Draft a concise reply that moves the deal forward.
- If sending a reply, fill the compose box and submit on Carousell.
- Schedule a follow-up if the buyer doesn’t respond.

For listing management:

- Keep item context straight (title, price, min acceptable price, condition, meetup/shipping preferences).
- Avoid cross-item confusion; each thread maps to its listing.

## Planning and reliability rules

Prefer stable selectors; if unknown, use Snapshot to identify accessible names/text, then Click by text or selector.
Use Wait between steps; pages need time to render.
On failures, capture Screenshot and optionally Get Console Logs; retry at most once.
Never loop indefinitely; keep steps minimal and capped.`;

const inactive = `
Negotiation and messaging policy:

Availability: Confirm availability and propose a next step (meet-up or shipping).
Offers:
Accept if >= min acceptable price; propose concrete next steps.
If slightly below min acceptable (within ~10%), counter near min acceptable (1–3% above).
If far below (<75% of ask), politely decline and share your lowest acceptable.
Logistics: Offer 1–2 specific meetup windows/locations or 1 shipping option with price.
Bundle: Offer a modest discount and clarify items.
Spam/fraud indicators: off-platform payment, gift cards, overpayment scams, “email me” templates. If spam is likely, do not reply and mark as spam.
Keep replies under 640 characters, neutral and polite, with one simple question to progress.
`;

export async function test() {
  try {
    const data = await generateText({ model: poe("GPT-5-mini"), prompt: "What is love?" });
    console.log("Generated text:", data.text);
  } catch (err) {
    console.error("LLM call failed:", err);
  }
}

export async function testTool() {
  try {
    const data = await generateText({
      model: poe("GPT-5-mini"),
      tools: {
        weather: tool({
          description: "Get the weather in a location",
          inputSchema: z.object({
            location: z.string().describe("The location to get the weather for"),
          }),
          execute: async ({ location }) => ({
            location,
            temperature: 72 + Math.floor(Math.random() * 21) - 10,
          }),
        }),
      },
      stopWhen: stepCountIs(5),
      prompt: "What is the weather in San Francisco?",
    });

    console.log("Generated weather text:", data.text);
    console.log(data.content);
  } catch (err) {
    console.error("LLM call failed:", err);
  }
}

export async function testBrowser() {
  const mcpClient = await getMcpClient();

  try {
    const tools = await mcpClient.tools();
    const data = await generateText({
      model: poe("GPT-5-mini"),
      tools,
      stopWhen: stepCountIs(5),
      prompt: "Check if I have any listings.",
      system,
    });

    console.log("Browser text:", data.text);
    console.log("––––––");
    console.log(data.content);
  } finally {
    await mcpClient?.close();
  }
}

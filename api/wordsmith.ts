import { generateText, hasToolCall } from "ai";
import type { Context } from "hono";
import z from "zod";

import { createPoeAdapter } from "../libs/ai/providers/poe-provider.ts";
import { reasoningTool } from "../libs/ai/reasoningTool.ts";
import { env } from "../libs/env.ts";
import { isDefined } from "../libs/utils/isDefined.ts";
import { listCodec } from "../libs/utils/listCodec.ts";
import { sendResult } from "./../libs/ai/sendResultTool.ts";

const poe = createPoeAdapter({ apiKey: env.poeApiKey });

const allOptions = ["Translate", "Reply", "Format for Whatsapp"] as const;

const optionSchema = z.enum(allOptions);
type Option = z.infer<typeof optionSchema>;

const inputSchema = z.object({
  prompt: z.string().min(1),
  user: z.string().min(1),
  options: listCodec(z.array(optionSchema)).optional().default([]),
});

export const wordsmithHandler = async (c: Context) => {
  try {
    const contentType = c.req.header("content-type") || "";

    if (!contentType.includes("multipart/form-data")) {
      return c.json({ error: "Content-Type must be multipart/form-data" }, 400);
    }

    const formData = await c.req.formData();
    const { prompt, user, options } = inputSchema.parse({
      prompt: formData.get("prompt"),
      user: formData.get("user"),
      options: formData.get("options"),
    });

    const imageFile = formData.get("image") as File | null;
    const imageBuffer: Buffer | undefined = imageFile ? Buffer.from(await imageFile.arrayBuffer()) : undefined;

    console.log("[RECEIVED]", { prompt, user, options, hasImage: !!imageBuffer });

    const userMessageContent = [
      { type: "text" as const, text: getUserPrompt(options, prompt) },
      imageBuffer ? { type: "image" as const, image: imageBuffer } : null,
    ].filter(isDefined);

    const data = await generateText({
      model: poe("Claude-Sonnet-4.5"),
      messages: [{ role: "user" as const, content: userMessageContent }],
      system: getSystemPrompt(options, user),
      tools: {
        sendResult: sendResult(async ({ userMessage }) => {
          console.log(`[USER MSG] ${userMessage}`);
        }),
        addAReasoningStep: reasoningTool(async ({ title, details }) => {
          console.log(`[REASONING] ${title}\n${details}`);
        }),
      },
      toolChoice: "required",
      stopWhen: hasToolCall("sendResult"),
    });

    const allToolCalls = data.steps.flatMap((step) => step.toolCalls).filter((call) => !call.dynamic);
    const reasoningSteps = allToolCalls.filter((call) => call.toolName === "addAReasoningStep").map((c) => c.input);
    const result = allToolCalls.find((call) => call.toolName === "sendResult")?.input;

    if (!result) {
      return c.json({ error: "No result generated - sendResult tool was not called" }, 500);
    }

    console.log("[GENERATED]", result.resultClipboard);
    return c.json({
      clipboard: result.resultClipboard,
      userMessage: result.userMessage,
      reasoning: reasoningSteps,
      usage: data.usage,
      totalUsage: data.totalUsage,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("Error occurred:", errorMessage);
    return c.json({ error: errorMessage }, 500);
  }
};

function getUserPrompt(options: Option[], prompt: string): string {
  const optionPrompts = options.map((option) => {
    switch (option) {
      case "Translate":
        return "Please translate the text.";
      case "Reply":
        return "Please craft a reply to the message.";
      case "Format for Whatsapp":
        return "Please format the text for WhatsApp.";
    }
  });
  return [prompt, ...optionPrompts].join("\n");
}

function getSystemPrompt(options: Option[], user: string): string {
  const optionPrompts = options.map((option) => {
    switch (option) {
      case "Translate":
        return translatePrompt;
      case "Reply":
        return replyPrompt;
      case "Format for Whatsapp":
        return formatWhatsappPrompt;
    }
  });
  return [basePrompt(user), ...optionPrompts].join("\n");
}

const basePrompt = (user: string) => `<role>
You are Wordsmith, an AI assistant helping the user ${user} with text editing tasks.
</role>
<language>
When communication with ${user} you always use English.
  <details language="de">Use High German as written in Switzerland (Hochdeutsch with Swiss spelling).</details>
  <details language="zh">Use Mandarin Chinese as spoken in Beijing.</details>
  <details language="zh">Use Cantonese as spoken in Hong Kong.</details>
  <details language="id">Use Bahasa Indonesia as spoken in Bali.</details>
</language>
<process>
  1. Use the reasoning tool to outline your approach BEFORE sending the result. (optional)
  2. You MUST then use the sendResult tool to deliver the final user message.
</process>
<rules>
  - Always provide a user message.
  - Never use markdown in the user message, as it will be shown in plain text.
  - When composing text snippets for the user to use elsewhere (such as a reply, or formatted message) add them to the clipboard.
  - Put ONLY the snippet to the clipboard. No explanations, no meta-commentary, no "Here is..." preambles.
  - If using the clipboard, let them know.
  - When using non-English languages, translate for the user (to English) and provide the full content in the user message.
</rules>`;

const translatePrompt = `<task type="translate">
Professional Translation:
- Preserve the original tone, style, and intent
- Adapt idioms and cultural references appropriately
- Maintain any formatting present in the source
- Keep technical terms accurate
- When talking to the user, always use English.
- When translating for the user from a foreign language, assume they want it in English.
</task>`;

const replyPrompt = `<task type="reply">
Craft a thoughtful reply that:
- Matches the tone of the original message (formal/casual)
- Addresses all points raised
- Is appropriately concise or detailed based on context
- Sounds natural and conversational
- Keep a friendly, almost familial and professional tone.
- Use the appropriate language from context, or based on the user request.
</task>`;

const formatWhatsappPrompt = `<format type="whatsapp">
Format the text snippet using WhatsApp text formatting (NOT markdown):
- Bold: *text*
- Italic: _text_
- Bold+Italic: *_text_*
- Strikethrough: ~text~
- Inline code: \`code\`
- Quote block: > text
- Headings: *Bold text*
- Lists: Use "- " or "1. " at start of line (no indentation, ONLY single-level)
  - You MUST NOT use indentation (preceding whitespaces) as they do not work in Whatsapp.

Compose a message which suits WhatsApp, no subject line or formal greetings/signoff like "Dear...", "Best regards," etc.
</format>`;

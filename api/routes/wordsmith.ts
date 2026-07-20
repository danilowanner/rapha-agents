import { createFileRoute } from "@tanstack/react-router";
import { stepCountIs, streamText } from "ai";
import z from "zod";

import { createPoeAdapter } from "../../libs/ai/providers/poe-provider.ts";
import { reasoningTool } from "../../libs/ai/reasoningTool.ts";
import { setClipboard, setClipboardToolName } from "../../libs/ai/setClipboardTool.ts";
import { getUserChatId } from "../../libs/context/getUserChatId.ts";
import { env } from "../../libs/env.ts";
import { createResponseStream } from "../../libs/utils/createResponseStream.ts";
import { formatDateTime } from "../../libs/utils/formatDateTime.ts";
import { getErrorMessage } from "../../libs/utils/getErrorMessage.ts";
import { isDefined } from "../../libs/utils/isDefined.ts";
import { listCodec } from "../../libs/utils/listCodec.ts";
import { authMiddleware } from "../authHeaderMiddleware.ts";
import { addMemoryEntry, getMemoryAsXml } from "../features/memory.ts";
import { addClipboard, addResponse, createResponseId, getResponseClipboardValue } from "../features/responses/state.ts";

const poe = createPoeAdapter({ apiKey: env.poeApiKey });
const poeProviderOptions = {
  poe: {
    reasoningBudgetTokens: 1024,
  },
} as const;
const allOptions = ["Translate", "Screen", "Translate Screen", "Reply", "Format for Whatsapp", "Think First"] as const;
const optionSchema = z.enum(allOptions);
const inputSchema = z.object({
  prompt: z.string(),
  user: z.string().min(1),
  options: listCodec(z.array(optionSchema)).optional().default([]),
});
const reasoningToolName = "addAReasoningStep";

type Option = z.infer<typeof optionSchema>;

type Response = {
  responseId?: string;
  error?: string;
};

type MemoryInput = {
  prompt: string;
  options: Option[];
  agentMessage: string;
  resultClipboard?: string;
};

export const Route = createFileRoute("/wordsmith")({
  server: {
    middleware: [authMiddleware],
    handlers: {
      POST: async ({ request }) => {
        try {
          const contentType = request.headers.get("content-type") ?? "";

          if (!contentType.includes("multipart/form-data")) {
            return globalThis.Response.json(
              { error: "Error: Content-Type must be multipart/form-data" } satisfies Response,
              { status: 400 },
            );
          }

          const formData = await request.formData();
          const inputParsed = inputSchema.safeParse({
            prompt: formData.get("prompt"),
            user: formData.get("user"),
            options: formData.get("options"),
          });

          if (!inputParsed.success) {
            return globalThis.Response.json(
              { error: `Error: Invalid input.\n${inputParsed.error.message}` } satisfies Response,
              { status: 400 },
            );
          }

          const { prompt, user, options } = inputParsed.data;
          const chatId = getUserChatId(user);

          const imageFile = formData.get("image") as File | null;
          const imageBuffer: Buffer | undefined = imageFile ? Buffer.from(await imageFile.arrayBuffer()) : undefined;

          console.log("[WORDSMITH] Received:", { prompt, user, options, hasImage: !!imageBuffer });

          const userMessageContent = [
            { type: "text" as const, text: getUserPrompt(options, prompt) },
            imageBuffer ? { type: "image" as const, image: imageBuffer } : null,
          ].filter(isDefined);

          const responseId = createResponseId();
          const result = streamText({
            model: poe("claude-sonnet-4.6"),
            messages: [{ role: "user" as const, content: userMessageContent }],
            system: await getSystemPrompt(options, user),
            tools: {
              [setClipboardToolName]: setClipboard(({ content }) => {
                const success = addClipboard(responseId, content);
                console.log(`[CLIPBOARD] ${responseId}: ${content.length} chars`);
                return success;
              }),
              [reasoningToolName]: reasoningTool(async ({ title, details }) => {
                console.log(`[REASONING] ${title}\n${details}`);
              }, chatId),
            },
            stopWhen: stepCountIs(6),
            providerOptions: poeProviderOptions,
          });

          addResponse(
            responseId,
            createResponseStream(result.fullStream, {
              handlers: {
                onReasoningStart: () => "🤔 Reasoning...",
                onToolInputStart: (chunk) => {
                  if (chunk.dynamic) return null;
                  if (chunk.toolName === reasoningToolName) return "🤔 Thinking...";
                  return null;
                },
                onToolCall: (chunk) => {
                  if (chunk.dynamic) return null;
                  switch (chunk.toolName) {
                    case setClipboardToolName:
                      return formatClipboardBlock(chunk.input.content);
                    case reasoningToolName:
                      return `✅ Finished reasoning about 👉 *${chunk.input.title}*`;
                  }
                },
                onToolError: (chunk) => {
                  if (chunk.dynamic) return null;
                  console.error(`[WORDSMITH STREAM] tool-error: ${chunk.toolName}`, chunk.error);
                  return null;
                },
                onToolResult: () => null,
              },
              hooks: {
                onComplete: (chunks) => {
                  console.log(`[WORDSMITH COMPLETE] Sent ${chunks.length} chunks for response ID: ${responseId}`);
                  addMemoryEntry(
                    user,
                    createMemoryEntry({
                      prompt,
                      options,
                      agentMessage: chunks.join(""),
                      resultClipboard: getResponseClipboardValue(responseId) || undefined,
                    }),
                  );
                },
              },
            }),
            { userId: user },
          );

          result.finishReason.then((reason) => {
            console.log("[FINISHED]", reason);
          });

          return globalThis.Response.json({ responseId } satisfies Response);
        } catch (err) {
          const error = getErrorMessage(err);
          console.error("[WORDSMITH ERROR]", error);
          return globalThis.Response.json({ error }, { status: 500 });
        }
      },
    },
  },
});

const createMemoryEntry = (input: MemoryInput): { userMessage: string; agentMessage: string } => {
  const optionsStr = input.options.length > 0 ? ` [${input.options.join(", ")}]` : "";
  const userMessage = `${input.prompt}\n\n#Options\n${optionsStr}`;

  const clipboardStr = input.resultClipboard ? `\n\n#Clipboard\n${input.resultClipboard}` : "";
  const agentMessage = `${input.agentMessage}${clipboardStr}`;

  return { userMessage, agentMessage };
};

const formatClipboardBlock = (content: string): string => {
  const escapedContent = content.replaceAll("```", "``\\`");
  return `📋 Clipboard\n\n\`\`\`text\n${escapedContent}\n\`\`\``;
};

function getUserPrompt(options: Option[], prompt: string): string {
  const taskItems = options
    .map<string | undefined>((option) => {
      switch (option) {
        case "Translate":
          return '<task type="translate">Please translate the text.</task>';
        case "Reply":
          return '<task type="reply">Please craft a reply to the message.</task>';
        case "Format for Whatsapp":
          return '<task type="format_whatsapp">Please format the text for WhatsApp.</task>';
        case "Screen":
          return undefined;
        case "Translate Screen":
          return '<task type="screen_reader">Please read, translate and summarize the screen.</task>';
        case "Think First":
          return '<task type="think_first">REQUIRED: You MUST use the addAReasoningStep tool to outline your approach before sending the result.</task>';
      }
    })
    .filter(isDefined);
  const tasks = `<tasks>\n${taskItems.join("\n")}\n</tasks>`;
  return [prompt, tasks].join("\n");
}

async function getSystemPrompt(options: Option[], user: string): Promise<string> {
  const memoryXml = await getMemoryAsXml(user);
  const optionPrompts = options
    .map<string | undefined>((option) => {
      switch (option) {
        case "Translate":
          return translatePrompt;
        case "Reply":
          return replyPrompt;
        case "Format for Whatsapp":
          return formatWhatsappPrompt;
        case "Screen":
          return undefined;
        case "Translate Screen":
          return translateScreenPrompt;
        case "Think First":
          return thinkFirstPrompt;
      }
    })
    .filter(isDefined);
  return [basePrompt(user), memoryXml, ...optionPrompts].join("\n");
}

const basePrompt = (user: string) => `<role>
You are Wordsmith, an AI assistant helping the user ${user} with text editing tasks.
</role>
<context>
TODAY: The current date and time is ${formatDateTime()}.
CRITICAL: Your training data has a knowledge cutoff, but the current date above is accurate and provided by the system. Dates like "Nov 2025" are NOT typos or errors—they are real and current. Trust all dates provided by tools (e.g., content publish dates) as accurate.
</context>
<language>
When communication with ${user} you always use English.
</language>
<output>
Deliver the final user message as your normal assistant response.
Use brief, natural English unless the user explicitly asks for another language.
</output>
<clipboard tool="${setClipboardToolName}">
When composing a text snippet for the user to reuse elsewhere, call ${setClipboardToolName}.
Put ONLY the reusable snippet in the clipboard tool. No explanations, no meta-commentary, no "Here is..." preambles.
After setting clipboard content, mention briefly in your normal response that the clipboard text is ready.
</clipboard>
<reasoning tool="${reasoningToolName}">
CRITICAL: Do NOT use the ${reasoningToolName} tool unless:
a. You see explicit instructions in the user prompt telling you to use it, OR
b. The task involves truly complex linguistic decisions (multiple conflicting requirements, significant ambiguity, or critical judgment calls)

For standard translations, replies, and formatting tasks: proceed directly without reasoning.
</reasoning>
<rules>
  - Distinguish between *user messages* (communication meant for ${user}) and *text snippets* you are preparing.
  - Always provide a *user message*.
  - When composing *text snippets* for the user to use elsewhere (such as a reply, or formatted message), call ${setClipboardToolName}.
  - If using the clipboard tool, let ${user} know in the response.
  - When using non-English languages, translate for ${user} (to English) and provide the full content in the *user message*.
</rules>`;

const translatePrompt = `<task type="translate">
Professional Translation:
- Preserve the original tone, style, and intent
- Adapt idioms and cultural references appropriately
- Maintain any formatting present in the source
- Keep technical terms accurate
- When talking to the user, always use English.
- When translating for the user from a foreign language, assume they want it in English.

<details language="de">Use High German as written in Switzerland (Hochdeutsch with Swiss spelling).</details>
<details language="de-CH">
  Use Swiss German as spoken in Switzerland.
  
  **Authenticity:** The primary goal is to replicate the user's exact personal style. This is more important than adhering to any standardized Swiss German grammar.
  **Tone:** The tone must be friendly, direct, and informal.
  **Emojis:** Use emojis where appropriate to match the friendly and informal tone.
  
  Key vocabulary (always use these forms):
  - ich → i, wir → mir, unser/e → eusi
  - nicht → nid, nicht mehr → nümm
  - es → es/s (use "s" as contraction: s het, s goht)
  - ist → isch
  - haben → hend (plural) / han (singular)
  - gehen → gönd (plural) / goh (singular)
  - kommen → chöme, dort → dort
  - Jahr → johr, Woche → wuche, viel → vil
  - auch → au, schon → scho, zurück → zrugg
  - Kunde → chund, Mittagessen → zmittag
  - Uhr → -i suffix (e.g., am 4i = um 4 Uhr)
  - weil → will, dass → dass
  
  Grammar rules:
  - Use Perfect Tense for past (e.g., i bin gsi, mir hend plant), avoid simple past
  - Past participles often end in -et/-ed: kündet, akünded, gschaffet
  - Irregular forms: gha (gehabt), gsi (gewesen), cho (gekommen)
  - Use "z" before infinitives: zum eusi vollzitjobs an nagel z hänke
  - Common contractions: s = es, wenni = wenn ich, gfallts = gefällt es, gits = gibt es
  - Prefer informal word order, can start with non-subject
  
  Common phrases:
  - Liebi Grüess (friendly closing)
  - en Guete (enjoy your meal)
  - ume si (to be around)
  - nid zwäg si (not feeling well)
  - vo dem her (therefore)
  - emel (at least/anyway)
  - im Ahschluss (afterwards)
  - in Bahnhofsnöchi (near station)
  - es goht scho besser (it's getting better)
</details>
<details language="zh">Use Mandarin Chinese as spoken in Beijing.</details>
<details language="zh-HK">
  Use Cantonese as spoken in Hong Kong.
  Provide Jyutping romanization in the user message.
  NEVER put romanization in the snippets / clipboard which are not meant for the user, but for Cantonese speakers.
</details>
<details language="id">Use Bahasa Indonesia as spoken in Bali.</details>
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

const formatWhatsappPrompt = `<format type="format_whatsapp">
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

const translateScreenPrompt = `<task type="screen_reader">
You are to read the content of a screen (e.g., webpage, app interface) and perform the following:
1. Accurately translate all visible text into English.
2. Summarize the main purpose and key elements of the screen.
3. Note any important actions or buttons present.
Ensure clarity and conciseness in your summary, focusing on what a user needs to know about the screen.

<format>
  1. Key elements and purpose of the screen.
  2. Important actions/buttons, translation and original text.
  3. Any additional information on the screen.
</format>
</task>`;

const thinkFirstPrompt = `<tool_call tool_name="${reasoningToolName}">
Use the reasoning tool to think through your approach before generating the final output. Structure your reasoning as follows:

**Analysis:**
- What is the user asking for? (translation, reply, formatting, etc.)
- What language/style requirements apply?
- What tone and context clues are present?

**Approach:**
- Key decisions: word choice, formality level, structure
- Potential challenges: idioms, cultural references, ambiguities
- How to preserve intent while adapting style

**Execution Plan:**
- Steps to complete the task
- Quality checks before delivering

This internal reasoning ensures high-quality, contextually appropriate output.
</tool_call>`;

import { generateText, hasToolCall } from "ai";
import type { Context } from "hono";
import z from "zod";

import { createPoeAdapter } from "../libs/ai/providers/poe-provider.ts";
import { reasoningTool } from "../libs/ai/reasoningTool.ts";
import { sendMessage } from "../libs/ai/sendMessageTool.ts";
import { userContext } from "../libs/context/userContext.ts";
import { env } from "../libs/env.ts";
import { isDefined } from "../libs/utils/isDefined.ts";
import { listCodec } from "../libs/utils/listCodec.ts";
import { sendResult } from "./../libs/ai/sendResultTool.ts";

const poe = createPoeAdapter({ apiKey: env.poeApiKey });

const allOptions = ["Translate", "Translate Screen", "Reply", "Format for Whatsapp", "Think First"] as const;

const optionSchema = z.enum(allOptions);
type Option = z.infer<typeof optionSchema>;

const inputSchema = z.object({
  prompt: z.string(),
  user: z.string().min(1),
  options: listCodec(z.array(optionSchema)).optional().default([]),
});

type Response = {
  userMessage: string;
  clipboard?: string;
  reasoning?: Array<{ title: string; details: string }>;
  usage?: Record<string, unknown>;
  totalUsage?: Record<string, unknown>;
};

const sendMessageToolName = "sendMessage";
const sendResultToolName = "sendResult";
const reasoningToolName = "addAReasoningStep";

export const wordsmithHandler = async (c: Context) => {
  try {
    const contentType = c.req.header("content-type") || "";

    if (!contentType.includes("multipart/form-data")) {
      return c.json<Response>(warningResponse("Error: Content-Type must be multipart/form-data"));
    }

    const formData = await c.req.formData();
    const inputParsed = inputSchema.safeParse({
      prompt: formData.get("prompt"),
      user: formData.get("user"),
      options: formData.get("options"),
    });

    if (!inputParsed.success) {
      return c.json<Response>(warningResponse(`Error: Invalid input.\n${inputParsed.error.message}`));
    }

    const { prompt, user, options } = inputParsed.data;
    const chatId = getUserChatId(user);

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
        [sendMessageToolName]: sendMessage(async ({ userMessage }) => {
          console.log(`[MESSAGE] ${userMessage}`);
        }, chatId),
        [sendResultToolName]: sendResult(async ({ userMessage, resultClipboard }) => {
          console.log(`[RESULT] ${userMessage}`);
          console.log(`[CLIPBOARD] ${resultClipboard}`);
        }, chatId),
        [reasoningToolName]: reasoningTool(async ({ title, details }) => {
          console.log(`[REASONING] ${title}\n${details}`);
        }, chatId),
      },
      toolChoice: "required",
      stopWhen: hasToolCall(sendResultToolName),
    });

    const allToolCalls = data.steps.flatMap((step) => step.toolCalls).filter((call) => !call.dynamic);
    const reasoningSteps = allToolCalls.filter((call) => call.toolName === reasoningToolName).map((c) => c.input);
    const result = allToolCalls.find((call) => call.toolName === sendResultToolName)?.input;

    if (!result) {
      console.debug(data.content);
      return c.json<Response>(
        warningResponse(`Error: No result generated. ${sendResultToolName} tool was not called.`)
      );
    }

    return c.json<Response>({
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

const warningResponse = (message: string): Response => {
  console.warn("[RESPONSE]", message);
  return { userMessage: message };
};

function getUserChatId(user: string): string | undefined {
  switch (user) {
    case "Danilo":
      return "30318273";
    case "Kian":
      return "926261094";
    default:
      return undefined;
  }
}

function getUserPrompt(options: Option[], prompt: string): string {
  const taskItems = options.map<string>((option) => {
    switch (option) {
      case "Translate":
        return '<task type="translate">Please translate the text.</task>';
      case "Reply":
        return '<task type="reply">Please craft a reply to the message.</task>';
      case "Format for Whatsapp":
        return '<task type="format_whatsapp">Please format the text for WhatsApp.</task>';
      case "Translate Screen":
        return '<task type="screen_reader">Please read, translate and summarize the screen.</task>';
      case "Think First":
        return '<task type="think_first">REQUIRED: You MUST use the addAReasoningStep tool to outline your approach before sending the result.</task>';
    }
  });
  const tasks = `<tasks>\n${taskItems.join("\n")}\n</tasks>`;
  return [prompt, tasks].join("\n");
}

function getSystemPrompt(options: Option[], user: string): string {
  const optionPrompts = options.map<string>((option) => {
    switch (option) {
      case "Translate":
        return translatePrompt;
      case "Reply":
        return replyPrompt;
      case "Format for Whatsapp":
        return formatWhatsappPrompt;
      case "Translate Screen":
        return translateScreenPrompt;
      case "Think First":
        return thinkFirstPrompt;
    }
  });
  return [basePrompt(user), userContext(user), ...optionPrompts].join("\n");
}

const now = () => new Date().toISOString();

const basePrompt = (user: string) => `<role>
You are Wordsmith, an AI assistant helping the user ${user} with text editing tasks.
</role>
<context>
The current date and time is ${now()}.
</context>
<language>
When communication with ${user} you always use English.
</language>
<progress tool="${sendMessageToolName}">
Use the ${sendMessageToolName} tool to keep ${user} informed during task execution:
- Acknowledge receipt: Confirm understanding of the request
- Share progress: Update on complex or multi-step operations
- Ask clarifying questions: When input is ambiguous or incomplete
- Provide feedback: Note interesting findings or considerations

Keep messages brief, natural, and conversational. Use this tool between other operations, not for the final result.
</progress>
<output tool="${sendResultToolName}">
You MUST use the ${sendResultToolName} tool to deliver the final user message.
1. Compose the clipboard content (if applicable, otherwise leave empty).
2. Leave a user message for ${user}.
  - The user message can mention the clipboard, provide a summary or translation/romanization if relevant.
</output>
<reasoning tool="${reasoningToolName}">
CRITICAL: Do NOT use the ${reasoningToolName} tool unless:
a. You see explicit instructions in the user prompt telling you to use it, OR
b. The task involves truly complex linguistic decisions (multiple conflicting requirements, significant ambiguity, or critical judgment calls)

For standard translations, replies, and formatting tasks: proceed directly to ${sendResultToolName} without reasoning.
</reasoning>
<rules>
  - Distinguish between *user messages* (communication meant for ${user}) and *text snippets* you are preparing.
  - Always provide a *user message*.
  - NEVER use markdown in the *user message*, as it will be shown in plain text.
  - When composing *text snippets* for the user to use elsewhere (such as a reply, or formatted message) add them to the *clipboard*.
  - Put ONLY the *text snippet* to the clipboard. No explanations, no meta-commentary, no "Here is..." preambles.
  - If using the clipboard, let ${user} know.
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

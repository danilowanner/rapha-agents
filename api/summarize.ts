import { generateText, hasToolCall, type UserContent } from "ai";
import type { Context } from "hono";
import z from "zod";

import { fetchWebsite } from "../libs/ai/fetchWebsiteTool.ts";
import { createPoeAdapter } from "../libs/ai/providers/poe-provider.ts";
import { sendResult } from "../libs/ai/sendResultTool.ts";
import { getUserChatId } from "../libs/context/getUserChatId.ts";
import { env } from "../libs/env.ts";
import { fileToImageBuffers } from "../libs/utils/fileToImageBuffers.ts";
import { fileToText } from "../libs/utils/fileToText.ts";

const poe = createPoeAdapter({ apiKey: env.poeApiKey });

const inputSchema = z.object({
  text: z.string().optional(),
  user: z.string().min(1),
});

type Response = {
  clipboard?: string;
  userMessage?: string;
};

const sendResultToolName = "sendResult";
const fetchWebsiteToolName = "fetchWebsite";

/**
 * Handles summarization requests for text, URLs, and documents.
 */
export const summarizeHandler = async (c: Context) => {
  try {
    const contentType = c.req.header("content-type") || "";

    if (!contentType.includes("multipart/form-data")) {
      return c.json<Response>(warningResponse("Error: Content-Type must be multipart/form-data"));
    }

    const formData = await c.req.formData();
    const inputParsed = inputSchema.safeParse({
      text: formData.get("text"),
      user: formData.get("user"),
    });

    if (!inputParsed.success) {
      return c.json<Response>(warningResponse(`Error: Invalid input.\n${inputParsed.error.message}`));
    }

    const { text, user } = inputParsed.data;
    const chatId = getUserChatId(user);

    const file = formData.get("file") as File | null;

    if (!text && !file) {
      return c.json<Response>(warningResponse("Error: Must provide either text or file to summarize"));
    }

    console.log("[RECEIVED]", { hasText: !!text, hasFile: !!file, user });

    const userMessageContent = await buildUserMessageContent(text, file);

    const data = await generateText({
      model: poe("Claude-Sonnet-4.5"),
      messages: [{ role: "user" as const, content: userMessageContent }],
      system: getSystemPrompt(user),
      tools: {
        [sendResultToolName]: sendResult(async ({ userMessage }) => {
          console.log(`[SUMMARY] ${userMessage}`);
        }, chatId),
        [fetchWebsiteToolName]: fetchWebsite(async ({ url, title }) => {
          console.log(`[FETCHED] ${url} - ${title}`);
        }),
      },
      toolChoice: "auto",
      stopWhen: hasToolCall(sendResultToolName),
    });

    const allToolCalls = data.steps.flatMap((step) => step.toolCalls).filter((call) => !call.dynamic);
    const result = allToolCalls.find((call) => call.toolName === sendResultToolName)?.input;
    const agentText = data.text;

    if (result || agentText) {
      const userMessage = result?.userMessage || agentText;
      console.log("[RESPONSE]", userMessage);
      return c.json<Response>({
        userMessage,
        clipboard: result?.resultClipboard,
      });
    } else {
      console.debug(data.content);
      return c.json<Response>(
        warningResponse(`Error: No result generated. ${sendResultToolName} tool was not called.`)
      );
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("Error occurred:", errorMessage);
    return c.json({ error: errorMessage }, 500);
  }
};

async function buildUserMessageContent(text: string | undefined, file: File | null): Promise<UserContent> {
  const content: UserContent = [{ type: "text", text: `Please summarize the content below.` }];

  if (text) {
    const urlPattern = /^https?:\/\/.+/i;
    if (urlPattern.test(text.trim())) {
      content.push({ type: "text", text: `<content_url>${text}</content_url>` });
    } else {
      content.push({ type: "text", text: `<text_content>${text}</text_content>` });
    }
  }
  if (file) {
    const pdfText = file.type === "application/pdf" ? await fileToText(file).catch(() => null) : null;
    const imageBuffers = await fileToImageBuffers(file, { maxPages: 5, scale: 1024 });
    content.push(...imageBuffers.map((buffer) => ({ type: "image" as const, image: buffer })));
    if (pdfText) content.push({ type: "text", text: `<pdf_text>${pdfText}</pdf_text>` });
  }

  return content;
}

function getSystemPrompt(user: string): string {
  const now = new Date().toISOString();

  return `<role>
You are my mobile-friendly, scientifically rigorous summarization assistant helping ${user} understand and condense information.
Given a document, PDF, image, article text, or URL, produce a concise summary that captures all crucial information without unnecessary verbosity, and background-check key claims.
</role>
<context>
The current date and time is ${now}.
</context>
<task>
Your task is to create clear, concise, and accurate summaries of the provided content. You may receive:
- Plain text to summarize
- A URL to fetch and summarize (use the ${fetchWebsiteToolName} tool when you see a URL in the text)
- Files (PDFs, images) to analyze and summarize

For each request:
1. If the text contains a URL, use the ${fetchWebsiteToolName} tool to retrieve the content first
2. Analyze the content carefully
3. Extract the key points and main ideas
4. Create a well-structured summary that captures the essence

When you have a final summary ready, use the ${sendResultToolName} tool to deliver it.
</task>
<summary_guidelines>
Your summaries should:
- Be concise but comprehensive
- Highlight the most important information
- Use clear, accessible language
- Maintain factual accuracy
- Be structured logically (use bullet points or paragraphs as appropriate)
- Preserve any critical details like numbers, dates, or names
</summary_guidelines>
<context>
When you respond:
- Audience: scientifically minded reader.
- Tone: neutral, precise, and concise. Use bullets. Avoid tables unless asked.
- Phone-friendly: skimmable, structured and using consistent formatting.
- Do not omit crucial caveats or uncertainties. If unsure, say so.
- If content is already concise and to the point: keep all key information intact and do not omit details unless redundant.
- If content is very long or complex: propose a plan to process in chunks.
</context>
<output tool="${sendResultToolName}">
Use the ${sendResultToolName} tool to deliver the final summary.
- Set resultClipboard to the complete summary in markdown
- Add a quick userMessage in plain text to display to the user. It should be a brief confirmation and overview of the summary.
</output>
<output-format>
(in this exact order)
1) High-level summary (3–5 bullet points, ≤200 words total).
2) Critical takeaways not to miss (bullets).
3) Detailed and structured article with headings, paragraphs and lists. Adjust length to fit all important information without being overly verbose or adding fluff. (≤2000 words)
4) Verification status and confidence
   - e.g., “Checked: key claims verified with [1][2] | Confidence: medium-high | Currency: up to 2025-10.”
5) If available: Source and/or Link (optional)
</output-format>
<citations>
- Use numbered inline references like [1], [2].
- Reference list: include title, author(s), outlet/venue, date, and URL/DOI.
- For claims taken from the provided document, include page/section anchors when possible.
- Prefer authoritative sources; avoid unsourced blogs or low-credibility outlets.
</citations>
<constraints-safety>
- Do not fabricate data or citations. If information is missing, say so and ask a clarifying question.
- Flag stale information or outdated data and note the publication/last-updated date.
</constraints-safety>`;
}

const warningResponse = (message: string): Response => {
  console.warn("[RESPONSE]", message);
  return { userMessage: message };
};

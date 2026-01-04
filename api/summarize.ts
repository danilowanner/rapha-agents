import { streamText, type UserContent } from "ai";
import type { Context } from "hono";
import z from "zod";

import { createFile, createFileToolName, getMarker } from "../libs/ai/createFileTool.ts";
import { fetchWebsite } from "../libs/ai/fetchWebsiteTool.ts";
import { fetchYoutubeTranscript } from "../libs/ai/fetchYoutubeTranscriptTool.ts";
import { createPoeAdapter } from "../libs/ai/providers/poe-provider.ts";
import { stopOnDoneOrMaxSteps } from "../libs/ai/stopConditions.ts";
import { getUserChatId } from "../libs/context/getUserChatId.ts";
import { env } from "../libs/env.ts";
import { createResponseStream } from "../libs/utils/createResponseStream.ts";
import { fileToImageBuffers } from "../libs/utils/fileToImageBuffers.ts";
import { fileToText } from "../libs/utils/fileToText.ts";
import { formatDateTime } from "../libs/utils/formatDateTime.ts";
import { getErrorMessage } from "../libs/utils/getErrorMessage.ts";
import { addResponse } from "./responses/state.ts";
import { sendTelegramResponseFile } from "./responses/telegram.ts";

const MAX_PDF_PAGES = 20;

const inputSchema = z.object({
  text: z.string().optional(),
  user: z.string().min(1),
});

type Response = {
  responseId?: string;
  error?: string;
};

const fetchYoutubeTranscriptToolName = "fetchYoutubeTranscript";
const fetchWebsiteToolName = "fetchWebsite";

const poe = createPoeAdapter({ apiKey: env.poeApiKey });

/**
 * Handles summarization requests for text, URLs, and documents.
 */
export const summarizeHandler = async (c: Context) => {
  try {
    const contentType = c.req.header("content-type") || "";

    if (!contentType.includes("multipart/form-data")) {
      return c.json<Response>(warningResponse("Error: Content-Type must be multipart/form-data"), 400);
    }

    const formData = await c.req.formData();
    const inputParsed = inputSchema.safeParse({
      text: formData.get("text"),
      user: formData.get("user"),
    });

    if (!inputParsed.success) {
      return c.json<Response>(warningResponse(`Error: Invalid input.\n${inputParsed.error.message}`), 400);
    }

    const { text, user } = inputParsed.data;
    const chatId = getUserChatId(user);

    const file = formData.get("file") as File | null;

    if (!text && !file) {
      return c.json<Response>(warningResponse("Error: Must provide either text or file to summarize"), 400);
    }

    console.log("[RECEIVED]", { hasText: !!text, hasFile: !!file, user });

    const userMessageContent = await buildUserMessageContent(text, file);

    const result = streamText({
      model: poe("Claude-Sonnet-4.5"),
      messages: [{ role: "user" as const, content: userMessageContent }],
      system: getSystemPrompt(user),
      tools: {
        [fetchYoutubeTranscriptToolName]: fetchYoutubeTranscript(async ({ url, title }) => {
          console.log(`[FETCHED] ${url} - ${title}`);
        }),
        [fetchWebsiteToolName]: fetchWebsite(async ({ url, title }) => {
          console.log(`[FETCHED] ${url} - ${title}`);
        }),
        [createFileToolName]: createFile((input) => {
          console.log(`[FILE] ${input.name}${input.description ? ` - ${input.description}` : ""}`);
        }),
      },
      toolChoice: "auto",
      stopWhen: stopOnDoneOrMaxSteps(6),
      onStepFinish: ({ content }) => {
        const toolErrors = content.filter((part) => part.type === "tool-error");
        if (toolErrors.length > 0)
          toolErrors.forEach((content) => {
            console.error(`[TOOL ERROR] ${content.toolName}: ${getErrorMessage(content.error)}`);
          });
      },
    });

    result.warnings.then((warnings) => {
      if ((warnings?.length ?? 0) > 0) console.warn("[WARNINGS]", warnings);
    });
    result.finishReason.then((reason) => {
      console.log("[FINISHED]", reason);
    });

    const responseId = addResponse(
      createResponseStream(result.fullStream, {
        handlers: {
          onToolCall: (chunk) => {
            if (chunk.dynamic) return null;
            switch (chunk.toolName) {
              case fetchWebsiteToolName:
                return `🌐 Reading the website ${chunk.input.url}`;
              case fetchYoutubeTranscriptToolName:
                return `▶️ Fetching transcript from YouTube video ${chunk.input.url}`;
              case createFileToolName:
                return null;
            }
          },
          onToolResult: (chunk) => {
            if (chunk.dynamic) return null;
            switch (chunk.toolName) {
              case fetchWebsiteToolName:
                const pageTitle: string = chunk.output.title ? `"${chunk.output.title}"` : "";
                return `✅ Fetched page ${pageTitle}`;
              case fetchYoutubeTranscriptToolName:
                const ytTitle: string = chunk.output.title ? `"${chunk.output.title}"` : "";
                return `✅ Fetched transcript ${ytTitle}`;
              case createFileToolName:
                return { marker: getMarker(chunk.output) };
            }
          },
        },
        hooks: {
          onComplete: (chunks) => {
            console.log(`[STREAM COMPLETE] Sent ${chunks.length} chunks for response ID: ${responseId}`);
            if (chatId) sendTelegramResponseFile(chatId, responseId);
          },
        },
      })
    );
    console.log(`[RESPONSE CREATED] ID: ${responseId}`);

    return c.json<Response>({ responseId });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("[RESPONSE ERROR]:", errorMessage);
    return c.json({ error: errorMessage }, 500);
  }
};

async function buildUserMessageContent(text: string | undefined, file: File | null): Promise<UserContent> {
  const content: UserContent = [{ type: "text", text: `Please summarize the content below and save as a file.` }];

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
    const imageBuffers = await fileToImageBuffers(file, { maxPages: MAX_PDF_PAGES });
    content.push(...imageBuffers.map((buffer) => ({ type: "image" as const, image: buffer })));
    if (pdfText) content.push({ type: "text", text: `<pdf_text>${pdfText}</pdf_text>` });
  }

  return content;
}

function getSystemPrompt(user: string): string {
  return `<role>
You are my mobile-friendly, scientifically rigorous summarization assistant helping ${user} understand and condense information.
Given a document, PDF, image, article text, or URL, produce a concise summary that captures all crucial information without unnecessary verbosity, and background-check key claims.
</role>
<context>
TODAY: ${formatDateTime()}.
CRITICAL: Your training data has a knowledge cutoff, but the current date above is accurate and provided by the system. Dates like "Nov 2025" are NOT typos or errors—they are real and current. Trust all dates provided by tools (e.g., YouTube publish dates) as accurate.
When content says "last week", "yesterday", etc., calculate relative to the source's publish date.
</context>
<task>
Your task is to create clear, concise, and accurate summaries of the provided content. You may receive:
- Plain text to summarize
- A URL to fetch and summarize (use the ${fetchWebsiteToolName} tool when you see a URL in the text)
- Files (PDFs, images) to analyze and summarize

For each request:
1. Retrieve: If the text contains a URL, use the ${fetchWebsiteToolName} tool to retrieve the content first
2. Summarize: Analyze, extract the key points and main ideas, create a well-structured summary that captures the essence
3. Save: Keep the summary as a markdown file using the ${createFileToolName} tool
</task>
<output-format>
(in this exact order)
1) High-level summary (3–5 bullet points, ≤200 words total).
2) Critical takeaways not to miss (bullets).
3) Detailed and structured article with headings, paragraphs and lists. Adjust length to fit all important information without being overly verbose or adding fluff (up to 10min read).
4) Confidence and credibility
5) If available: Source and/or Link (optional)
</output-format>
<create-file-tool>
You MUST use the ${createFileToolName} tool to save your summary as a file.
Immediately after writing, call ${createFileToolName} with:
  - name: A descriptive, sentence-cased filename based on the content (e.g., "Climate report summary.md")
  - description: A brief one-line description of the file contents
  - startMarker: The exact first 50-100 characters of your summary content
  - done: true (since this completes the task)
</create-file-tool>
<summary_guidelines>
Your summaries should:
- Be concise but comprehensive
- Highlight the most important information
- Use clear, accessible language
- Maintain factual accuracy
- Be structured logically (use bullet points or paragraphs as appropriate)
- Preserve any critical details like numbers, dates, or names
</summary_guidelines>
<fidelity_requirements>
When you respond:
- Audience: scientifically minded reader.
- Tone: neutral, precise, and concise. Use bullets.
- Phone-friendly: skimmable, structured and using consistent formatting.
- Do not omit crucial caveats or uncertainties. If unsure, say so.
CRITICAL: Stay faithful to the source material.
- DO NOT add information, context, or explanations not present in the source
- DO NOT embellish or expand on points beyond what is explicitly stated
- DO NOT insert background information, definitions, or elaborations unless they appear in the source
- If the source is already concise, preserve its brevity—do not artificially expand it
- Quote directly when precision matters; paraphrase only to compress, never to add
- If asked to summarize something that is already minimal, acknowledge this and present it as-is
</fidelity_requirements>
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
  console.warn("[ERROR]", message);
  return { error: message };
};

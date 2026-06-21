import { generateText, type UserContent } from "ai";
import type { Context } from "hono";
import { createPoeAdapter } from "../../libs/ai/providers/poe-provider.ts";
import { reasoningTool } from "../../libs/ai/reasoningTool.ts";
import { stopOnDoneOrMaxSteps } from "../../libs/ai/stopConditions.ts";
import { submitFilename, submitFilenameToolName } from "../../libs/ai/submitFilenameTool.ts";
import { env } from "../../libs/env.ts";
import { fileToImageBuffers } from "../../libs/utils/fileToImageBuffers.ts";
import { fileToText } from "../../libs/utils/fileToText.ts";
import { isDefined } from "../../libs/utils/isDefined.ts";

const poe = createPoeAdapter({ apiKey: env.poeApiKey });
const reasoningToolName = "addAReasoningStep";

/**
 * Handler for the /filename endpoint.
 * Analyzes file contents using vision and generates a standardized filename in format: YYYY-MM-DD Title.ext
 * Accepts file uploads (PDF or images).
 */
export async function filenameHandler(c: Context) {
  try {
    const contentType = c.req.header("content-type") || "";

    if (!contentType.includes("multipart/form-data")) {
      return c.json({ error: "Content-Type must be multipart/form-data" }, 400);
    }

    const formData = await c.req.formData();
    const file = formData.get("file") as File | null;
    const userPrompt = formData.get("prompt") as string | null;

    if (!file) {
      return c.json(
        {
          error: "Invalid request",
          details: "File is required",
        },
        400,
      );
    }

    const extension = file.name.split(".").pop() || "pdf";

    const extractedText = file.type === "application/pdf" ? await fileToText(file).catch(() => null) : null;
    const imageBuffers = await fileToImageBuffers(file, { maxPages: 5 });

    const content: UserContent = [{ type: "text", text: "Analyze this document and generate a filename:" }];

    if (extractedText) {
      content.push({
        type: "text",
        text: `<extracted_text>\n${extractedText}\n</extracted_text>`,
      });
    }

    content.push(...imageBuffers.map((buffer) => ({ type: "image" as const, image: buffer })));

    const { steps } = await generateText({
      model: poe("gemini-3.1-flash-lite"),
      system: systemPrompt(userPrompt),
      messages: [
        {
          role: "user",
          content,
        },
      ],
      tools: {
        [reasoningToolName]: reasoningTool(async ({ title, details }) => {
          console.log(`[FILENAME REASONING] ${title}\n${details}`);
        }),
        [submitFilenameToolName]: submitFilename(({ filename }) => {
          console.log(`[FILENAME SUBMIT] ${filename}`);
        }),
      },
      stopWhen: stopOnDoneOrMaxSteps(6),
      temperature: 0.3,
    });

    const filename = [...steps]
      .reverse()
      .flatMap((step) => step.toolResults)
      .map((toolResult) =>
        toolResult.dynamic === false && toolResult.toolName === submitFilenameToolName
          ? toolResult.output?.filename?.trim()
          : null,
      )
      .filter(isDefined)[0];

    const fullFilename = `${filename}.${extension}`;

    return c.json({
      filename: fullFilename,
    });
  } catch (error) {
    console.error("Error in filename handler:", error);
    return c.json(
      {
        error: "Failed to generate filename",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
}

const today = () => new Date().toISOString().split("T")[0];

const getSubmittedFilename = (
  steps: Array<{ toolResults: Array<{ dynamic?: boolean; toolName: string; output: unknown }> }>,
) => {
  for (const step of [...steps].reverse()) {
    for (const toolResult of step.toolResults) {
      if (toolResult.dynamic || toolResult.toolName !== submitFilenameToolName) continue;
      const { output } = toolResult;
      if (
        typeof output === "object" &&
        output !== null &&
        "done" in output &&
        output.done === true &&
        "filename" in output &&
        typeof output.filename === "string"
      )
        return output.filename.trim();
    }
  }
};

const systemPrompt = (userPrompt: string | null) => `<role>
You are a filename generator. Analyze the provided file contents and extract:
1. The most appropriate title (e.g., subject line, heading, or main topic)
2. The relevant date if present in the content
</role>

<workflow>
1. Use ${reasoningToolName} to analyze the document and decide on title and date
2. Call ${submitFilenameToolName} with the final filename
Do NOT output the filename as plain text. The filename must be submitted via ${submitFilenameToolName} only.
</workflow>

<rules>
- Title should be concise and descriptive
- Use sentence case for the title
- If no date is found, use today's date: ${today()}
- Filename format: YYYY-MM-DD Title
- Do not include the file extension
- Keep the title under 80 characters
- Remove special characters that are invalid in filenames (/, \\, :, *, ?, ", <, >, |)
</rules>

<examples>
- "2024-08-15 Tax assessment final 23-24 and provisional 24-25"
- "2025-08-26 Apple iCloud+ 2TB invoice"
</examples>

${userPrompt ? `<naming_instructions>\n${userPrompt}\n</naming_instructions>\n\n` : ""}
`;

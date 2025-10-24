import { generateText } from "ai";
import type { Context } from "hono";
import { createPoeAdapter } from "../libs/ai/providers/poe-provider.ts";
import { env } from "../libs/env.ts";
import { fileToImageBuffers } from "../libs/utils/fileToImageBuffers.ts";

const poe = createPoeAdapter({ apiKey: env.poeApiKey });

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

    if (!file) {
      return c.json(
        {
          error: "Invalid request",
          details: "File is required",
        },
        400
      );
    }

    const extension = file.name.split(".").pop() || "pdf";
    const imageBuffers = await fileToImageBuffers(file, { maxPages: 5, scale: 1024 });

    const { text } = await generateText({
      model: poe("Claude-Haiku-4.5"),
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Analyze this document and generate a filename:" },
            ...imageBuffers.map((buffer) => ({
              type: "image" as const,
              image: buffer,
            })),
          ],
        },
      ],
      temperature: 0.3,
    });

    const filename = text.trim();
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
      500
    );
  }
}
const today = () => new Date().toISOString().split("T")[0];

const systemPrompt = `<role>
You are a filename generator. Analyze the provided file contents and extract:
1. The most appropriate title (e.g., subject line, heading, or main topic)
2. The relevant date if present in the content
</role>

<rules>
- Title should be concise and descriptive
- Use sentence case for the title
- If no date is found, use today's date: ${today()}
- Return ONLY the filename in format: YYYY-MM-DD Title
- Do not include the file extension
- Keep the title under 80 characters
- Remove special characters that are invalid in filenames (/, \\, :, *, ?, ", <, >, |)
</rules>

<examples>
- "2024-08-15 Tax assessment final 23-24 and provisional 24-25"
- "2025-08-26 Apple iCloud+ 2TB invoice"
</examples>`;

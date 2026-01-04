import { generateText, zodSchema } from "ai";
import z from "zod";
import { env } from "../../env.ts";
import { getErrorMessage } from "../../utils/getErrorMessage.ts";
import { createPoeAdapter } from "../providers/poe-provider.ts";

const TRUNCATE_LENGTH = 3000;

const poe = createPoeAdapter({ apiKey: env.poeApiKey });

const fileMetadataSchema = z.object({
  name: z.string().describe("Filename with extension, Sentence cased (e.g. 'Climate report summary.md')"),
  description: z.string().optional().describe("Brief one-line description"),
  startMarker: z.string().min(10).describe("EXACT characters from where file content begins, ~50 characters long"),
});
const schemaString = JSON.stringify(zodSchema(fileMetadataSchema), null, 2);

type FileResult = {
  name: string;
  description?: string;
  result: string;
};

/**
 * Extracts file metadata from an AI response using Claude Haiku.
 * Fallback for when explicit file markers are not present in the response.
 */
export async function extractFile(response: string): Promise<FileResult | null> {
  try {
    const truncated = response.slice(0, TRUNCATE_LENGTH);

    const { text } = await generateText({
      model: poe("Claude-Haiku-4.5"),
      prompt: `Extract file metadata from this AI response. Return ONLY a JSON object, no markdown, no explanation.

JSON schema:
${schemaString}

CRITICAL for startMarker:
- Copy around 50 exact characters verbatim from the response
- Must be character-for-character identical (spaces, newlines, punctuation)
- Choose text marking the START of actual file content (not preamble, no tools, no greetings)
- Will be used with indexOf() - any deviation causes failure

Response to analyze:
${truncated}

JSON:`,
    });

    console.log("Extracted file metadata response:", text);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON object found in AI response");

    const parsed = fileMetadataSchema.safeParse(JSON.parse(jsonMatch[0]));
    if (!parsed.success) throw new Error("Failed to parse file metadata JSON");

    const { name, description, startMarker } = parsed.data;
    const startIndex = response.indexOf(startMarker);
    if (startIndex === -1) throw new Error("Start marker not found in response");

    return {
      name,
      description,
      result: response.slice(startIndex).trim(),
    };
  } catch (e) {
    console.error("Error extracting file metadata:", getErrorMessage(e));
    return null;
  }
}

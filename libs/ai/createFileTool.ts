import { type InferToolOutput, tool } from "ai";
import z from "zod";

export const FILE_MARKER_PREFIX = "<!-- FILE:";
export const FILE_MARKER_SUFFIX = " -->";

export type FileMetadata = {
  name: string;
  description?: string;
  startMarker: string;
};

const createFileInput = z.object({
  name: z.string().min(1).describe("Filename with extension, Sentence cased (e.g., 'The benefits of omega-3.md')"),
  description: z.string().optional().describe("Brief one-line description of the file contents"),
  startMarker: z
    .string()
    .min(10)
    .describe("The exact starting text of your content (first 50-100 chars). Used to locate the file content."),
  done: z
    .boolean()
    .describe(
      "Set to true if this is the final output and the task is complete. Set to false if you need to continue with the task."
    ),
});

export const createFileToolName = "createFile";

type CreateFileInput = z.infer<typeof createFileInput>;
type Handler = (result: CreateFileInput) => void;

/**
 * Tool for marking file content in streamed responses.
 * AI writes content first, then calls this tool with filename and start marker.
 */
export const createFile = (handler: Handler) =>
  tool({
    description: `Save your written content as a file. After writing your response content, call this tool to mark it as a file. Set done=true if the task is complete, or done=false if you need to continue.`,
    inputSchema: createFileInput,
    execute: async (input) => {
      handler(input);
      return {
        success: true,
        done: input.done,
        metadata: { name: input.name, description: input.description, startMarker: input.startMarker },
      } as const;
    },
  });

export const getMarker = (output: InferToolOutput<ReturnType<typeof createFile>>): string => {
  const metadataJson = JSON.stringify(output.metadata);
  const hiddenMeta = `${FILE_MARKER_PREFIX}${metadataJson}${FILE_MARKER_SUFFIX}`;
  const visiblePart = `---\n📄 **Saved as:** ${output.metadata.name}`;
  return `${hiddenMeta}\n${visiblePart}`;
};

type ExtractedFile = {
  name: string;
  description?: string;
  result: string;
};

/**
 * Extracts file content from a response string using a start marker.
 * Returns the content from the start marker to the end marker with metadata.
 */
export const extractFileByMarker = (response?: string): ExtractedFile | null => {
  if (!response) return null;
  const markerStart = response.indexOf(FILE_MARKER_PREFIX);
  const metaStart = markerStart + FILE_MARKER_PREFIX.length;
  const metaEnd = response.indexOf(FILE_MARKER_SUFFIX, metaStart);

  if (markerStart === -1 || metaEnd === -1) return null;

  try {
    const metadataJson = response.slice(metaStart, metaEnd);
    const metadata = JSON.parse(metadataJson) as FileMetadata;

    const startMarkerStart = response.indexOf(metadata.startMarker);
    const content = response.slice(startMarkerStart !== -1 ? startMarkerStart : 0, markerStart).trim();
    return { name: metadata.name, description: metadata.description, result: content };
  } catch {
    return null;
  }
};

import { tool } from "ai";
import { exec } from "child_process";
import { promisify } from "util";
import z from "zod";

const execAsync = promisify(exec);

const youtubeTranscript = z.object({
  url: z.url().describe("The URL of the YouTube video to fetch transcript from"),
});

export type YoutubeTranscript = z.infer<typeof youtubeTranscript>;

type Handler = (content: Content) => Promise<void>;
type Content = {
  url: string;
  transcript: string;
  title?: string;
};

/**
 * Fetches YouTube transcript using YouTube's timedtext API.
 */
export const fetchYoutubeTranscript = (handler: Handler) =>
  tool({
    description: `Fetch transcript from a YouTube video.`,
    inputSchema: youtubeTranscript,
    execute: async ({ url }) => {
      const { transcript, title } = await fetchTranscript(url);
      await handler({ url, transcript, title });
      return { title, transcript };
    },
  });

async function fetchTranscript(url: string): Promise<Content> {
  const videoId = url.match(/(?:v=|\/)([0-9A-Za-z_-]{11}).*/)?.[1];
  if (!videoId) throw new Error("Invalid YouTube URL");

  try {
    // Use yt-dlp to fetch captions - it handles YouTube's signature requirements
    const ytDlpPath = process.env.YT_DLP_PATH || "yt-dlp";

    // Get title first
    const titleCmd = `${ytDlpPath} --get-title "${url}" 2>/dev/null`;
    const { stdout: titleOutput } = await execAsync(titleCmd);
    const title = titleOutput.trim();

    // Download captions
    const captionCmd = `${ytDlpPath} --skip-download --write-auto-subs --sub-lang en --sub-format vtt -o "/tmp/yt-transcript-${videoId}" "${url}" 2>/dev/null`;
    await execAsync(captionCmd);

    // Read the VTT file
    const vttPath = `/tmp/yt-transcript-${videoId}.en.vtt`;
    const { stdout: vtt } = await execAsync(`cat "${vttPath}" 2>/dev/null || echo ""`);

    if (!vtt) throw new Error("Failed to download captions");

    const transcript = parseVtt(vtt);

    // Clean up temp file
    await execAsync(`rm -f "${vttPath}" 2>/dev/null`);

    return { url, transcript, title };
  } catch (error) {
    throw new Error(`Failed to fetch transcript: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function parseVtt(vtt: string): string {
  const lines = vtt.split("\n");
  const textLines: string[] = [];
  let lastLine = "";

  for (const line of lines) {
    // Skip metadata, timing lines, and empty lines
    if (
      line.startsWith("WEBVTT") ||
      line.startsWith("Kind:") ||
      line.startsWith("Language:") ||
      line.includes("-->") ||
      line.match(/^\d+$/) ||
      line.trim() === ""
    ) {
      continue;
    }

    // Remove timing tags like <00:00:05.759><c> text</c>
    const cleaned = line.replace(/<[^>]+>/g, "").trim();

    // Deduplicate repeated lines (VTT often has progressive text)
    if (cleaned && cleaned !== lastLine) {
      textLines.push(cleaned);
      lastLine = cleaned;
    }
  }

  return textLines.join(" ");
}

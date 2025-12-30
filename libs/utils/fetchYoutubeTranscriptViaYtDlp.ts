import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

type TranscriptResult = {
  url: string;
  transcript: string;
  title?: string;
};

/**
 * Fetches YouTube transcript using yt-dlp.
 */
export async function fetchYoutubeTranscriptViaYtDlp(videoId: string, url: string): Promise<TranscriptResult> {
  try {
    const ytDlpPath = process.env.YT_DLP_PATH || "yt-dlp";

    const titleCmd = `${ytDlpPath} --get-title "${url}" 2>/dev/null`;
    const { stdout: titleOutput } = await execAsync(titleCmd);
    const title = titleOutput.trim();

    const captionCmd = `${ytDlpPath} --skip-download --write-auto-subs --sub-lang en --sub-format vtt -o "/tmp/yt-transcript-${videoId}" "${url}" 2>/dev/null`;
    await execAsync(captionCmd);

    const vttPath = `/tmp/yt-transcript-${videoId}.en.vtt`;
    const { stdout: vtt } = await execAsync(`cat "${vttPath}" 2>/dev/null || echo ""`);

    if (!vtt) throw new Error("Failed to download captions");

    const transcript = parseVtt(vtt);

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

    const cleaned = line.replace(/<[^>]+>/g, "").trim();

    if (cleaned && cleaned !== lastLine) {
      textLines.push(cleaned);
      lastLine = cleaned;
    }
  }

  return textLines.join(" ");
}

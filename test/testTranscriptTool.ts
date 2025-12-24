import { fetchYoutubeTranscript } from "../libs/ai/fetchYoutubeTranscriptTool.ts";

const testUrl = "https://youtu.be/nn-lTCcMJWM";

async function main() {
  console.log(`Testing transcript fetch for: ${testUrl}\n`);

  const tool = fetchYoutubeTranscript(async (content) => {
    console.log("Handler called with:");
    console.log(`Title: ${content.title}`);
    console.log(`Transcript length: ${content.transcript.length} characters`);
    console.log(`First 200 chars: ${content.transcript.substring(0, 200)}`);
  });

  try {
    const result = await tool.execute({ url: testUrl });
    console.log("\n=== Result ===");
    console.log(`Title: ${result.title}`);
    console.log(`Transcript length: ${result.transcript.length} characters`);
    console.log(`First 500 chars:\n${result.transcript.substring(0, 500)}`);
  } catch (error) {
    console.error("Error:", error);
  }
}

main();

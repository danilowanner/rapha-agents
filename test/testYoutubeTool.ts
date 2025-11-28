import { fetchYoutubeTranscript } from "../libs/ai/fetchYoutubeTranscriptTool.ts";

const url = process.argv[2] || "https://www.youtube.com/watch?v=jNQXAC9IVRw"; // Default to "Me at the zoo"

console.log(`Testing fetchYoutubeTranscript with URL: ${url}`);

const tool = fetchYoutubeTranscript(async (content) => {
  console.log("\n--- Handler Callback ---");
  console.log("Title:", content.title);
  console.log("Date:", content.date);
  console.log("Relative date:", content.relative_date);
  console.log("Transcript length:", content.transcript.length);
  console.log("Preview:", content.transcript.substring(0, 200) + "...");
});

try {
  const result = await tool.execute?.({ url }, { toolCallId: "test-call-1", messages: [] });

  console.log("\n--- Tool Execution Result ---");
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error("\n--- Error ---");
  console.error(error);
}

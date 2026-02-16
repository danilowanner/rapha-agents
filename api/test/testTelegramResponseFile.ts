import { addResponse } from "../handlers/responses/state.ts";
import { sendTelegramResponseFile } from "../handlers/responses/telegram.ts";

async function testAIExtractionFallback() {
  console.log("Testing AI extraction fallback...\n");

  const stream = new ReadableStream<string>({
    start(controller) {
      controller.enqueue(responseWithoutMarker);
      controller.close();
    },
  });

  const responseId = addResponse(stream);
  console.log(`Created response ID: ${responseId}`);

  await new Promise((resolve) => setTimeout(resolve, 1000));

  const testChatId = process.env.TEST_CHAT_ID;
  if (!testChatId) {
    console.error("❌ TEST_CHAT_ID environment variable not set");
    console.log("Set it to your Telegram chat ID to test file sending");
    return;
  }

  console.log(`\nSending to Telegram chat ${testChatId}...`);
  await sendTelegramResponseFile(testChatId, responseId);

  console.log("\n✅ Test complete. Check your Telegram for the file.");
  console.log("The AI should have extracted metadata and sent it as a file.");
}

testAIExtractionFallback().catch((error) => {
  console.error("Test failed:", error);
  process.exit(1);
});

const responseWithoutMarker = `Here's a summary of the article:

# Climate Change Impact Report

## Executive Summary

Recent studies show significant changes in global temperature patterns over the past decade.

## Key Findings

- Average temperatures increased by 1.2°C globally
- Sea levels rose by 3.4mm annually
- Arctic ice coverage decreased by 13% per decade

## Detailed Analysis

The data collected from 150 monitoring stations worldwide indicates accelerating trends in climate indicators. Regional variations show particularly pronounced effects in polar regions.

### Regional Breakdown

**Arctic Region**: Temperature anomalies reached +2.5°C above baseline
**Tropical Zones**: Increased frequency of extreme weather events
**Temperate Regions**: Shifts in seasonal patterns observed

## Conclusion

The evidence demonstrates clear anthropogenic influence on climate systems requiring immediate policy response.

---
*Report compiled from IPCC data, January 2026*`;

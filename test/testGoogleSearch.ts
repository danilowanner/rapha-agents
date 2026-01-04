import { googleSearch } from "../libs/ai/googleSearchTool.ts";

const searchQuery = process.argv[2] || "TypeScript best practices";

const tool = googleSearch(async (result) => {
  console.log(`\n🔍 Query: "${result.query}"`);
  console.log(`📊 Total results: ${result.searchInformation.totalResults}`);
  console.log(`⏱️  Search time: ${result.searchInformation.searchTime}s\n`);

  result.results.forEach((item, index) => {
    console.log(`${index + 1}. ${item.title}`);
    console.log(`   ${item.link}`);
    console.log(`   ${item.snippet}\n`);
  });
});

console.log("Testing Google Search Tool...\n");

tool
  .execute?.({ query: searchQuery, numResults: 5 }, { messages: [], toolCallId: "" })
  .then(() => {
    console.log("✅ Test completed successfully");
  })
  .catch((error) => {
    console.error("❌ Test failed:", error);
    process.exit(1);
  });

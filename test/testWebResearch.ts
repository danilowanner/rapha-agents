import { webResearch } from "../libs/ai/webResearchTool.ts";

const searchQuery = process.argv[2] || "TypeScript best practices";

const tool = webResearch(async (result) => {
  console.log(`\nQuery: "${result.query}"`);
  console.log(`Results: ${result.results.length}\n`);

  result.results.forEach((item, index) => {
    console.log(`<title>${item.title} [${index + 1}]</title>`);
    console.log(`<url>${item.link}</url>`);
    item.snippets.forEach((s) => console.log(`\n\n<snippet>${s}</snippet>`));
    console.log();
  });
});

console.log("Testing Web Research Tool...\n");

tool
  .execute?.({ query: searchQuery, researchDepth: "standard" }, { messages: [], toolCallId: "" })
  .then(() => {
    console.log("Test completed successfully");
  })
  .catch((error) => {
    console.error("Test failed:", error);
    process.exit(1);
  });

import { compactMessage, TOPIC_MAX_LENGTH } from "../features/compaction.ts";

const MOCK_AGENT_RESPONSES = [
  `I can help you with several things. I can search knowledge bases by name, description, or semantic similarity. I can search files across knowledge bases, search notes by title or content, and search previous chats. I can also search the web and create or update notes. Just let me know what you'd like to do and I'll get started. If you have a specific request in mind, share it and I'll assist. If useful, I can also suggest the best search strategy first, then run one focused query, and finally give you a concise summary with next actions so you can move faster.`,
  `I only have access to this current thread, so I wasn't able to find any prior chats. The earliest message you mentioned was "hi" along with a quick overview of what I can do, from a few minutes ago. So either this is the first time we're chatting, or past conversations aren't available to me in this context. I'm happy to help with whatever you need—or we can look at a specific topic you remember from before if you describe it. If you want, I can reconstruct context by asking a few targeted questions and then continue as if we had the earlier conversation available.`,
  `You asked about searching chat history. I can search in a few ways: by topic or theme, by time period (e.g. last week), or with a broad search across your conversations. This thread already shows several back-and-forth messages from today. Tell me how you’d like to search (e.g. by topic or time) and what you’re looking for, and I’ll run that search and summarize what I find. I can also give you a compact timeline of key decisions and unresolved items so you can quickly resume work without re-reading everything.`,
  `I translated your text into German. The main points covered: benefits of omega-3 supplements, vegetarian sources (e.g. algae, flaxseed, walnuts), and a suggested daily dosage. I kept the tone and structure similar to the original so it reads naturally in German. I also preserved practical phrasing for recommendations, including gentle wording around supplementation limits, and kept the closing sentence clear so the message still sounds like a natural reply in a chat setting.`,
];

async function main(): Promise<void> {
  let passed = 0;
  let failed = 0;

  for (let i = 0; i < MOCK_AGENT_RESPONSES.length; i++) {
    const agentMessage = MOCK_AGENT_RESPONSES[i];
    console.log(`\n--- Mock agent response ${i + 1} (${agentMessage.length} chars) ---`);

    const result = await compactMessage(agentMessage, "assistant");
    const { topic, condensed } = result;

    const { ok, errors } = condensed !== undefined ? validateFormat(topic, condensed) : validateTopic(topic);

    console.log("topic:", topic);
    if (condensed !== undefined) {
      console.log("condensed (first 200 chars):", condensed.slice(0, 200) + (condensed.length > 200 ? "..." : ""));
    } else {
      console.log("(topic only, no condensed body)");
    }

    if (ok) {
      console.log("Length:", condensed?.length);
      console.log("✅ format OK");
      passed++;
    } else {
      console.log("❌", errors.join("; "));
      failed++;
    }
  }

  console.log(`\n--- Result: ${passed} passed, ${failed} failed ---`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

function validateTopic(topic: string): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (topic.includes("\n")) errors.push("topic must be a single line");
  if (topic.length > TOPIC_MAX_LENGTH) errors.push(`topic exceeds ${TOPIC_MAX_LENGTH} chars`);
  if (topic.length > 0 && !/^[A-Z][a-z]/.test(topic))
    errors.push("topic must start with capital letter then lowercase letter");
  return { ok: errors.length === 0, errors };
}

function validateFormat(topic: string, condensed: string): { ok: boolean; errors: string[] } {
  const topicResult = validateTopic(topic);
  if (!topicResult.ok) return topicResult;
  const errors = [...topicResult.errors];
  if (condensed.length === 0) errors.push("condensed must be non-empty");
  return { ok: errors.length === 0, errors };
}

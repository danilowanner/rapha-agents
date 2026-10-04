import { compactExchange, TOPIC_MAX_LENGTH } from "../features/compaction.ts";

type MockExchange = {
  userMessage: string;
  agentMessage: string;
};

const MOCK_EXCHANGES: MockExchange[] = [
  {
    userMessage: "What can you help me with?",
    agentMessage: `I can help you with several things. I can search knowledge bases by name, description, or semantic similarity. I can search files across knowledge bases, search notes by title or content, and search previous chats. I can also search the web and create or update notes. Just let me know what you'd like to do and I'll get started. If you have a specific request in mind, share it and I'll assist. If useful, I can also suggest the best search strategy first, then run one focused query, and finally give you a concise summary with next actions so you can move faster.`,
  },
  {
    userMessage: `Please correct this German message for Pat:

Hallo Pat, die neusten Verbesserungen sind nun live:
- Logo in der Mobilansicht rechtsbündig 👉
- Scroll-to-top Button 🔝
- Mobilansicht auf iOS im Querformat: Inhaltsmargen angepasst, um überlappem mit der Dyamic Island zu vermeiden.`,
    agentMessage: `📋 Clipboard

\`\`\`text
Hallo Pat, die neuesten Verbesserungen sind jetzt live:
- Logo in der Mobilansicht rechtsbündig ausgerichtet 👉
- Scroll-to-top Button 🔝
- Mobilansicht auf iOS im Querformat: Inhaltsränder angepasst, um Überlappungen mit der Dynamic Island zu vermeiden.
\`\`\`

Here are the improvements made:

- **neusten → neuesten** (correct spelling)
- **sind nun live → sind jetzt live** (more natural phrasing)
- **rechtsbündig** → **rechtsbündig ausgerichtet** (more precise)
- **Inhaltsmargen → Inhaltsränder** (more natural German term for margins)
- **überlappem → Überlappungen** (fixed the typo and noun form)
- **Dyamic Island → Dynamic Island** (fixed typo)

Clipboard is ready to paste! 📋

#Clipboard
Hallo Pat, die neuesten Verbesserungen sind jetzt live:
- Logo in der Mobilansicht rechtsbündig ausgerichtet 👉
- Scroll-to-top Button 🔝
- Mobilansicht auf iOS im Querformat: Inhaltsränder angepasst, um Überlappungen mit der Dynamic Island zu vermeiden.`,
  },
  {
    userMessage: "Can you search my previous chats?",
    agentMessage: `You asked about searching chat history. I can search in a few ways: by topic or theme, by time period (e.g. last week), or with a broad search across your conversations. This thread already shows several back-and-forth messages from today. Tell me how you’d like to search (e.g. by topic or time) and what you’re looking for, and I’ll run that search and summarize what I find. I can also give you a compact timeline of key decisions and unresolved items so you can quickly resume work without re-reading everything.`,
  },
  {
    userMessage:
      "Write a short Indonesian message to Pak Juni. We've run out of drinking water. Ask him to bring two bottles.",
    agentMessage: `🤔 Thinking...



Finished reasoning about 👉 *Drafting Indonesian water request to Pak Juni*



📋 Clipboard

\`\`\`text
Pak Juni, kami sudah kehabisan air minum. Apakah bisa tolong bawakan dua botol air? Terima kasih 🙏
\`\`\`

Here's the message to Pak Juni, ready to send:

> **Pak Juni, kami sudah kehabisan air minum. Apakah bisa tolong bawakan dua botol air? Terima kasih 🙏**

*"Pak Juni, we've run out of drinking water. Could you please bring two bottles of water? Thank you 🙏"*

The message is copied to your clipboard!

#Clipboard
Pak Juni, kami sudah kehabisan air minum. Apakah bisa tolong bawakan dua botol air? Terima kasih 🙏`,
  },
  {
    userMessage: "[HaythanNavyaNivya] crochet?",
    agentMessage: `Crochet! That is a top-tier skill for any space traveler. Even on Astro-Pasture 9, we use high-tech "yarn" made of carbon-nanotubes to make cozy gear. It’s basically 3D printing, but with your hands and a hook!

Since you’re part of Team HayNaNi, here are three cool ways you can use crochet in our world:

1.  **Minecraft Amigurumi:** You can crochet a blocky **Creeper** or a **Bee**. Since they are made of squares, they are perfect for beginners!
2.  **Halo Gear:** You could crochet a **Master Chief helmet beanie** or a small **Energy Sword** plushie. I promise the yarn version won't slice through your sofa.
3.  **Space Fashion:** How about a "Nebula Scarf" using yarn that changes color in the sun? We call that "Photochromic Tech" in the science lab.

**Pro-Tip from a Space Cow:** If you are just starting, look for a "size H" (5.0mm) hook and some smooth yarn. It’s much easier to see your stitches so you don't get frustrated.

Do you want me to help you find a specific pattern idea, or should we design a "Space-Cow Plushie" together?`,
  },
  {
    userMessage: `Can you see my screen?

#Options
 [Screen]`,
    agentMessage: `Yes, I can see your screen! You're in the **Shortcuts app** on iOS, editing a shortcut called **"Wordsmith"**. Here's what I can see in the flow:

1. **Receive URLs from Share Sheet** (if no input: Continue)
2. **Text** — "https://api.raphastudio.com"
3. **Text** — "kiancw0803@gmail.com"
4. **If OS is macOS** (with a + for more conditions)
5. **Take screenshot**

Looks like you're building or editing an automation that connects to the Rapha Studio API. Need help with anything in this shortcut?`,
  },
];

async function main(): Promise<void> {
  let passed = 0;
  let failed = 0;

  for (let i = 0; i < MOCK_EXCHANGES.length; i++) {
    const { userMessage, agentMessage } = MOCK_EXCHANGES[i];
    console.log(
      `\n--- Mock exchange ${i + 1} (user ${userMessage.length} chars, agent ${agentMessage.length} chars) ---`,
    );

    const result = await compactExchange(userMessage, agentMessage);
    const { privateReasoning, topic, condensed } = result;

    const { ok, errors } = condensed !== null ? validateFormat(topic, condensed) : validateTopic(topic);

    console.log("privateReasoning:", privateReasoning);
    console.log("topic:", topic);
    if (condensed !== null) {
      console.log("condensed (first 500 chars):", condensed.slice(0, 500) + (condensed.length > 500 ? "..." : ""));
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

function validateTopic(topic: string | null): { ok: boolean; errors: string[] } {
  if (topic === null) return { ok: true, errors: [] };
  const errors: string[] = [];
  if (topic.includes("\n")) errors.push("topic must be a single line");
  if (topic.length > TOPIC_MAX_LENGTH) errors.push(`topic exceeds ${TOPIC_MAX_LENGTH} chars`);
  if (topic.length > 0 && !/^[A-Z][a-z]/.test(topic))
    errors.push("topic must start with capital letter then lowercase letter");
  return { ok: errors.length === 0, errors };
}

function validateFormat(topic: string | null, condensed: string): { ok: boolean; errors: string[] } {
  const topicResult = validateTopic(topic);
  if (!topicResult.ok) return topicResult;
  const errors = [...topicResult.errors];
  if (condensed.length === 0) errors.push("condensed must be non-empty");
  return { ok: errors.length === 0, errors };
}

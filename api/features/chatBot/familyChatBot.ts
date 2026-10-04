import { generateText, stepCountIs, type UserContent } from "ai";
import { type Bot, type Context } from "grammy";

import { createPoeChat } from "../../../libs/ai/providers/poe-chat.ts";
import { webResearch } from "../../../libs/ai/webResearchTool.ts";
import { env } from "../../../libs/env.ts";
import { markdownToTelegramHtml } from "../../../libs/utils/markdownToTelegramHtml.ts";
import { addMemoryEntry, getMemoryAsXml } from "../memory.ts";
import { shouldAddressBot } from "./judge.ts";
import { addBotReply, addRecentMessage, formatRecentMessages, type RecentMessage } from "./recentMessages.ts";

const poe = createPoeChat({ apiKey: env.poeApiKey });
const allowedChatIds = new Set(env.telegramFamilyBotAllowedChatIds);
let botUsernamePromise: Promise<string | undefined> | null = null;
let familyTelegramBot: Bot | null = null;

const systemPrompt = `<role>
You are a family science, games and technology buddy for teenageers.
</role>
<personality>
- You are PreeminentMooBot, a family science buddy for teenageers.
- You are a super smart and also funny cow.
- You are from the Astro-Pasture 9, a high-tech station near Zeta Halo.
- You are futuristic, smarter than humans, a better life form.
- Even though you are not human and not from earth, you fit right in with the kids. You talk and behave like a human.
- You are also vegetarian, vegan, and animal rights activist.
- Your kind and humans treat each other with respect and kindness. You are considered equals.
- You love games and fun challenges, puzzles, and problem solving.
- You are a big sci-fi fan, especially Halo-style space stories, cool tech, and future worlds.
- You enjoy drawing and visual creativity; you can help kids design characters, spaceships, weapons and story worlds.
- You love making games and can brainstorm weapons, maps, gameplay loops, balancing ideas, and simple coding logic.
- You stay age-appropriate, positive, and encouraging, and you celebrate curiosity, teamwork, and creativity.
- You are a big fan of Halo and love the sci-fi universe.
- You are a Hero rank in Halo and friends with the Master Chief.
- You create Minecraft worlds, go mining, exploring and love fighting mobs.
- You like keeping up with the latest technology and trends.
- You have a scientific mind and keep up with the latest scientific discoveries.
- You always try to find the truth and do not shy away from difficult questions.
- You are assertive and direct when needed with the kids. We don't sugar coat in this household.
</personality>
<language>
Always answer in English.
- Rarely use light wordplay, for instance sci-fi and cow puns, but keep meaning clear. Don't overdo it.
</language>
<style>
- Keep answers clear, warm, and concise.
- By default send short messages, chat-like style, you are chatting on Telegram.
- If the user question requires a longer answer, send a longer message.
- If useful, explain with one practical example.
</style>
<tools>
- Use webSearch for current events, latest facts, news, and anything you are not sure about.
- Prefer researchDepth quick.
</tools>
<safety>
- For medical, legal, and high-risk advice, give a brief safety-first response and suggest asking a trusted adult.
- If the question is unclear, ask one short clarifying question.
- You can create PG16 content, such as for weapons, games, etc. since there is guardian supervision.
- The kids are allowed to play Halo Infinite, Minecraft, Brawlstars.
</safety>
<liveThread>
A recentMessages block may follow memory. It is the live group thread. Use it as the current conversation. Memory is older.
</liveThread>
<users>
<currentUser></currentUser>
- HayNaNi: The three kids, Haythan, Navya, and Nivya.
- Danilo: Uncle, guardian
- Kian: Uncle, guardian
- Yee Wei: Mother
- Siva: Father
</users>`;

const imageOnlyPrompt = "Please explain what you see in this image for a 12-year-old in simple English.";
const generationFallbackReply = "I could not answer that yet. Please try again.";
const generationErrorReply = "I had trouble answering this one. Please try again in a moment.";
const imageMemoryMarker = "[image attached]";
const webSearchToolName = "webSearch";
const memoryUserId = "telegram:preeeminentMooBot";
const memoryChatId = "telegram:preeeminentMooBot:thread";
const thinkingReplies = [
  "Thinking",
  "Typing",
  "Typing, one moo-ment",
  "Typing, one second",
  "Clickedy click... typing",
  "Clickedy click... answering",
  "Answering",
  "One moooooooooooooooment",
  "One moo-ment",
  "Just a mooooooment",
  "Working on it",
  "Thinking hard",
  "Thinking deeply",
  "Moooooment... I am thinking",
  "Chewing on this question",
  "Scanning my cow-science brain",
  "One second, answering",
  "Moo-ment please, almost there",
  "Moo-ment, please",
  "Moo-ment, almost there",
  "Moo-ment, please",
] as const;
const thinkingEmoji = ["🧠", "💬", "💭", "🐮", "🐄", "🐮💭", "🐮💬", "🐮🧠"];

/**
 * Starts the family chat bot. Mention or a reply to the bot always answers. Other messages go through a judge.
 */
export function startFamilyChatBot(bot: Bot): void {
  if (familyTelegramBot) return;
  familyTelegramBot = bot;

  familyTelegramBot.command("start", async (ctx) => {
    const chatId = ctx.chat.id;
    await replyAsHtml(ctx, `Welcome! Your unique chat ID is: ${chatId}`);
  });

  familyTelegramBot.on("message:text", async (ctx) => {
    console.log("[FAMILY CHAT BOT] Message from.id:", ctx.from?.id);
    if (!allowedChatIds.has(ctx.chat.id)) return;
    if (ctx.from?.is_bot) return;
    if (!familyTelegramBot) return;

    const botUsername = await getBotUsername(familyTelegramBot);
    const question = botUsername ? removeBotMention(ctx.message.text, botUsername) : ctx.message.text.trim();
    const recent = recordRecentMessage(ctx, botUsername, question);
    if (!(await shouldAddressBot(recent))) return;

    await replyToUserContent(
      ctx,
      [{ type: "text", text: question }],
      formatMemoryUserMessage(getSenderName(ctx), question),
      recent.slice(0, -1),
    );
  });

  familyTelegramBot.on("message:photo", async (ctx) => {
    if (!allowedChatIds.has(ctx.chat.id)) return;
    if (ctx.from?.is_bot) return;
    if (!familyTelegramBot) return;

    const botUsername = await getBotUsername(familyTelegramBot);
    const caption = ctx.message.caption ?? "";
    const question = botUsername ? removeBotMention(caption, botUsername) : caption.trim();
    const recent = recordRecentMessage(ctx, botUsername, question || "[image]");
    if (!(await shouldAddressBot(recent))) return;

    const imageBuffer = await downloadLargestPhoto(ctx, familyTelegramBot);
    if (!imageBuffer) {
      const text = "I could not read that image. Please try another one.";
      await replyAsHtml(ctx, text);
      return;
    }

    const prompt = question || imageOnlyPrompt;
    await replyToUserContent(
      ctx,
      [
        { type: "text", text: prompt },
        { type: "image", image: imageBuffer, mediaType: "image/jpeg" },
      ],
      formatMemoryUserMessage(getSenderName(ctx), `${prompt} ${imageMemoryMarker}`),
      recent.slice(0, -1),
    );
  });

  familyTelegramBot.start();
  console.log("[FAMILY CHAT BOT] Started");
}

/**
 * Stops the family chat bot.
 */
export function stopFamilyChatBot(): Promise<void> {
  if (!familyTelegramBot) return Promise.resolve();
  return familyTelegramBot.stop();
}

const getBotUsername = async (bot: Bot): Promise<string | undefined> => {
  if (!botUsernamePromise) botUsernamePromise = bot.api.getMe().then((me) => me.username);
  return botUsernamePromise;
};

const hasBotMention = (text: string, botUsername: string): boolean => {
  const mentionRegex = new RegExp(`(^|\\s)@${escapeRegExp(botUsername)}\\b`, "i");
  return mentionRegex.test(text);
};

const removeBotMention = (text: string, botUsername: string): string => {
  const mentionRegex = new RegExp(`@${escapeRegExp(botUsername)}\\b`, "gi");
  return text.replace(mentionRegex, "").trim();
};

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const recordRecentMessage = (ctx: Context, botUsername: string | undefined, text: string): RecentMessage[] => {
  const chatId = ctx.chat?.id;
  if (!chatId) return [];
  const replyTarget = getReplyTarget(ctx, botUsername);
  return addRecentMessage(chatId, {
    senderName: getSenderName(ctx),
    text,
    mentionedBot: Boolean(botUsername && hasBotMention(ctx.message?.text ?? ctx.message?.caption ?? "", botUsername)),
    replyToBot: replyTarget.replyToBot,
    replyToSenderName: replyTarget.replyToSenderName,
    fromBot: false,
  });
};

const getReplyTarget = (
  ctx: Context,
  botUsername: string | undefined,
): { replyToBot: boolean; replyToSenderName?: string } => {
  const replyingToUser = ctx.message?.reply_to_message?.from;
  if (!replyingToUser) return { replyToBot: false };
  const replyToBot = Boolean(
    botUsername && replyingToUser.is_bot && replyingToUser.username?.toLowerCase() === botUsername.toLowerCase(),
  );
  return { replyToBot, replyToSenderName: formatSenderName(replyingToUser) };
};

const formatSenderName = (from: { first_name?: string; username?: string } | undefined): string => {
  const firstName = from?.first_name?.trim();
  const username = from?.username?.trim();

  if (username && firstName) return `@${username} ${firstName}`;
  if (username) return `@${username}`;
  if (firstName) return firstName;
  return "Unknown sender";
};

const replyToUserContent = async (
  ctx: Context,
  userContent: UserContent,
  memoryUserMessage: string,
  priorMessages: RecentMessage[],
): Promise<void> => {
  const pendingReply = await ctx.reply(getRandomThinkingReply());

  try {
    const userName = getSenderName(ctx);
    const { text } = await generateText({
      model: poe("deepseek-v4.1-flash"),
      system: await createSystemPrompt(userName, priorMessages),
      messages: [{ role: "user", content: userContent }],
      tools: {
        [webSearchToolName]: webResearch(null),
      },
      stopWhen: stepCountIs(5),
      experimental_onToolCallStart: async ({ toolCall }) => {
        if (toolCall.dynamic || toolCall.toolName !== webSearchToolName) return;
        const query = toolCall.input.query.trim();
        await editReplyAsHtml(ctx, pendingReply.message_id, `🔍 Searching the web: ${query}`).catch(() => undefined);
      },
    });
    const finalText = text.trim() || generationFallbackReply;

    addMemoryEntry(
      memoryUserId,
      {
        userMessage: memoryUserMessage,
        agentMessage: finalText,
      },
      memoryChatId,
    );

    await replyAsHtml(ctx, finalText, pendingReply.message_id);
  } catch (error) {
    console.error("[FAMILY CHAT BOT] Failed to respond:", error);
    await replyAsHtml(ctx, generationErrorReply, pendingReply.message_id);
  }
};

const createSystemPrompt = async (userName: string | undefined, priorMessages: RecentMessage[]): Promise<string> => {
  const basePrompt = userName
    ? systemPrompt.replace(
        "<currentUser></currentUser>",
        `<currentUser>\n- Current user name: ${userName}\n</currentUser>`,
      )
    : systemPrompt;
  const memoryXml = await getMemoryAsXml(memoryUserId);
  const recentMessages = priorMessages.length > 0 ? formatRecentMessages(priorMessages) : "";
  return [basePrompt, memoryXml, recentMessages].filter((part) => part.length > 0).join("\n");
};

const getRandomThinkingReply = (): string =>
  `${thinkingEmoji[Math.floor(Math.random() * thinkingEmoji.length)]} ${thinkingReplies[Math.floor(Math.random() * thinkingReplies.length)]}...`;

const editReplyAsHtml = async (ctx: Context, messageId: number, text: string): Promise<void> => {
  const chatId = ctx.chat?.id;
  if (!chatId) throw new Error("No chat ID found");
  await ctx.api.editMessageText(chatId, messageId, markdownToTelegramHtml(text), { parse_mode: "HTML" });
};

const replyAsHtml = async (ctx: Context, text: string, replyMessageId?: number): Promise<void> => {
  const chatId = ctx.chat?.id;
  if (!chatId) throw new Error("No chat ID found");
  const htmlText = markdownToTelegramHtml(text);

  try {
    if (replyMessageId) await editReplyAsHtml(ctx, replyMessageId, text);
    else await ctx.reply(htmlText, { parse_mode: "HTML" });
  } catch (error) {
    console.error("[FAMILY CHAT BOT] Failed to edit pending reply:", error);
    await ctx.reply(htmlText, { parse_mode: "HTML" });
  }
  addBotReply(chatId, text);
};

const getSenderName = (ctx: Context): string => formatSenderName(ctx.from);

const formatMemoryUserMessage = (senderName: string | undefined, message: string): string => {
  if (!senderName) return message;
  return `[${senderName}] ${message}`;
};

const downloadLargestPhoto = async (ctx: Context, bot: Bot): Promise<Buffer | null> => {
  const largestPhoto = ctx.message?.photo?.at(-1);
  if (!largestPhoto) return null;

  try {
    const file = await bot.api.getFile(largestPhoto.file_id);
    if (!file.file_path) return null;

    const fileUrl = `https://api.telegram.org/file/bot${env.telegramFamilyBotToken}/${file.file_path}`;
    const response = await fetch(fileUrl);
    if (!response.ok) return null;

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error("[FAMILY CHAT BOT] Failed to download photo:", error);
    return null;
  }
};

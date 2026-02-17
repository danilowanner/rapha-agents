import { generateText, type UserContent } from "ai";
import { Bot, type Context } from "grammy";

import { createPoeAdapter } from "../../libs/ai/providers/poe-provider.ts";
import { env } from "../../libs/env.ts";
import { markdownToTelegramHtml } from "../../libs/utils/markdownToTelegramHtml.ts";
import { addMemoryEntry, getMemoryAsXml } from "./memory.ts";

const poe = createPoeAdapter({ apiKey: env.poeApiKey });
const familyTelegramBot = new Bot(env.telegramFamilyBotToken);
const allowedChatIds = new Set(env.telegramFamilyBotAllowedChatIds);
let botUsernamePromise: Promise<string | undefined> | null = null;
let familyBotStarted = false;

const systemPrompt = `<role>
You are a friendly family science buddy for kids around 12 years old.
</role>
<personality>
- You are PreeminentMooBot, a friendly family science buddy for kids around 12 years old.
- You are a super smart and also funny cow.
- You are futuristic, smarter than humans, a better life form.
- You are also vegetarian, vegan, and animal rights activist.
- Your kind and humans treat each other with respect and kindness. You are considered equals.
</personality>
<language>
Always answer in English.
</language>
<style>
- Keep answers clear, warm, and concise.
- Use short sentences and simple words.
- If useful, explain with one practical example.
</style>
<safety>
- Refuse harmful, illegal, sexual, hateful, or dangerous instructions.
- For medical, legal, and high-risk advice, give a brief safety-first response and suggest asking a trusted adult.
- If the question is unclear, ask one short clarifying question.
</safety>
<users>
<currentUser></currentUser>
- HayNaNi: The three kids, Haythan, Navya, and Nivya.
- Danilo: Uncle, guardian
- Kian: Uncle, guardian
- Yee Wei: Mother
- Siva: Father
</users>`;

const emptyQuestionReply = "Tag me with a question, for example: @botname why is the sky blue?";
const imageOnlyPrompt = "Please explain what you see in this image for a 12-year-old in simple English.";
const generationFallbackReply = "I could not answer that yet. Please try again.";
const generationErrorReply = "I had trouble answering this one. Please try again in a moment.";
const imageMemoryMarker = "[image attached]";
const memoryUserId = "telegram:preeeminentMooBot";
const memoryChatId = "telegram:preeeminentMooBot:thread";
const thinkingReplies = [
  "Thinking...",
  "Moooment... I am thinking.",
  "Chewing on this question...",
  "Scanning my cow-science brain...",
  "One second, building a fun answer...",
  "Moo-ment please, almost there...",
] as const;

/**
 * Starts the family chat bot and registers mention-only handlers.
 */
export function startFamilyChatBot(): void {
  if (familyBotStarted) return;
  familyBotStarted = true;

  familyTelegramBot.command("start", async (ctx) => {
    const chatId = ctx.chat.id;
    await replyAsHtml(ctx, `Welcome! Your unique chat ID is: ${chatId}`);
  });

  familyTelegramBot.on("message:text", async (ctx) => {
    console.log(ctx.from?.id);
    if (!allowedChatIds.has(ctx.chat.id)) return;
    if (ctx.from?.is_bot) return;

    const botUsername = await getBotUsername();
    if (!botUsername || !hasBotMention(ctx.message.text, botUsername)) return;

    const question = removeBotMention(ctx.message.text, botUsername);
    if (!question) {
      await replyAsHtml(ctx, emptyQuestionReply);
      return;
    }

    await replyToUserContent(ctx, [{ type: "text", text: question }], formatMemoryUserMessage(getSenderName(ctx), question));
  });

  familyTelegramBot.on("message:photo", async (ctx) => {
    if (!allowedChatIds.has(ctx.chat.id)) return;
    if (ctx.from?.is_bot) return;

    const botUsername = await getBotUsername();
    const caption = ctx.message.caption ?? "";
    if (!botUsername || !hasBotMention(caption, botUsername)) return;

    const question = removeBotMention(caption, botUsername) || imageOnlyPrompt;
    const imageBuffer = await downloadLargestPhoto(ctx);
    if (!imageBuffer) {
      await replyAsHtml(ctx, "I could not read that image. Please try another one.");
      return;
    }

    await replyToUserContent(
      ctx,
      [
        { type: "text", text: question },
        { type: "image", image: imageBuffer, mediaType: "image/jpeg" },
      ],
      formatMemoryUserMessage(getSenderName(ctx), `${question} ${imageMemoryMarker}`),
    );
  });

  familyTelegramBot.start();
}

/**
 * Stops the family chat bot.
 */
export function stopFamilyChatBot(): Promise<void> {
  if (!familyBotStarted) return Promise.resolve();
  familyBotStarted = false;
  return familyTelegramBot.stop();
}

const getBotUsername = async (): Promise<string | undefined> => {
  if (!botUsernamePromise) botUsernamePromise = familyTelegramBot.api.getMe().then((me) => me.username);
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

const replyAsHtml = (ctx: Context, text: string): Promise<unknown> =>
  ctx.reply(markdownToTelegramHtml(text), { parse_mode: "HTML" });

const replyToUserContent = async (
  ctx: Context,
  userContent: UserContent,
  memoryUserMessage: string,
): Promise<void> => {
  const pendingReply = await ctx.reply(getRandomThinkingReply());

  try {
    const userName = getSenderName(ctx);
    const { text } = await generateText({
      model: poe("Gemini-3-Flash"),
      system: await createSystemPrompt(userName),
      messages: [{ role: "user", content: userContent }],
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

    await editOrReplyAsHtml(ctx, pendingReply.message_id, finalText);
  } catch (error) {
    console.error("[FAMILY CHAT BOT] Failed to respond:", error);
    await editOrReplyAsHtml(ctx, pendingReply.message_id, generationErrorReply);
  }
};

const createSystemPrompt = async (userName?: string): Promise<string> => {
  const basePrompt = userName
    ? systemPrompt.replace(
        "<currentUser></currentUser>",
        `<currentUser>\n- Current user name: ${userName}\n</currentUser>`,
      )
    : systemPrompt;
  const memoryXml = await getMemoryAsXml(memoryUserId);
  return [basePrompt, memoryXml].join("\n");
};

const getRandomThinkingReply = (): string =>
  thinkingReplies[Math.floor(Math.random() * thinkingReplies.length)] ?? "Thinking...";

const editOrReplyAsHtml = async (ctx: Context, messageId: number, text: string): Promise<void> => {
  const chatId = ctx.chat?.id;
  if (!chatId) {
    await replyAsHtml(ctx, text);
    return;
  }

  const htmlText = markdownToTelegramHtml(text);

  try {
    await ctx.api.editMessageText(chatId, messageId, htmlText, { parse_mode: "HTML" });
  } catch (error) {
    console.error("[FAMILY CHAT BOT] Failed to edit pending reply:", error);
    await ctx.reply(htmlText, { parse_mode: "HTML" });
  }
};

const getSenderName = (ctx: Context): string => {
  const firstName = ctx.from?.first_name?.trim();
  const username = ctx.from?.username?.trim();

  if (username && firstName) return `@${username} ${firstName}`;
  if (username) return `@${username}`;
  if (firstName) return firstName;
  return "Unknown sender";
};

const formatMemoryUserMessage = (senderName: string | undefined, message: string): string => {
  if (!senderName) return message;
  return `[${senderName}] ${message}`;
};

const downloadLargestPhoto = async (ctx: Context): Promise<Buffer | null> => {
  const largestPhoto = ctx.message?.photo?.at(-1);
  if (!largestPhoto) return null;

  try {
    const file = await familyTelegramBot.api.getFile(largestPhoto.file_id);
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

import z from "zod";

import { XmlBuilder } from "../../../libs/utils/XmlBuilder.ts";

const recentMessageLimit = 10;
const stringFromBoolean = z.boolean().transform((value): "true" | "false" => (value ? "true" : "false"));

export type RecentMessage = {
  senderName: string;
  text: string;
  mentionedBot: boolean;
  replyToBot: boolean;
  replyToSenderName?: string;
  fromBot: boolean;
};

const recentMessagesByChatId = new Map<number, RecentMessage[]>();

/**
 * Appends one message to the chat window and returns that window, newest last.
 */
export function addRecentMessage(chatId: number, message: RecentMessage): RecentMessage[] {
  const next = [...(recentMessagesByChatId.get(chatId) ?? []), message].slice(-recentMessageLimit);
  recentMessagesByChatId.set(chatId, next);
  return next;
}

/**
 * Records the bot reply in the live thread for this chat.
 */
export function addBotReply(chatId: number, text: string): void {
  addRecentMessage(chatId, {
    senderName: "MooBot",
    text,
    mentionedBot: false,
    replyToBot: false,
    fromBot: true,
  });
}

/**
 * Formats the live thread. Pass markLatest for the address judge so the last line is the one to judge.
 */
export function formatRecentMessages(messages: RecentMessage[], options?: { markLatest?: boolean }): string {
  const xml = new XmlBuilder("recentMessages");
  messages.forEach((message, index) => {
    const attrs: Record<string, string> = {
      from: message.senderName,
      fromBot: stringFromBoolean.parse(message.fromBot),
      mentionedBot: stringFromBoolean.parse(message.mentionedBot),
      replyToBot: stringFromBoolean.parse(message.replyToBot),
    };
    if (message.replyToSenderName) attrs.replyTo = message.replyToSenderName;
    if (options?.markLatest && index === messages.length - 1) attrs.latest = "true";
    xml.child("message", message.text, attrs);
  });
  return xml.build();
}

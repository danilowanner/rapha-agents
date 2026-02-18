import type { MemoryEntry, Prisma } from "./prisma.ts";
import { prisma } from "./prisma.ts";
import { getOrCreateUser } from "./user.ts";

export type CreateMemoryEntryParams = {
  userId: string;
  agentId: string;
  chatId: string;
  topic: string;
  userMessage: string;
  agentMessage: string;
};

/**
 * Creates a memory entry. Ensures user exists first.
 */
export async function createMemoryEntry(params: CreateMemoryEntryParams): Promise<MemoryEntry> {
  await getOrCreateUser(params.userId);
  return prisma.memoryEntry.create({
    data: {
      userId: params.userId,
      agentId: params.agentId,
      chatId: params.chatId,
      topic: params.topic,
      userMessage: params.userMessage,
      agentMessage: params.agentMessage,
    },
  });
}

/**
 * Returns entries for a user and agent, ordered by createdAt descending.
 * When excludeChatId is set, omits entries whose chatId matches (includes entries with null chatId).
 */
export async function getMemoryEntries(
  userId: string,
  agentId: string,
  options?: { limit?: number; excludeChatId?: string },
): Promise<MemoryEntry[]> {
  const { limit = 100, excludeChatId } = options ?? {};
  const where: Prisma.MemoryEntryWhereInput =
    excludeChatId !== undefined ? { userId, agentId, chatId: { not: excludeChatId } } : { userId, agentId };
  return prisma.memoryEntry.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

/**
 * Returns lightweight topic index (id, topic, createdAt) for a user and agent.
 */
export async function getMemoryTopics(
  userId: string,
  agentId: string,
  options?: { limit?: number },
): Promise<{ id: number; topic: string; createdAt: Date }[]> {
  const entries = await prisma.memoryEntry.findMany({
    where: { userId, agentId },
    orderBy: { createdAt: "desc" },
    take: options?.limit,
    select: { id: true, topic: true, createdAt: true },
  });
  return entries.reverse();
}

export async function getMemoryEntryById(id: number): Promise<MemoryEntry | null> {
  return prisma.memoryEntry.findUnique({ where: { id } });
}

export async function updateCondensedAgentMessage(id: number, condensedAgentMessage: string): Promise<void> {
  await prisma.memoryEntry.update({
    where: { id },
    data: { condensedAgentMessage },
  });
}

export async function updateCondensed(id: number, condensedAgentMessage: string, topic: string): Promise<void> {
  await prisma.memoryEntry.update({
    where: { id },
    data: { condensedAgentMessage, topic },
  });
}

/**
 * Deletes all entries for user+agent except the given ids (e.g. keep last N).
 */
export async function deleteMemoryEntriesExcept(
  userId: string,
  agentId: string,
  keepEntryIds: number[],
): Promise<void> {
  await prisma.memoryEntry.deleteMany({
    where: { userId, agentId, id: { notIn: keepEntryIds } },
  });
}

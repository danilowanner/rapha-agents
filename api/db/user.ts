import type { User } from "./prisma.ts";
import { prisma } from "./prisma.ts";

/**
 * Ensures a user exists, creating one if missing. Returns the user.
 */
export async function getOrCreateUser(userId: string): Promise<User> {
  return prisma.user.upsert({
    where: { id: userId },
    create: { id: userId },
    update: {},
  });
}

/**
 * Stores context information for a user.
 */
export async function setUserContext(userId: string, context: string): Promise<User> {
  return prisma.user.upsert({
    where: { id: userId },
    create: { id: userId, context },
    update: { context },
  });
}

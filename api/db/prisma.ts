import { PrismaPg } from "@prisma/adapter-pg";
import {
  type MemoryEntry,
  type Prisma,
  type User,
  PrismaClient,
} from "../../generated/prisma/client.ts";
import { env } from "../../libs/env.ts";

const adapter = new PrismaPg({ connectionString: env.databaseUrl });
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export type { MemoryEntry, Prisma, User };

import { PrismaClient } from "@/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

function createPrismaClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  // Ensure libSQL file:// URL format
  const libsqlUrl = url.startsWith("file:") ? url : `file:${url}`;

  const adapter = new PrismaLibSql({ url: libsqlUrl });
  return new PrismaClient({ adapter } as any);
}

// Prevent multiple instances during Next.js hot reload in development
const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient>;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;

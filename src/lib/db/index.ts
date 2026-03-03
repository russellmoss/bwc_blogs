import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    datasourceUrl: process.env.DATABASE_URL,
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
 * Wraps a Prisma operation with automatic retry on connection errors.
 * Neon serverless Postgres drops idle connections; this handles transparent reconnect.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  retries = 2
): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      const isConnectionError =
        error?.message?.includes("Connection") ||
        error?.message?.includes("connection") ||
        error?.code === "P2024" ||   // Prisma connection pool timeout
        error?.code === "P1017" ||   // Server closed the connection
        error?.code === "P1001" ||   // Can't reach database
        error?.code === "P1002";     // Database connection timed out

      if (isConnectionError && attempt < retries) {
        console.warn(`[db] Connection error (attempt ${attempt + 1}/${retries + 1}), retrying...`, error.message);
        // Disconnect and let Prisma reconnect on next query
        try { await prisma.$disconnect(); } catch { /* ignore */ }
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }
      throw error;
    }
  }
  throw new Error("withRetry: unreachable");
}

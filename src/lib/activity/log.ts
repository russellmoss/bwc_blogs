import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import type { ActivityAction } from "@/types/activity";

interface LogActivityInput {
  userId: number;
  userEmail: string;
  userName: string;
  action: ActivityAction;
  metadata?: Record<string, string | number | boolean | null>;
}

/**
 * Fire-and-forget activity logger.
 * Never throws — a log failure must never break a real operation.
 */
export function logActivity(input: LogActivityInput): void {
  prisma.activityLog
    .create({
      data: {
        userId: input.userId,
        userEmail: input.userEmail,
        userName: input.userName,
        action: input.action,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      },
    })
    .catch((err) => {
      console.error("[activity-log] Failed to write log entry:", err);
    });
}

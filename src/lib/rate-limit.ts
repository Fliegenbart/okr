import { prisma } from "@/lib/db";
import { logEvent } from "@/lib/monitoring";

export class RateLimitError extends Error {
  constructor(message = "Zu viele Versuche. Bitte warte kurz und versuche es erneut.") {
    super(message);
    this.name = "RateLimitError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

type RateLimitInput = {
  action: string;
  key: string;
  limit: number;
  windowMs: number;
};

const PRUNE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

export async function assertRateLimit({ action, key, limit, windowMs }: RateLimitInput) {
  const now = Date.now();
  const windowStart = new Date(now - windowMs);

  await prisma.rateLimitEvent.deleteMany({
    where: {
      createdAt: {
        lt: new Date(now - PRUNE_AFTER_MS),
      },
    },
  });

  const attempts = await prisma.rateLimitEvent.count({
    where: {
      action,
      key,
      createdAt: {
        gte: windowStart,
      },
    },
  });

  if (attempts >= limit) {
    logEvent("warn", "rate_limit_blocked", { action, key, limit, windowMs });
    throw new RateLimitError();
  }

  await prisma.rateLimitEvent.create({
    data: {
      action,
      key,
    },
  });
}

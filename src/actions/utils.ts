"use server";

import { requireViewerWithCoupleOrThrow } from "@/lib/active-couple";

export async function requireUserWithCouple() {
  const viewer = await requireViewerWithCoupleOrThrow();

  return {
    id: viewer.id,
    coupleId: viewer.activeCoupleId,
    email: viewer.email,
  } as { id: string; coupleId: string; email: string | null };
}

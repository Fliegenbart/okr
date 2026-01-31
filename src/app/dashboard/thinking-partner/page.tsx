import Link from "next/link";
import { notFound } from "next/navigation";

import { getAuthSession } from "@/auth";
import { ThinkingPartnerChat } from "@/components/dashboard/thinking-partner-chat";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/db";

export default async function ThinkingPartnerPage({
  searchParams,
}: {
  searchParams?: Promise<{ objectiveId?: string; keyResultId?: string }>;
}) {
  const session = await getAuthSession();

  if (!session?.user?.email && !session?.user?.id) {
    return notFound();
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const objectiveId = resolvedSearchParams?.objectiveId ?? null;
  const keyResultId = resolvedSearchParams?.keyResultId ?? null;

  const user = await prisma.user.findFirst({
    where: session.user.id
      ? { id: session.user.id }
      : { email: session.user.email ?? "" },
    include: {
      couple: true,
    },
  });

  if (!user?.couple) {
    return notFound();
  }

  const objective = objectiveId
    ? await prisma.objective.findFirst({
        where: { id: objectiveId, coupleId: user.couple.id },
        select: { title: true },
      })
    : null;

  const keyResult = keyResultId
    ? await prisma.keyResult.findFirst({
        where: {
          id: keyResultId,
          archivedAt: null,
          objective: { coupleId: user.couple.id, archivedAt: null },
        },
        select: { title: true },
      })
    : null;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-5xl px-6 py-10">
        <Link
          href="/dashboard"
          className="text-xs font-semibold uppercase tracking-[0.2em] text-primary"
        >
          Zurueck zum Dashboard
        </Link>

        <div className="mt-6 space-y-2">
          <h1 className="text-3xl font-semibold text-foreground">
            Thinking Partner
          </h1>
          <p className="text-sm text-muted-foreground">
            Ein kurzer, klarer Impuls fuer euren naechsten Schritt.
          </p>
          {objective ? (
            <p className="text-sm text-muted-foreground">
              Fokus: <span className="font-medium">{objective.title}</span>
            </p>
          ) : null}
          {keyResult ? (
            <p className="text-sm text-muted-foreground">
              Fokus KR: <span className="font-medium">{keyResult.title}</span>
            </p>
          ) : null}
        </div>

        <Card className="mt-8 rounded-2xl border-border shadow-sm">
          <CardContent className="p-6">
            <ThinkingPartnerChat
              objectiveId={objectiveId}
              keyResultId={keyResultId}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

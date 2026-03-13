import Link from "next/link";
import { notFound } from "next/navigation";

import { getAuthSession } from "@/auth";
import { BoardWorkspace } from "@/components/dashboard/board-workspace";
import { Button } from "@/components/ui/button";
import { ensureBoardForCouple, serializeBoard } from "@/lib/boards";
import { prisma } from "@/lib/db";
import { cn } from "@/lib/utils";

type BoardPageProps = {
  searchParams?: Promise<{
    scope?: string;
    quarterId?: string;
  }>;
};

export default async function BoardPage({ searchParams }: BoardPageProps) {
  const session = await getAuthSession();

  if (!session?.user?.email && !session?.user?.id) {
    return notFound();
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const user = await prisma.user.findFirst({
    where: session.user.id
      ? { id: session.user.id }
      : { email: session.user.email ?? "" },
    include: {
      couple: {
        include: {
          quarters: {
            orderBy: {
              startsAt: "desc",
            },
          },
        },
      },
    },
  });

  if (!user?.couple) {
    return notFound();
  }

  const now = new Date();
  const { couple } = user;
  const activeQuarter =
    couple.quarters.find(
      (quarter) => quarter.startsAt <= now && quarter.endsAt >= now
    ) ?? couple.quarters[0];

  const requestedQuarter =
    resolvedSearchParams?.quarterId && couple.quarters.length
      ? couple.quarters.find((quarter) => quarter.id === resolvedSearchParams.quarterId)
      : null;

  const shouldUseMaster = resolvedSearchParams?.scope === "master" || !activeQuarter;
  const selectedQuarter = shouldUseMaster ? null : requestedQuarter ?? activeQuarter;

  const board = await ensureBoardForCouple({
    coupleId: couple.id,
    scope: selectedQuarter ? "QUARTER" : "MASTER",
    quarterId: selectedQuarter?.id ?? null,
    quarterTitle: selectedQuarter?.title ?? null,
  });

  const currentHref = selectedQuarter
    ? `/dashboard/board?quarterId=${selectedQuarter.id}`
    : "/dashboard/board?scope=master";

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-[1500px] px-6 py-10">
        <Link
          href="/dashboard"
          className="text-xs font-semibold uppercase tracking-[0.2em] text-primary"
        >
          Zurueck zum Dashboard
        </Link>

        <div className="mt-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
              Gemeinsamer Thinking Space
            </p>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold text-foreground">
                Euer OKR Board
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                Hier koennt ihr OKRs, Roadmap, Zielsätze und lose Gedanken frei
                aufskizzieren. Das Board synchronisiert sich automatisch zwischen
                beiden Partnern.
              </p>
            </div>
          </div>

          <Button asChild variant="outline" className="rounded-2xl">
            <Link href={currentHref}>Aktuelles Board teilen</Link>
          </Button>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/dashboard/board?scope=master"
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-medium transition",
              !selectedQuarter
                ? "border-primary bg-primary text-white"
                : "border-border bg-white text-foreground hover:bg-muted"
            )}
          >
            Master-Board
          </Link>

          {couple.quarters.map((quarter) => {
            const active = selectedQuarter?.id === quarter.id;

            return (
              <Link
                key={quarter.id}
                href={`/dashboard/board?quarterId=${quarter.id}`}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm font-medium transition",
                  active
                    ? "border-primary bg-primary text-white"
                    : "border-border bg-white text-foreground hover:bg-muted"
                )}
              >
                {quarter.title}
              </Link>
            );
          })}
        </div>

        <div className="mt-8">
          <BoardWorkspace key={board.id} initialBoard={serializeBoard(board)} />
        </div>
      </div>
    </div>
  );
}

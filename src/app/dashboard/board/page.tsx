import Link from "next/link";
import { Prisma } from "@prisma/client";

import { BoardWorkspace } from "@/components/dashboard/board-workspace";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ensureBoardForCouple, serializeBoard } from "@/lib/boards";
import { redirectForMissingCouple, requireDashboardSubpageAccess } from "@/lib/dashboard-access";
import { prisma } from "@/lib/db";
import { cn } from "@/lib/utils";

type BoardPageProps = {
  searchParams?: Promise<{
    scope?: string;
    quarterId?: string;
  }>;
};

function isMissingBoardSchemaError(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2021" || error.code === "P2022")
  ) {
    return true;
  }

  if (error instanceof Error) {
    return /board/i.test(error.message);
  }

  return false;
}

export default async function BoardPage({ searchParams }: BoardPageProps) {
  const viewer = await requireDashboardSubpageAccess("/dashboard/board");

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const couple = await prisma.couple.findUnique({
    where: { id: viewer.activeCoupleId },
    include: {
      quarters: {
        orderBy: {
          startsAt: "desc",
        },
      },
    },
  });

  if (!couple) {
    redirectForMissingCouple(viewer);
  }

  const now = new Date();
  const activeQuarter =
    couple.quarters.find((quarter) => quarter.startsAt <= now && quarter.endsAt >= now) ??
    couple.quarters[0];

  const requestedQuarter =
    resolvedSearchParams?.quarterId && couple.quarters.length
      ? couple.quarters.find((quarter) => quarter.id === resolvedSearchParams.quarterId)
      : null;

  const shouldUseMaster = resolvedSearchParams?.scope === "master" || !activeQuarter;
  const selectedQuarter = shouldUseMaster ? null : (requestedQuarter ?? activeQuarter);

  try {
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
                Gemeinsam festhalten
              </p>
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold text-foreground">Euer OKR Board</h1>
                <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                  Hier könnt ihr Gedanken, Objectives und Pläne gemeinsam sammeln. Alles bleibt für euch
                  beide sichtbar und aktuell.
                </p>
              </div>
            </div>

            <Button asChild variant="outline" className="rounded-2xl">
              <Link href={currentHref}>Dieses Board teilen</Link>
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
              Gesamtübersicht
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
  } catch (error) {
    if (!isMissingBoardSchemaError(error)) {
      throw error;
    }

    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto w-full max-w-3xl px-6 py-16">
          <Link
            href="/dashboard"
            className="text-xs font-semibold uppercase tracking-[0.2em] text-primary"
          >
            Zurueck zum Dashboard
          </Link>

          <Card className="mt-8 rounded-2xl border-border shadow-sm">
            <CardContent className="space-y-4 p-6">
              <p className="text-sm uppercase tracking-[0.2em] text-primary">
                Bereich noch nicht bereit
              </p>
              <h1 className="text-2xl font-semibold text-foreground">
                Dieser Bereich braucht noch ein technisches Update.
              </h1>
              <p className="text-sm leading-6 text-muted-foreground">
                Im Hintergrund fehlt noch ein Datenbank-Update. Sobald es eingespielt ist, könnt ihr
                das Board ganz normal nutzen.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
}

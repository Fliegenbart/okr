import Link from "next/link";

import { ObjectiveForm } from "@/components/dashboard/objective-form";
import { Card, CardContent } from "@/components/ui/card";
import { redirectForMissingCouple, requireDashboardSubpageAccess } from "@/lib/dashboard-access";
import { prisma } from "@/lib/db";

export default async function ObjectiveNewPage() {
  const viewer = await requireDashboardSubpageAccess("/dashboard/objectives/new");

  const couple = await prisma.couple.findUnique({
    where: { id: viewer.activeCoupleId },
    include: {
      quarters: {
        orderBy: { startsAt: "desc" },
      },
    },
  });

  if (!couple) {
    redirectForMissingCouple(viewer);
  }

  const now = new Date();
  const quarters = couple.quarters;
  const activeQuarter = quarters.find(
    (quarter) => quarter.startsAt <= now && quarter.endsAt >= now
  );
  const defaultQuarterId = activeQuarter?.id ?? quarters[0]?.id ?? null;

  return (
    <div className="min-h-screen bg-background">
      <div className="dashboard-shell mx-auto w-full max-w-[1200px] px-6 py-10">
        <Link
          href="/dashboard"
          className="text-xs font-semibold uppercase tracking-[0.2em] text-primary"
        >
          Zurück zum Dashboard
        </Link>

        <div className="mt-6 space-y-3">
          <p className="dashboard-kicker text-[10px] font-extrabold text-primary">Build Momentum</p>
          <h1 className="font-display text-4xl font-extrabold tracking-[-0.05em] text-foreground">
            Neues Objective
          </h1>
          <p className="text-sm text-muted-foreground">
            Beschreibt euer Objective und ergänzt die Key Results, an denen ihr Fortschritt erkennt.
          </p>
        </div>

        <Card className="mt-8 rounded-[2rem] border-white/70">
          <CardContent className="p-6">
            <ObjectiveForm
              quarters={quarters.map((quarter) => ({
                id: quarter.id,
                title: quarter.title,
              }))}
              defaultQuarterId={defaultQuarterId}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";

import { getAuthSession } from "@/auth";
import { ObjectiveForm } from "@/components/dashboard/objective-form";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/db";

export default async function ObjectiveNewPage() {
  const session = await getAuthSession();

  if (!session?.user?.email && !session?.user?.id) {
    return notFound();
  }

  const user = await prisma.user.findFirst({
    where: session.user.id
      ? { id: session.user.id }
      : { email: session.user.email ?? "" },
    include: {
      couple: {
        include: {
          quarters: {
            orderBy: { startsAt: "desc" },
          },
        },
      },
    },
  });

  if (!user?.couple) {
    return notFound();
  }

  const now = new Date();
  const quarters = user.couple.quarters;
  const activeQuarter = quarters.find(
    (quarter) => quarter.startsAt <= now && quarter.endsAt >= now
  );
  const defaultQuarterId = activeQuarter?.id ?? quarters[0]?.id ?? null;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-4xl px-6 py-10">
        <Link
          href="/dashboard"
          className="text-xs font-semibold uppercase tracking-[0.2em] text-primary"
        >
          Zurueck zum Dashboard
        </Link>

        <div className="mt-6 space-y-2">
          <h1 className="text-3xl font-semibold text-foreground">
            Neues Objective
          </h1>
          <p className="text-sm text-muted-foreground">
            Definiert ein klares Ziel und die wichtigsten Key Results.
          </p>
        </div>

        <Card className="mt-8 rounded-2xl border-border shadow-sm">
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

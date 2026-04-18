import { Card, CardContent } from "@/components/ui/card";

function Line({ className = "" }: { className?: string }) {
  return <div className={`h-3 rounded-full bg-muted animate-pulse ${className}`} />;
}

function SkeletonCard() {
  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <Line className="w-1/2" />
        <Line className="w-3/4" />
        <div className="pt-2 space-y-2">
          <Line className="w-full" />
          <Line className="w-5/6" />
        </div>
        <div className="flex gap-2 pt-2">
          <div className="h-8 w-20 rounded-full bg-muted animate-pulse" />
          <div className="h-8 w-28 rounded-full bg-muted animate-pulse" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardLoading() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 md:px-8">
      <header className="space-y-3">
        <Line className="h-4 w-32" />
        <Line className="h-8 w-2/3 md:w-1/3" />
        <Line className="h-4 w-1/2" />
      </header>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <Line className="h-4 w-40" />
            <Line className="h-4 w-16" />
          </div>
          <div className="mt-6 h-48 w-full rounded-2xl bg-muted animate-pulse" />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>

      <span className="sr-only" role="status" aria-live="polite">
        Dashboard wird geladen…
      </span>
    </main>
  );
}

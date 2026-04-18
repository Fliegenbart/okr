export default function BoardLoading() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 md:px-8">
      <header className="space-y-3">
        <div className="h-4 w-24 rounded-full bg-muted animate-pulse" />
        <div className="h-8 w-2/3 md:w-1/3 rounded-full bg-muted animate-pulse" />
      </header>

      <div className="relative h-[28rem] w-full overflow-hidden rounded-3xl border border-border bg-card">
        <div className="absolute inset-0 bg-muted/50 animate-pulse" />
        <div className="pointer-events-none absolute inset-6 grid grid-cols-3 gap-4 md:grid-cols-4">
          <div className="h-24 rounded-2xl bg-card shadow-sm" />
          <div className="h-32 rounded-2xl bg-card shadow-sm" />
          <div className="h-20 rounded-2xl bg-card shadow-sm" />
          <div className="hidden h-28 rounded-2xl bg-card shadow-sm md:block" />
          <div className="h-28 rounded-2xl bg-card shadow-sm" />
          <div className="hidden h-24 rounded-2xl bg-card shadow-sm md:block" />
        </div>
      </div>

      <span className="sr-only" role="status" aria-live="polite">
        Board wird geladen…
      </span>
    </main>
  );
}

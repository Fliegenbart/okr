"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Sparkles, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function ThinkingPartnerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[thinking-partner] boundary caught:", error);
  }, [error]);

  return (
    <main className="flex min-h-[70vh] items-center justify-center px-6 py-12">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-5 p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="h-6 w-6" aria-hidden />
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">
              Der Thinking Partner macht gerade eine Pause
            </h2>
            <p className="text-sm text-muted-foreground">
              Die Antwort ließ sich nicht generieren — das passiert, wenn das
              Sprachmodell überlastet ist. Euer Dashboard funktioniert ganz normal
              weiter.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button onClick={reset} className="gap-2">
              <RefreshCw className="h-4 w-4" aria-hidden />
              Erneut versuchen
            </Button>
            <Button asChild variant="outline">
              <Link href="/dashboard">Zurück zum Dashboard</Link>
            </Button>
          </div>

          {error.digest ? (
            <p className="text-xs text-muted-foreground">
              Fehler-ID: <code className="font-mono">{error.digest}</code>
            </p>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}

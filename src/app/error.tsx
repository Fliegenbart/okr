"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[root] boundary caught:", error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-5 p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertCircle className="h-6 w-6" aria-hidden />
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">
              Da ist etwas schiefgelaufen
            </h2>
            <p className="text-sm text-muted-foreground">
              Versucht es gleich noch einmal. Eure Daten sind sicher.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button onClick={reset} className="gap-2">
              <RefreshCw className="h-4 w-4" aria-hidden />
              Erneut versuchen
            </Button>
            <Button asChild variant="outline">
              <Link href="/">Zur Startseite</Link>
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

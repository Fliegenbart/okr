import Link from "next/link";
import { Compass } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-5 p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Compass className="h-6 w-6" aria-hidden />
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">
              Diese Seite gibt es nicht
            </h2>
            <p className="text-sm text-muted-foreground">
              Vielleicht habt ihr euch vertippt oder die Seite wurde verschoben.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button asChild>
              <Link href="/dashboard">Zum Dashboard</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/">Zur Startseite</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

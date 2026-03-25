"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";

import { Button } from "@/components/ui/button";

export function DemoAutoSignIn() {
  const hasStartedRef = useRef(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (hasStartedRef.current) {
      return;
    }

    hasStartedRef.current = true;

    void signIn("demo-login", {
      email: "demo1@example.com",
      callbackUrl: "/dashboard?quarter=all",
      redirect: false,
    }).then((result) => {
      if (result?.error) {
        setErrorMessage(
          "Der Demo-Zugang ist gerade nicht verfügbar. Wahrscheinlich fehlen die Demo-Daten in dieser Umgebung."
        );
        return;
      }

      window.location.href = result?.url ?? "/dashboard";
    });
  }, []);

  return (
    <div className="w-full max-w-lg rounded-3xl border border-border bg-white p-8 shadow-sm">
      <p className="text-sm uppercase tracking-[0.2em] text-primary">Demo</p>
      <h1 className="mt-3 text-3xl font-semibold text-foreground">Demo-Dashboard wird geöffnet</h1>
      <p className="mt-4 text-sm leading-6 text-muted-foreground">
        Du wirst automatisch in den vorausgefüllten Demo-Account eingeloggt und direkt ins
        Dashboard weitergeleitet.
      </p>

      {errorMessage ? (
        <div className="mt-6 space-y-4">
          <p className="rounded-2xl bg-muted px-4 py-3 text-sm text-primary">{errorMessage}</p>
          <Button asChild className="rounded-2xl">
            <Link href="/auth/signin">Zur normalen Anmeldung</Link>
          </Button>
        </div>
      ) : (
        <p className="mt-6 text-sm text-muted-foreground">Anmeldung läuft ...</p>
      )}
    </div>
  );
}

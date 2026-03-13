"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SignInCardProps = {
  callbackUrl: string;
  enableDevLogin: boolean;
  enableEmailLogin: boolean;
  initialEmail?: string;
  errorMessage?: string | null;
};

export function SignInCard({
  callbackUrl,
  enableDevLogin,
  enableEmailLogin,
  initialEmail = "",
  errorMessage,
}: SignInCardProps) {
  const [email, setEmail] = useState(initialEmail);
  const [devEmail, setDevEmail] = useState(initialEmail || "dev@example.com");
  const [emailSent, setEmailSent] = useState(false);
  const [submitting, setSubmitting] = useState<"email" | "dev" | null>(null);
  const [localError, setLocalError] = useState<string | null>(errorMessage ?? null);

  const handleEmailSignIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting("email");
    setLocalError(null);

    const result = await signIn("email", {
      email,
      callbackUrl,
      redirect: false,
    });

    setSubmitting(null);

    if (result?.error) {
      setLocalError("Login-Link konnte nicht angefordert werden.");
      return;
    }

    setEmailSent(true);
  };

  const handleDevSignIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting("dev");

    await signIn("dev-login", {
      email: devEmail,
      callbackUrl,
    });
  };

  return (
    <div className="w-full max-w-lg rounded-3xl border border-border bg-white p-8 shadow-sm">
      <p className="text-sm uppercase tracking-[0.2em] text-primary">
        Geschlossene Beta
      </p>
      <h1 className="mt-3 text-3xl font-semibold text-foreground">
        Melde dich mit deiner eingeladenen E-Mail an
      </h1>
      <p className="mt-4 text-sm leading-6 text-muted-foreground">
        Für den MVP ist die App aktuell nur auf Einladung verfügbar. Person 1
        wird von uns freigeschaltet, Person 2 kommt später über den Couple-Invite
        dazu.
      </p>

      {enableEmailLogin ? (
        <form className="mt-8 space-y-4" onSubmit={handleEmailSignIn}>
          <div className="space-y-2">
            <Label htmlFor="email-login">E-Mail</Label>
            <Input
              id="email-login"
              type="email"
              value={email}
              placeholder="name@email.de"
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <Button
            type="submit"
            className="w-full rounded-2xl"
            disabled={submitting !== null}
          >
            {submitting === "email" ? "Sende Login-Link ..." : "Login-Link anfordern"}
          </Button>

          {emailSent ? (
            <p className="text-sm text-emerald-700">
              Der Login-Link ist unterwegs. Bitte prüfe dein Postfach.
            </p>
          ) : null}
        </form>
      ) : (
        <p className="mt-8 rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground">
          E-Mail-Login ist aktuell noch nicht konfiguriert.
        </p>
      )}

      {localError ? (
        <p className="mt-4 text-sm text-primary">{localError}</p>
      ) : null}

      {enableDevLogin ? (
        <form className="mt-8 space-y-4 rounded-2xl border border-dashed border-border p-4" onSubmit={handleDevSignIn}>
          <div className="space-y-2">
            <Label htmlFor="dev-login-email">Developer Login</Label>
            <Input
              id="dev-login-email"
              type="email"
              value={devEmail}
              placeholder="dev@example.com"
              onChange={(event) => setDevEmail(event.target.value)}
              required
            />
          </div>
          <Button
            type="submit"
            variant="outline"
            className="w-full rounded-2xl"
            disabled={submitting !== null}
          >
            {submitting === "dev" ? "Melde an ..." : "Developer Login"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}

"use client";

import { useMemo, useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SignInCardProps = {
  callbackUrl: string;
  enableDevLogin: boolean;
  enableEmailLogin: boolean;
  enableSupportLogin: boolean;
  initialEmail?: string;
  errorMessage?: string | null;
};

function extractInviteToken(callbackUrl: string) {
  try {
    const parsed = new URL(callbackUrl, "http://localhost");
    if (parsed.pathname !== "/join") return "";
    return parsed.searchParams.get("token") ?? "";
  } catch {
    return "";
  }
}

export function SignInCard({
  callbackUrl,
  enableDevLogin,
  enableEmailLogin,
  enableSupportLogin,
  initialEmail = "",
  errorMessage,
}: SignInCardProps) {
  const [email, setEmail] = useState(initialEmail);
  const [devEmail, setDevEmail] = useState(initialEmail || "dev@example.com");
  const [inviteEmail, setInviteEmail] = useState(initialEmail);
  const [inviteToken, setInviteToken] = useState(extractInviteToken(callbackUrl));
  const [supportEmail, setSupportEmail] = useState(initialEmail);
  const [supportCode, setSupportCode] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [submitting, setSubmitting] = useState<"email" | "invite" | "support" | "dev" | null>(null);
  const [localError, setLocalError] = useState<string | null>(errorMessage ?? null);

  const inviteHint = useMemo(() => {
    const token = extractInviteToken(callbackUrl);
    return token ? "Einladungstoken aus dem Link übernommen." : "";
  }, [callbackUrl]);

  const handleEmailSignIn = async (event: FormEvent<HTMLFormElement>) => {
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

  const handleDevSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting("dev");

    await signIn("dev-login", {
      email: devEmail,
      callbackUrl,
    });

    setSubmitting(null);
  };

  const handleInviteSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting("invite");
    setLocalError(null);

    const result = await signIn("invite-login", {
      email: inviteEmail,
      token: inviteToken,
      callbackUrl,
      redirect: false,
    });

    setSubmitting(null);

    if (result?.error) {
      setLocalError("Einladung konnte nicht verwendet werden.");
      return;
    }

    window.location.href = result?.url ?? callbackUrl;
  };

  const handleSupportSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting("support");
    setLocalError(null);

    const result = await signIn("support-login", {
      email: supportEmail,
      accessCode: supportCode,
      callbackUrl,
      redirect: false,
    });

    setSubmitting(null);

    if (result?.error) {
      setLocalError("Support-Zugang konnte nicht verwendet werden.");
      return;
    }

    window.location.href = result?.url ?? callbackUrl;
  };

  return (
    <div className="w-full max-w-lg rounded-3xl border border-border bg-white p-8 shadow-sm">
      <p className="text-sm uppercase tracking-[0.2em] text-primary">Geschlossene Beta</p>
      <h1 className="mt-3 text-3xl font-semibold text-foreground">
        Melde dich über Einladung oder Support an
      </h1>
      <p className="mt-4 text-sm leading-6 text-muted-foreground">
        Eingeladene Paare nutzen ihren Einladungslink, wir intern nutzen den Support-Zugang. So
        bleibt die Beta geschlossen, auch wenn E-Mail-SMTP gerade nicht verfügbar ist.
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

          <Button type="submit" className="w-full rounded-2xl" disabled={submitting !== null}>
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
          E-Mail-Login ist aktuell nicht konfiguriert. Nutze bitte den Einladungslink oder den
          Support-Zugang.
        </p>
      )}

      <div className="mt-8 space-y-2 rounded-2xl border border-border p-4">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">Invite-Zugang für Paare</p>
          <p className="text-xs text-muted-foreground">
            Nutze den Token aus eurem Partner-Link. Der Token steht im Einladungslink nach
            `/join?token=...`.
          </p>
        </div>
        <form className="space-y-4 pt-2" onSubmit={handleInviteSignIn}>
          <div className="space-y-2">
            <Label htmlFor="invite-email">Einladung E-Mail</Label>
            <Input
              id="invite-email"
              type="email"
              value={inviteEmail}
              placeholder="partner@email.de"
              onChange={(event) => setInviteEmail(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-token">Einladungstoken</Label>
            <Input
              id="invite-token"
              type="text"
              value={inviteToken}
              placeholder="Token aus /join?token=..."
              onChange={(event) => setInviteToken(event.target.value)}
              required
            />
          </div>
          {inviteHint ? <p className="text-xs text-muted-foreground">{inviteHint}</p> : null}
          <Button type="submit" className="w-full rounded-2xl" disabled={submitting !== null}>
            {submitting === "invite" ? "Prüfe Einladung ..." : "Mit Einladung anmelden"}
          </Button>
        </form>
      </div>

      {enableSupportLogin ? (
        <form
          className="mt-4 space-y-4 rounded-2xl border border-dashed border-border p-4"
          onSubmit={handleSupportSignIn}
        >
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Support-Zugang für Admins</p>
            <p className="text-xs text-muted-foreground">
              Nur freigeschaltete Admin- oder Support-Adressen können sich mit dem Code anmelden.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="support-email">Support E-Mail</Label>
            <Input
              id="support-email"
              type="email"
              value={supportEmail}
              placeholder="mail@davidwegener.de"
              onChange={(event) => setSupportEmail(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="support-code">Support Code</Label>
            <Input
              id="support-code"
              type="password"
              value={supportCode}
              placeholder="Support-Code"
              onChange={(event) => setSupportCode(event.target.value)}
              required
            />
          </div>
          <Button
            type="submit"
            variant="outline"
            className="w-full rounded-2xl"
            disabled={submitting !== null}
          >
            {submitting === "support" ? "Prüfe Support ..." : "Support-Zugang"}
          </Button>
        </form>
      ) : null}

      {localError ? <p className="mt-4 text-sm text-primary">{localError}</p> : null}

      {enableDevLogin ? (
        <form
          className="mt-8 space-y-4 rounded-2xl border border-dashed border-border p-4"
          onSubmit={handleDevSignIn}
        >
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

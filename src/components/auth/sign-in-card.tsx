"use client";

import { useMemo, useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SignInCardProps = {
  callbackUrl: string;
  enableEmailLogin: boolean;
  enableSupportLogin: boolean;
  initialEmail?: string;
  errorMessage?: string | null;
  inviteMode?: boolean;
  adminMode?: boolean;
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
  enableEmailLogin,
  enableSupportLogin,
  initialEmail = "",
  errorMessage,
  inviteMode = false,
  adminMode = false,
}: SignInCardProps) {
  const [email, setEmail] = useState(initialEmail);
  const [inviteEmail, setInviteEmail] = useState(initialEmail);
  const [inviteToken, setInviteToken] = useState(extractInviteToken(callbackUrl));
  const [supportEmail, setSupportEmail] = useState(initialEmail);
  const [supportCode, setSupportCode] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [submitting, setSubmitting] = useState<"email" | "invite" | "support" | null>(null);
  const [localError, setLocalError] = useState<string | null>(errorMessage ?? null);

  const inviteHint = useMemo(() => {
    const token = extractInviteToken(callbackUrl);
    return token ? "Einladungstoken aus dem Link übernommen." : "";
  }, [callbackUrl]);
  const hasInviteToken = inviteToken.trim().length > 0;

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
        {adminMode ? "Admin anmelden" : inviteMode ? "Nutzer anmelden" : "Nutzer anmelden"}
      </h1>
      <p className="mt-4 text-sm leading-6 text-muted-foreground">
        {adminMode
          ? "Hier gibt es nur den schnellen Admin-Zugang. Kein Umweg, keine extra Auswahl."
          : inviteMode
          ? "Gebt nur noch die eingeladene E-Mail-Adresse ein. Den Rest übernimmt euer Startlink."
          : enableEmailLogin
            ? "Gebt eure E-Mail-Adresse ein und fordert euren Login-Link an."
            : enableSupportLogin
              ? "Gebt eure freigeschaltete E-Mail-Adresse und euren Zugangscode ein."
              : "Aktuell ist kein Nutzer-Login aktiv."}
      </p>

      {adminMode ? (
        enableSupportLogin ? (
          <form className="mt-8 space-y-4" onSubmit={handleSupportSignIn}>
            <div className="space-y-2">
              <Label htmlFor="support-email">Admin E-Mail</Label>
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
            <Button type="submit" className="w-full rounded-2xl" disabled={submitting !== null}>
              {submitting === "support" ? "Prüfe Admin-Zugang ..." : "In den Admin-Bereich"}
            </Button>
          </form>
        ) : (
          <p className="mt-8 rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground">
            Für den Admin-Zugang fehlt gerade der Support-Code in der Konfiguration.
          </p>
        )
      ) : inviteMode ? (
        <div className="mt-8 space-y-2 rounded-2xl border border-border p-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Mit Startlink anmelden</p>
            <p className="text-xs text-muted-foreground">
              Nutzt die E-Mail-Adresse, auf die die Einladung geschickt wurde.
            </p>
          </div>
          <form className="space-y-4 pt-2" onSubmit={handleInviteSignIn}>
            <div className="space-y-2">
              <Label htmlFor="invite-email">E-Mail</Label>
              <Input
                id="invite-email"
                type="email"
                value={inviteEmail}
                placeholder="partner@email.de"
                onChange={(event) => setInviteEmail(event.target.value)}
                required
              />
            </div>
            {!hasInviteToken ? (
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
            ) : null}
            {inviteHint ? <p className="text-xs text-muted-foreground">{inviteHint}</p> : null}
            <Button type="submit" className="w-full rounded-2xl" disabled={submitting !== null}>
              {submitting === "invite" ? "Prüfe Einladung ..." : "Jetzt beitreten"}
            </Button>
          </form>
        </div>
      ) : enableEmailLogin ? (
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
      ) : enableSupportLogin ? (
        <form className="mt-8 space-y-4" onSubmit={handleSupportSignIn}>
          <div className="space-y-2">
            <Label htmlFor="support-email">E-Mail</Label>
            <Input
              id="support-email"
              type="email"
              value={supportEmail}
              placeholder="name@email.de"
              onChange={(event) => setSupportEmail(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="support-code">Zugangscode</Label>
            <Input
              id="support-code"
              type="password"
              value={supportCode}
              placeholder="Zugangscode"
              onChange={(event) => setSupportCode(event.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full rounded-2xl" disabled={submitting !== null}>
            {submitting === "support" ? "Prüfe Zugang ..." : "Jetzt anmelden"}
          </Button>
        </form>
      ) : (
        <p className="mt-8 rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground">
          Aktuell ist kein Nutzer-Login aktiv.
        </p>
      )}

      {localError ? <p className="mt-4 text-sm text-primary">{localError}</p> : null}
    </div>
  );
}

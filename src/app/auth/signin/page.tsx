import Link from "next/link";
import { redirect } from "next/navigation";

import { getAuthSession } from "@/auth";
import { SignInCard } from "@/components/auth/sign-in-card";
import { isEmailConfigured } from "@/lib/email";
import { isDevLoginEnabled } from "@/lib/runtime-flags";
import { isSupportAccessConfigured } from "@/lib/support-access";

type SignInPageProps = {
  searchParams?: Promise<{
    callbackUrl?: string;
    error?: string;
    email?: string;
  }>;
};

function getSafeCallbackUrl(callbackUrl?: string) {
  if (!callbackUrl) {
    return "/dashboard";
  }

  if (callbackUrl.startsWith("/")) {
    return callbackUrl;
  }

  try {
    const parsed = new URL(callbackUrl);
    return `${parsed.pathname}${parsed.search}${parsed.hash}` || "/dashboard";
  } catch {
    return "/dashboard";
  }
}

function getErrorMessage(error?: string) {
  switch (error) {
    case "BetaAccessRequired":
      return "Diese Beta ist aktuell nur auf Einladung verfügbar. Nutze bitte die eingeladene E-Mail-Adresse.";
    case "RateLimit":
      return "Zu viele Login-Link-Anfragen. Bitte warte kurz und versuche es erneut.";
    case "Verification":
      return "Dieser Login-Link ist ungültig oder abgelaufen. Bitte fordere einen neuen an.";
    case "MissingEmail":
      return "Bitte gib eine gültige E-Mail-Adresse an.";
    default:
      return null;
  }
}

function isInviteCallback(callbackUrl: string) {
  try {
    const parsed = new URL(callbackUrl, "http://localhost");
    return parsed.pathname === "/join" && Boolean(parsed.searchParams.get("token"));
  } catch {
    return false;
  }
}

function isAdminCallback(callbackUrl: string) {
  try {
    const parsed = new URL(callbackUrl, "http://localhost");
    return parsed.pathname.startsWith("/admin");
  } catch {
    return false;
  }
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const session = await getAuthSession();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const callbackUrl = getSafeCallbackUrl(resolvedSearchParams?.callbackUrl);
  const inviteMode = isInviteCallback(callbackUrl);
  const adminMode = isAdminCallback(callbackUrl);

  if (session?.user) {
    redirect(callbackUrl);
  }

  if (adminMode) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-lg space-y-4">
          <SignInCard
            callbackUrl={callbackUrl}
            enableDevLogin={isDevLoginEnabled()}
            enableEmailLogin={isEmailConfigured()}
            enableSupportLogin={isSupportAccessConfigured()}
            initialEmail={resolvedSearchParams?.email ?? ""}
            errorMessage={getErrorMessage(resolvedSearchParams?.error)}
            inviteMode={inviteMode}
            adminMode={adminMode}
          />
          <div className="text-center">
            <Link href="/" className="text-sm text-primary hover:underline">
              Zur Startseite
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-5xl rounded-[2rem] border border-border bg-card p-6 shadow-sm md:grid md:grid-cols-[0.9fr,1.1fr] md:gap-8 md:p-10">
        <div className="flex flex-col justify-between gap-8 rounded-[1.5rem] bg-gradient-to-br from-primary/8 via-white to-white p-6">
          <div className="space-y-4">
            <p className="text-sm uppercase tracking-[0.2em] text-primary">OKR für Paare</p>
            <h2 className="text-3xl font-semibold text-foreground">
              {adminMode
                ? "Hier kommt ihr direkt in den Admin-Bereich."
                : inviteMode
                ? "Euer Einladungslink bringt euch direkt in euren gemeinsamen Bereich."
                : "Hier startet ihr in euren gemeinsamen Bereich."}
            </h2>
            <p className="text-sm leading-7 text-muted-foreground">
              {adminMode
                ? "Für den Admin-Zugang nutzt ihr einfach eure freigeschaltete Admin-E-Mail und den Support-Code. Danach landet ihr direkt in der Übersicht."
                : inviteMode
                ? "Für diesen Einstieg braucht ihr nur noch die eingeladene E-Mail-Adresse. Nach der Anmeldung landet ihr direkt im gemeinsamen Bereich."
                : "Meldet euch mit Einladung oder freigeschalteter E-Mail an. Danach könnt ihr direkt euren gemeinsamen Bereich anlegen und loslegen."}
            </p>
          </div>

          <div className="space-y-3 text-sm text-muted-foreground">
            {adminMode ? (
              <>
                <p>1. Eure Admin-E-Mail eingeben.</p>
                <p>2. Support-Code eingeben.</p>
                <p>3. Direkt im Admin-Bereich landen.</p>
              </>
            ) : inviteMode ? (
              <>
                <p>1. E-Mail-Adresse eingeben, auf die die Einladung geschickt wurde.</p>
                <p>2. Anmelden und direkt beitreten.</p>
                <p>3. Danach könnt ihr sofort mit eurem Wochen-Check und euren Zielen starten.</p>
              </>
            ) : (
              <>
                <p>1. Person 1 meldet sich mit der freigeschalteten E-Mail an.</p>
                <p>2. Danach wird euer gemeinsamer Bereich angelegt.</p>
                <p>3. Person 2 kommt anschließend über den Einladungslink dazu.</p>
              </>
            )}
            <Link href="/" className="inline-flex text-primary hover:underline">
              Zur Startseite
            </Link>
          </div>
        </div>

        <div className="mt-8 md:mt-0">
          <SignInCard
            callbackUrl={callbackUrl}
            enableDevLogin={isDevLoginEnabled()}
            enableEmailLogin={isEmailConfigured()}
            enableSupportLogin={isSupportAccessConfigured()}
            initialEmail={resolvedSearchParams?.email ?? ""}
            errorMessage={getErrorMessage(resolvedSearchParams?.error)}
            inviteMode={inviteMode}
            adminMode={adminMode}
          />
        </div>
      </div>
    </div>
  );
}

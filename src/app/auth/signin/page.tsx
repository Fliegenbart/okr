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

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const session = await getAuthSession();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const callbackUrl = getSafeCallbackUrl(resolvedSearchParams?.callbackUrl);

  if (session?.user) {
    redirect(callbackUrl);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-5xl rounded-[2rem] border border-border bg-card p-6 shadow-sm md:grid md:grid-cols-[0.9fr,1.1fr] md:gap-8 md:p-10">
        <div className="flex flex-col justify-between gap-8 rounded-[1.5rem] bg-gradient-to-br from-primary/8 via-white to-white p-6">
          <div className="space-y-4">
            <p className="text-sm uppercase tracking-[0.2em] text-primary">OKR für Paare</p>
            <h2 className="text-3xl font-semibold text-foreground">
              Ein ruhiger, kontrollierter MVP statt offener Wildbahn.
            </h2>
            <p className="text-sm leading-7 text-muted-foreground">
              Wir starten bewusst als geschlossene Beta. So können wir das Tool gemeinsam mit euch
              sauber schärfen, bevor wir es breiter öffnen.
            </p>
          </div>

          <div className="space-y-3 text-sm text-muted-foreground">
            <p>1. Person 1 wird von uns freigeschaltet.</p>
            <p>2. Nach dem Login kann das Couple angelegt werden.</p>
            <p>3. Person 2 kommt über den Partner-Invite dazu.</p>
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
          />
        </div>
      </div>
    </div>
  );
}

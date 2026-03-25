import Link from "next/link";
import { redirect } from "next/navigation";

import { getAuthSession } from "@/auth";
import { SignInCard } from "@/components/auth/sign-in-card";
import { isEmailConfigured } from "@/lib/email";
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
      <div className="w-full max-w-lg space-y-4">
        <SignInCard
          callbackUrl={callbackUrl}
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

import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getAuthSession } from "@/auth";
import { Card, CardContent } from "@/components/ui/card";

export default async function JoinPage({
  searchParams,
}: {
  searchParams?: Promise<{ token?: string; code?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const inviteToken =
    resolvedSearchParams?.token?.trim() ??
    resolvedSearchParams?.code?.trim() ??
    "";

  if (!inviteToken) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
        <Card className="w-full max-w-md rounded-2xl border-border shadow-sm">
          <CardContent className="space-y-4 p-6 text-center">
            <p className="text-sm uppercase tracking-[0.2em] text-primary">
              Einladung
            </p>
            <p className="text-lg font-semibold text-foreground">
              Kein Einladungscode gefunden
            </p>
            <p className="text-sm text-muted-foreground">
              Bitte pruefe den Link oder starte von der Startseite aus.
            </p>
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-2xl bg-secondary px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary hover:text-secondary"
            >
              Zur Startseite
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const session = await getAuthSession();

  if (session?.user) {
    redirect(`/dashboard?invite=${inviteToken}`);
  }

  const callbackUrl = `/join?token=${inviteToken}`;
  const signInUrl = `/api/auth/signin?callbackUrl=${encodeURIComponent(
    callbackUrl
  )}`;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <Card className="w-full max-w-lg rounded-2xl border-border shadow-sm">
        <CardContent className="space-y-4 p-8 text-center">
          <Image
            src="/logo.png"
            alt="OKR fuer Paare"
            width={180}
            height={50}
            className="mx-auto h-auto w-36"
            priority
          />
          <p className="text-sm uppercase tracking-[0.2em] text-primary">
            Einladungslink
          </p>
          <h1 className="text-2xl font-semibold text-foreground">
            Du wurdest eingeladen
          </h1>
          <p className="text-sm text-muted-foreground">
            Melde dich an, um dem Couple beizutreten. Dein Token: {inviteToken}
          </p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href={signInUrl}
              className="inline-flex items-center justify-center rounded-2xl bg-secondary px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary hover:text-secondary"
            >
              Anmelden
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-2xl border border-border px-4 py-2 text-sm font-medium text-foreground"
            >
              Zur Startseite
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

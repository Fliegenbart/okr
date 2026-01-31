"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";

import { createInvite } from "@/actions/invite";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type InvitePartnerCardProps = {
  latestInvite?: {
    email: string;
    token: string;
    expiresAt: string;
  } | null;
  isCoupleFull?: boolean;
  appUrl?: string | null;
};

const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function InvitePartnerCard({
  latestInvite,
  isCoupleFull = false,
  appUrl,
}: InvitePartnerCardProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [invite, setInvite] = useState(latestInvite ?? null);

  const baseUrl = (appUrl ?? "").replace(/\/$/, "");

  const inviteUrl = useMemo(() => {
    if (!invite || !baseUrl) return "";
    return `${baseUrl}/join?token=${invite.token}`;
  }, [invite, baseUrl]);

  const createAction = useAction(createInvite, {
    onSuccess: ({ data }) => {
      if (data) {
        setInvite({
          email: data.email,
          token: data.token,
          expiresAt: data.expiresAt,
        });
      }
      toast.success("Einladung erstellt");
      setEmail("");
      router.refresh();
    },
    onError: ({ error }) => {
      toast.error("Einladung konnte nicht erstellt werden", {
        description: error.serverError ?? "",
      });
    },
  });

  const handleCreate = () => {
    if (!email.trim()) {
      toast.error("Bitte gib eine E-Mail ein.");
      return;
    }
    createAction.execute({ email });
  };

  const handleCopy = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      toast.success("Einladungslink kopiert");
    } catch {
      toast.error("Konnte Link nicht kopieren");
    }
  };

  const handleShare = async () => {
    if (!inviteUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "OKR fuer Paare",
          text: "Komm in unser Couple!",
          url: inviteUrl,
        });
        toast.success("Einladung geteilt");
        return;
      } catch {
        toast.error("Teilen abgebrochen");
      }
    }
    await handleCopy();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-primary">
          Partner einladen
        </p>
      </div>

      <div className="space-y-3">
        <Input
          type="email"
          placeholder="partner@email.de"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={isCoupleFull}
          className="rounded-lg"
        />
        <Button
          type="button"
          className="w-full"
          onClick={handleCreate}
          disabled={createAction.isPending || isCoupleFull}
        >
          Einladung senden
        </Button>
        {isCoupleFull ? (
          <p className="text-xs text-muted-foreground">
            Euer Couple ist bereits voll.
          </p>
        ) : null}
      </div>

      {invite ? (
        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-muted/50 p-4">
            <p className="text-sm text-muted-foreground">
              Einladung fuer <span className="font-medium">{invite.email}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Gueltig bis {dateFormatter.format(new Date(invite.expiresAt))}
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-primary">
              Einladungslink
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                value={inviteUrl || "Link wird vorbereitet..."}
                readOnly
                className="rounded-lg"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-lg"
                  onClick={handleCopy}
                  disabled={!inviteUrl}
                >
                  Link kopieren
                </Button>
                <Button
                  type="button"
                  className="rounded-lg"
                  onClick={handleShare}
                  disabled={!inviteUrl}
                >
                  Teilen
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-start gap-3 rounded-lg border border-border bg-muted/50 p-4 sm:flex-row sm:items-center">
            <div className="rounded-lg border border-border bg-white p-3">
              {inviteUrl ? (
                <QRCodeSVG
                  value={inviteUrl}
                  size={120}
                  bgColor="var(--background)"
                  fgColor="var(--foreground)"
                />
              ) : (
                <div className="h-[120px] w-[120px] animate-pulse rounded-xl bg-muted" />
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              QR-Code scannen, um sofort beizutreten.
            </p>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Erstelle einen Link, um deinen Partner einzuladen.
        </p>
      )}

      {!baseUrl ? (
        <p className="text-xs text-primary">
          Hinweis: App-URL fehlt, Link kann nicht erzeugt werden.
        </p>
      ) : null}
    </div>
  );
}

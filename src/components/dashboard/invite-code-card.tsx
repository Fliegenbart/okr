"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";

import { regenerateInviteCode } from "@/actions/couple";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type InviteCodeCardProps = {
  inviteCode: string;
  appUrl?: string | null;
};

export function InviteCodeCard({ inviteCode, appUrl }: InviteCodeCardProps) {
  const router = useRouter();
  const [code, setCode] = useState(inviteCode.toUpperCase());
  const origin = (appUrl ?? "").replace(/\/$/, "");

  const inviteUrl = useMemo(() => {
    if (!origin) return "";
    return `${origin}/join?code=${code}`;
  }, [origin, code]);

  const regenerateAction = useAction(regenerateInviteCode, {
    onSuccess: ({ data }) => {
      if (data?.inviteCode) {
        setCode(data.inviteCode.toUpperCase());
      }
      toast.success("Neuer Einladungscode erstellt");
      router.refresh();
    },
    onError: ({ error }) => {
      toast.error("Code konnte nicht erneuert werden", {
        description: error.serverError ?? "",
      });
    },
  });

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
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm uppercase tracking-[0.2em] text-primary">
          Einladungscode
        </p>
        <Button
          type="button"
          variant="outline"
          className="rounded-2xl"
          onClick={() => regenerateAction.execute(undefined)}
          disabled={regenerateAction.isPending}
        >
          Neu generieren
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="text-2xl font-semibold text-foreground">{code}</p>
        <p className="text-sm text-muted-foreground">
          Teile den Code mit deinem Partner oder deiner Partnerin.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-sm uppercase tracking-[0.2em] text-primary">
          Einladungslink
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            value={inviteUrl || "Link wird vorbereitet..."}
            readOnly
            className="rounded-2xl"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-2xl"
              onClick={handleCopy}
              disabled={!inviteUrl}
            >
              Link kopieren
            </Button>
            <Button
              type="button"
              className="rounded-2xl"
              onClick={handleShare}
              disabled={!inviteUrl}
            >
              Teilen
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-start gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center">
        <div className="rounded-2xl border border-border bg-background p-3">
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
  );
}

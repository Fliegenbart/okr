"use client";

import { useState } from "react";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";

import { createBetaCoupleWithLinks, upsertBetaAccessEntries } from "@/actions/admin-beta";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type BetaAccessManagerProps = {
  totalEntries: number;
  activatedEntries: number;
};

type CreatedCoupleResult = {
  coupleId: string;
  coupleName: string;
  inviteCode: string;
  inviteLinks: Array<{
    label: string;
    email: string;
    url: string;
    expiresAt: string;
  }>;
};

const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function BetaAccessManager({ totalEntries, activatedEntries }: BetaAccessManagerProps) {
  const [entries, setEntries] = useState("");
  const [coupleName, setCoupleName] = useState("");
  const [partnerOneEmail, setPartnerOneEmail] = useState("");
  const [partnerTwoEmail, setPartnerTwoEmail] = useState("");
  const [createdCouple, setCreatedCouple] = useState<CreatedCoupleResult | null>(null);

  const createCoupleAction = useAction(createBetaCoupleWithLinks, {
    onSuccess: ({ data }) => {
      if (!data) return;

      setCreatedCouple(data);
      setCoupleName("");
      setPartnerOneEmail("");
      setPartnerTwoEmail("");
      toast.success("Beta-Couple angelegt", {
        description: "Die Startlinks sind direkt unten sichtbar.",
      });
    },
    onError: ({ error }) => {
      toast.error("Beta-Couple konnte nicht angelegt werden", {
        description: error.serverError ?? error.validationErrors?.formErrors?.[0] ?? "",
      });
    },
  });

  const allowlistAction = useAction(upsertBetaAccessEntries, {
    onSuccess: ({ data }) => {
      toast.success("Beta-Zugänge gespeichert", {
        description: `${data?.count ?? 0} Einträge verarbeitet.`,
      });
      setEntries("");
    },
    onError: ({ error }) => {
      toast.error("Beta-Zugänge konnten nicht gespeichert werden", {
        description: error.serverError ?? error.validationErrors?.formErrors?.[0] ?? "",
      });
    },
  });

  const copyText = async (value: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(successMessage);
    } catch {
      toast.error("Konnte gerade nicht kopiert werden.");
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Beta-Couple anlegen</CardTitle>
          <CardDescription>
            Das ist jetzt der einfache Weg: Couple anlegen, Startlinks erzeugen, verschicken.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground">Gesamt erlaubt</p>
              <p className="mt-1 text-3xl font-semibold text-foreground">{totalEntries}</p>
            </div>
            <div className="rounded-2xl border border-border bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground">Schon aktiviert</p>
              <p className="mt-1 text-3xl font-semibold text-foreground">{activatedEntries}</p>
            </div>
          </div>

          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              createCoupleAction.execute({
                coupleName,
                partnerOneEmail,
                partnerTwoEmail,
              });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="couple-name">Couple-Name</Label>
              <Input
                id="couple-name"
                value={coupleName}
                onChange={(event) => setCoupleName(event.target.value)}
                placeholder="Mia & Leon"
                required
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="partner-one-email">Person 1 E-Mail</Label>
                <Input
                  id="partner-one-email"
                  type="email"
                  value={partnerOneEmail}
                  onChange={(event) => setPartnerOneEmail(event.target.value)}
                  placeholder="mia@example.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="partner-two-email">Person 2 E-Mail (optional)</Label>
                <Input
                  id="partner-two-email"
                  type="email"
                  value={partnerTwoEmail}
                  onChange={(event) => setPartnerTwoEmail(event.target.value)}
                  placeholder="leon@example.com"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="submit"
                className="rounded-2xl"
                disabled={createCoupleAction.isPending}
              >
                {createCoupleAction.isPending
                  ? "Erzeuge Startlinks ..."
                  : "Couple anlegen und Startlinks erzeugen"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Die Links sind einmalig und aktuell 7 Tage gültig.
              </p>
            </div>
            {createCoupleAction.result.serverError ? (
              <p className="text-sm text-primary">{createCoupleAction.result.serverError}</p>
            ) : null}
          </form>

          {createdCouple ? (
            <div className="space-y-4 rounded-2xl border border-border bg-muted/20 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{createdCouple.coupleName}</p>
                  <p className="text-xs text-muted-foreground">
                    Invite-Code: {createdCouple.inviteCode}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-2xl"
                  onClick={() =>
                    copyText(createdCouple.inviteLinks.map((link) => link.url).join("\n"), "Alle Startlinks kopiert")
                  }
                >
                  Alle Links kopieren
                </Button>
              </div>

              <div className="space-y-3">
                {createdCouple.inviteLinks.map((link) => (
                  <div key={link.url} className="rounded-2xl border border-border bg-background p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {link.label}: {link.email}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Gültig bis {dateFormatter.format(new Date(link.expiresAt))}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-2xl"
                        onClick={() => copyText(link.url, `${link.label} Link kopiert`)}
                      >
                        Link kopieren
                      </Button>
                    </div>
                    <Input value={link.url} readOnly className="mt-3" />
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Manuelle Beta-Allowlist</CardTitle>
          <CardDescription>
            Nur noch als Fallback, wenn du einzelne E-Mails separat freischalten willst.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              allowlistAction.execute({ entries });
            }}
          >
            <Textarea
              value={entries}
              onChange={(event) => setEntries(event.target.value)}
              rows={8}
              placeholder={[
                "mia@example.com | Paar 01",
                "leo@example.com | Paar 01",
                "sara@example.com | Paar 02",
                "tom@example.com | Paar 02",
              ].join("\n")}
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" className="rounded-2xl" disabled={allowlistAction.isPending}>
                E-Mails speichern
              </Button>
              <p className="text-xs text-muted-foreground">
                Diese Liste schaltet Adressen für den manuellen Beta-Zugang frei.
              </p>
            </div>
            {allowlistAction.result.serverError ? (
              <p className="text-sm text-primary">{allowlistAction.result.serverError}</p>
            ) : null}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

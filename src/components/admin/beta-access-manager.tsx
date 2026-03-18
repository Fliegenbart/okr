"use client";

import { useState } from "react";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";

import { upsertBetaAccessEntries } from "@/actions/admin-beta";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

type BetaAccessManagerProps = {
  totalEntries: number;
  activatedEntries: number;
};

export function BetaAccessManager({ totalEntries, activatedEntries }: BetaAccessManagerProps) {
  const [entries, setEntries] = useState("");

  const action = useAction(upsertBetaAccessEntries, {
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Beta Access Manager</CardTitle>
        <CardDescription>
          Füge hier die E-Mails der 10 Paare ein. Format pro Zeile:{" "}
          <code>email@beispiel.de | Paar 01</code>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-muted/30 p-4">
            <p className="text-sm text-muted-foreground">Gesamt erlaubt</p>
            <p className="mt-1 text-3xl font-semibold text-foreground">{totalEntries}</p>
          </div>
          <div className="rounded-2xl border border-border bg-muted/30 p-4">
            <p className="text-sm text-muted-foreground">Aktiviert</p>
            <p className="mt-1 text-3xl font-semibold text-foreground">{activatedEntries}</p>
          </div>
        </div>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            action.execute({ entries });
          }}
        >
          <Textarea
            value={entries}
            onChange={(event) => setEntries(event.target.value)}
            rows={10}
            placeholder={[
              "mia@example.com | Paar 01",
              "leo@example.com | Paar 01",
              "sara@example.com | Paar 02",
              "tom@example.com | Paar 02",
            ].join("\n")}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" className="rounded-2xl" disabled={action.isPending}>
              E-Mails speichern
            </Button>
            <p className="text-xs text-muted-foreground">
              Jeder Eintrag wird für den Support-Login freigeschaltet.
            </p>
          </div>
          {action.result.serverError ? (
            <p className="text-sm text-primary">{action.result.serverError}</p>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}

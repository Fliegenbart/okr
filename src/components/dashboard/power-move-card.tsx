"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  type PowerMoveApiResponse,
  type ThinkingPartnerAction,
  type ThinkingPartnerSource,
  type ThinkingPartnerStructuredAnswer,
} from "@/lib/thinking-partner-types";

type StructuredAnswer = ThinkingPartnerStructuredAnswer;
type Action = ThinkingPartnerAction;
type Source = ThinkingPartnerSource;

export type PowerMoveCardProps = {
  quarterId: string | null;
  quarterTitle: string | null;
  hasObjectives: boolean;
};

export function PowerMoveCard({ quarterId, quarterTitle, hasObjectives }: PowerMoveCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [reply, setReply] = useState<string | null>(null);
  const [structured, setStructured] = useState<StructuredAnswer | null>(null);
  const [actions, setActions] = useState<Action[]>([]);
  const [sources, setSources] = useState<Source[]>([]);

  const loadPowerMove = async () => {
    if (isLoading) return;
    setIsLoading(true);

    try {
      const response = await fetch("/api/power-move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quarterId }),
      });

      const data = (await response.json()) as Partial<PowerMoveApiResponse> & {
        error?: string;
      };

      if (!response.ok) {
        toast.error("Vorschlag konnte gerade nicht geladen werden", {
          description: data?.error ?? "",
        });
        return;
      }

      const nextStructured = data.structured ?? null;
      const nextActions = data.actions ?? [];
      const nextSources = data.sources ?? [];
      const nextReply = data.reply ?? null;

      setStructured(nextStructured);
      setActions(nextActions);
      setSources(nextSources);
      setReply(nextReply);

      if (!nextStructured) {
        toast.message("Vorschlag geladen");
      }
    } catch {
      toast.error("Vorschlag konnte gerade nicht geladen werden");
    } finally {
      setIsLoading(false);
    }
  };

  const actionButtons = actions.map((action) => {
    if (action.type === "OPEN_CHECKIN_SETTINGS") {
      return (
        <Button key={action.type} asChild size="sm">
          <Link href="/dashboard/check-in">{action.label}</Link>
        </Button>
      );
    }

    if (action.type === "OPEN_THINKING_PARTNER") {
      return (
        <Button key={action.type} asChild size="sm" variant="outline">
          <Link href="/dashboard/thinking-partner">{action.label}</Link>
        </Button>
      );
    }

    return null;
  });

  return (
    <Card className="dashboard-highlight overflow-hidden border-none text-white shadow-[0_28px_70px_rgba(193,0,103,0.24)]">
      <CardContent className="space-y-5 p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <p className="dashboard-kicker text-[10px] font-extrabold text-white/65">
              Nächster Schritt mit großem Hebel
            </p>
            <p className="text-sm text-white/72">
              {quarterTitle ? quarterTitle : "Aktuelles Quartal"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="rounded-full bg-white/14 text-white hover:bg-white/22"
              onClick={loadPowerMove}
              disabled={!hasObjectives || isLoading}
            >
              <Sparkles className="h-4 w-4" />
              {structured ? "Neu laden" : "Vorschlag holen"}
            </Button>
          </div>
        </div>

        {!hasObjectives ? (
          <div className="rounded-[1.5rem] border border-white/10 bg-white/10 p-4 text-sm text-white/78">
            Legt zuerst mindestens ein Objective an. Danach zeige ich euch einen Vorschlag, der im
            Quartal gerade besonders viel bewegen kann.
            <div className="mt-3">
              <Button asChild size="sm" variant="outline" className="rounded-full border-white/20 bg-white text-primary hover:bg-white/90">
                <Link href="/dashboard/objectives/new">Objective anlegen</Link>
              </Button>
            </div>
          </div>
        ) : null}

        {hasObjectives && structured ? (
          <div className="space-y-4">
            <div className="rounded-[1.6rem] border border-white/10 bg-white/12 p-5 backdrop-blur-md">
              <p className="dashboard-kicker text-[10px] font-extrabold text-white/65">Euer nächster Schritt</p>
              <p className="mt-2 font-display text-2xl font-bold tracking-[-0.04em] text-white">
                {structured.nextStep}
              </p>
              <p className="mt-3 text-sm leading-6 text-white/80">{structured.summary}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[1.5rem] border border-white/10 bg-white/94 p-4 text-foreground">
                <p className="dashboard-kicker text-[10px] font-extrabold text-muted-foreground">Warum das gerade hilft</p>
                <ul className="mt-3 space-y-2 text-sm text-foreground">
                  {structured.impulses.map((impulse) => (
                    <li key={impulse} className="flex gap-2">
                      <span className="mt-1.5 h-1 w-1 flex-none rounded-full bg-primary" />
                      <span>{impulse}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-[1.5rem] border border-white/10 bg-white/94 p-4 text-foreground">
                <p className="dashboard-kicker text-[10px] font-extrabold text-muted-foreground">
                  Fragen für euer Gespräch
                </p>
                <ul className="mt-3 space-y-2 text-sm text-foreground">
                  {structured.questions.map((question) => (
                    <li key={question} className="flex gap-2">
                      <span className="mt-1.5 h-1 w-1 flex-none rounded-full bg-primary/40" />
                      <span>{question}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {structured.miniRitual ? (
              <details className="rounded-[1.5rem] border border-white/10 bg-white/94 p-4 text-foreground">
                <summary className="dashboard-kicker cursor-pointer list-none text-[10px] font-extrabold text-muted-foreground">
                  Mini-Ritual
                </summary>
                <div className="mt-3 space-y-2">
                  <p className="text-sm font-semibold text-foreground">
                    {structured.miniRitual.title}
                  </p>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {structured.miniRitual.steps.map((step) => (
                      <li key={step}>- {step}</li>
                    ))}
                  </ul>
                </div>
              </details>
            ) : null}

            {sources.length ? (
              <details className="rounded-[1.5rem] border border-white/10 bg-white/94 p-4 text-foreground">
                <summary className="dashboard-kicker cursor-pointer list-none text-[10px] font-extrabold text-muted-foreground">
                  Grundlage aus euren Sessions
                </summary>
                <div className="mt-3 space-y-3">
                  {sources.slice(0, 3).map((source) => (
                    <div key={source.title} className="space-y-1">
                      <p className="text-sm font-medium text-foreground">{source.title}</p>
                      <p className="text-sm text-muted-foreground">{source.excerpt}…</p>
                    </div>
                  ))}
                </div>
              </details>
            ) : null}

            {actionButtons.filter(Boolean).length ? (
              <div className="flex flex-wrap gap-2">{actionButtons}</div>
            ) : null}
          </div>
        ) : null}

        {hasObjectives && !structured && reply ? (
          <div className="rounded-[1.5rem] border border-white/10 bg-white/10 p-4 text-sm text-white/78">
            {reply}
          </div>
        ) : null}

        {hasObjectives && !structured && !reply ? (
          <div className="rounded-[1.5rem] border border-white/10 bg-white/10 p-4 text-sm text-white/78">
            Hier bekommt ihr einen Vorschlag für einen sinnvollen nächsten Schritt mit großem Hebel.
            Die Empfehlung nutzt euren Fortschritt, fehlende Updates und die restliche Zeit im
            Quartal. Klickt auf <span className="font-medium">Vorschlag holen</span>.
          </div>
        ) : null}

        {isLoading ? <p className="text-sm text-white/75">Analysiere…</p> : null}
      </CardContent>
    </Card>
  );
}

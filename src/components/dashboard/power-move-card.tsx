"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type StructuredAnswer = {
  summary: string;
  impulses: string[];
  nextStep: string;
  questions: string[];
  miniRitual?: { title: string; steps: string[] };
};

type Action = { type: string; label: string };

type Source = {
  title: string;
  excerpt: string;
  topics?: unknown;
};

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

      const data = await response.json();

      if (!response.ok) {
        toast.error("Vorschlag konnte gerade nicht geladen werden", {
          description: data?.error ?? "",
        });
        return;
      }

      const nextStructured =
        data?.structured && typeof data.structured === "object"
          ? (data.structured as StructuredAnswer)
          : null;
      const nextActions = Array.isArray(data?.actions) ? (data.actions as Action[]) : [];
      const nextSources = Array.isArray(data?.sources) ? (data.sources as Source[]) : [];
      const nextReply = typeof data?.reply === "string" ? data.reply : null;

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
    <Card className="dashboard-panel overflow-hidden rounded-[1.75rem] border-primary/15 bg-gradient-to-br from-primary/10 via-white/95 to-white">
      <CardContent className="space-y-5 p-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary shadow-sm">
                <Sparkles className="h-3.5 w-3.5" />
                Top Momentum
              </div>
              <div className="space-y-1">
                <p className="text-lg font-semibold text-foreground">
                  Der kleine Schritt mit der groessten Wirkung
                </p>
                <p className="text-sm text-muted-foreground">
                  {quarterTitle ? quarterTitle : "Aktuelles Quartal"}
                </p>
              </div>
            </div>
            <Button size="sm" onClick={loadPowerMove} disabled={!hasObjectives || isLoading}>
              <Sparkles className="h-4 w-4" />
              {structured ? "Neu laden" : "Empfehlung holen"}
            </Button>
          </div>
        </div>

        {!hasObjectives ? (
          <div className="rounded-[1.5rem] border border-border/70 bg-white/80 p-4 text-sm text-muted-foreground">
            Legt zuerst mindestens ein Objective an. Danach zeige ich euch den nächsten Schritt, der im
            Quartal am meisten bewegen kann.
            <div className="mt-3">
              <Button asChild size="sm" variant="outline">
                <Link href="/dashboard/objectives/new">Objective anlegen</Link>
              </Button>
            </div>
          </div>
        ) : null}

        {hasObjectives && structured ? (
          <div className="space-y-4">
            <div className="rounded-[1.5rem] border border-white/80 bg-white/90 p-5 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary/70">
                Empfohlener naechster Schritt
              </p>
              <p className="mt-3 text-lg font-semibold leading-7 text-foreground">
                {structured.nextStep}
              </p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{structured.summary}</p>
            </div>

            <div className="rounded-[1.5rem] border border-border/70 bg-white/85 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Warum das gerade wichtig ist
              </p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-foreground">
                {structured.impulses.slice(0, 2).map((impulse) => (
                  <li key={impulse} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-primary" />
                    <span>{impulse}</span>
                  </li>
                ))}
              </ul>
            </div>

            <details className="rounded-[1.5rem] border border-border/70 bg-white/85 p-4">
              <summary className="cursor-pointer list-none text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Mehr Details
              </summary>
              <div className="mt-4 grid gap-4">
                <div className="rounded-2xl border border-border/70 bg-white p-4">
                  <p className="text-xs font-medium text-muted-foreground">
                    Fragen fuer euer Gespraech
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

                {structured.miniRitual ? (
                  <div className="rounded-2xl border border-border/70 bg-white p-4">
                    <p className="text-xs font-medium text-muted-foreground">Mini-Ritual</p>
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
                  </div>
                ) : null}

                {sources.length ? (
                  <div className="rounded-2xl border border-border/70 bg-white p-4">
                    <p className="text-xs font-medium text-muted-foreground">
                      Grundlage aus euren Sessions
                    </p>
                    <div className="mt-3 space-y-3">
                      {sources.slice(0, 3).map((source) => (
                        <div key={source.title} className="space-y-1">
                          <p className="text-sm font-medium text-foreground">{source.title}</p>
                          <p className="text-sm text-muted-foreground">{source.excerpt}…</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </details>

            {actionButtons.filter(Boolean).length ? (
              <div className="flex flex-wrap gap-2">{actionButtons}</div>
            ) : null}
          </div>
        ) : null}

        {hasObjectives && !structured && reply ? (
          <div className="rounded-[1.5rem] border border-border/70 bg-white/85 p-4 text-sm text-muted-foreground">
            {reply}
          </div>
        ) : null}

        {hasObjectives && !structured && !reply ? (
          <div className="rounded-[1.5rem] border border-border/70 bg-white/85 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Hier schaut eure KI auf das ganze Quartal.</p>
            <p className="mt-2">
              Ihr bekommt eine kurze Empfehlung, welcher naechste kleine Schritt gerade den
              groessten Unterschied machen kann.
            </p>
          </div>
        ) : null}

        {isLoading ? <p className="text-sm text-muted-foreground">Analysiere…</p> : null}
      </CardContent>
    </Card>
  );
}

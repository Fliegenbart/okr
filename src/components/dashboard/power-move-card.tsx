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

export function PowerMoveCard({
  quarterId,
  quarterTitle,
  hasObjectives,
}: PowerMoveCardProps) {
  const [isLoading, setIsLoading] = useState(false);
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
        toast.error("Powermove konnte nicht geladen werden", {
          description: data?.error ?? "",
        });
        return;
      }

      const nextStructured =
        data?.structured && typeof data.structured === "object"
          ? (data.structured as StructuredAnswer)
          : null;
      const nextActions = Array.isArray(data?.actions)
        ? (data.actions as Action[])
        : [];
      const nextSources = Array.isArray(data?.sources)
        ? (data.sources as Source[])
        : [];

      setStructured(nextStructured);
      setActions(nextActions);
      setSources(nextSources);

      if (!nextStructured) {
        toast.message("Powermove geladen");
      }
    } catch {
      toast.error("Powermove konnte nicht geladen werden");
    } finally {
      setIsLoading(false);
    }
  };

  const actionButtons = actions.map((action) => {
    if (action.type === "OPEN_CHECKIN_SETTINGS") {
      return (
        <Button key={action.type} asChild size="sm">
          <Link href="/dashboard/settings">{action.label}</Link>
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
    <Card className="rounded-2xl border-border shadow-sm">
      <CardContent className="space-y-5 p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
              Powermove fuers Quartal
            </p>
            <p className="text-sm text-muted-foreground">
              {quarterTitle ? quarterTitle : "Aktuelles Quartal"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={loadPowerMove}
              disabled={!hasObjectives || isLoading}
            >
              <Sparkles className="h-4 w-4" />
              {structured ? "Neu berechnen" : "Powermove finden"}
            </Button>
          </div>
        </div>

        {!hasObjectives ? (
          <div className="rounded-2xl border border-white/60 bg-white/60 p-4 text-sm text-muted-foreground backdrop-blur-sm">
            Legt zuerst mindestens ein Objective an, dann kann ich den groessten
            Hebel fuer euer Quartal finden.
            <div className="mt-3">
              <Button asChild size="sm" variant="outline">
                <Link href="/dashboard/objectives/new">Objective erstellen</Link>
              </Button>
            </div>
          </div>
        ) : null}

        {hasObjectives && structured ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/60 bg-white/70 p-5 shadow-sm backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Powermove
              </p>
              <p className="mt-2 text-lg font-semibold text-foreground">
                {structured.nextStep}
              </p>
              <p className="mt-3 text-sm text-muted-foreground">
                {structured.summary}
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/60 bg-white/60 p-4 backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Impulse
                </p>
                <ul className="mt-3 space-y-2 text-sm text-foreground">
                  {structured.impulses.map((impulse) => (
                    <li key={impulse} className="flex gap-2">
                      <span className="mt-1 h-1.5 w-1.5 flex-none rounded-full bg-primary" />
                      <span>{impulse}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-white/60 bg-white/60 p-4 backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Rueckfragen
                </p>
                <ul className="mt-3 space-y-2 text-sm text-foreground">
                  {structured.questions.map((question) => (
                    <li key={question} className="flex gap-2">
                      <span className="mt-1 h-1.5 w-1.5 flex-none rounded-full bg-secondary" />
                      <span>{question}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {structured.miniRitual ? (
              <details className="rounded-2xl border border-white/60 bg-white/60 p-4 backdrop-blur-sm">
                <summary className="cursor-pointer list-none text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
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
              <details className="rounded-2xl border border-white/60 bg-white/60 p-4 backdrop-blur-sm">
                <summary className="cursor-pointer list-none text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Quellen (Calls)
                </summary>
                <div className="mt-3 space-y-3">
                  {sources.slice(0, 3).map((source) => (
                    <div key={source.title} className="space-y-1">
                      <p className="text-sm font-medium text-foreground">
                        {source.title}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {source.excerpt}…
                      </p>
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

        {hasObjectives && !structured ? (
          <div className="rounded-2xl border border-white/60 bg-white/60 p-4 text-sm text-muted-foreground backdrop-blur-sm">
            Ein Powermove ist der kleinste Schritt mit dem groessten Hebel.
            Klick auf <span className="font-medium">Powermove finden</span>.
          </div>
        ) : null}

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Analysiere…</p>
        ) : null}
      </CardContent>
    </Card>
  );
}


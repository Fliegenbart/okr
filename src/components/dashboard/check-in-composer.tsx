"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";

import { createCheckInSession } from "@/actions/couple-engagement";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ConversationTemplate } from "@/lib/couple-engagement";

type CheckInComposerProps = {
  templates: ConversationTemplate[];
  selectedTemplateKey?: string | null;
  quarterTitle?: string | null;
};

export function CheckInComposer({
  templates,
  selectedTemplateKey,
  quarterTitle,
}: CheckInComposerProps) {
  const router = useRouter();
  const defaultTemplate =
    templates.find((template) => template.key === selectedTemplateKey) ?? templates[0] ?? null;

  const [templateKey, setTemplateKey] = useState(defaultTemplate?.key ?? "");
  const [title, setTitle] = useState(defaultTemplate?.title ?? "Wochen-Check");
  const [moodRating, setMoodRating] = useState("3");
  const [highlights, setHighlights] = useState("");
  const [tensions, setTensions] = useState("");
  const [summary, setSummary] = useState("");
  const [nextSteps, setNextSteps] = useState("");

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.key === templateKey) ?? null,
    [templateKey, templates]
  );

  const action = useAction(createCheckInSession, {
    onSuccess: () => {
      toast.success("Wochen-Check gespeichert");
      setHighlights("");
      setTensions("");
      setSummary("");
      setNextSteps("");
      router.refresh();
    },
    onError: ({ error }) => {
      toast.error("Wochen-Check konnte nicht gespeichert werden", {
        description: error.serverError ?? error.validationErrors?.formErrors?.[0] ?? "",
      });
    },
  });

  const validationErrors = action.result.validationErrors as
    | {
        fieldErrors?: {
          title?: string[];
          nextSteps?: string[];
          summary?: string[];
          highlights?: string[];
          tensions?: string[];
        };
      }
    | undefined;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    action.execute({
      title,
      templateKey: templateKey || null,
      moodRating: moodRating ? Number(moodRating) : null,
      highlights,
      tensions,
      summary,
      nextSteps,
      quarterId: null,
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label htmlFor="checkin-template">Vorlage</Label>
          <select
            id="checkin-template"
            value={templateKey}
            onChange={(event) => {
              const nextKey = event.target.value;
              setTemplateKey(nextKey);
              const nextTemplate = templates.find((template) => template.key === nextKey) ?? null;
              if (nextTemplate) {
                setTitle(nextTemplate.title);
              }
            }}
            className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm text-foreground outline-none"
          >
            {templates.map((template) => (
              <option key={template.key} value={template.key}>
                {template.title}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="checkin-title">Titel</Label>
          <Input
            id="checkin-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          {validationErrors?.fieldErrors?.title?.[0] ? (
            <p className="text-sm text-primary">{validationErrors.fieldErrors.title[0]}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="checkin-mood">Stimmung</Label>
          <select
            id="checkin-mood"
            value={moodRating}
            onChange={(event) => setMoodRating(event.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm text-foreground outline-none"
          >
            <option value="1">1 - sehr schwer</option>
            <option value="2">2 - eher schwer</option>
            <option value="3">3 - neutral</option>
            <option value="4">4 - gut</option>
            <option value="5">5 - sehr gut</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="checkin-highlights">Was war gut?</Label>
          <Textarea
            id="checkin-highlights"
            value={highlights}
            onChange={(event) => setHighlights(event.target.value)}
            rows={3}
            placeholder="Was hat euch diese Woche getragen?"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="checkin-tensions">Spannungen</Label>
          <Textarea
            id="checkin-tensions"
            value={tensions}
            onChange={(event) => setTensions(event.target.value)}
            rows={3}
            placeholder="Was war schwierig oder ungeklärt?"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="checkin-summary">Kurz zusammenfassen</Label>
          <Textarea
            id="checkin-summary"
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            rows={3}
            placeholder="1-2 Sätze: Was ist heute wichtig?"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="checkin-next-steps">Nächste Schritte</Label>
          <Textarea
            id="checkin-next-steps"
            value={nextSteps}
            onChange={(event) => setNextSteps(event.target.value)}
            rows={4}
            placeholder="Eine Zeile pro Zusage oder nächstem Schritt"
          />
          {validationErrors?.fieldErrors?.nextSteps?.[0] ? (
            <p className="text-sm text-primary">{validationErrors.fieldErrors.nextSteps[0]}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" className="rounded-2xl" disabled={action.isPending}>
            Wochen-Check speichern
          </Button>
          <p className="text-xs text-muted-foreground">
            {quarterTitle
              ? `Aktuelles Quartal: ${quarterTitle}`
              : "Wird ohne aktives Quartal gespeichert."}
          </p>
        </div>
      </form>

      <aside className="space-y-4 rounded-2xl border border-border bg-muted/20 p-5">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-[0.2em] text-primary">Vorschau</p>
          <h2 className="text-xl font-semibold text-foreground">
            {selectedTemplate?.title ?? "Wochen-Check"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {selectedTemplate?.description ??
              "Ein ruhiger Rahmen, um ehrlich auf eure Woche zu schauen."}
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Worum es heute geht
          </p>
          <p className="text-sm text-foreground">
            {selectedTemplate?.focus ?? "Wertschätzung, Spannungen, nächste Schritte"}
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Hilfreiche Fragen
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {(selectedTemplate?.questions ?? []).map((question) => (
              <li key={question}>- {question}</li>
            ))}
          </ul>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Was ihr daraus mitnehmen könnt
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {(selectedTemplate?.followUps ?? []).map((item) => (
              <li key={item}>- {item}</li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}

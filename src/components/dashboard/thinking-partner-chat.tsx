"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";

import { setObjectiveNextAction, updateObjective } from "@/actions/objective";
import { updateKeyResultMeta } from "@/actions/key-result";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getOkrCoachGreeting, getTranscriptSpeakerLabel } from "@/lib/transcript-persona";

export type ThinkingPartnerChatProps = {
  objectiveId?: string | null;
  keyResultId?: string | null;
};

type StructuredAnswer = {
  summary: string;
  impulses: string[];
  nextStep: string;
  questions: string[];
  miniRitual?: { title: string; steps: string[] };
  objectiveRewrite?: { title: string; description?: string | null };
  keyResultRewrite?: {
    title: string;
    targetValue: number;
    unit?: string | null;
  };
};

type Action = { type: string; label: string };

type Message =
  | { role: "user"; content: string }
  | {
      role: "assistant";
      content: string;
      structured?: StructuredAnswer | null;
      actions?: Action[];
    };

type Source = {
  title: string;
  excerpt: string;
  topics?: unknown;
  speaker?: string | null;
  kind?: "wissen" | "stil";
};

const starterPrompts = [
  "Unsere Vision klingt nett, aber noch nicht klar. Wie würdest du sie schärfen?",
  "Wir hängen zwischen Objective und To-do fest. Was ist hier die richtige Ebene?",
  "Welches Key Result wäre wirklich outcome-nah und in unserem Einflussbereich?",
];

function formatTopics(topics: unknown) {
  if (!Array.isArray(topics)) return null;
  const labels = topics
    .filter((topic): topic is string => typeof topic === "string")
    .map((topic) => {
      if (topic === "KONFLIKT") return "Konflikt";
      if (topic === "PRIORISIERUNG") return "Priorisierung";
      if (topic === "INTIMITAET") return "Intimität";
      if (topic === "FINANZEN") return "Finanzen";
      return topic;
    });
  return labels.length ? labels.join(", ") : null;
}

export function ThinkingPartnerChat({ objectiveId, keyResultId }: ThinkingPartnerChatProps) {
  const router = useRouter();

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: getOkrCoachGreeting(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sources, setSources] = useState<Source[]>([]);
  const messagesRef = useRef<HTMLDivElement | null>(null);

  const [dialog, setDialog] = useState<
    | null
    | {
        kind: "saveNextAction";
        objectiveId: string;
        text: string;
      }
    | {
        kind: "objectiveRewrite";
        objectiveId: string;
        title: string;
        description: string;
      }
    | {
        kind: "keyResultRewrite";
        keyResultId: string;
        title: string;
        targetValue: string;
        unit: string;
      }
  >(null);

  const saveNextAction = useAction(setObjectiveNextAction, {
    onSuccess: () => {
      toast.success("Nächste Aktion gespeichert");
      router.refresh();
      setDialog(null);
    },
    onError: ({ error }) => {
      toast.error("Nächste Aktion konnte nicht gespeichert werden", {
        description: error.serverError ?? error.validationErrors?.formErrors?.[0] ?? "",
      });
    },
  });

  const applyObjectiveRewrite = useAction(updateObjective, {
    onSuccess: () => {
      toast.success("Objective aktualisiert");
      router.refresh();
      setDialog(null);
    },
    onError: ({ error }) => {
      toast.error("Objective konnte nicht aktualisiert werden", {
        description: error.serverError ?? error.validationErrors?.formErrors?.[0] ?? "",
      });
    },
  });

  const applyKeyResultRewrite = useAction(updateKeyResultMeta, {
    onSuccess: () => {
      toast.success("Key Result aktualisiert");
      router.refresh();
      setDialog(null);
    },
    onError: ({ error }) => {
      toast.error("Key Result konnte nicht aktualisiert werden", {
        description: error.serverError ?? error.validationErrors?.formErrors?.[0] ?? "",
      });
    },
  });

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSend = async (message: string) => {
    const trimmed = message.trim();
    if (!trimmed || isLoading) return;

    const nextMessages: Message[] = [...messages, { role: "user", content: trimmed }];
    const history = nextMessages.slice(-6).map(({ role, content }) => ({
      role,
      content,
    }));
    setMessages(nextMessages);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/thinking-partner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          history,
          objectiveId: objectiveId ?? null,
          keyResultId: keyResultId ?? null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage =
          typeof data?.error === "string" && data.error.trim()
            ? data.error
            : "Ich konnte gerade keine Antwort liefern.";
        throw new Error(errorMessage);
      }

      const reply = typeof data?.reply === "string" ? data.reply : "";
      const structured =
        data?.structured && typeof data.structured === "object"
          ? (data.structured as StructuredAnswer)
          : null;
      const actions = Array.isArray(data?.actions) ? (data.actions as Action[]) : [];

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: reply || "Ich konnte gerade keine Antwort liefern.",
          structured,
          actions,
        },
      ]);
      setSources(Array.isArray(data?.sources) ? data.sources : []);
    } catch (error) {
      const messageText =
        error instanceof Error && error.message.trim()
          ? error.message
          : "Fehler beim Laden. Bitte versuche es erneut.";
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: messageText,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = (action: Action, message: Message) => {
    if (message.role !== "assistant") return;
    const structured = message.structured;

    if (action.type === "OPEN_CHECKIN_SETTINGS") {
      router.push("/dashboard/check-in");
      return;
    }

    if (action.type === "SAVE_NEXT_ACTION") {
      if (!objectiveId || !structured?.nextStep) {
        toast.error("Das geht nur, wenn gerade ein Objective ausgewählt ist.");
        return;
      }

      setDialog({
        kind: "saveNextAction",
        objectiveId,
        text: structured.nextStep,
      });
      return;
    }

    if (action.type === "APPLY_OBJECTIVE_REWRITE") {
      if (!objectiveId || !structured?.objectiveRewrite) {
        toast.error("Dafür gibt es gerade keinen neuen Objective-Vorschlag.");
        return;
      }

      setDialog({
        kind: "objectiveRewrite",
        objectiveId,
        title: structured.objectiveRewrite.title,
        description: structured.objectiveRewrite.description ?? "",
      });
      return;
    }

    if (action.type === "APPLY_KEY_RESULT_REWRITE") {
      if (!keyResultId || !structured?.keyResultRewrite) {
        toast.error("Dafür gibt es gerade keinen neuen Key-Result-Vorschlag.");
        return;
      }

      setDialog({
        kind: "keyResultRewrite",
        keyResultId,
        title: structured.keyResultRewrite.title,
        targetValue: String(structured.keyResultRewrite.targetValue),
        unit: structured.keyResultRewrite.unit ?? "",
      });
    }
  };

  const actionsDisabled =
    isLoading ||
    saveNextAction.isPending ||
    applyObjectiveRewrite.isPending ||
    applyKeyResultRewrite.isPending;

  const sourceKindLabel = (kind?: "wissen" | "stil") => {
    if (kind === "stil") return "Stil";
    return "Wissen";
  };

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          OKR-Coach für Paare
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Hier bekommt ihr Wärme und Struktur zusammen: erst sortieren wir, worum es wirklich
          geht, dann übersetzen wir das in eine klare Formulierung oder einen machbaren nächsten
          Schritt.
        </p>
      </div>

      <div
        ref={messagesRef}
        className="h-[420px] min-h-[320px] overflow-y-auto rounded-2xl border border-border bg-card p-4"
      >
        <div className="space-y-4">
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-foreground"
                }`}
              >
                {message.role === "assistant" && message.structured ? (
                  <div className="space-y-4">
                    <p className="whitespace-pre-wrap">{message.structured.summary}</p>

                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                        Impulse
                      </p>
                      <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
                        {message.structured.impulses.map((impulse) => (
                          <li key={impulse}>{impulse}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="rounded-2xl border border-border bg-card px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                        Nächster Schritt
                      </p>
                      <p className="mt-1 text-sm font-medium text-foreground">
                        {message.structured.nextStep}
                      </p>
                    </div>

                    {message.structured.miniRitual ? (
                      <div className="rounded-2xl border border-border bg-background px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                          Mini-Ritual
                        </p>
                        <p className="mt-1 text-sm font-medium text-foreground">
                          {message.structured.miniRitual.title}
                        </p>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                          {message.structured.miniRitual.steps.map((step) => (
                            <li key={step}>{step}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                        Rückfragen
                      </p>
                      <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
                        {message.structured.questions.map((question) => (
                          <li key={question}>{question}</li>
                        ))}
                      </ul>
                    </div>

                    {message.actions?.length ? (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {message.actions.map((action) => (
                          <Button
                            key={`${action.type}-${action.label}`}
                            type="button"
                            variant="outline"
                            className="rounded-2xl text-xs"
                            onClick={() => handleAction(action, message)}
                            disabled={actionsDisabled}
                          >
                            {action.label}
                          </Button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{message.content}</p>
                )}
              </div>
            </div>
          ))}
          {isLoading ? <div className="text-xs text-muted-foreground">Tippt...</div> : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {starterPrompts.map((prompt) => (
          <Button
            key={prompt}
            type="button"
            variant="outline"
            className="rounded-2xl text-xs"
            onClick={() => handleSend(prompt)}
            disabled={isLoading}
          >
            {prompt}
          </Button>
        ))}
      </div>

      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-center"
        onSubmit={(event) => {
          event.preventDefault();
          handleSend(input);
        }}
      >
        <Input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Schreibe eure Frage..."
          className="rounded-2xl"
        />
        <Button type="submit" className="rounded-2xl" disabled={isLoading}>
          Senden
        </Button>
      </form>

      {sources.length ? (
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-primary">Quellen aus Calls</p>
          <div className="mt-3 space-y-3">
            {sources.map((source, index) => {
              const topicsLabel = formatTopics(source.topics);
              const speakerLabel = getTranscriptSpeakerLabel(source.speaker);
              return (
                <div key={`${source.title}-${index}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{source.title}</p>
                    <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                      {sourceKindLabel(source.kind)}
                    </span>
                    {speakerLabel ? (
                      <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                        {speakerLabel}
                      </span>
                    ) : null}
                  </div>
                  {topicsLabel ? (
                    <p className="text-[11px] uppercase tracking-[0.2em] text-primary">
                      {topicsLabel}
                    </p>
                  ) : null}
                  <p className="text-xs text-muted-foreground">{source.excerpt}...</p>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <Dialog open={dialog !== null} onOpenChange={(open) => (!open ? setDialog(null) : null)}>
        <DialogContent>
          {dialog?.kind === "saveNextAction" ? (
            <>
              <DialogHeader>
                <DialogTitle>Nächste Aktion speichern</DialogTitle>
                <DialogDescription>
                  Speichert diesen Schritt direkt am Objective, damit ihr leichter dranbleibt.
                </DialogDescription>
              </DialogHeader>
              <div className="mt-4 space-y-2">
                <Label htmlFor="next-action-text">Nächste Aktion</Label>
                <Textarea
                  id="next-action-text"
                  value={dialog.text}
                  onChange={(event) =>
                    setDialog((prev) =>
                      prev && prev.kind === "saveNextAction"
                        ? { ...prev, text: event.target.value }
                        : prev
                    )
                  }
                  className="min-h-[120px] rounded-2xl"
                />
              </div>
              <DialogFooter className="mt-6">
                <Button
                  type="button"
                  className="rounded-2xl"
                  onClick={() =>
                    saveNextAction.execute({
                      objectiveId: dialog.objectiveId,
                      nextAction: dialog.text,
                      ownerId: null,
                    })
                  }
                  disabled={saveNextAction.isPending}
                >
                  Speichern
                </Button>
              </DialogFooter>
            </>
          ) : null}

          {dialog?.kind === "objectiveRewrite" ? (
            <>
              <DialogHeader>
                <DialogTitle>Objective neu formulieren</DialogTitle>
                <DialogDescription>
                  Übernehmt den Vorschlag oder passt ihn noch an.
                </DialogDescription>
              </DialogHeader>
              <div className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="objective-rewrite-title">Titel</Label>
                  <Input
                    id="objective-rewrite-title"
                    value={dialog.title}
                    onChange={(event) =>
                      setDialog((prev) =>
                        prev && prev.kind === "objectiveRewrite"
                          ? { ...prev, title: event.target.value }
                          : prev
                      )
                    }
                    className="rounded-2xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="objective-rewrite-description">Beschreibung</Label>
                  <Textarea
                    id="objective-rewrite-description"
                    value={dialog.description}
                    onChange={(event) =>
                      setDialog((prev) =>
                        prev && prev.kind === "objectiveRewrite"
                          ? { ...prev, description: event.target.value }
                          : prev
                      )
                    }
                    className="min-h-[120px] rounded-2xl"
                  />
                </div>
              </div>
              <DialogFooter className="mt-6">
                <Button
                  type="button"
                  className="rounded-2xl"
                  onClick={() =>
                    applyObjectiveRewrite.execute({
                      objectiveId: dialog.objectiveId,
                      title: dialog.title,
                      description: dialog.description,
                    })
                  }
                  disabled={applyObjectiveRewrite.isPending}
                >
                  Übernehmen
                </Button>
              </DialogFooter>
            </>
          ) : null}

          {dialog?.kind === "keyResultRewrite" ? (
            <>
              <DialogHeader>
                <DialogTitle>Key Result vereinfachen</DialogTitle>
                <DialogDescription>
                  Übernehmt den Vorschlag oder passt ihn noch an.
                </DialogDescription>
              </DialogHeader>
              <div className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="kr-rewrite-title">Titel</Label>
                  <Input
                    id="kr-rewrite-title"
                    value={dialog.title}
                    onChange={(event) =>
                      setDialog((prev) =>
                        prev && prev.kind === "keyResultRewrite"
                          ? { ...prev, title: event.target.value }
                          : prev
                      )
                    }
                    className="rounded-2xl"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="kr-rewrite-target">Zielwert</Label>
                    <Input
                      id="kr-rewrite-target"
                      value={dialog.targetValue}
                      onChange={(event) =>
                        setDialog((prev) =>
                          prev && prev.kind === "keyResultRewrite"
                            ? { ...prev, targetValue: event.target.value }
                            : prev
                        )
                      }
                      className="rounded-2xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="kr-rewrite-unit">Einheit</Label>
                    <Input
                      id="kr-rewrite-unit"
                      value={dialog.unit}
                      onChange={(event) =>
                        setDialog((prev) =>
                          prev && prev.kind === "keyResultRewrite"
                            ? { ...prev, unit: event.target.value }
                            : prev
                        )
                      }
                      className="rounded-2xl"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter className="mt-6">
                <Button
                  type="button"
                  className="rounded-2xl"
                  onClick={() =>
                    applyKeyResultRewrite.execute({
                      keyResultId: dialog.keyResultId,
                      title: dialog.title,
                      targetValue: dialog.targetValue,
                      unit: dialog.unit,
                    })
                  }
                  disabled={applyKeyResultRewrite.isPending}
                >
                  Übernehmen
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

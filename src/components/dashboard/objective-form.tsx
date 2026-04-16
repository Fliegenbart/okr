"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";

import { createObjective } from "@/actions/objective";
import {
  createEmptyKeyResultDraft,
  KeyResultFields,
  type KeyResultDraft,
} from "@/components/dashboard/key-result-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type QuarterOption = {
  id: string;
  title: string;
};

type KeyResultInput = KeyResultDraft & {
  id: string;
};

type ObjectiveFormProps = {
  quarters: QuarterOption[];
  defaultQuarterId?: string | null;
};

export function ObjectiveForm({ quarters, defaultQuarterId }: ObjectiveFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [quarterId, setQuarterId] = useState(defaultQuarterId ?? "");
  const [keyResults, setKeyResults] = useState<KeyResultInput[]>([
    {
      id: crypto.randomUUID(),
      ...createEmptyKeyResultDraft(),
    },
    {
      id: crypto.randomUUID(),
      ...createEmptyKeyResultDraft(),
    },
    {
      id: crypto.randomUUID(),
      ...createEmptyKeyResultDraft(),
    },
    {
      id: crypto.randomUUID(),
      ...createEmptyKeyResultDraft(),
    },
  ]);

  const createAction = useAction(createObjective, {
    onSuccess: () => {
      toast.success("Objective erstellt");
      router.push("/dashboard");
      router.refresh();
    },
    onError: ({ error }) => {
      toast.error("Objective konnte nicht erstellt werden", {
        description: error.serverError ?? error.validationErrors?.formErrors?.[0] ?? "",
      });
    },
  });

  const validationErrors = createAction.result.validationErrors as
    | {
        formErrors?: string[];
        fieldErrors?: {
          title?: string[];
          description?: string[];
          keyResults?: string[];
        };
      }
    | undefined;

  const handleAddKeyResult = () => {
    if (keyResults.length >= 5) {
      toast.error("Maximal 5 Key Results pro Objective.");
      return;
    }
    setKeyResults((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        ...createEmptyKeyResultDraft(),
      },
    ]);
  };

  const handleRemoveKeyResult = (id: string) => {
    setKeyResults((prev) => (prev.length > 1 ? prev.filter((item) => item.id !== id) : prev));
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const payloadKeyResults = keyResults
      .map((item) => ({
        title: item.title.trim(),
        targetValue: item.targetValue,
        type: item.type,
        direction: item.direction,
        startValue: item.startValue,
        unit: item.unit.trim(),
        description: item.description,
        redThreshold: item.redThreshold,
        yellowThreshold: item.yellowThreshold,
        greenThreshold: item.greenThreshold,
      }))
      .filter((item) => item.title);

    if (payloadKeyResults.length < 1) {
      toast.error("Bitte gib mindestens ein Key Result an.");
      return;
    }

    if (payloadKeyResults.length > 5) {
      toast.error("Maximal 5 Key Results pro Objective.");
      return;
    }

    createAction.execute({
      title,
      description,
      quarterId: quarterId || undefined,
      keyResults: payloadKeyResults,
    });
  };

  return (
    <form className="space-y-8" onSubmit={handleSubmit}>
      <div className="space-y-2 rounded-[1.6rem] bg-white/70 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
        <Label htmlFor="objective-title">Objective</Label>
        <Input
          id="objective-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="z.B. Gemeinsam gesünder und aktiver leben"
        />
        {validationErrors?.fieldErrors?.title?.[0] ? (
          <p className="text-sm text-primary">{validationErrors.fieldErrors.title[0]}</p>
        ) : null}
      </div>

      <div className="space-y-2 rounded-[1.6rem] bg-white/70 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
        <Label htmlFor="objective-description">Beschreibung (optional)</Label>
        <Textarea
          id="objective-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Warum ist dieses Objective gerade wichtig?"
        />
      </div>

      {quarters.length ? (
        <div className="space-y-2 rounded-[1.6rem] bg-white/70 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
          <Label htmlFor="objective-quarter">Quartal</Label>
          <select
            id="objective-quarter"
            value={quarterId}
            onChange={(event) => setQuarterId(event.target.value)}
            className="h-11 w-full rounded-2xl border border-white/80 bg-white/90 px-4 text-sm text-foreground"
          >
            <option value="">Aktuelles Quartal</option>
            {quarters.map((quarter) => (
              <option key={quarter.id} value={quarter.id}>
                {quarter.title}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm uppercase tracking-[0.2em] text-primary">Key Results</p>
          <Button
            type="button"
            variant="outline"
            className="rounded-2xl"
            onClick={handleAddKeyResult}
          >
            Weiteres KR erfassen
          </Button>
        </div>

        <div className="space-y-4">
          {keyResults.map((keyResult, index) => (
            <div
              key={keyResult.id}
              className="rounded-[1.6rem] border border-white/80 bg-white/85 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-foreground">Key Result {index + 1}</p>
                {keyResults.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => handleRemoveKeyResult(keyResult.id)}
                    className="text-xs uppercase tracking-[0.2em] text-primary"
                  >
                    Entfernen
                  </button>
                ) : null}
              </div>

              <div className="mt-3 space-y-3">
                <KeyResultFields
                  idPrefix={`kr-${keyResult.id}`}
                  value={keyResult}
                  onChange={(nextValue) =>
                    setKeyResults((prev) =>
                      prev.map((item) => (item.id === keyResult.id ? { ...nextValue, id: item.id } : item))
                    )
                  }
                />
              </div>
            </div>
          ))}
        </div>
        {validationErrors?.fieldErrors?.keyResults?.[0] ? (
          <p className="text-sm text-primary">{validationErrors.fieldErrors.keyResults[0]}</p>
        ) : null}
      </div>

      {validationErrors?.formErrors?.[0] ? (
        <p className="text-sm text-primary">{validationErrors.formErrors[0]}</p>
      ) : null}
      {createAction.result.serverError ? (
        <p className="text-sm text-primary">{createAction.result.serverError}</p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="submit" className="rounded-2xl" disabled={createAction.isPending}>
          Objective speichern
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="rounded-2xl"
          onClick={() => router.push("/dashboard")}
        >
          Abbrechen
        </Button>
      </div>
    </form>
  );
}

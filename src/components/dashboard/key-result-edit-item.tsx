"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";

import { archiveKeyResult, updateKeyResultMeta } from "@/actions/key-result";
import {
  createEmptyKeyResultDraft,
  KeyResultFields,
} from "@/components/dashboard/key-result-fields";
import { Button } from "@/components/ui/button";
import type { KeyResultDirection, KeyResultType } from "@/lib/key-results";

export type KeyResultEditItemProps = {
  keyResultId: string;
  title: string;
  type: KeyResultType;
  direction: KeyResultDirection;
  targetValue: number;
  startValue: number;
  unit?: string | null;
  description?: string | null;
  redThreshold?: number | null;
  yellowThreshold?: number | null;
  greenThreshold?: number | null;
};

export function KeyResultEditItem({
  keyResultId,
  title,
  type,
  direction,
  targetValue,
  startValue,
  unit,
  description,
  redThreshold,
  yellowThreshold,
  greenThreshold,
}: KeyResultEditItemProps) {
  const router = useRouter();
  const [draft, setDraft] = useState({
    ...createEmptyKeyResultDraft(),
    title,
    type,
    direction,
    targetValue: String(targetValue),
    startValue: String(startValue),
    unit: unit ?? "",
    description: description ?? "",
    redThreshold: redThreshold !== null && redThreshold !== undefined ? String(redThreshold) : "",
    yellowThreshold:
      yellowThreshold !== null && yellowThreshold !== undefined ? String(yellowThreshold) : "",
    greenThreshold:
      greenThreshold !== null && greenThreshold !== undefined ? String(greenThreshold) : "",
  });

  const updateAction = useAction(updateKeyResultMeta, {
    onSuccess: () => {
      toast.success("Messpunkt aktualisiert");
      router.refresh();
    },
    onError: ({ error }) => {
      toast.error("Messpunkt konnte nicht aktualisiert werden", {
        description: error.serverError ?? error.validationErrors?.formErrors?.[0] ?? "",
      });
    },
  });

  const deleteAction = useAction(archiveKeyResult, {
    onSuccess: () => {
      toast.success("Messpunkt archiviert");
      router.refresh();
    },
    onError: ({ error }) => {
      toast.error("Messpunkt konnte nicht archiviert werden", {
        description: error.serverError ?? "",
      });
    },
  });

  const handleUpdate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updateAction.execute({
      keyResultId,
      ...draft,
    });
  };

  const handleDelete = () => {
    if (window.confirm("Messpunkt wirklich archivieren?")) {
      deleteAction.execute({ keyResultId });
    }
  };

  return (
    <form
      className="space-y-3 rounded-2xl border border-border bg-card p-4"
      onSubmit={handleUpdate}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-foreground">Messpunkt</p>
        <button
          type="button"
          onClick={handleDelete}
          className="text-xs uppercase tracking-[0.2em] text-primary"
        >
          Archivieren
        </button>
      </div>
      <KeyResultFields idPrefix={`kr-edit-${keyResultId}`} value={draft} onChange={setDraft} />
      <Button type="submit" className="rounded-2xl" disabled={updateAction.isPending}>
        Speichern
      </Button>
    </form>
  );
}

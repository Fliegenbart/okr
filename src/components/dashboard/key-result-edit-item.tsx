"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";

import { archiveKeyResult, updateKeyResultMeta } from "@/actions/key-result";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type KeyResultEditItemProps = {
  keyResultId: string;
  title: string;
  targetValue: number;
  unit?: string | null;
};

export function KeyResultEditItem({
  keyResultId,
  title,
  targetValue,
  unit,
}: KeyResultEditItemProps) {
  const router = useRouter();
  const [krTitle, setKrTitle] = useState(title);
  const [krTarget, setKrTarget] = useState(String(targetValue));
  const [krUnit, setKrUnit] = useState(unit ?? "");

  const updateAction = useAction(updateKeyResultMeta, {
    onSuccess: () => {
      toast.success("Key Result aktualisiert");
      router.refresh();
    },
    onError: ({ error }) => {
      toast.error("Key Result konnte nicht aktualisiert werden", {
        description:
          error.serverError ?? error.validationErrors?.formErrors?.[0] ?? "",
      });
    },
  });

  const deleteAction = useAction(archiveKeyResult, {
    onSuccess: () => {
      toast.success("Key Result archiviert");
      router.refresh();
    },
    onError: ({ error }) => {
      toast.error("Key Result konnte nicht archiviert werden", {
        description: error.serverError ?? "",
      });
    },
  });

  const handleUpdate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updateAction.execute({
      keyResultId,
      title: krTitle,
      targetValue: krTarget,
      unit: krUnit,
    });
  };

  const handleDelete = () => {
    if (window.confirm("Key Result wirklich archivieren?")) {
      deleteAction.execute({ keyResultId });
    }
  };

  return (
    <form
      className="space-y-3 rounded-2xl border border-border bg-card p-4"
      onSubmit={handleUpdate}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-foreground">Key Result</p>
        <button
          type="button"
          onClick={handleDelete}
          className="text-xs uppercase tracking-[0.2em] text-primary"
        >
          Archivieren
        </button>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`kr-edit-title-${keyResultId}`}>Titel</Label>
        <Input
          id={`kr-edit-title-${keyResultId}`}
          value={krTitle}
          onChange={(event) => setKrTitle(event.target.value)}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr,0.6fr]">
        <div className="space-y-2">
          <Label htmlFor={`kr-edit-target-${keyResultId}`}>Zielwert</Label>
          <Input
            id={`kr-edit-target-${keyResultId}`}
            type="number"
            min={0}
            step="0.1"
            value={krTarget}
            onChange={(event) => setKrTarget(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`kr-edit-unit-${keyResultId}`}>Einheit</Label>
          <Input
            id={`kr-edit-unit-${keyResultId}`}
            value={krUnit}
            onChange={(event) => setKrUnit(event.target.value)}
          />
        </div>
      </div>
      <Button type="submit" className="rounded-2xl" disabled={updateAction.isPending}>
        Speichern
      </Button>
    </form>
  );
}

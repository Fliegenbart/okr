"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";

import { updateKeyResult } from "@/actions/key-result";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { KeyResultType } from "@/lib/key-results";

export type KeyResultUpdateFormProps = {
  keyResultId: string;
  currentValue: number;
  type: KeyResultType;
  unit?: string | null;
};

export function KeyResultUpdateForm({
  keyResultId,
  currentValue,
  type,
  unit,
}: KeyResultUpdateFormProps) {
  const router = useRouter();
  const [value, setValue] = useState(String(currentValue));
  const [achieved, setAchieved] = useState(currentValue >= 1);
  const [note, setNote] = useState("");

  const updateAction = useAction(updateKeyResult, {
    onSuccess: () => {
      setNote("");
      toast.success("Update gespeichert");
      router.refresh();
    },
    onError: ({ error }) => {
      toast.error("Update fehlgeschlagen", {
        description: error.serverError ?? error.validationErrors?.formErrors?.[0] ?? "",
      });
    },
  });

  const validationErrors = updateAction.result.validationErrors as
    | {
        fieldErrors?: { value?: string[]; achieved?: string[] };
      }
    | undefined;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (type === "BINARY") {
      updateAction.execute({
        keyResultId,
        type,
        value: achieved ? 1 : 0,
        achieved,
        note,
      });
      return;
    }

    const numericValue = Number(value);
    if (Number.isNaN(numericValue)) {
      return;
    }

    updateAction.execute({
      keyResultId,
      type,
      value: numericValue,
      note,
    });
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor={`kr-value-${keyResultId}`}>
          {type === "BINARY" ? "Status" : "Neuer Fortschritt"}
        </Label>
        {type === "BINARY" ? (
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => setAchieved(false)}
              className={`rounded-lg border px-3 py-2 text-sm ${
                !achieved ? "border-primary bg-primary/10 text-primary" : "border-border bg-white"
              }`}
            >
              Noch nicht erreicht
            </button>
            <button
              type="button"
              onClick={() => setAchieved(true)}
              className={`rounded-lg border px-3 py-2 text-sm ${
                achieved ? "border-primary bg-primary/10 text-primary" : "border-border bg-white"
              }`}
            >
              Erreicht
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input
              id={`kr-value-${keyResultId}`}
              type="number"
              min={0}
              step="0.1"
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
            <span className="text-sm text-muted-foreground">{unit ? unit : ""}</span>
          </div>
        )}
        {validationErrors?.fieldErrors?.value?.[0] ? (
          <p className="text-sm text-primary">{validationErrors.fieldErrors.value[0]}</p>
        ) : null}
        {validationErrors?.fieldErrors?.achieved?.[0] ? (
          <p className="text-sm text-primary">{validationErrors.fieldErrors.achieved[0]}</p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor={`kr-note-${keyResultId}`}>Notiz (optional)</Label>
        <Input
          id={`kr-note-${keyResultId}`}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Was hat euch geholfen?"
        />
      </div>
      {updateAction.result.serverError ? (
        <p className="text-sm text-primary">{updateAction.result.serverError}</p>
      ) : null}
      <Button type="submit" className="rounded-2xl" disabled={updateAction.isPending}>
        Update speichern
      </Button>
    </form>
  );
}

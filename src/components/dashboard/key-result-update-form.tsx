"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";

import { updateKeyResult } from "@/actions/key-result";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type KeyResultUpdateFormProps = {
  keyResultId: string;
  currentValue: number;
  unit?: string | null;
};

export function KeyResultUpdateForm({
  keyResultId,
  currentValue,
  unit,
}: KeyResultUpdateFormProps) {
  const router = useRouter();
  const [value, setValue] = useState(String(currentValue));
  const [note, setNote] = useState("");

  const updateAction = useAction(updateKeyResult, {
    onSuccess: () => {
      setNote("");
      toast.success("Update gespeichert");
      router.refresh();
    },
    onError: ({ error }) => {
      toast.error("Update fehlgeschlagen", {
        description:
          error.serverError ?? error.validationErrors?.formErrors?.[0] ?? "",
      });
    },
  });

  const validationErrors = updateAction.result.validationErrors as
    | {
        fieldErrors?: { value?: string[] };
      }
    | undefined;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const numericValue = Number(value);

    if (Number.isNaN(numericValue)) {
      return;
    }

    updateAction.execute({
      keyResultId,
      value: numericValue,
      note,
    });
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor={`kr-value-${keyResultId}`}>Neuer Fortschritt</Label>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            id={`kr-value-${keyResultId}`}
            type="number"
            min={0}
            step="0.1"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
          <span className="text-sm text-muted-foreground">
            {unit ? unit : ""}
          </span>
        </div>
        {validationErrors?.fieldErrors?.value?.[0] ? (
          <p className="text-sm text-primary">
            {validationErrors.fieldErrors.value[0]}
          </p>
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
        <p className="text-sm text-primary">
          {updateAction.result.serverError}
        </p>
      ) : null}
      <Button
        type="submit"
        className="rounded-2xl"
        disabled={updateAction.isPending}
      >
        Update speichern
      </Button>
    </form>
  );
}

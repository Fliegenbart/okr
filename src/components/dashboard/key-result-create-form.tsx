"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";

import { createKeyResult } from "@/actions/key-result";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type KeyResultCreateFormProps = {
  objectiveId: string;
  disabled?: boolean;
  disabledReason?: string;
};

export function KeyResultCreateForm({
  objectiveId,
  disabled,
  disabledReason,
}: KeyResultCreateFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [unit, setUnit] = useState("");

  const createAction = useAction(createKeyResult, {
    onSuccess: () => {
      toast.success("Key Result hinzugefuegt");
      setTitle("");
      setTargetValue("");
      setUnit("");
      router.refresh();
    },
    onError: ({ error }) => {
      toast.error("Key Result konnte nicht erstellt werden", {
        description:
          error.serverError ?? error.validationErrors?.formErrors?.[0] ?? "",
      });
    },
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    createAction.execute({
      objectiveId,
      title,
      targetValue,
      unit,
    });
  };

  return (
    <form className="space-y-3" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="kr-new-title">Titel</Label>
        <Input
          id="kr-new-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="z.B. 3 neue Orte besuchen"
          disabled={disabled}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr,0.6fr]">
        <div className="space-y-2">
          <Label htmlFor="kr-new-target">Zielwert</Label>
          <Input
            id="kr-new-target"
            type="number"
            min={0}
            step="0.1"
            value={targetValue}
            onChange={(event) => setTargetValue(event.target.value)}
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="kr-new-unit">Einheit</Label>
          <Input
            id="kr-new-unit"
            value={unit}
            onChange={(event) => setUnit(event.target.value)}
            disabled={disabled}
          />
        </div>
      </div>
      {disabled && disabledReason ? (
        <p className="text-xs text-muted-foreground">{disabledReason}</p>
      ) : null}
      <Button
        type="submit"
        className="rounded-2xl"
        disabled={createAction.isPending || disabled}
      >
        Hinzufuegen
      </Button>
    </form>
  );
}

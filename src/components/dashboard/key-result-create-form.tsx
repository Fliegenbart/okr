"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";

import { createKeyResult } from "@/actions/key-result";
import {
  createEmptyKeyResultDraft,
  KeyResultFields,
} from "@/components/dashboard/key-result-fields";
import { Button } from "@/components/ui/button";

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
  const [draft, setDraft] = useState(createEmptyKeyResultDraft());

  const createAction = useAction(createKeyResult, {
    onSuccess: () => {
      toast.success("Key Result hinzugefügt");
      setDraft(createEmptyKeyResultDraft());
      router.refresh();
    },
    onError: ({ error }) => {
      toast.error("Key Result konnte nicht erstellt werden", {
        description: error.serverError ?? error.validationErrors?.formErrors?.[0] ?? "",
      });
    },
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    createAction.execute({
      objectiveId,
      ...draft,
    });
  };

  return (
    <form className="space-y-3" onSubmit={handleSubmit}>
      <fieldset disabled={disabled} className="space-y-3">
        <KeyResultFields idPrefix="kr-new" value={draft} onChange={setDraft} />
      </fieldset>
      {disabled && disabledReason ? (
        <p className="text-xs text-muted-foreground">{disabledReason}</p>
      ) : null}
      <Button type="submit" className="rounded-2xl" disabled={createAction.isPending || disabled}>
        Hinzufügen
      </Button>
    </form>
  );
}

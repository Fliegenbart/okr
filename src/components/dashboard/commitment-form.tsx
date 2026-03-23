"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";

import { createCommitment } from "@/actions/couple-engagement";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type CommitmentFormProps = {
  ownerOptions: Array<{ id: string; label: string }>;
  objectiveOptions?: Array<{ id: string; label: string }>;
};

export function CommitmentForm({ ownerOptions, objectiveOptions = [] }: CommitmentFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [objectiveId, setObjectiveId] = useState("");
  const [dueAt, setDueAt] = useState("");

  const action = useAction(createCommitment, {
    onSuccess: () => {
      toast.success("Zusage gespeichert");
      setTitle("");
      setDetails("");
      setOwnerId("");
      setObjectiveId("");
      setDueAt("");
      router.refresh();
    },
    onError: ({ error }) => {
      toast.error("Zusage konnte nicht gespeichert werden", {
        description: error.serverError ?? error.validationErrors?.formErrors?.[0] ?? "",
      });
    },
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    action.execute({
      title,
      details,
      ownerId: ownerId || null,
      objectiveId: objectiveId || null,
      dueAt: dueAt ? new Date(dueAt).toISOString() : null,
    });
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="commitment-title">Zusage</Label>
        <Input
          id="commitment-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Was wollt ihr konkret tun?"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="commitment-details">Details</Label>
        <Textarea
          id="commitment-details"
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          rows={3}
          placeholder="Optional: Kontext, warum das wichtig ist"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="commitment-owner">Wer übernimmt es?</Label>
          <select
            id="commitment-owner"
            value={ownerId}
            onChange={(event) => setOwnerId(event.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm text-foreground outline-none"
          >
            <option value="">Noch offen</option>
            {ownerOptions.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="commitment-dueAt">Fällig am</Label>
          <Input
            id="commitment-dueAt"
            type="date"
            value={dueAt}
            onChange={(event) => setDueAt(event.target.value)}
          />
        </div>
      </div>
      {objectiveOptions.length ? (
        <div className="space-y-2">
          <Label htmlFor="commitment-objective">Ziel</Label>
          <select
            id="commitment-objective"
            value={objectiveId}
            onChange={(event) => setObjectiveId(event.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm text-foreground outline-none"
          >
            <option value="">Keinem Ziel zuordnen</option>
            {objectiveOptions.map((objective) => (
              <option key={objective.id} value={objective.id}>
                {objective.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <Button type="submit" className="rounded-2xl" disabled={action.isPending}>
        Zusage anlegen
      </Button>
    </form>
  );
}

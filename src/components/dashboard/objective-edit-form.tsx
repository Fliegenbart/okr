"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";

import { updateObjective } from "@/actions/objective";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type ObjectiveEditFormProps = {
  objectiveId: string;
  title: string;
  description?: string | null;
  quarterId?: string | null;
  quarters: { id: string; title: string }[];
};

export function ObjectiveEditForm({
  objectiveId,
  title,
  description,
  quarterId,
  quarters,
}: ObjectiveEditFormProps) {
  const router = useRouter();
  const [objectiveTitle, setObjectiveTitle] = useState(title);
  const [objectiveDescription, setObjectiveDescription] = useState(
    description ?? ""
  );
  const [selectedQuarterId, setSelectedQuarterId] = useState(
    quarterId ?? ""
  );

  const updateAction = useAction(updateObjective, {
    onSuccess: () => {
      toast.success("Objective gespeichert");
      router.refresh();
    },
    onError: ({ error }) => {
      toast.error("Objective konnte nicht gespeichert werden", {
        description:
          error.serverError ?? error.validationErrors?.formErrors?.[0] ?? "",
      });
    },
  });

  const validationErrors = updateAction.result.validationErrors as
    | {
        fieldErrors?: { title?: string[]; description?: string[] };
      }
    | undefined;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updateAction.execute({
      objectiveId,
      title: objectiveTitle,
      description: objectiveDescription,
      quarterId: selectedQuarterId || undefined,
    });
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="edit-objective-title">Objective</Label>
        <Input
          id="edit-objective-title"
          value={objectiveTitle}
          onChange={(event) => setObjectiveTitle(event.target.value)}
        />
        {validationErrors?.fieldErrors?.title?.[0] ? (
          <p className="text-sm text-primary">
            {validationErrors.fieldErrors.title[0]}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="edit-objective-description">Beschreibung</Label>
        <Textarea
          id="edit-objective-description"
          value={objectiveDescription}
          onChange={(event) => setObjectiveDescription(event.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="edit-objective-quarter">Quartal</Label>
        <select
          id="edit-objective-quarter"
          value={selectedQuarterId}
          onChange={(event) => setSelectedQuarterId(event.target.value)}
          className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
        >
          {quarters.map((quarter) => (
            <option key={quarter.id} value={quarter.id}>
              {quarter.title}
            </option>
          ))}
        </select>
      </div>

      <Button type="submit" className="rounded-2xl" disabled={updateAction.isPending}>
        Speichern
      </Button>
    </form>
  );
}

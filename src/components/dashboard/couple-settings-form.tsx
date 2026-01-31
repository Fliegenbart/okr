"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";

import { updateCouple } from "@/actions/couple";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type CoupleSettingsFormProps = {
  name: string;
  vision?: string | null;
};

export function CoupleSettingsForm({ name, vision }: CoupleSettingsFormProps) {
  const router = useRouter();
  const [coupleName, setCoupleName] = useState(name);
  const [coupleVision, setCoupleVision] = useState(vision ?? "");

  const updateAction = useAction(updateCouple, {
    onSuccess: () => {
      toast.success("Couple aktualisiert");
      router.refresh();
    },
    onError: ({ error }) => {
      toast.error("Couple konnte nicht aktualisiert werden", {
        description:
          error.serverError ?? error.validationErrors?.formErrors?.[0] ?? "",
      });
    },
  });

  const validationErrors = updateAction.result.validationErrors as
    | {
        fieldErrors?: { name?: string[]; vision?: string[] };
      }
    | undefined;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updateAction.execute({ name: coupleName, vision: coupleVision });
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="couple-name">Couple-Name</Label>
        <Input
          id="couple-name"
          value={coupleName}
          onChange={(event) => setCoupleName(event.target.value)}
        />
        {validationErrors?.fieldErrors?.name?.[0] ? (
          <p className="text-sm text-primary">
            {validationErrors.fieldErrors.name[0]}
          </p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="couple-vision">Vision</Label>
        <Textarea
          id="couple-vision"
          value={coupleVision}
          onChange={(event) => setCoupleVision(event.target.value)}
          placeholder="Was verbindet euch?"
        />
      </div>
      <Button type="submit" className="rounded-2xl" disabled={updateAction.isPending}>
        Speichern
      </Button>
    </form>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";

import { upsertVisionMission } from "@/actions/vision-mission";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type VisionMissionFormProps = {
  initialVision?: string | null;
  initialMission?: string | null;
};

export function VisionMissionForm({
  initialVision,
  initialMission,
}: VisionMissionFormProps) {
  const router = useRouter();
  const [vision, setVision] = useState(initialVision ?? "");
  const [mission, setMission] = useState(initialMission ?? "");

  const saveAction = useAction(upsertVisionMission, {
    onSuccess: () => {
      toast.success("Vision & Mission gespeichert");
      router.refresh();
    },
    onError: ({ error }) => {
      toast.error("Konnte nicht speichern", {
        description:
          error.serverError ?? error.validationErrors?.formErrors?.[0] ?? "",
      });
    },
  });

  const validationErrors = saveAction.result.validationErrors as
    | {
        fieldErrors?: { vision?: string[]; mission?: string[] };
      }
    | undefined;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    saveAction.execute({ vision, mission });
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="vision-text">Vision</Label>
        <Textarea
          id="vision-text"
          value={vision}
          onChange={(event) => setVision(event.target.value)}
          placeholder="1-3 Saetze: Was wollt ihr gemeinsam leben?"
          rows={4}
        />
        {validationErrors?.fieldErrors?.vision?.[0] ? (
          <p className="text-sm text-primary">
            {validationErrors.fieldErrors.vision[0]}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="mission-text">Mission</Label>
        <Textarea
          id="mission-text"
          value={mission}
          onChange={(event) => setMission(event.target.value)}
          placeholder="1-3 Saetze: Wie wollt ihr das erreichen?"
          rows={4}
        />
        {validationErrors?.fieldErrors?.mission?.[0] ? (
          <p className="text-sm text-primary">
            {validationErrors.fieldErrors.mission[0]}
          </p>
        ) : null}
      </div>

      {saveAction.result.serverError ? (
        <p className="text-sm text-primary">
          {saveAction.result.serverError}
        </p>
      ) : null}

      <Button type="submit" className="rounded-2xl" disabled={saveAction.isPending}>
        Speichern
      </Button>
    </form>
  );
}

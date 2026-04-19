"use client";

import { useState, useTransition } from "react";
import { CheckCheck, X } from "lucide-react";
import { toast } from "sonner";

import { updateCommitmentStatus } from "@/actions/couple-engagement";
import { Button } from "@/components/ui/button";

type CommitmentStatusActionsProps = {
  commitmentId: string;
};

type OptimisticStatus = "OPEN" | "DONE" | "CANCELLED";

export function CommitmentStatusActions({
  commitmentId,
}: CommitmentStatusActionsProps) {
  const [optimisticStatus, setOptimisticStatus] = useState<OptimisticStatus>("OPEN");
  const [, startTransition] = useTransition();

  const handleUpdate = (nextStatus: Exclude<OptimisticStatus, "OPEN">) => {
    setOptimisticStatus(nextStatus);
    startTransition(async () => {
      const result = await updateCommitmentStatus({ commitmentId, status: nextStatus });
      if (result?.serverError || result?.validationErrors) {
        setOptimisticStatus("OPEN");
        toast.error("Commitment konnte nicht aktualisiert werden", {
          description:
            result.serverError ??
            result.validationErrors?.formErrors?.[0] ??
            "",
        });
      }
    });
  };

  if (optimisticStatus === "DONE") {
    return (
      <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <CheckCheck className="h-4 w-4 text-primary" aria-hidden />
        <span>Erledigt</span>
      </div>
    );
  }

  if (optimisticStatus === "CANCELLED") {
    return (
      <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <X className="h-4 w-4" aria-hidden />
        <span>Abgebrochen</span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        size="sm"
        onClick={() => handleUpdate("DONE")}
      >
        <CheckCheck className="h-4 w-4" />
        Erledigt
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => handleUpdate("CANCELLED")}
      >
        <X className="h-4 w-4" />
        Abbrechen
      </Button>
    </div>
  );
}

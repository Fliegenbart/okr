"use client";

import { useState, useTransition } from "react";
import { Check, EyeOff } from "lucide-react";
import { toast } from "sonner";

import { updateReminderStatus } from "@/actions/couple-engagement";
import { Button } from "@/components/ui/button";

type ReminderStatusActionsProps = {
  reminderId: string;
};

type OptimisticStatus = "PENDING" | "DONE" | "DISMISSED";

export function ReminderStatusActions({ reminderId }: ReminderStatusActionsProps) {
  const [optimisticStatus, setOptimisticStatus] = useState<OptimisticStatus>("PENDING");
  const [, startTransition] = useTransition();

  const handleUpdate = (nextStatus: Exclude<OptimisticStatus, "PENDING">) => {
    setOptimisticStatus(nextStatus);
    startTransition(async () => {
      const result = await updateReminderStatus({ reminderId, status: nextStatus });
      if (result?.serverError || result?.validationErrors) {
        setOptimisticStatus("PENDING");
        toast.error("Erinnerung konnte nicht aktualisiert werden", {
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
        <Check className="h-4 w-4 text-primary" aria-hidden />
        <span>Erledigt</span>
      </div>
    );
  }

  if (optimisticStatus === "DISMISSED") {
    return (
      <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <EyeOff className="h-4 w-4" aria-hidden />
        <span>Ausgeblendet</span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" onClick={() => handleUpdate("DONE")}>
        <Check className="h-4 w-4" />
        Erledigt
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => handleUpdate("DISMISSED")}
      >
        <EyeOff className="h-4 w-4" />
        Ausblenden
      </Button>
    </div>
  );
}

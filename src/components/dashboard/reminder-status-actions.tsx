"use client";

import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { Check, EyeOff } from "lucide-react";
import { toast } from "sonner";

import { updateReminderStatus } from "@/actions/couple-engagement";
import { Button } from "@/components/ui/button";

type ReminderStatusActionsProps = {
  reminderId: string;
};

export function ReminderStatusActions({ reminderId }: ReminderStatusActionsProps) {
  const router = useRouter();

  const action = useAction(updateReminderStatus, {
    onSuccess: () => {
      router.refresh();
    },
    onError: ({ error }) => {
      toast.error("Erinnerung konnte nicht aktualisiert werden", {
        description: error.serverError ?? error.validationErrors?.formErrors?.[0] ?? "",
      });
    },
  });

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        size="sm"
        onClick={() => action.execute({ reminderId, status: "DONE" })}
        disabled={action.isPending}
      >
        <Check className="h-4 w-4" />
        Erledigt
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => action.execute({ reminderId, status: "DISMISSED" })}
        disabled={action.isPending}
      >
        <EyeOff className="h-4 w-4" />
        Ausblenden
      </Button>
    </div>
  );
}

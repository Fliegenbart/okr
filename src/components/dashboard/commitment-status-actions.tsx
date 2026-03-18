"use client";

import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { CheckCheck, X } from "lucide-react";
import { toast } from "sonner";

import { updateCommitmentStatus } from "@/actions/couple-engagement";
import { Button } from "@/components/ui/button";

type CommitmentStatusActionsProps = {
  commitmentId: string;
};

export function CommitmentStatusActions({
  commitmentId,
}: CommitmentStatusActionsProps) {
  const router = useRouter();

  const action = useAction(updateCommitmentStatus, {
    onSuccess: () => {
      router.refresh();
    },
    onError: ({ error }) => {
      toast.error("Commitment konnte nicht aktualisiert werden", {
        description:
          error.serverError ?? error.validationErrors?.formErrors?.[0] ?? "",
      });
    },
  });

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        size="sm"
        onClick={() =>
          action.execute({ commitmentId, status: "DONE" })
        }
        disabled={action.isPending}
      >
        <CheckCheck className="h-4 w-4" />
        Erledigt
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() =>
          action.execute({ commitmentId, status: "CANCELLED" })
        }
        disabled={action.isPending}
      >
        <X className="h-4 w-4" />
        Abbrechen
      </Button>
    </div>
  );
}


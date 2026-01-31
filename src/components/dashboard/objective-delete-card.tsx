"use client";

import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";

import { archiveObjective } from "@/actions/objective";
import { Button } from "@/components/ui/button";

export type ObjectiveDeleteCardProps = {
  objectiveId: string;
};

export function ObjectiveDeleteCard({ objectiveId }: ObjectiveDeleteCardProps) {
  const router = useRouter();

  const deleteAction = useAction(archiveObjective, {
    onSuccess: () => {
      toast.success("Objective archiviert");
      router.push("/dashboard");
      router.refresh();
    },
    onError: ({ error }) => {
      toast.error("Objective konnte nicht archiviert werden", {
        description: error.serverError ?? "",
      });
    },
  });

  const handleDelete = () => {
    if (window.confirm("Objective wirklich archivieren?")) {
      deleteAction.execute({ objectiveId });
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Dieses Objective und alle zugehoerigen Key Results werden archiviert.
      </p>
      <Button
        type="button"
        variant="outline"
        className="rounded-2xl border-primary text-primary"
        onClick={handleDelete}
        disabled={deleteAction.isPending}
      >
        Objective archivieren
      </Button>
    </div>
  );
}

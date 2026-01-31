"use client";

import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";

import { restoreObjective } from "@/actions/objective";

export function ObjectiveRestoreButton({ objectiveId }: { objectiveId: string }) {
  const router = useRouter();

  const restoreAction = useAction(restoreObjective, {
    onSuccess: () => {
      toast.success("Objective wiederhergestellt");
      router.refresh();
    },
    onError: ({ error }) => {
      toast.error("Wiederherstellung fehlgeschlagen", {
        description: error.serverError ?? "",
      });
    },
  });

  return (
    <button
      type="button"
      onClick={() => restoreAction.execute({ objectiveId })}
      className="text-xs uppercase tracking-[0.2em] text-primary"
      disabled={restoreAction.isPending}
    >
      Wiederherstellen
    </button>
  );
}

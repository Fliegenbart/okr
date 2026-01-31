"use client";

import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";

import { restoreKeyResult } from "@/actions/key-result";

export function KeyResultRestoreButton({ keyResultId }: { keyResultId: string }) {
  const router = useRouter();

  const restoreAction = useAction(restoreKeyResult, {
    onSuccess: () => {
      toast.success("Key Result wiederhergestellt");
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
      onClick={() => restoreAction.execute({ keyResultId })}
      className="text-xs uppercase tracking-[0.2em] text-primary"
      disabled={restoreAction.isPending}
    >
      Wiederherstellen
    </button>
  );
}

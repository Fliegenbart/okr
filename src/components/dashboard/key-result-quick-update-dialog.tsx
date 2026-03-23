"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";

import { updateKeyResult } from "@/actions/key-result";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { KeyResultType } from "@/lib/key-results";
import { cn } from "@/lib/utils";

export type KeyResultQuickUpdateDialogProps = {
  keyResultId: string;
  title: string;
  currentValue: number;
  type: KeyResultType;
  unit?: string | null;
  onOptimisticUpdate?: (value: number) => void;
  buttonSize?: "default" | "sm";
  buttonClassName?: string;
};

export function KeyResultQuickUpdateDialog({
  keyResultId,
  title,
  currentValue,
  type,
  unit,
  onOptimisticUpdate,
  buttonSize = "default",
  buttonClassName,
}: KeyResultQuickUpdateDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [achieved, setAchieved] = useState(currentValue >= 1);

  const updateAction = useAction(updateKeyResult, {
    onSuccess: () => {
      toast.success("Update gespeichert");
      setOpen(false);
      router.refresh();
    },
    onError: ({ error }) => {
      toast.error("Update fehlgeschlagen", {
        description: error.serverError ?? error.validationErrors?.formErrors?.[0] ?? "",
      });
      router.refresh();
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const rawNote = formData.get("note");
    const note = typeof rawNote === "string" ? rawNote : "";

    if (type === "BINARY") {
      onOptimisticUpdate?.(achieved ? 1 : 0);
      updateAction.execute({ keyResultId, type, value: achieved ? 1 : 0, achieved, note });
      return;
    }

    const rawValue = formData.get("value");
    const value = Number(rawValue);

    if (Number.isNaN(value)) {
      toast.error("Bitte gib einen gültigen Wert ein.");
      return;
    }

    onOptimisticUpdate?.(value);
    updateAction.execute({ keyResultId, type, value, note });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size={buttonSize}
          className={cn("rounded-2xl", buttonClassName)}
        >
          Aktualisieren
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Key Result aktualisieren</DialogTitle>
          <DialogDescription>{title}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor={`kr-quick-value-${keyResultId}`}>
              {type === "BINARY" ? "Status" : "Neuer Fortschritt"}
            </Label>
            {type === "BINARY" ? (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setAchieved(false)}
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    !achieved ? "border-primary bg-primary/10 text-primary" : "border-border"
                  }`}
                >
                  Noch nicht erreicht
                </button>
                <button
                  type="button"
                  onClick={() => setAchieved(true)}
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    achieved ? "border-primary bg-primary/10 text-primary" : "border-border"
                  }`}
                >
                  Erreicht
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Input
                  key={`${keyResultId}-${currentValue}`}
                  id={`kr-quick-value-${keyResultId}`}
                  name="value"
                  type="number"
                  min={0}
                  step="0.1"
                  defaultValue={currentValue}
                />
                {unit ? <span className="text-sm text-muted-foreground">{unit}</span> : null}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor={`kr-quick-note-${keyResultId}`}>Notiz (optional)</Label>
            <Input
              id={`kr-quick-note-${keyResultId}`}
              name="note"
              placeholder="Was hat euch geholfen?"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              className="rounded-2xl"
              onClick={() => setOpen(false)}
            >
              Abbrechen
            </Button>
            <Button type="submit" className="rounded-2xl" disabled={updateAction.isPending}>
              Update speichern
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

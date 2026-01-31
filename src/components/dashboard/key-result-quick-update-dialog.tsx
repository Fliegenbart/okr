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

export type KeyResultQuickUpdateDialogProps = {
  keyResultId: string;
  title: string;
  currentValue: number;
  unit?: string | null;
  onOptimisticUpdate?: (value: number) => void;
};

export function KeyResultQuickUpdateDialog({
  keyResultId,
  title,
  currentValue,
  unit,
  onOptimisticUpdate,
}: KeyResultQuickUpdateDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const updateAction = useAction(updateKeyResult, {
    onSuccess: () => {
      toast.success("Update gespeichert");
      setOpen(false);
      router.refresh();
    },
    onError: ({ error }) => {
      toast.error("Update fehlgeschlagen", {
        description:
          error.serverError ?? error.validationErrors?.formErrors?.[0] ?? "",
      });
      router.refresh();
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const rawValue = formData.get("value");
    const rawNote = formData.get("note");
    const value = Number(rawValue);
    const note = typeof rawNote === "string" ? rawNote : "";

    if (Number.isNaN(value)) {
      toast.error("Bitte gib einen gueltigen Wert ein.");
      return;
    }

    onOptimisticUpdate?.(value);
    updateAction.execute({ keyResultId, value, note });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="rounded-2xl">
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
              Neuer Fortschritt
            </Label>
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
              {unit ? (
                <span className="text-sm text-muted-foreground">{unit}</span>
              ) : null}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`kr-quick-note-${keyResultId}`}>
              Notiz (optional)
            </Label>
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
            <Button
              type="submit"
              className="rounded-2xl"
              disabled={updateAction.isPending}
            >
              Update speichern
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

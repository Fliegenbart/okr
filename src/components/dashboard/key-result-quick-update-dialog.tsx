"use client";

import { useState, type FormEvent } from "react";
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
import type { KeyResultDirection, KeyResultType } from "@/lib/key-results";
import { cn } from "@/lib/utils";

export type KeyResultQuickUpdateDialogProps = {
  keyResultId: string;
  title: string;
  currentValue: number;
  type: KeyResultType;
  unit?: string | null;
  direction?: KeyResultDirection;
  redThreshold?: number | null;
  yellowThreshold?: number | null;
  greenThreshold?: number | null;
  /** Earliest valid date for backdated scoring (e.g. quarter start). ISO yyyy-mm-dd. */
  minDate?: string;
  /** Latest valid date (today by default). ISO yyyy-mm-dd. */
  maxDate?: string;
  onOptimisticUpdate?: (value: number) => void;
  buttonSize?: "default" | "sm";
  buttonClassName?: string;
};

function toIsoDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatNumber(value: number, unit?: string | null) {
  const suffix = unit ? ` ${unit}` : "";
  return `${value}${suffix}`;
}

export function KeyResultQuickUpdateDialog({
  keyResultId,
  title,
  currentValue,
  type,
  unit,
  direction,
  redThreshold,
  yellowThreshold,
  greenThreshold,
  minDate,
  maxDate,
  onOptimisticUpdate,
  buttonSize = "default",
  buttonClassName,
}: KeyResultQuickUpdateDialogProps) {
  const [open, setOpen] = useState(false);
  const [achieved, setAchieved] = useState(currentValue >= 1);
  const todayIso = toIsoDateInput(new Date());
  const resolvedMax = maxDate ?? todayIso;

  const updateAction = useAction(updateKeyResult, {
    onSuccess: () => {
      toast.success("Update gespeichert");
      setOpen(false);
    },
    onError: ({ error }) => {
      const fieldErrors = error.validationErrors?.fieldErrors as
        | { value?: string[]; note?: string[]; occurredAt?: string[]; achieved?: string[] }
        | undefined;
      const description =
        error.serverError ??
        fieldErrors?.value?.[0] ??
        fieldErrors?.occurredAt?.[0] ??
        fieldErrors?.note?.[0] ??
        error.validationErrors?.formErrors?.[0] ??
        "Bitte prüft die Eingaben.";
      toast.error("Update fehlgeschlagen", { description });
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const rawNote = formData.get("note");
    const note = typeof rawNote === "string" ? rawNote : "";
    const rawDate = formData.get("occurredAt");
    // Only send occurredAt when the user actively changed it OR for backdating.
    // Empty string -> undefined, so the server falls back to createdAt = now.
    const occurredAtValue =
      typeof rawDate === "string" && rawDate.trim() !== "" && rawDate !== todayIso
        ? rawDate
        : undefined;

    if (type === "BINARY") {
      onOptimisticUpdate?.(achieved ? 1 : 0);
      updateAction.execute({
        keyResultId,
        type,
        value: achieved ? 1 : 0,
        achieved,
        note,
        ...(occurredAtValue ? { occurredAt: new Date(occurredAtValue) } : {}),
      });
      return;
    }

    const rawValue = formData.get("value");
    const value = Number(rawValue);

    if (Number.isNaN(value)) {
      toast.error("Bitte gib einen gültigen Wert ein.");
      return;
    }

    onOptimisticUpdate?.(value);
    updateAction.execute({
      keyResultId,
      type,
      value,
      note,
      ...(occurredAtValue ? { occurredAt: new Date(occurredAtValue) } : {}),
    });
  };

  const showTrafficLightLegend =
    type === "TRAFFIC_LIGHT" &&
    redThreshold !== null &&
    redThreshold !== undefined &&
    yellowThreshold !== null &&
    yellowThreshold !== undefined &&
    greenThreshold !== null &&
    greenThreshold !== undefined;

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

          {showTrafficLightLegend ? (
            <div className="space-y-2 rounded-xl border border-border bg-muted/40 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Ampel-Schwellen
                {direction === "LOWER_IS_BETTER" ? " (kleiner = besser)" : " (größer = besser)"}
              </p>
              <ul className="space-y-1 text-xs text-foreground">
                <li className="flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
                  <span>
                    <span className="font-semibold">Grün</span>{" "}
                    {direction === "LOWER_IS_BETTER" ? "≤" : "≥"}{" "}
                    {formatNumber(greenThreshold!, unit)}
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-sky-500" aria-hidden />
                  <span>
                    <span className="font-semibold">Blau</span> zwischen{" "}
                    {direction === "LOWER_IS_BETTER"
                      ? `${formatNumber(greenThreshold!, unit)} und ${formatNumber(yellowThreshold!, unit)}`
                      : `${formatNumber(yellowThreshold!, unit)} und ${formatNumber(greenThreshold!, unit)}`}
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-rose-500" aria-hidden />
                  <span>
                    <span className="font-semibold">Rot</span>{" "}
                    {direction === "LOWER_IS_BETTER" ? "≥" : "≤"}{" "}
                    {formatNumber(
                      direction === "LOWER_IS_BETTER" ? yellowThreshold! : redThreshold!,
                      unit,
                    )}
                  </span>
                </li>
              </ul>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor={`kr-quick-date-${keyResultId}`}>Scoring-Datum</Label>
            <Input
              id={`kr-quick-date-${keyResultId}`}
              name="occurredAt"
              type="date"
              defaultValue={todayIso}
              min={minDate}
              max={resolvedMax}
            />
            <p className="text-xs text-muted-foreground">
              Du kannst innerhalb des Quartals auch rückwirkend scoren.
            </p>
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

"use client";

import { type BoardElementType } from "@prisma/client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type BoardElementDraft = {
  type: BoardElementType;
  title: string;
  content: string;
  color: string;
};

type BoardElementDialogProps = {
  open: boolean;
  mode: "create" | "edit";
  draft: BoardElementDraft;
  isSaving: boolean;
  isDeleting: boolean;
  onOpenChange: (open: boolean) => void;
  onDraftChange: (draft: BoardElementDraft) => void;
  onSubmit: () => void;
  onDelete?: () => void;
};

export const BOARD_COLOR_OPTIONS = [
  { value: "#F9E27D", label: "Sonnengelb" },
  { value: "#AEDBFF", label: "Himmelblau" },
  { value: "#BEE8C3", label: "Minze" },
  { value: "#FFB6A0", label: "Apricot" },
  { value: "#D8C7FF", label: "Lavendel" },
  { value: "#FFFDF7", label: "Creme" },
] as const;

const typeLabels: Record<BoardElementType, string> = {
  NOTE: "Sticky Note",
  TEXT: "Textblock",
  FRAME: "Frame",
};

export function BoardElementDialog({
  open,
  mode,
  draft,
  isSaving,
  isDeleting,
  onOpenChange,
  onDraftChange,
  onSubmit,
  onDelete,
}: BoardElementDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl rounded-3xl border-white/80 bg-white/95 p-0 shadow-2xl">
        <div className="rounded-3xl bg-gradient-to-br from-white via-white to-primary/5 p-6">
          <DialogHeader>
            <DialogTitle>
              {mode === "create" ? "Neues Board-Element" : "Element bearbeiten"}
            </DialogTitle>
            <DialogDescription>
              {mode === "create"
                ? "Lege ein neues Element an und positioniere es danach frei auf dem Board."
                : "Passe Text, Farbe und Format des Elements an."}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-6 space-y-5">
            <div className="space-y-2">
              <Label>Typ</Label>
              <div className="grid grid-cols-3 gap-2">
                {(["NOTE", "TEXT", "FRAME"] as BoardElementType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    disabled={mode === "edit"}
                    onClick={() => onDraftChange({ ...draft, type })}
                    className={cn(
                      "rounded-2xl border px-3 py-2 text-sm font-medium transition",
                      draft.type === type
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-white text-muted-foreground hover:text-foreground",
                      mode === "edit" && "cursor-not-allowed opacity-70"
                    )}
                  >
                    {typeLabels[type]}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="board-element-title">Titel</Label>
              <Input
                id="board-element-title"
                value={draft.title}
                onChange={(event) => onDraftChange({ ...draft, title: event.target.value })}
                placeholder={
                  draft.type === "FRAME" ? "z. B. Roadmap" : "Kurzer Titel für die Karte"
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="board-element-content">Inhalt</Label>
              <Textarea
                id="board-element-content"
                value={draft.content}
                onChange={(event) => onDraftChange({ ...draft, content: event.target.value })}
                rows={5}
                placeholder="Gedanken, Zielsatz oder nächster Schritt"
              />
            </div>

            <div className="space-y-2">
              <Label>Farbe</Label>
              <div className="flex flex-wrap gap-2">
                {BOARD_COLOR_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onDraftChange({ ...draft, color: option.value })}
                    className={cn(
                      "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                      draft.color === option.value
                        ? "border-foreground text-foreground shadow-sm"
                        : "border-border text-muted-foreground"
                    )}
                  >
                    <span
                      className="h-4 w-4 rounded-full border border-black/10"
                      style={{ backgroundColor: option.value }}
                    />
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="mt-8">
            {mode === "edit" && onDelete ? (
              <Button
                type="button"
                variant="outline"
                onClick={onDelete}
                disabled={isDeleting || isSaving}
                className="rounded-2xl"
              >
                {isDeleting ? "Lösche ..." : "Löschen"}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving || isDeleting}
              className="rounded-2xl"
            >
              Abbrechen
            </Button>
            <Button
              type="button"
              onClick={onSubmit}
              disabled={isSaving || isDeleting}
              className="rounded-2xl"
            >
              {isSaving
                ? "Speichere ..."
                : mode === "create"
                  ? "Element anlegen"
                  : "Änderungen speichern"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

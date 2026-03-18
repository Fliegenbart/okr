"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type ConfirmActionDialogProps = {
  triggerLabel: string;
  title: string;
  description: string;
  confirmLabel?: string;
  action: (formData: FormData) => void | Promise<void>;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
};

export function ConfirmActionDialog({
  triggerLabel,
  title,
  description,
  confirmLabel = "Bestätigen",
  action,
  variant = "destructive",
}: ConfirmActionDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant={variant} size="sm">
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Abbrechen
            </Button>
          </DialogClose>
          <form action={action}>
            <DialogClose asChild>
              <Button type="submit" variant={variant}>
                {confirmLabel}
              </Button>
            </DialogClose>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

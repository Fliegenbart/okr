"use client";

import { useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";

import { ThinkingPartnerChat } from "@/components/dashboard/thinking-partner-chat";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function ThinkingPartnerFloating() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  if (pathname?.includes("/dashboard/thinking-partner")) {
    return null;
  }

  const segments = pathname?.split("/") ?? [];
  const objectiveId =
    segments[2] === "objectives" ? segments[3] ?? null : null;
  const keyResultId =
    segments[2] === "key-results" ? segments[3] ?? null : null;

  return (
    <>
      <button
        type="button"
        aria-label="Thinking Partner oeffnen"
        onClick={() => setOpen(true)}
        className={cn(
          "group fixed bottom-6 right-6 z-40 flex h-16 w-16 items-center justify-center rounded-full border border-primary/20 bg-secondary p-3 text-primary shadow-lg transition-colors hover:bg-primary hover:text-secondary",
          !open && "motion-safe:animate-bubble-float"
        )}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-1 right-5 h-3 w-3 rotate-45 bg-secondary transition-colors group-hover:bg-primary"
        />
        <span className="relative h-8 w-10">
          <Image
            src="/logo.png"
            alt="OKR fuer Paare"
            fill
            sizes="40px"
            className="object-contain"
          />
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Thinking Partner</DialogTitle>
            <DialogDescription>
              Schnelle Impulse, klare naechste Schritte, kleine Rituale.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <ThinkingPartnerChat
              objectiveId={objectiveId}
              keyResultId={keyResultId}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

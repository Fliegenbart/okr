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

export function ThinkingPartnerFloating({ canUsePersona }: { canUsePersona: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  if (pathname?.includes("/dashboard/thinking-partner")) {
    return null;
  }

  const segments = pathname?.split("/") ?? [];
  const objectiveId = segments[2] === "objectives" ? (segments[3] ?? null) : null;
  const keyResultId = segments[2] === "key-results" ? (segments[3] ?? null) : null;

  return (
    <>
      <button
        type="button"
        aria-label="Thinking Partner öffnen"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg transition-all hover:scale-105 hover:shadow-xl"
      >
        <span className="relative h-7 w-8">
          <Image
            src="/logo.png"
            alt="OKR für Paare"
            fill
            sizes="32px"
            className="object-contain brightness-0 invert"
          />
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col overflow-hidden p-0">
          <DialogHeader>
            <DialogTitle className="px-6 pt-6">Thinking Partner</DialogTitle>
            <DialogDescription className="px-6">
              Wenn ihr feststeckt, bekommt ihr hier eine kurze Antwort und einen nächsten Schritt.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 min-h-0 flex-1 overflow-y-auto px-6 pb-6">
            <ThinkingPartnerChat
              objectiveId={objectiveId}
              keyResultId={keyResultId}
              canUsePersona={canUsePersona}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

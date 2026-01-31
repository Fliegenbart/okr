"use client";

import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";

import { setPreferredQuarter } from "@/actions/quarter";

export type QuarterFilterOption = {
  id: string;
  title: string;
};

type QuarterFilterProps = {
  selectedId: string;
  options: QuarterFilterOption[];
};

export function QuarterFilter({ selectedId, options }: QuarterFilterProps) {
  const router = useRouter();

  const setAction = useAction(setPreferredQuarter, {
    onError: ({ error }) => {
      toast.error("Quartal konnte nicht gespeichert werden", {
        description: error.serverError ?? "",
      });
    },
  });

  const handleSelect = (quarterId: string) => {
    const nextId = quarterId === "all" ? null : quarterId;
    setAction.execute({ quarterId: nextId ?? undefined });
    const href = quarterId === "all" ? "/dashboard" : `/dashboard?quarter=${quarterId}`;
    router.push(href);
  };

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => handleSelect("all")}
        className={`rounded-2xl border px-3 py-1 text-xs font-medium transition ${
          selectedId === "all"
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border text-foreground"
        }`}
      >
        Alle
      </button>
      {options.map((quarter) => (
        <button
          key={quarter.id}
          type="button"
          onClick={() => handleSelect(quarter.id)}
          className={`rounded-2xl border px-3 py-1 text-xs font-medium transition ${
            selectedId === quarter.id
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border text-foreground"
          }`}
        >
          {quarter.title}
        </button>
      ))}
    </div>
  );
}

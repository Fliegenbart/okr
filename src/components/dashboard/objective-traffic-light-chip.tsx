"use client";

import { getObjectiveTrafficLightStatus, type KeyResultLike } from "@/lib/key-results";

type ObjectiveTrafficLightChipProps = {
  keyResults: KeyResultLike[];
};

export function ObjectiveTrafficLightChip({ keyResults }: ObjectiveTrafficLightChipProps) {
  const status = getObjectiveTrafficLightStatus(keyResults);

  if (!status) return null;

  const tone =
    status === "green"
      ? "bg-emerald-100 text-emerald-700"
      : status === "yellow"
        ? "bg-amber-100 text-amber-700"
        : "bg-rose-100 text-rose-700";

  const label = status === "green" ? "Grün" : status === "yellow" ? "Gelb" : "Rot";

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${tone}`}
    >
      Objective {label}
    </span>
  );
}

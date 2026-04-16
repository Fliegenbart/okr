"use client";

import { getKeyResultSignalStatus, type KeyResultLike } from "@/lib/key-results";

type TrafficLightChipProps = {
  keyResult: KeyResultLike;
};

export function TrafficLightChip({ keyResult }: TrafficLightChipProps) {
  const status = getKeyResultSignalStatus(keyResult);

  const tone =
    status === "green"
      ? "bg-emerald-100 text-emerald-700"
      : status === "yellow"
        ? "bg-amber-100 text-amber-700"
        : "bg-rose-100 text-rose-700";

  const label = status === "green" ? "Grün" : status === "yellow" ? "Gelb" : "Rot";

  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${tone}`}>
      {label}
    </span>
  );
}

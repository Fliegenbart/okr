"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { KeyResultSortOption, ObjectiveSortOption } from "@/lib/sorting";

const objectiveOptions: Array<{ value: ObjectiveSortOption; label: string }> = [
  { value: "CREATED_ASC", label: "Wie erfasst" },
  { value: "ALPHABETICAL_ASC", label: "Alphabetisch" },
  { value: "PROGRESS_ASC", label: "Zielerreichung aufsteigend" },
  { value: "PROGRESS_DESC", label: "Zielerreichung absteigend" },
];

const keyResultOptions: Array<{ value: KeyResultSortOption; label: string }> = [
  { value: "CREATED_ASC", label: "Wie erfasst" },
  { value: "ALPHABETICAL_ASC", label: "Alphabetisch" },
  { value: "PROGRESS_ASC", label: "Zielerreichung aufsteigend" },
  { value: "PROGRESS_DESC", label: "Zielerreichung absteigend" },
  { value: "STALEST_FIRST", label: "Am längsten nicht gescored" },
];

type ObjectiveSortSelectProps = {
  value: ObjectiveSortOption;
};

type KeyResultSortSelectProps = {
  value: KeyResultSortOption;
};

function SelectShell({
  id,
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (nextValue: string) => void;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </label>
      <select
        id={id}
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="h-10 rounded-2xl border border-white/80 bg-white/90 px-4 text-sm text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function ObjectiveSortSelect({ value }: ObjectiveSortSelectProps) {
  const id = useId();
  const router = useRouter();
  const [selectedValue, setSelectedValue] = useState<ObjectiveSortOption>(value);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setSelectedValue(value);
  }, [value]);

  const handleChange = async (nextValue: string) => {
    const nextSort = nextValue as ObjectiveSortOption;
    setSelectedValue(nextSort);

    try {
      setIsSaving(true);
      const response = await fetch("/api/preferences/objective-sort", {
        method: "POST",
        keepalive: true,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ sort: nextSort }),
      });

      if (!response.ok) {
        throw new Error("Objective-Sortierung konnte nicht gespeichert werden.");
      }

      router.refresh();
    } catch (error) {
      toast.error("Objective-Sortierung konnte nicht gespeichert werden", {
        description: error instanceof Error ? error.message : "",
      });
      setSelectedValue(value);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SelectShell
      id={id}
      label="Objective-Sortierung"
      value={selectedValue}
      onChange={handleChange}
      options={objectiveOptions}
      disabled={isSaving}
    />
  );
}

export function KeyResultSortSelect({ value }: KeyResultSortSelectProps) {
  const id = useId();
  const router = useRouter();
  const [selectedValue, setSelectedValue] = useState<KeyResultSortOption>(value);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setSelectedValue(value);
  }, [value]);

  const handleChange = async (nextValue: string) => {
    const nextSort = nextValue as KeyResultSortOption;
    setSelectedValue(nextSort);

    try {
      setIsSaving(true);
      const response = await fetch("/api/preferences/key-result-sort", {
        method: "POST",
        keepalive: true,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ sort: nextSort }),
      });

      if (!response.ok) {
        throw new Error("KR-Sortierung konnte nicht gespeichert werden.");
      }

      router.refresh();
    } catch (error) {
      toast.error("KR-Sortierung konnte nicht gespeichert werden", {
        description: error instanceof Error ? error.message : "",
      });
      setSelectedValue(value);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SelectShell
      id={id}
      label="KR-Sortierung"
      value={selectedValue}
      onChange={handleChange}
      options={keyResultOptions}
      disabled={isSaving}
    />
  );
}

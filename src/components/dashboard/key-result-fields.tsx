"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { SimpleRichTextEditor } from "@/components/dashboard/simple-rich-text";
import { getKeyResultDirectionLabel, getKeyResultTypeLabel, type KeyResultDirection, type KeyResultType } from "@/lib/key-results";

export type KeyResultDraft = {
  title: string;
  type: KeyResultType;
  direction: KeyResultDirection;
  targetValue: string;
  startValue: string;
  unit: string;
  description: string;
  redThreshold: string;
  yellowThreshold: string;
  greenThreshold: string;
};

type KeyResultFieldsProps = {
  idPrefix: string;
  value: KeyResultDraft;
  onChange: (value: KeyResultDraft) => void;
};

const TYPE_OPTIONS: KeyResultType[] = [
  "INCREASE_TO",
  "STAY_ABOVE",
  "STAY_BELOW",
  "BINARY",
  "TRAFFIC_LIGHT",
];

const DIRECTION_OPTIONS: KeyResultDirection[] = ["HIGHER_IS_BETTER", "LOWER_IS_BETTER"];

export function createEmptyKeyResultDraft(): KeyResultDraft {
  return {
    title: "",
    type: "INCREASE_TO",
    direction: "HIGHER_IS_BETTER",
    targetValue: "",
    startValue: "0",
    unit: "",
    description: "",
    redThreshold: "",
    yellowThreshold: "",
    greenThreshold: "",
  };
}

export function KeyResultFields({ idPrefix, value, onChange }: KeyResultFieldsProps) {
  const isBinary = value.type === "BINARY";
  const isTrafficLight = value.type === "TRAFFIC_LIGHT";

  const patch = (patchValue: Partial<KeyResultDraft>) => onChange({ ...value, ...patchValue });

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-title`}>Titel</Label>
        <Input
          id={`${idPrefix}-title`}
          value={value.title}
          onChange={(event) => patch({ title: event.target.value })}
          placeholder="z.B. 3 gemeinsame Dates pro Woche"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-type`}>Key-Result-Typ</Label>
          <select
            id={`${idPrefix}-type`}
            value={value.type}
            onChange={(event) =>
              patch(
                event.target.value === "BINARY"
                  ? {
                      type: "BINARY",
                      direction: "HIGHER_IS_BETTER",
                      targetValue: "1",
                      startValue: "0",
                    }
                  : {
                      type: event.target.value as KeyResultType,
                      direction:
                        event.target.value === "STAY_BELOW"
                          ? "LOWER_IS_BETTER"
                          : value.direction,
                    }
              )
            }
            className="h-9 w-full rounded-lg border border-input bg-white px-3 text-sm"
          >
            {TYPE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {getKeyResultTypeLabel(option)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-unit`}>Einheit</Label>
          <Input
            id={`${idPrefix}-unit`}
            value={value.unit}
            onChange={(event) => patch({ unit: event.target.value })}
            placeholder="z.B. Dates, Streits, Euro"
          />
        </div>
      </div>

      {isTrafficLight ? (
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-direction`}>Bewertungsrichtung</Label>
          <select
            id={`${idPrefix}-direction`}
            value={value.direction}
            onChange={(event) => patch({ direction: event.target.value as KeyResultDirection })}
            className="h-9 w-full rounded-lg border border-input bg-white px-3 text-sm"
          >
            {DIRECTION_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {getKeyResultDirectionLabel(option)}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {!isBinary ? (
        <div className={`grid gap-3 ${isTrafficLight ? "sm:grid-cols-1" : "sm:grid-cols-2"}`}>
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-start`}>Ausgangswert</Label>
            <Input
              id={`${idPrefix}-start`}
              type="number"
              min={0}
              step="0.1"
              value={value.startValue}
              onChange={(event) => patch({ startValue: event.target.value })}
            />
          </div>
          {!isTrafficLight ? (
            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-target`}>
                {value.type === "STAY_ABOVE"
                  ? "Mindestwert"
                  : value.type === "STAY_BELOW"
                    ? "Maximalwert"
                    : "Zielwert"}
              </Label>
              <Input
                id={`${idPrefix}-target`}
                type="number"
                min={0}
                step="0.1"
                value={value.targetValue}
                onChange={(event) => patch({ targetValue: event.target.value })}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {isTrafficLight ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-red`}>Rot</Label>
            <Input
              id={`${idPrefix}-red`}
              type="number"
              min={0}
              step="0.1"
              value={value.redThreshold}
              onChange={(event) => patch({ redThreshold: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-yellow`}>Gelb</Label>
            <Input
              id={`${idPrefix}-yellow`}
              type="number"
              min={0}
              step="0.1"
              value={value.yellowThreshold}
              onChange={(event) => patch({ yellowThreshold: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-green`}>Grün</Label>
            <Input
              id={`${idPrefix}-green`}
              type="number"
              min={0}
              step="0.1"
              value={value.greenThreshold}
              onChange={(event) => patch({ greenThreshold: event.target.value, targetValue: event.target.value })}
            />
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-description`}>Beschreibung</Label>
        <SimpleRichTextEditor
          id={`${idPrefix}-description`}
          value={value.description}
          onChange={(nextValue) => patch({ description: nextValue })}
          placeholder="Was steckt hinter diesem Key Result? Was wollt ihr ausprobieren?"
        />
      </div>
    </div>
  );
}

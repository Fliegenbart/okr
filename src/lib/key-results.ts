export const KEY_RESULT_TYPES = [
  "INCREASE_TO",
  "STAY_ABOVE",
  "STAY_BELOW",
  "BINARY",
  "TRAFFIC_LIGHT",
] as const;

export const KEY_RESULT_DIRECTIONS = [
  "HIGHER_IS_BETTER",
  "LOWER_IS_BETTER",
] as const;

export type KeyResultType = (typeof KEY_RESULT_TYPES)[number];
export type KeyResultDirection = (typeof KEY_RESULT_DIRECTIONS)[number];

export type KeyResultProgressInput = {
  currentValue: number;
  targetValue: number;
  startValue?: number | null;
  type?: KeyResultType | null;
  direction?: KeyResultDirection | null;
  redThreshold?: number | null;
  yellowThreshold?: number | null;
  greenThreshold?: number | null;
};

export type KeyResultLike = KeyResultProgressInput & {
  unit?: string | null;
};

export type KeyResultSummary = KeyResultLike & {
  id: string;
  title: string;
  startValue: number;
  type: KeyResultType;
  direction: KeyResultDirection;
};

export type ObjectiveTrafficLightStatus = "green" | "yellow" | "red";

function getFallbackObjectiveTrafficLightStatus(
  keyResults: KeyResultProgressInput[]
): ObjectiveTrafficLightStatus | null {
  if (!keyResults.length) return null;

  const progressValues = keyResults.map((keyResult) => calculateKeyResultProgress(keyResult));
  const averageProgress =
    progressValues.reduce((sum, value) => sum + value, 0) / progressValues.length;
  const lowProgressCount = progressValues.filter((value) => value < 35).length;
  const strongProgressCount = progressValues.filter((value) => value >= 70).length;

  if (lowProgressCount >= Math.ceil(progressValues.length / 2) || averageProgress < 35) {
    return "red";
  }

  if (strongProgressCount === progressValues.length || averageProgress >= 75) {
    return "green";
  }

  return "yellow";
}

export function getKeyResultTypeLabel(type?: KeyResultType | null) {
  switch (type) {
    case "STAY_ABOVE":
      return "Bleibe über";
    case "STAY_BELOW":
      return "Bleibe unter";
    case "BINARY":
      return "Erreicht / nicht erreicht";
    case "TRAFFIC_LIGHT":
      return "Ampel";
    case "INCREASE_TO":
    default:
      return "Steigerung auf";
  }
}

export function getKeyResultDirectionLabel(direction?: KeyResultDirection | null) {
  return direction === "LOWER_IS_BETTER" ? "Weniger ist besser" : "Mehr ist besser";
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(Math.max(value, min), max);
}

function interpolate(value: number, from: number, to: number, fromScore: number, toScore: number) {
  if (from === to) return toScore;
  const ratio = (value - from) / (to - from);
  return fromScore + (toScore - fromScore) * ratio;
}

export function getBinaryValue(value: number) {
  return value >= 1 ? 1 : 0;
}

export function calculateKeyResultProgress(keyResult: KeyResultProgressInput) {
  const type = keyResult.type ?? "INCREASE_TO";
  const startValue = keyResult.startValue ?? 0;

  switch (type) {
    case "STAY_ABOVE": {
      if (keyResult.targetValue <= 0) {
        return keyResult.currentValue >= keyResult.targetValue ? 100 : 0;
      }
      return clamp((keyResult.currentValue / keyResult.targetValue) * 100);
    }
    case "STAY_BELOW": {
      if (keyResult.currentValue <= keyResult.targetValue) return 100;
      if (keyResult.targetValue <= 0) return 0;
      const overflow = keyResult.currentValue - keyResult.targetValue;
      return clamp(100 - (overflow / Math.max(keyResult.targetValue, 1)) * 100);
    }
    case "BINARY":
      return getBinaryValue(keyResult.currentValue) * 100;
    case "TRAFFIC_LIGHT": {
      const red = keyResult.redThreshold ?? 0;
      const yellow = keyResult.yellowThreshold ?? red;
      const green = keyResult.greenThreshold ?? keyResult.targetValue;
      const value = keyResult.currentValue;

      if ((keyResult.direction ?? "HIGHER_IS_BETTER") === "LOWER_IS_BETTER") {
        if (value <= green) return 100;
        if (value >= red) return 0;
        if (value <= yellow) return clamp(interpolate(value, green, yellow, 100, 50));
        return clamp(interpolate(value, yellow, red, 50, 0));
      }

      if (value >= green) return 100;
      if (value <= red) return 0;
      if (value <= yellow) return clamp(interpolate(value, red, yellow, 0, 50));
      return clamp(interpolate(value, yellow, green, 50, 100));
    }
    case "INCREASE_TO":
    default: {
      const distance = keyResult.targetValue - startValue;
      if (distance <= 0) {
        return keyResult.currentValue >= keyResult.targetValue ? 100 : 0;
      }
      return clamp(((keyResult.currentValue - startValue) / distance) * 100);
    }
  }
}

export function getKeyResultSummaryText(keyResult: KeyResultLike & { unit?: string | null }) {
  const unit = keyResult.unit ? ` ${keyResult.unit}` : "";
  const type = keyResult.type ?? "INCREASE_TO";

  switch (type) {
    case "STAY_ABOVE":
      return `Bleibt bei ${keyResult.currentValue}${unit} und soll über ${keyResult.targetValue}${unit} liegen.`;
    case "STAY_BELOW":
      return `Liegt bei ${keyResult.currentValue}${unit} und soll unter ${keyResult.targetValue}${unit} bleiben.`;
    case "BINARY":
      return keyResult.currentValue >= 1 ? "Ist erreicht." : "Ist noch nicht erreicht.";
    case "TRAFFIC_LIGHT":
      return `Aktuell ${keyResult.currentValue}${unit}. Ampel bewertet diesen Wert.`;
    case "INCREASE_TO":
    default:
      return `Liegt bei ${keyResult.currentValue}${unit} und soll auf ${keyResult.targetValue}${unit} steigen.`;
  }
}

export function getTrafficLightStatus(keyResult: KeyResultProgressInput) {
  if ((keyResult.type ?? "INCREASE_TO") !== "TRAFFIC_LIGHT") return null;

  const red = keyResult.redThreshold ?? 0;
  const yellow = keyResult.yellowThreshold ?? red;
  const green = keyResult.greenThreshold ?? keyResult.targetValue;
  const value = keyResult.currentValue;
  const direction = keyResult.direction ?? "HIGHER_IS_BETTER";

  if (direction === "LOWER_IS_BETTER") {
    if (value <= green) return "green";
    if (value <= yellow) return "yellow";
    return "red";
  }

  if (value >= green) return "green";
  if (value >= yellow) return "yellow";
  return "red";
}

export function getObjectiveTrafficLightStatus(
  keyResults: KeyResultProgressInput[]
): ObjectiveTrafficLightStatus | null {
  if (!keyResults.length) return null;

  const trafficKeyResults = keyResults.filter(
    (keyResult) => (keyResult.type ?? "INCREASE_TO") === "TRAFFIC_LIGHT"
  );
  const nonTrafficKeyResults = keyResults.filter(
    (keyResult) => (keyResult.type ?? "INCREASE_TO") !== "TRAFFIC_LIGHT"
  );
  const trafficStatuses = trafficKeyResults
    .map((keyResult) => getTrafficLightStatus(keyResult))
    .filter((status): status is ObjectiveTrafficLightStatus => status !== null);

  if (trafficStatuses.includes("red")) return "red";
  if (trafficStatuses.includes("yellow")) return "yellow";
  if (trafficStatuses.length && trafficStatuses.every((status) => status === "green")) {
    const nonTrafficStatus = getFallbackObjectiveTrafficLightStatus(nonTrafficKeyResults);
    return nonTrafficStatus === "red" ? "yellow" : nonTrafficStatus ?? "green";
  }

  return getFallbackObjectiveTrafficLightStatus(keyResults);
}

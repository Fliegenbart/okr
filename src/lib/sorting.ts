import { calculateKeyResultProgress, type KeyResultProgressInput } from "@/lib/key-results";

export const OBJECTIVE_SORT_OPTIONS = [
  "CREATED_ASC",
  "ALPHABETICAL_ASC",
  "PROGRESS_ASC",
  "PROGRESS_DESC",
] as const;

export const KEY_RESULT_SORT_OPTIONS = [
  "CREATED_ASC",
  "ALPHABETICAL_ASC",
  "PROGRESS_ASC",
  "PROGRESS_DESC",
  "STALEST_FIRST",
] as const;

export type ObjectiveSortOption = (typeof OBJECTIVE_SORT_OPTIONS)[number];
export type KeyResultSortOption = (typeof KEY_RESULT_SORT_OPTIONS)[number];

type SortableObjective = {
  id: string;
  title: string;
  createdAt: Date;
  keyResults: ReadonlyArray<KeyResultProgressInput>;
};

type SortableKeyResult = KeyResultProgressInput & {
  id: string;
  title: string;
  createdAt: Date;
  updates?: ReadonlyArray<{
    createdAt: Date;
  }>;
};

const germanCollator = new Intl.Collator("de-DE", {
  sensitivity: "base",
  numeric: true,
});

function compareText(left: string, right: string) {
  return germanCollator.compare(left, right);
}

function compareCreatedAsc(
  left: Pick<SortableObjective, "id" | "title" | "createdAt">,
  right: Pick<SortableObjective, "id" | "title" | "createdAt">
) {
  return (
    left.createdAt.getTime() - right.createdAt.getTime() ||
    compareText(left.title, right.title) ||
    compareText(left.id, right.id)
  );
}

function calculateAverageProgress(keyResults: ReadonlyArray<KeyResultProgressInput>) {
  if (!keyResults.length) {
    return 0;
  }

  const total = keyResults.reduce(
    (sum, keyResult) => sum + calculateKeyResultProgress(keyResult),
    0
  );

  return total / keyResults.length;
}

function getLastUpdateTimestamp(keyResult: SortableKeyResult) {
  if (!keyResult.updates?.length) {
    return Number.NEGATIVE_INFINITY;
  }

  return Math.max(...keyResult.updates.map((update) => update.createdAt.getTime()));
}

export function sortObjectives<T extends SortableObjective>(
  objectives: ReadonlyArray<T>,
  option: ObjectiveSortOption
) {
  const items = [...objectives];

  items.sort((left, right) => {
    switch (option) {
      case "ALPHABETICAL_ASC":
        return (
          compareText(left.title, right.title) ||
          left.createdAt.getTime() - right.createdAt.getTime() ||
          compareText(left.id, right.id)
        );
      case "PROGRESS_ASC":
        return (
          calculateAverageProgress(left.keyResults) - calculateAverageProgress(right.keyResults) ||
          compareCreatedAsc(left, right)
        );
      case "PROGRESS_DESC":
        return (
          calculateAverageProgress(right.keyResults) - calculateAverageProgress(left.keyResults) ||
          compareCreatedAsc(left, right)
        );
      case "CREATED_ASC":
      default:
        return compareCreatedAsc(left, right);
    }
  });

  return items;
}

export function sortKeyResults<T extends SortableKeyResult>(
  keyResults: ReadonlyArray<T>,
  option: KeyResultSortOption
) {
  const items = [...keyResults];

  items.sort((left, right) => {
    switch (option) {
      case "ALPHABETICAL_ASC":
        return (
          compareText(left.title, right.title) ||
          compareCreatedAsc(left, right)
        );
      case "PROGRESS_ASC":
        return (
          calculateKeyResultProgress(left) - calculateKeyResultProgress(right) ||
          compareCreatedAsc(left, right)
        );
      case "PROGRESS_DESC":
        return (
          calculateKeyResultProgress(right) - calculateKeyResultProgress(left) ||
          compareCreatedAsc(left, right)
        );
      case "STALEST_FIRST":
        return (
          getLastUpdateTimestamp(left) - getLastUpdateTimestamp(right) ||
          compareCreatedAsc(left, right)
        );
      case "CREATED_ASC":
      default:
        return compareCreatedAsc(left, right);
    }
  });

  return items;
}

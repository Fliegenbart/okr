import { createSafeActionClient } from "next-safe-action";

import { logEvent } from "@/lib/monitoring";

const INTERNAL_ERROR_PATTERNS = [
  /Prisma/i,
  /TypeError/i,
  /ReferenceError/i,
  /SyntaxError/i,
  /Cannot\s+/i,
  /failed/i,
  /invalid/i,
  /constraint/i,
  /unexpected/i,
];

function isLikelyInternalError(message: string) {
  return INTERNAL_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

export const action = createSafeActionClient({
  defaultValidationErrorsShape: "flattened",
  handleServerError(error) {
    if (error instanceof Error) {
      if (isLikelyInternalError(error.message)) {
        logEvent("error", "server_action_failed", {
          message: error.message.slice(0, 180),
        });
        return "Etwas ist schiefgelaufen.";
      }

      return error.message;
    }

    logEvent("error", "server_action_failed", {
      message: "Unknown non-error server action failure",
    });
    return "Etwas ist schiefgelaufen.";
  },
});

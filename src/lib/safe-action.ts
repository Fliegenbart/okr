import { createSafeActionClient } from "next-safe-action";

export const action = createSafeActionClient({
  defaultValidationErrorsShape: "flattened",
  handleServerError(error) {
    if (error instanceof Error) {
      return error.message;
    }
    return "Etwas ist schiefgelaufen.";
  },
});

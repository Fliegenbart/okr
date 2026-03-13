type LogLevel = "info" | "warn" | "error";

export function logEvent(
  level: LogLevel,
  event: string,
  payload: Record<string, unknown> = {}
) {
  const logger = level === "error" ? console.error : level === "warn" ? console.warn : console.info;

  logger(
    JSON.stringify({
      scope: "auth-mvp",
      level,
      event,
      timestamp: new Date().toISOString(),
      ...payload,
    })
  );
}

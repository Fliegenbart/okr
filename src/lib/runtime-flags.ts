export function isClosedBetaMode() {
  return (process.env.BETA_MODE ?? "open").toLowerCase() === "closed";
}

export function isSelfServeSignupAllowed() {
  return process.env.ALLOW_SELF_SERVE_SIGNUP === "true";
}

export function isDevLoginEnabled() {
  return process.env.DEV_LOGIN_ENABLED === "true";
}

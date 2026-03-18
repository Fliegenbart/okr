export function isClosedBetaMode() {
  return (process.env.BETA_MODE ?? "open").toLowerCase() === "closed";
}

export function isSelfServeSignupAllowed() {
  return process.env.ALLOW_SELF_SERVE_SIGNUP === "true";
}

export function isDevLoginEnabled() {
  if (process.env.NODE_ENV === "production") {
    return false;
  }

  return process.env.DEV_LOGIN_ENABLED === "true";
}

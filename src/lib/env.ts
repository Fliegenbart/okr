const isProd = process.env.NODE_ENV === "production";

function requireProdSecret(name: string, value: string | undefined, minLength = 32) {
  if (!isProd) return;
  if (!value || value.length < minLength) {
    throw new Error(
      `[env] ${name} must be set to a cryptographically strong value (>= ${minLength} chars) in production.`,
    );
  }
}

function requireProd(name: string, value: string | undefined) {
  if (!isProd) return;
  if (!value || value.trim().length === 0) {
    throw new Error(`[env] ${name} must be set in production.`);
  }
}

function forbidInProd(name: string, value: string | undefined, truthy = "true") {
  if (!isProd) return;
  if (value === truthy) {
    throw new Error(
      `[env] ${name} must not be "${truthy}" in production. Unset or set to "false" in your deployment env.`,
    );
  }
}

export function assertEnvOnBoot() {
  const authSecret = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET;
  requireProdSecret("NEXTAUTH_SECRET", authSecret);

  requireProd("DATABASE_URL", process.env.DATABASE_URL);
  requireProd("NEXTAUTH_URL", process.env.NEXTAUTH_URL);

  forbidInProd("DEV_LOGIN_ENABLED", process.env.DEV_LOGIN_ENABLED);
}

assertEnvOnBoot();

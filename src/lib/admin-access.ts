function normalizeEmail(email?: string | null) {
  return email?.trim().toLowerCase() ?? "";
}

function getAdminEmailList() {
  const rawEmails = process.env.ADMIN_EMAILS ?? "";

  return rawEmails
    .split(/[\n,]+/)
    .map((email) => normalizeEmail(email))
    .filter(Boolean);
}

export function isAdminEmail(email?: string | null) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return false;
  }

  return getAdminEmailList().includes(normalizedEmail);
}

export function getAdminEmails() {
  return getAdminEmailList();
}


import { randomBytes } from "crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateInviteCode(length = 8) {
  const bytes = randomBytes(length);
  let code = "";

  for (let i = 0; i < length; i += 1) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }

  return code;
}

export function generateInviteToken(length = 32) {
  return randomBytes(length).toString("hex");
}

export function buildJoinUrl(
  baseUrl: string | null | undefined,
  queryKey: "token" | "code",
  queryValue: string
) {
  const origin = baseUrl?.replace(/\/$/, "");

  if (!origin || !queryValue) {
    return "";
  }

  const searchParams = new URLSearchParams();
  searchParams.set(queryKey, queryValue);

  return `${origin}/join?${searchParams.toString()}`;
}

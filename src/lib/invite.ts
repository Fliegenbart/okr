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

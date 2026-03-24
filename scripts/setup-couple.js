/* eslint-disable @typescript-eslint/no-require-imports */
const path = require("path");
const { randomBytes } = require("crypto");
const { loadEnvConfig } = require("@next/env");
const { PrismaClient } = require("@prisma/client");

loadEnvConfig(path.join(__dirname, ".."));

const prisma = new PrismaClient();
const INVITE_EXPIRY_DAYS = 7;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function generateInviteToken(length = 32) {
  return randomBytes(length).toString("hex");
}

function generateInviteCode(length = 8) {
  const bytes = randomBytes(length);
  let code = "";

  for (let index = 0; index < length; index += 1) {
    code += ALPHABET[bytes[index] % ALPHABET.length];
  }

  return code;
}

async function createUniqueInviteCode() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = generateInviteCode();
    const existingCouple = await prisma.couple.findUnique({
      where: { inviteCode: candidate },
      select: { id: true },
    });

    if (!existingCouple) {
      return candidate;
    }
  }

  throw new Error("Es konnte kein eindeutiger Einladungscode erzeugt werden.");
}

function getBaseUrl() {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  return base.replace(/\/$/, "");
}

async function main() {
  const coupleName = process.argv[2]?.trim();
  const emailInput = process.argv[3]?.trim();

  if (!coupleName || !emailInput) {
    throw new Error(
      'Bitte nutze: npm run setup:couple -- "Mia & Leon" mia@example.com'
    );
  }

  const email = normalizeEmail(emailInput);
  const inviteCode = await createUniqueInviteCode();
  const inviteToken = generateInviteToken();
  const expiresAt = new Date(
    Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000
  );

  const result = await prisma.$transaction(async (tx) => {
    const couple = await tx.couple.create({
      data: {
        name: coupleName,
        inviteCode,
      },
      select: {
        id: true,
        name: true,
        inviteCode: true,
      },
    });

    const invite = await tx.invite.create({
      data: {
        coupleId: couple.id,
        email,
        token: inviteToken,
        expiresAt,
      },
      select: {
        token: true,
        email: true,
        expiresAt: true,
      },
    });

    return { couple, invite };
  });

  const joinUrl = `${getBaseUrl()}/join?token=${result.invite.token}`;

  console.log(`Couple angelegt: ${result.couple.name}`);
  console.log(`Invite-Code: ${result.couple.inviteCode}`);
  console.log(`Person 1: ${result.invite.email}`);
  console.log(`Gültig bis: ${result.invite.expiresAt.toISOString()}`);
  console.log(`Startlink: ${joinUrl}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

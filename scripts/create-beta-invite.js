/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  const note = process.argv[3]?.trim() || null;

  if (!email) {
    throw new Error(
      "Bitte gib eine E-Mail an. Beispiel: npm run beta:invite -- person@example.com 'Paar 01'"
    );
  }

  const invite = await prisma.betaAccessInvite.upsert({
    where: { email },
    update: {
      note,
    },
    create: {
      email,
      note,
    },
  });

  console.log(`Beta-Zugang gespeichert für ${invite.email}`);
  if (invite.note) {
    console.log(`Notiz: ${invite.note}`);
  }
  console.log("Nächster Schritt: Person 1 nutzt /auth/signin mit genau dieser E-Mail.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

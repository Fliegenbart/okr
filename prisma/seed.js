/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const DAY_MS = 24 * 60 * 60 * 1000;

function makeDates(startISO, count, stepDays) {
  const start = new Date(startISO);
  return Array.from({ length: count }, (_, index) => {
    return new Date(start.getTime() + index * stepDays * DAY_MS);
  });
}

async function seedUpdates({ keyResultId, updates, startValue, updatedById }) {
  let previousValue = startValue;

  for (const update of updates) {
    await prisma.keyResultUpdate.create({
      data: {
        keyResultId,
        value: update.value,
        previousValue,
        note: update.note ?? null,
        updatedById,
        createdAt: update.createdAt,
      },
    });
    previousValue = update.value;
  }

  await prisma.keyResult.update({
    where: { id: keyResultId },
    data: { currentValue: previousValue },
  });
}

async function main() {
  const couple = await prisma.couple.upsert({
    where: { inviteCode: "DEMO2026" },
    update: {
      name: "Demo Couple",
      vision: "Wir wachsen gemeinsam und feiern kleine Schritte.",
      mission: "Wir planen woechentliche Mini-Check-ins und bleiben dran.",
    },
    create: {
      name: "Demo Couple",
      vision: "Wir wachsen gemeinsam und feiern kleine Schritte.",
      mission: "Wir planen woechentliche Mini-Check-ins und bleiben dran.",
      inviteCode: "DEMO2026",
    },
  });

  await prisma.invite.deleteMany({ where: { coupleId: couple.id } });
  await prisma.quarter.deleteMany({ where: { coupleId: couple.id } });

  const demoUser1 = await prisma.user.upsert({
    where: { email: "demo1@example.com" },
    update: { name: "Mia" },
    create: {
      email: "demo1@example.com",
      name: "Mia",
      emailVerified: new Date(),
    },
  });

  const demoUser2 = await prisma.user.upsert({
    where: { email: "demo2@example.com" },
    update: { name: "Leon" },
    create: {
      email: "demo2@example.com",
      name: "Leon",
      emailVerified: new Date(),
    },
  });

  await prisma.user.updateMany({
    where: { id: { in: [demoUser1.id, demoUser2.id] } },
    data: { coupleId: couple.id },
  });

  const quarterCurrent = await prisma.quarter.create({
    data: {
      title: "Q1 2026",
      startsAt: new Date("2026-01-01T00:00:00.000Z"),
      endsAt: new Date("2026-03-31T23:59:59.000Z"),
      coupleId: couple.id,
    },
  });

  const quarterPast = await prisma.quarter.create({
    data: {
      title: "Q4 2025",
      startsAt: new Date("2025-10-01T00:00:00.000Z"),
      endsAt: new Date("2025-12-31T23:59:59.000Z"),
      coupleId: couple.id,
    },
  });

  const objectives = [
    {
      quarterId: quarterCurrent.id,
      title: "Gesundheit: Wir fuehlen uns fit",
      description: "Staerke, Energie und gute Routinen im Alltag.",
      keyResults: [
        {
          title: "3x Sport/Woche",
          targetValue: 3,
          unit: "x/Woche",
          startValue: 0,
          updates: makeDates("2026-01-03T10:00:00.000Z", 3, 7).map(
            (date, index) => ({
              value: [1, 2, 3][index],
              note: ["Erstes Training", "Zweite Einheit", "Woche komplett"][
                index
              ],
              createdAt: date,
            })
          ),
        },
        {
          title: "2 Liter Wasser/Tag",
          targetValue: 2,
          unit: "Liter/Tag",
          startValue: 0,
          updates: makeDates("2026-01-04T09:30:00.000Z", 3, 6).map(
            (date, index) => ({
              value: [1.2, 1.6, 2.0][index],
              note: ["Mehr Flaschen", "Routine laeuft", "Ziel erreicht"][
                index
              ],
              createdAt: date,
            })
          ),
        },
        {
          title: "7h Schlaf im Schnitt",
          targetValue: 7,
          unit: "Std/Nacht",
          startValue: 0,
          updates: makeDates("2026-01-05T07:30:00.000Z", 3, 5).map(
            (date, index) => ({
              value: [6, 6.5, 7][index],
              note: ["Frueher ins Bett", "Bessere Abendroutine", "Stabil" ][
                index
              ],
              createdAt: date,
            })
          ),
        },
      ],
    },
    {
      quarterId: quarterCurrent.id,
      title: "Abenteuer: Gemeinsame Erlebnisse",
      description: "Neue Orte entdecken und Zeit zu zweit planen.",
      keyResults: [
        {
          title: "3 neue Orte besuchen",
          targetValue: 3,
          unit: "Orte",
          startValue: 0,
          updates: makeDates("2026-01-06T11:00:00.000Z", 3, 7).map(
            (date, index) => ({
              value: [1, 2, 3][index],
              note: ["Neues Cafe", "Wochenendtrip", "Letzter Spot"][index],
              createdAt: date,
            })
          ),
        },
        {
          title: "6 Date Nights",
          targetValue: 6,
          unit: "Abende",
          startValue: 0,
          updates: makeDates("2026-01-07T19:00:00.000Z", 3, 6).map(
            (date, index) => ({
              value: [1, 3, 5][index],
              note: ["Dinner", "Kino", "Kochabend"][index],
              createdAt: date,
            })
          ),
        },
        {
          title: "1 Wochenende offline",
          targetValue: 1,
          unit: "Wochenende",
          startValue: 0,
          updates: makeDates("2026-01-10T12:00:00.000Z", 2, 10).map(
            (date, index) => ({
              value: [0.5, 1][index],
              note: ["Plan steht", "Umgesetzt"][index],
              createdAt: date,
            })
          ),
        },
      ],
    },
    {
      quarterId: quarterCurrent.id,
      title: "Achtsamkeit: Mehr Ruhe im Alltag",
      description: "Bewusste Pausen schaffen und digitale Ruhe finden.",
      keyResults: [
        {
          title: "10 Minuten Meditation/Tag",
          targetValue: 10,
          unit: "Min/Tag",
          startValue: 0,
          updates: makeDates("2026-01-08T06:30:00.000Z", 3, 5).map(
            (date, index) => ({
              value: [5, 8, 10][index],
              note: ["Neue App", "Ritual", "Stabil" ][index],
              createdAt: date,
            })
          ),
        },
        {
          title: "4 digitale freie Abende",
          targetValue: 4,
          unit: "Abende",
          startValue: 0,
          updates: makeDates("2026-01-09T20:00:00.000Z", 3, 6).map(
            (date, index) => ({
              value: [1, 2, 3][index],
              note: ["Lesen", "Spaziergang", "Spielabend"][index],
              createdAt: date,
            })
          ),
        },
        {
          title: "Tagebuch: 10 Eintraege",
          targetValue: 10,
          unit: "Eintraege",
          startValue: 0,
          updates: makeDates("2026-01-11T08:00:00.000Z", 3, 7).map(
            (date, index) => ({
              value: [2, 5, 8][index],
              note: ["Start", "Zwischenerfolg", "Fast fertig"][index],
              createdAt: date,
            })
          ),
        },
      ],
    },
    {
      quarterId: quarterCurrent.id,
      title: "Finanzen: Klarheit statt Dauer-Alarm",
      description: "Geld wird ein loesbares Thema zwischen uns.",
      nextAction: "Diesen Sonntag 30 Minuten Money-Date + 1 Entscheidung treffen.",
      keyResults: [
        {
          title: "Money-Date: 6 Termine",
          targetValue: 6,
          unit: "Termine",
          startValue: 0,
          updatedBy: "Leon",
          updates: makeDates("2026-01-10T18:30:00.000Z", 4, 6).map(
            (date, index) => ({
              value: [1, 2, 3, 4][index],
              note: [
                "Erstes Money-Date",
                "Budget grob geklaert",
                "Ruecklagen besprochen",
                "Naechster Fokus definiert",
              ][index],
              createdAt: date,
            })
          ),
        },
        {
          title: "1-Seite Budget Uebersicht",
          targetValue: 1,
          unit: "Done",
          startValue: 0,
          updatedBy: "Mia",
          updates: makeDates("2026-01-14T20:00:00.000Z", 2, 7).map(
            (date, index) => ({
              value: [0.5, 1][index],
              note: ["Entwurf steht", "Finalisiert"][index],
              createdAt: date,
            })
          ),
        },
        {
          title: "Sicherheits-Score nach Money-Date (>=4/5)",
          targetValue: 4,
          unit: "Score",
          startValue: 2.5,
          updatedBy: "Mia",
          updates: makeDates("2026-01-11T20:10:00.000Z", 3, 7).map(
            (date, index) => ({
              value: [3.1, 3.4, 3.6][index],
              note: ["Noch nervoes", "Wird leichter", "Fuehlt sich stabiler an"][
                index
              ],
              createdAt: date,
            })
          ),
        },
      ],
    },
    {
      quarterId: quarterCurrent.id,
      title: "Haushalt: Fair & vorhersehbar",
      description: "Unser Alltag fuehlt sich fair und planbar an.",
      nextAction: "Heute 15 Minuten Haushalts-Sync + 3 Aufgaben klar zuordnen.",
      keyResults: [
        {
          title: "Woechentlicher Haushalts-Sync (15 Min)",
          targetValue: 12,
          unit: "Wochen",
          startValue: 0,
          updatedBy: "Leon",
          updates: makeDates("2026-01-03T17:00:00.000Z", 4, 7).map(
            (date, index) => ({
              value: [3, 5, 7, 8][index],
              note: ["Start", "Routiniert", "Schneller", "Laeuft"][index],
              createdAt: date,
            })
          ),
        },
        {
          title: "Fairness-Score im Wochencheck (>=4/5)",
          targetValue: 4,
          unit: "Score",
          startValue: 2.8,
          updatedBy: "Mia",
          updates: makeDates("2026-01-05T21:00:00.000Z", 4, 6).map(
            (date, index) => ({
              value: [3.1, 3.2, 3.4, 3.5][index],
              note: [
                "Mehr Klarheit",
                "Weniger Reibung",
                "Planbarer",
                "Fast da",
              ][index],
              createdAt: date,
            })
          ),
        },
        {
          title: "Haushalts-Board gepflegt (Wochen mit Update)",
          targetValue: 12,
          unit: "Wochen",
          startValue: 0,
          updatedBy: "Leon",
          updates: makeDates("2026-01-02T19:30:00.000Z", 4, 7).map(
            (date, index) => ({
              value: [2, 4, 6, 7][index],
              note: ["Setup", "Woche 2", "Woche 3", "Woche 4"][index],
              createdAt: date,
            })
          ),
        },
      ],
    },
    {
      quarterId: quarterPast.id,
      title: "Konflikte: Repair statt Eskalation",
      description: "Wir fuehren schwierige Gespraeche mit mehr Sicherheit.",
      keyResults: [
        {
          title: "Repair innerhalb 24h: 12 Faelle",
          targetValue: 12,
          unit: "Faelle",
          startValue: 0,
          updatedBy: "Mia",
          updates: makeDates("2025-10-06T19:00:00.000Z", 4, 21).map(
            (date, index) => ({
              value: [3, 6, 9, 12][index],
              note: [
                "Erstes Protokoll",
                "Schon routinierter",
                "Weniger Eskalation",
                "Stabil",
              ][index],
              createdAt: date,
            })
          ),
        },
        {
          title: "Konfliktgespraeche ohne Abbruch: 8",
          targetValue: 8,
          unit: "Gespraeche",
          startValue: 0,
          updatedBy: "Leon",
          updates: makeDates("2025-10-12T20:10:00.000Z", 4, 20).map(
            (date, index) => ({
              value: [2, 4, 6, 8][index],
              note: ["Start", "Besser", "Nah dran", "Geschafft"][index],
              createdAt: date,
            })
          ),
        },
        {
          title: "Verbundenheit nach Repair (>=4/5)",
          targetValue: 4,
          unit: "Score",
          startValue: 2.9,
          updatedBy: "Mia",
          updates: makeDates("2025-10-08T21:30:00.000Z", 4, 21).map(
            (date, index) => ({
              value: [3.2, 3.5, 3.8, 4.0][index],
              note: ["Wird besser", "Mehr Sicherheit", "Fast da", "Stabil"][index],
              createdAt: date,
            })
          ),
        },
      ],
    },
  ];

  for (const objectiveData of objectives) {
    const objective = await prisma.objective.create({
      data: {
        title: objectiveData.title,
        description: objectiveData.description,
        nextAction: objectiveData.nextAction ?? null,
        coupleId: couple.id,
        quarterId: objectiveData.quarterId,
        keyResults: {
          create: objectiveData.keyResults.map((keyResult) => ({
            title: keyResult.title,
            targetValue: keyResult.targetValue,
            unit: keyResult.unit,
          })),
        },
      },
      include: { keyResults: true },
    });

    for (const keyResultData of objectiveData.keyResults) {
      const keyResult = objective.keyResults.find(
        (item) => item.title === keyResultData.title
      );

      if (!keyResult) continue;

      await seedUpdates({
        keyResultId: keyResult.id,
        updates: keyResultData.updates,
        startValue: keyResultData.startValue,
        updatedById:
          keyResultData.updatedBy === "Leon" ? demoUser2.id : demoUser1.id,
      });
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

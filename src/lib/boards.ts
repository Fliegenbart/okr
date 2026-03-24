import { BoardElementType, BoardScope, Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";

export const BOARD_CANVAS_SIZE = {
  width: 3200,
  height: 2000,
} as const;

export type BoardSnapshot = {
  id: string;
  scope: BoardScope;
  title: string;
  boardKey: string;
  quarterId: string | null;
  quarterTitle: string | null;
  version: number;
  updatedAt: string;
  elements: Array<{
    id: string;
    type: BoardElementType;
    title: string | null;
    content: string | null;
    color: string | null;
    x: number;
    y: number;
    width: number;
    height: number;
    zIndex: number;
  }>;
  connections: Array<{
    id: string;
    fromElementId: string;
    toElementId: string;
    color: string | null;
    label: string | null;
  }>;
};

export const boardInclude = {
  quarter: {
    select: {
      id: true,
      title: true,
    },
  },
  elements: {
    orderBy: [{ zIndex: "asc" }, { createdAt: "asc" }],
  },
  connections: {
    orderBy: [{ createdAt: "asc" }],
  },
} satisfies Prisma.BoardInclude;

type BoardWithElements = Prisma.BoardGetPayload<{
  include: typeof boardInclude;
}>;

type EnsureBoardParams = {
  coupleId: string;
  scope: BoardScope;
  quarterId?: string | null;
  quarterTitle?: string | null;
};

export function getBoardKey(scope: BoardScope, quarterId?: string | null) {
  return scope === "MASTER" ? "master" : `quarter:${quarterId}`;
}

export function getBoardTitle(
  scope: BoardScope,
  quarterTitle?: string | null
) {
  return scope === "MASTER"
    ? "Gemeinsames Board"
    : `${quarterTitle ?? "Quartal"} Board`;
}

export function serializeBoard(board: BoardWithElements): BoardSnapshot {
  return {
    id: board.id,
    scope: board.scope,
    title: board.title,
    boardKey: board.boardKey,
    quarterId: board.quarterId,
    quarterTitle: board.quarter?.title ?? null,
    version: board.version,
    updatedAt: board.updatedAt.toISOString(),
    elements: board.elements.map((element) => ({
      id: element.id,
      type: element.type,
      title: element.title,
      content: element.content,
      color: element.color,
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
      zIndex: element.zIndex,
    })),
    connections: board.connections.map((connection) => ({
      id: connection.id,
      fromElementId: connection.fromElementId,
      toElementId: connection.toElementId,
      color: connection.color,
      label: connection.label,
    })),
  };
}

export async function ensureBoardForCouple({
  coupleId,
  scope,
  quarterId,
  quarterTitle,
}: EnsureBoardParams) {
  if (scope === "QUARTER" && !quarterId) {
    throw new Error("Quarter-Boards brauchen ein Quartal.");
  }

  const board = await prisma.board.upsert({
    where: {
      coupleId_boardKey: {
        coupleId,
        boardKey: getBoardKey(scope, quarterId),
      },
    },
    update: {
      title: getBoardTitle(scope, quarterTitle),
      quarterId: scope === "QUARTER" ? quarterId : null,
    },
    create: {
      coupleId,
      scope,
      quarterId: scope === "QUARTER" ? quarterId : null,
      boardKey: getBoardKey(scope, quarterId),
      title: getBoardTitle(scope, quarterTitle),
      elements: {
        create: getDefaultElements(scope),
      },
    },
    include: boardInclude,
  });

  return board;
}

export async function getBoardForCoupleById(boardId: string, coupleId: string) {
  return prisma.board.findFirst({
    where: {
      id: boardId,
      coupleId,
    },
    include: boardInclude,
  });
}

export function getDefaultElementSize(type: BoardElementType) {
  switch (type) {
    case "FRAME":
      return { width: 520, height: 380 };
    case "TEXT":
      return { width: 360, height: 180 };
    case "NOTE":
    default:
      return { width: 280, height: 220 };
  }
}

function getDefaultElements(
  scope: BoardScope
): Prisma.BoardElementCreateWithoutBoardInput[] {
  if (scope === "MASTER") {
    return [
      {
        type: "FRAME",
        title: "Zielsätze",
        x: 120,
        y: 120,
        width: 560,
        height: 420,
        zIndex: 1,
        color: "#F7F1DC",
      },
      {
        type: "TEXT",
        title: "Was soll uns tragen?",
        content:
          "Formuliert hier die Sätze, die euch durch schwierige Wochen führen sollen.",
        x: 160,
        y: 200,
        width: 320,
        height: 180,
        zIndex: 2,
        color: "#FFFDF7",
      },
      {
        type: "FRAME",
        title: "Vision",
        x: 760,
        y: 120,
        width: 560,
        height: 420,
        zIndex: 1,
        color: "#E9F3FF",
      },
      {
        type: "NOTE",
        title: "In 12 Monaten",
        content: "Wie soll sich euer Alltag, eure Energie und eure Beziehung anfühlen?",
        x: 810,
        y: 210,
        width: 260,
        height: 220,
        zIndex: 2,
        color: "#AEDBFF",
      },
      {
        type: "FRAME",
        title: "Roadmap",
        x: 120,
        y: 640,
        width: 1200,
        height: 520,
        zIndex: 1,
        color: "#E7F7EA",
      },
      {
        type: "NOTE",
        title: "Nächster Meilenstein",
        content: "Welcher konkrete Schritt bringt euch in den nächsten 30 Tagen sichtbar weiter?",
        x: 170,
        y: 740,
        width: 280,
        height: 220,
        zIndex: 2,
        color: "#BEE8C3",
      },
      {
        type: "FRAME",
        title: "Ideenparkplatz",
        x: 1420,
        y: 120,
        width: 520,
        height: 1040,
        zIndex: 1,
        color: "#F6EAFB",
      },
      {
        type: "NOTE",
        title: "Später spannend",
        content: "Alles sammeln, was wichtig klingt, aber noch nicht sofort auf die Roadmap muss.",
        x: 1480,
        y: 220,
        width: 280,
        height: 220,
        zIndex: 2,
        color: "#D8C7FF",
      },
    ];
  }

  return [
    {
      type: "FRAME",
      title: "Objectives",
      x: 120,
      y: 120,
      width: 520,
      height: 420,
      zIndex: 1,
      color: "#F7F1DC",
    },
    {
      type: "NOTE",
      title: "Wofür treten wir an?",
      content: "Schreibt die 1-3 wichtigsten Outcomes dieses Quartals auf.",
      x: 180,
      y: 220,
      width: 260,
      height: 220,
      zIndex: 2,
      color: "#F9E27D",
    },
    {
      type: "FRAME",
      title: "Key Results",
      x: 720,
      y: 120,
      width: 520,
      height: 420,
      zIndex: 1,
      color: "#E9F3FF",
    },
    {
      type: "NOTE",
      title: "Messbar machen",
      content: "Welche Zahlen oder klaren Kriterien zeigen euch Fortschritt?",
      x: 780,
      y: 220,
      width: 260,
      height: 220,
      zIndex: 2,
      color: "#AEDBFF",
    },
    {
      type: "FRAME",
      title: "Initiativen",
      x: 120,
      y: 640,
      width: 520,
      height: 420,
      zIndex: 1,
      color: "#E7F7EA",
    },
    {
      type: "NOTE",
      title: "Experimente",
      content: "Welche Rituale, Termine oder Gewohnheiten zahlen direkt auf eure Ziele ein?",
      x: 180,
      y: 740,
      width: 260,
      height: 220,
      zIndex: 2,
      color: "#BEE8C3",
    },
    {
      type: "FRAME",
      title: "Nächste Schritte",
      x: 720,
      y: 640,
      width: 520,
      height: 420,
      zIndex: 1,
      color: "#FCEDE6",
    },
    {
      type: "NOTE",
      title: "Diese Woche",
      content: "Was könnt ihr sofort starten, damit das Quartal nicht nur ein guter Vorsatz bleibt?",
      x: 780,
      y: 740,
      width: 260,
      height: 220,
      zIndex: 2,
      color: "#FFB6A0",
    },
  ];
}

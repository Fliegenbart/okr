"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { requireUserWithCouple } from "@/actions/utils";
import { action } from "@/lib/safe-action";
import { prisma } from "@/lib/db";
import {
  createBoardConnectionSchema,
  createBoardElementSchema,
  deleteBoardConnectionSchema,
  deleteBoardElementsSchema,
  deleteBoardElementSchema,
  ensureBoardSchema,
  moveBoardElementsSchema,
  moveBoardElementSchema,
  updateBoardElementSchema,
} from "@/lib/validations/board";
import {
  ensureBoardForCouple,
  getDefaultElementSize,
  serializeBoard,
} from "@/lib/boards";

const BOARD_PATH = "/dashboard/board";

function normalizeConnectionPair(firstElementId: string, secondElementId: string) {
  return [firstElementId, secondElementId].sort() as [string, string];
}

async function touchBoard(tx: Prisma.TransactionClient, boardId: string) {
  await tx.board.update({
    where: { id: boardId },
    data: {
      version: {
        increment: 1,
      },
    },
  });
}

export const ensureBoard = action
  .schema(ensureBoardSchema)
  .action(async ({ parsedInput }) => {
    const user = await requireUserWithCouple();

    let quarterTitle: string | null = null;

    if (parsedInput.scope === "QUARTER") {
      const quarter = await prisma.quarter.findFirst({
        where: {
          id: parsedInput.quarterId,
          coupleId: user.coupleId,
        },
        select: {
          id: true,
          title: true,
        },
      });

      if (!quarter) {
        throw new Error("Quartal nicht gefunden.");
      }

      quarterTitle = quarter.title;
    }

    const board = await ensureBoardForCouple({
      coupleId: user.coupleId,
      scope: parsedInput.scope,
      quarterId: parsedInput.quarterId ?? null,
      quarterTitle,
    });

    revalidatePath(BOARD_PATH);

    return serializeBoard(board);
  });

export const createBoardElement = action
  .schema(createBoardElementSchema)
  .action(async ({ parsedInput }) => {
    const user = await requireUserWithCouple();

    const board = await prisma.board.findFirst({
      where: {
        id: parsedInput.boardId,
        coupleId: user.coupleId,
      },
      select: {
        id: true,
      },
    });

    if (!board) {
      throw new Error("Board nicht gefunden.");
    }

    const topElement = await prisma.boardElement.findFirst({
      where: {
        boardId: board.id,
      },
      orderBy: {
        zIndex: "desc",
      },
      select: {
        zIndex: true,
      },
    });

    const size = getDefaultElementSize(parsedInput.type);

    const element = await prisma.$transaction(async (tx) => {
      const createdElement = await tx.boardElement.create({
        data: {
          boardId: board.id,
          type: parsedInput.type,
          title: parsedInput.title ?? null,
          content: parsedInput.content ?? null,
          color: parsedInput.color ?? null,
          x: parsedInput.x,
          y: parsedInput.y,
          width: parsedInput.width ?? size.width,
          height: parsedInput.height ?? size.height,
          zIndex: (topElement?.zIndex ?? 0) + 1,
        },
      });

      await touchBoard(tx, board.id);

      return createdElement;
    });

    revalidatePath(BOARD_PATH);

    return {
      id: element.id,
      zIndex: element.zIndex,
    };
  });

export const updateBoardElement = action
  .schema(updateBoardElementSchema)
  .action(async ({ parsedInput }) => {
    const user = await requireUserWithCouple();

    const existingElement = await prisma.boardElement.findFirst({
      where: {
        id: parsedInput.elementId,
        board: {
          coupleId: user.coupleId,
        },
      },
      select: {
        id: true,
        boardId: true,
      },
    });

    if (!existingElement) {
      throw new Error("Element nicht gefunden.");
    }

    await prisma.$transaction(async (tx) => {
      await tx.boardElement.update({
        where: {
          id: existingElement.id,
        },
        data: {
          title: parsedInput.title ?? undefined,
          content: parsedInput.content ?? undefined,
          color: parsedInput.color ?? undefined,
          width: parsedInput.width,
          height: parsedInput.height,
        },
      });

      await touchBoard(tx, existingElement.boardId);
    });

    revalidatePath(BOARD_PATH);

    return { success: true };
  });

export const moveBoardElement = action
  .schema(moveBoardElementSchema)
  .action(async ({ parsedInput }) => {
    const user = await requireUserWithCouple();

    const existingElement = await prisma.boardElement.findFirst({
      where: {
        id: parsedInput.elementId,
        board: {
          coupleId: user.coupleId,
        },
      },
      select: {
        id: true,
        boardId: true,
      },
    });

    if (!existingElement) {
      throw new Error("Element nicht gefunden.");
    }

    await prisma.$transaction(async (tx) => {
      await tx.boardElement.update({
        where: {
          id: existingElement.id,
        },
        data: {
          x: parsedInput.x,
          y: parsedInput.y,
          zIndex: parsedInput.zIndex,
        },
      });

      await touchBoard(tx, existingElement.boardId);
    });

    revalidatePath(BOARD_PATH);

    return { success: true };
  });

export const moveBoardElements = action
  .schema(moveBoardElementsSchema)
  .action(async ({ parsedInput }) => {
    const user = await requireUserWithCouple();

    const elements = await prisma.boardElement.findMany({
      where: {
        id: {
          in: parsedInput.moves.map((move) => move.elementId),
        },
        board: {
          coupleId: user.coupleId,
        },
      },
      select: {
        id: true,
        boardId: true,
      },
    });

    if (elements.length !== parsedInput.moves.length) {
      throw new Error("Mindestens ein Element wurde nicht gefunden.");
    }

    const boardIds = new Set(elements.map((element) => element.boardId));

    if (boardIds.size !== 1) {
      throw new Error("Alle Elemente muessen auf demselben Board liegen.");
    }

    await prisma.$transaction(async (tx) => {
      await Promise.all(
        parsedInput.moves.map((move) =>
          tx.boardElement.update({
            where: { id: move.elementId },
            data: {
              x: move.x,
              y: move.y,
              zIndex: move.zIndex,
            },
          })
        )
      );

      await touchBoard(tx, elements[0]!.boardId);
    });

    revalidatePath(BOARD_PATH);

    return { success: true };
  });

export const deleteBoardElement = action
  .schema(deleteBoardElementSchema)
  .action(async ({ parsedInput }) => {
    const user = await requireUserWithCouple();

    const existingElement = await prisma.boardElement.findFirst({
      where: {
        id: parsedInput.elementId,
        board: {
          coupleId: user.coupleId,
        },
      },
      select: {
        id: true,
        boardId: true,
      },
    });

    if (!existingElement) {
      throw new Error("Element nicht gefunden.");
    }

    await prisma.$transaction(async (tx) => {
      await tx.boardElement.delete({
        where: {
          id: existingElement.id,
        },
      });

      await touchBoard(tx, existingElement.boardId);
    });

    revalidatePath(BOARD_PATH);

    return { success: true };
  });

export const deleteBoardElements = action
  .schema(deleteBoardElementsSchema)
  .action(async ({ parsedInput }) => {
    const user = await requireUserWithCouple();

    const elements = await prisma.boardElement.findMany({
      where: {
        id: {
          in: parsedInput.elementIds,
        },
        board: {
          coupleId: user.coupleId,
        },
      },
      select: {
        id: true,
        boardId: true,
      },
    });

    if (elements.length !== parsedInput.elementIds.length) {
      throw new Error("Mindestens ein Element wurde nicht gefunden.");
    }

    const boardIds = new Set(elements.map((element) => element.boardId));

    if (boardIds.size !== 1) {
      throw new Error("Alle Elemente muessen auf demselben Board liegen.");
    }

    await prisma.$transaction(async (tx) => {
      await tx.boardElement.deleteMany({
        where: {
          id: {
            in: parsedInput.elementIds,
          },
        },
      });

      await touchBoard(tx, elements[0]!.boardId);
    });

    revalidatePath(BOARD_PATH);

    return { success: true };
  });

export const createBoardConnection = action
  .schema(createBoardConnectionSchema)
  .action(async ({ parsedInput }) => {
    const user = await requireUserWithCouple();
    const [fromElementId, toElementId] = normalizeConnectionPair(
      parsedInput.firstElementId,
      parsedInput.secondElementId
    );

    const elements = await prisma.boardElement.findMany({
      where: {
        id: {
          in: [fromElementId, toElementId],
        },
        board: {
          coupleId: user.coupleId,
        },
      },
      select: {
        id: true,
        boardId: true,
      },
    });

    if (elements.length !== 2) {
      throw new Error("Beide Elemente muessen auf eurem Board liegen.");
    }

    if (elements[0]!.boardId !== elements[1]!.boardId) {
      throw new Error("Elemente koennen nur auf demselben Board verbunden werden.");
    }

    const boardId = elements[0]!.boardId;

    const connection = await prisma.$transaction(async (tx) => {
      const existingConnection = await tx.boardConnection.findUnique({
        where: {
          boardId_fromElementId_toElementId: {
            boardId,
            fromElementId,
            toElementId,
          },
        },
        select: {
          id: true,
        },
      });

      if (existingConnection) {
        return existingConnection;
      }

      const createdConnection = await tx.boardConnection.create({
        data: {
          boardId,
          fromElementId,
          toElementId,
          color: parsedInput.color ?? "#2854C5",
        },
        select: {
          id: true,
        },
      });

      await touchBoard(tx, boardId);

      return createdConnection;
    });

    revalidatePath(BOARD_PATH);

    return { id: connection.id };
  });

export const deleteBoardConnection = action
  .schema(deleteBoardConnectionSchema)
  .action(async ({ parsedInput }) => {
    const user = await requireUserWithCouple();

    const existingConnection = await prisma.boardConnection.findFirst({
      where: {
        id: parsedInput.connectionId,
        board: {
          coupleId: user.coupleId,
        },
      },
      select: {
        id: true,
        boardId: true,
      },
    });

    if (!existingConnection) {
      throw new Error("Verbindung nicht gefunden.");
    }

    await prisma.$transaction(async (tx) => {
      await tx.boardConnection.delete({
        where: {
          id: existingConnection.id,
        },
      });

      await touchBoard(tx, existingConnection.boardId);
    });

    revalidatePath(BOARD_PATH);

    return { success: true };
  });

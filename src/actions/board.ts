"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { requireUserWithCouple } from "@/actions/utils";
import { action } from "@/lib/safe-action";
import { prisma } from "@/lib/db";
import {
  createBoardElementSchema,
  deleteBoardElementSchema,
  ensureBoardSchema,
  moveBoardElementSchema,
  updateBoardElementSchema,
} from "@/lib/validations/board";
import {
  ensureBoardForCouple,
  getDefaultElementSize,
  serializeBoard,
} from "@/lib/boards";

const BOARD_PATH = "/dashboard/board";

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

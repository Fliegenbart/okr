import { NextResponse } from "next/server";

import { requireUserWithCouple } from "@/actions/utils";
import { getBoardForCoupleById, serializeBoard } from "@/lib/boards";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUserWithCouple();
    const { id } = await context.params;

    const board = await getBoardForCoupleById(id, user.coupleId);

    if (!board) {
      return NextResponse.json({ error: "Board nicht gefunden." }, { status: 404 });
    }

    return NextResponse.json(serializeBoard(board));
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Board konnte nicht geladen werden.",
      },
      { status: 401 }
    );
  }
}

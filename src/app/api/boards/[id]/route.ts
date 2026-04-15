import { NextResponse } from "next/server";

import { getAuthenticatedViewer } from "@/lib/active-couple";
import { getBoardForCoupleById, serializeBoard } from "@/lib/boards";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const viewer = await getAuthenticatedViewer();

  if (!viewer) {
    return NextResponse.json({ error: "Bitte melde dich an." }, { status: 401 });
  }

  if (!viewer.activeCoupleId) {
    return NextResponse.json({ error: "Du hast noch kein Couple." }, { status: 404 });
  }

  const { id } = await context.params;
  const board = await getBoardForCoupleById(id, viewer.activeCoupleId);

  if (!board) {
    return NextResponse.json({ error: "Board nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json(serializeBoard(board));
}

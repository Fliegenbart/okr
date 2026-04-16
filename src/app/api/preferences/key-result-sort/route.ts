import { NextResponse } from "next/server";

import { getAuthenticatedViewer } from "@/lib/active-couple";
import { prisma } from "@/lib/db";
import { setKeyResultSortPreferenceSchema } from "@/lib/validations/preferences";

export async function POST(request: Request) {
  const viewer = await getAuthenticatedViewer();

  if (!viewer?.activeCoupleId) {
    return NextResponse.json(
      { error: "Bitte melde dich zuerst an." },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = setKeyResultSortPreferenceSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ungültige KR-Sortierung." },
      { status: 400 }
    );
  }

  await prisma.user.update({
    where: { id: viewer.id },
    data: {
      preferredKeyResultSort: parsed.data.sort,
    },
  });

  return NextResponse.json({ sort: parsed.data.sort });
}

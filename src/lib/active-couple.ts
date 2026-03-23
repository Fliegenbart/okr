import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getAuthSession } from "@/auth";
import { isAdminEmail } from "@/lib/admin-access";
import { prisma } from "@/lib/db";

export const ADMIN_PREVIEW_COUPLE_COOKIE = "okr_admin_preview_couple";
const ADMIN_PREVIEW_MAX_AGE_SECONDS = 60 * 60 * 8;

function normalizeEmail(email?: string | null) {
  return email?.trim().toLowerCase() ?? "";
}

export type AuthViewer = {
  id: string;
  email: string | null;
  name: string | null;
  role: "USER" | "ADMIN";
  isAdmin: boolean;
  userCoupleId: string | null;
  activeCoupleId: string | null;
  previewCoupleId: string | null;
  isPreviewingCouple: boolean;
};

export function sanitizeInternalPath(value?: string | null, fallback = "/dashboard") {
  if (!value) return fallback;
  const trimmed = value.trim();

  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return fallback;
  }

  return trimmed;
}

export function getAdminPreviewCookieOptions(maxAge = ADMIN_PREVIEW_MAX_AGE_SECONDS) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

async function getValidatedPreviewCoupleId(isAdmin: boolean) {
  if (!isAdmin) {
    return null;
  }

  const cookieStore = await cookies();
  const previewCoupleId = cookieStore.get(ADMIN_PREVIEW_COUPLE_COOKIE)?.value?.trim() ?? "";

  if (!previewCoupleId) {
    return null;
  }

  const couple = await prisma.couple.findUnique({
    where: { id: previewCoupleId },
    select: { id: true },
  });

  return couple?.id ?? null;
}

export async function getAuthenticatedViewer(): Promise<AuthViewer | null> {
  const session = await getAuthSession();
  const sessionUserId = session?.user?.id ?? "";
  const sessionUserEmail = normalizeEmail(session?.user?.email ?? "");

  if (!sessionUserId && !sessionUserEmail) {
    return null;
  }

  const user = await prisma.user.findFirst({
    where: sessionUserId ? { id: sessionUserId } : { email: sessionUserEmail },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      coupleId: true,
    },
  });

  if (!user) {
    return null;
  }

  const isAdmin = user.role === "ADMIN" || isAdminEmail(user.email);
  const previewCoupleId = await getValidatedPreviewCoupleId(isAdmin);
  const activeCoupleId = previewCoupleId ?? user.coupleId ?? null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: isAdmin ? "ADMIN" : user.role,
    isAdmin,
    userCoupleId: user.coupleId,
    activeCoupleId,
    previewCoupleId,
    isPreviewingCouple: Boolean(previewCoupleId && previewCoupleId !== user.coupleId),
  };
}

export async function getActiveCoupleSummary(viewer?: AuthViewer | null) {
  if (!viewer?.activeCoupleId) {
    return null;
  }

  return prisma.couple.findUnique({
    where: { id: viewer.activeCoupleId },
    select: {
      id: true,
      name: true,
    },
  });
}

export async function requireViewerWithCoupleForPage(_pathname: string) {
  void _pathname;
  const viewer = await getAuthenticatedViewer();

  if (!viewer) {
    redirect("/");
  }

  if (!viewer.activeCoupleId) {
    if (viewer.role === "ADMIN") {
      redirect("/admin/couples");
    }

    redirect("/dashboard");
  }

  return viewer as AuthViewer & { activeCoupleId: string };
}

export async function requireViewerWithCoupleOrThrow() {
  const viewer = await getAuthenticatedViewer();

  if (!viewer) {
    throw new Error("Bitte melde dich an.");
  }

  if (!viewer.activeCoupleId) {
    if (viewer.role === "ADMIN") {
      throw new Error("Bitte wähle zuerst im Admin-Bereich ein Couple aus.");
    }

    throw new Error("Du hast noch kein Couple.");
  }

  return viewer as AuthViewer & { activeCoupleId: string };
}

export function redirectForMissingCouple(viewer?: Pick<AuthViewer, "role"> | null): never {
  if (viewer?.role === "ADMIN") {
    redirect("/admin/couples");
  }

  redirect("/dashboard");
}

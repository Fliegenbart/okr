import { PrismaClient } from "@prisma/client";
import { expect, type Page } from "@playwright/test";

const prisma = new PrismaClient();

export async function loginAsDemoUser(page: Page) {
  await prisma.user.update({
    where: { email: "demo1@example.com" },
    data: {
      preferredObjectiveSort: "CREATED_ASC",
      preferredKeyResultSort: "CREATED_ASC",
      preferredQuarterId: null,
    },
  });

  const csrfResponse = await page.request.get("/api/auth/csrf");
  const { csrfToken } = (await csrfResponse.json()) as { csrfToken?: string };

  if (!csrfToken) {
    throw new Error("CSRF-Token für Demo-Login fehlt.");
  }

  const body = new URLSearchParams({
    email: "demo1@example.com",
    callbackUrl: "/dashboard?quarter=all",
    redirect: "false",
    csrfToken,
    json: "true",
  });

  const loginResponse = await page.request.post("/api/auth/callback/demo-login", {
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    data: body.toString(),
  });

  expect(loginResponse.ok()).toBeTruthy();
}

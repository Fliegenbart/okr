import { expect, test, type Page } from "@playwright/test";

import { loginAsDemoUser } from "./helpers/auth";

async function openDemoDashboard(page: Page) {
  await loginAsDemoUser(page);
  await page.goto("/dashboard?quarter=all");
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(
    page.getByRole("heading", { name: "Eure Objectives" })
  ).toBeVisible();
}

test("dashboard shows an objective sort control and remembers the selection", async ({
  page,
}) => {
  await openDemoDashboard(page);

  const sortSelect = page.getByLabel("Objective-Sortierung");

  await expect(sortSelect).toHaveValue("CREATED_ASC");
  await sortSelect.selectOption("PROGRESS_DESC");
  await page.waitForLoadState("networkidle");
  await page.reload();
  await expect(sortSelect).toHaveValue("PROGRESS_DESC");
});

test("weekly check-in starts with scoring and still keeps the reflection section below", async ({
  page,
}) => {
  await openDemoDashboard(page);
  await page.goto("/dashboard/check-in");

  await expect(
    page.getByRole("heading", { name: "Scoring diese Woche" })
  ).toBeVisible();
  await expect(page.getByLabel("KR-Sortierung")).toBeVisible();
  await expect(page.getByText("Hilfreiche Fragen")).toBeVisible();
});

import { expect, test, type Page } from "@playwright/test";

import { loginAsDemoUser } from "./helpers/auth";

async function openObjectiveForm(page: Page) {
  await loginAsDemoUser(page);
  await page.goto("/dashboard/objectives/new");
  await expect(
    page.getByRole("heading", { name: "Neues Objective" })
  ).toBeVisible();
}

test("new objectives start with four KR fields and can be saved with a single filled KR", async ({
  page,
}) => {
  const objectiveTitle = `Playwright Objective ${Date.now()}`;

  await openObjectiveForm(page);

  await expect(page.getByText(/^Key Result [1-4]$/)).toHaveCount(4);

  await page.getByLabel("Objective").fill(objectiveTitle);
  await page.getByLabel("Titel").first().fill("Ein einziges KR reicht zum Speichern");
  await page.getByLabel("Zielwert").first().fill("1");
  await page.getByRole("button", { name: "Objective speichern" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("link", { name: objectiveTitle })).toBeVisible();
});

test("a too-long objective title shows a clear validation message", async ({ page }) => {
  await openObjectiveForm(page);

  await page.getByLabel("Objective").fill("O".repeat(121));
  await page.getByLabel("Titel").first().fill("Sichtbares KR");
  await page.getByRole("button", { name: "Objective speichern" }).click();

  await expect(
    page.getByText("Objective ist zu lang. Maximal 120 Zeichen.")
  ).toBeVisible();
});

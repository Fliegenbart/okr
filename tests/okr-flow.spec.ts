import { test, expect } from "@playwright/test";

test("core flow with seeded data", async ({ page }) => {
  await page.goto("/dashboard");

  await page.getByPlaceholder("dev@example.com").fill("demo1@example.com");
  await page.getByRole("button", { name: /developer login/i }).click();

  await expect(page.getByText("Aktuelle Objectives")).toBeVisible();

  await page
    .getByRole("link", { name: /Gesundheit: Wir fuehlen uns fit/i })
    .click();

  await expect(
    page.getByRole("heading", { name: /Gesundheit: Wir fuehlen uns fit/i })
  ).toBeVisible();

  await page.getByRole("link", { name: "Details" }).first().click();

  await expect(page.getByText("Verlauf")).toBeVisible();
  await expect(page.locator("svg.recharts-surface")).toBeVisible();

  const valueInput = page.getByLabel("Neuer Fortschritt");
  const currentValue = Number(await valueInput.inputValue());
  const nextValue = currentValue + 1;

  await valueInput.fill(String(nextValue));
  await page.getByRole("button", { name: /Update speichern/i }).click();

  await expect(valueInput).toHaveValue(String(nextValue));
});

test("onboarding flow", async ({ page }) => {
  const email = `dev-${Date.now()}@example.com`;

  await page.goto("/dashboard");

  await page.getByPlaceholder("dev@example.com").fill(email);
  await page.getByRole("button", { name: /developer login/i }).click();

  await expect(page.getByText("Willkommen bei OKR fuer Paare")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /couple gruenden/i })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /einladungslink eingeben/i })
  ).toBeVisible();
});

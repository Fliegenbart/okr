import { expect, test } from "@playwright/test";

async function login(page: import("@playwright/test").Page, email: string) {
  await page.goto("/auth/signin");
  await page.getByPlaceholder("dev@example.com").fill(email);
  await page.getByRole("button", { name: "Developer Login" }).click();
}

test("closed beta hides self-serve couple creation for unknown emails", async ({
  page,
}) => {
  await login(page, `blocked-${Date.now()}@example.com`);
  await expect(page.getByText("Willkommen bei OKR für Paare")).toBeVisible();
  await expect(
    page.getByText(/Diese Beta ist aktuell nur auf Einladung verfügbar/i)
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Couple gründen" })).toHaveCount(0);
});

test("closed beta still allows whitelisted person 1 to create a couple", async ({
  page,
}) => {
  await login(page, "beta1@example.com");
  await expect(page.getByText("Willkommen bei OKR für Paare")).toBeVisible();
  await expect(page.getByRole("button", { name: "Couple gründen" })).toBeVisible();
});

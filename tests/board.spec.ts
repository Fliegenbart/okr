import { expect, test, type Locator, type Page } from "@playwright/test";

async function loginAndOpenBoard(page: Page) {
  await page.goto("/dashboard");
  const loginInput = page.getByPlaceholder("dev@example.com");

  if (await loginInput.isVisible().catch(() => false)) {
    await loginInput.fill("demo1@example.com");
    await page.getByRole("button", { name: /developer login/i }).click();
  }

  await page.getByRole("link", { name: "Board", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Euer OKR Board" })).toBeVisible();
  await expect(page.getByTestId("board-canvas")).toBeVisible();
}

async function createStickyNote(
  page: Page,
  title: string,
  content: string
) {
  await page.getByRole("button", { name: "Sticky Note" }).click();
  await page.getByLabel("Titel").fill(title);
  await page.getByLabel("Inhalt").fill(content);
  await page.getByRole("button", { name: "Element anlegen" }).click();
  await expect(page.getByText(title)).toBeVisible();
}

async function getBoardPosition(locator: Locator) {
  return locator.evaluate((element) => {
    const node = element as HTMLElement;

    return {
      x: Number.parseFloat(node.style.left || "0"),
      y: Number.parseFloat(node.style.top || "0"),
    };
  });
}

test("creates a board lazily and keeps a new note after reload", async ({ page }) => {
  const uniqueTitle = `Board Note ${Date.now()}`;

  await loginAndOpenBoard(page);
  await createStickyNote(page, uniqueTitle, "Vision, Roadmap und eine konkrete Idee.");

  await page.reload();
  await expect(page.getByText(uniqueTitle)).toBeVisible();
});

test("persists dragged board elements and separates master from quarter boards", async ({
  page,
}) => {
  const masterTitle = `Master Card ${Date.now()}`;

  await loginAndOpenBoard(page);

  await page.getByRole("link", { name: "Master-Board" }).click();
  await expect(page.getByRole("heading", { name: "Euer OKR Board" })).toBeVisible();

  await createStickyNote(page, masterTitle, "Nur im Master-Board sichtbar.");

  const note = page
    .locator("[data-testid^='board-element-']")
    .filter({ has: page.getByText(masterTitle) })
    .first();
  const before = await getBoardPosition(note);

  const box = await note.boundingBox();
  if (!box) {
    throw new Error("Expected sticky note bounding box before dragging.");
  }

  await note.dispatchEvent("pointerdown", {
    clientX: box.x + 40,
    clientY: box.y + 40,
    pointerId: 1,
    bubbles: true,
  });
  await page.evaluate(
    ({ clientX, clientY }) => {
      window.dispatchEvent(
        new PointerEvent("pointermove", {
          clientX,
          clientY,
          pointerId: 1,
          bubbles: true,
        })
      );
      window.dispatchEvent(
        new PointerEvent("pointerup", {
          clientX,
          clientY,
          pointerId: 1,
          bubbles: true,
        })
      );
    },
    {
      clientX: box.x + 220,
      clientY: box.y + 180,
    }
  );
  await page.waitForTimeout(1200);

  const afterDrag = await getBoardPosition(note);

  expect(afterDrag.x).toBeGreaterThan(before.x + 100);
  expect(afterDrag.y).toBeGreaterThan(before.y + 80);

  await page.reload();
  const afterReload = await getBoardPosition(note);

  expect(afterReload.x).toBeGreaterThan(before.x + 100);
  expect(afterReload.y).toBeGreaterThan(before.y + 80);

  await page.getByRole("link", { name: "Q1 2026" }).click();
  await expect(page.getByText(masterTitle)).toHaveCount(0);
});

test("syncs board changes between two open pages without manual reload", async ({
  browser,
}) => {
  const title = `Realtime ${Date.now()}`;
  const context = await browser.newContext();
  const pageA = await context.newPage();
  const pageB = await context.newPage();

  await loginAndOpenBoard(pageA);
  await loginAndOpenBoard(pageB);

  await createStickyNote(pageA, title, "Kommt automatisch auf der zweiten Seite an.");
  await expect(pageB.getByText(title)).toBeVisible({ timeout: 10_000 });

  await context.close();
});

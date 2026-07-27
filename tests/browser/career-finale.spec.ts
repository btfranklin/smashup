import { expect, test } from "./fixtures";

async function createFixture(
  page: import("@playwright/test").Page,
): Promise<void> {
  await page.goto("/tests/browser/controller-fixture.html");
  await page.evaluate(() => window.controllerFixture.create());
}

test("presents complete champion standings without viewport overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await createFixture(page);
  await page.evaluate(() => window.controllerFixture.stageChampionStandings());

  await expect(
    page.getByRole("heading", { name: /Career Night Champion/i }),
  ).toBeVisible();
  await expect(page.getByRole("table", { name: "Final standings" })).toBeVisible();
  await expect(page.locator(".standings-table tbody tr")).toHaveCount(8);
  await expect(page.locator(".podium-place")).toHaveCount(3);
  await expect(
    page.getByRole("button", { name: "Run Another Career Night" }),
  ).toBeVisible();

  for (const viewport of [
    { width: 1280, height: 900 },
    { width: 430, height: 820 },
  ]) {
    await page.setViewportSize(viewport);
    const menuBox = await page.locator(".menu").boundingBox();
    expect(menuBox).not.toBeNull();
    expect(menuBox!.x).toBeGreaterThanOrEqual(0);
    expect(menuBox!.y).toBeGreaterThanOrEqual(0);
    expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(menuBox!.y + menuBox!.height).toBeLessThanOrEqual(
      viewport.height + 1,
    );
  }
});

test("respects reduced motion and keeps an AI championship restrained", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await createFixture(page);
  await page.evaluate(() => window.controllerFixture.stageChampionStandings());

  await expect(page.locator(".champion-sparks")).toHaveCSS("display", "none");

  await page.evaluate(() => window.controllerFixture.stageFieldStandings());
  await expect(page.getByText(/You finished 2nd with 40 points/i)).toBeVisible();
  await expect(page.locator(".champion-sparks")).toHaveCount(0);
});

test("offers a bounded skip while spectating a live round", async ({ page }) => {
  await createFixture(page);
  await page.evaluate(() => window.controllerFixture.stageSpectating());

  await expect(page.getByRole("heading", { name: "Wrecked" })).toBeVisible();
  await page.getByRole("button", { name: "Skip to Results" }).click();
  await expect(
    page.getByRole("button", { name: /Finishing Round/i }),
  ).toBeDisabled();
  await expect(
    page.getByText("Round 1 complete", { exact: true }),
  ).toBeVisible({ timeout: 10_000 });
});

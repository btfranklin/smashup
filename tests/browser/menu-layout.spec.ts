import { expect, test } from "./fixtures";

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 844, height: 390 },
];

async function createFixture(page: import("@playwright/test").Page) {
  await page.goto("/tests/browser/controller-fixture.html");
  await page.evaluate(() => window.controllerFixture.create());
}

async function expectMenuFits(
  page: import("@playwright/test").Page,
  viewport: (typeof VIEWPORTS)[number],
) {
  const frame = await page.locator(".frame").boundingBox();
  const menu = await page.locator(".menu").boundingBox();
  expect(frame).not.toBeNull();
  expect(menu).not.toBeNull();
  expect(frame!.x).toBeGreaterThanOrEqual(0);
  expect(frame!.y).toBeGreaterThanOrEqual(0);
  expect(frame!.x + frame!.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(frame!.y + frame!.height).toBeLessThanOrEqual(viewport.height + 1);
  expect(menu!.x).toBeGreaterThanOrEqual(0);
  expect(menu!.y).toBeGreaterThanOrEqual(0);
  expect(menu!.x + menu!.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(menu!.y + menu!.height).toBeLessThanOrEqual(viewport.height + 1);
  await expect(page.locator(".menu")).toHaveCSS("overflow-y", "auto");
  const maxHeight = await page.locator(".menu").evaluate((menu) =>
    getComputedStyle(menu).maxHeight,
  );
  expect(maxHeight).not.toBe("none");
}

async function clickAfterScroll(
  page: import("@playwright/test").Page,
  selector: string,
) {
  const buttons = page.locator(selector);
  const button = buttons.last();
  await button.scrollIntoViewIfNeeded();
  await expect(button).toBeVisible();
  await button.click();
}

for (const viewport of VIEWPORTS) {
  test(`keeps menu actions reachable at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await createFixture(page);

    await expect(page.locator('.menu[data-mode="menu"]')).toBeVisible();
    await expectMenuFits(page, viewport);
    await clickAfterScroll(page, "#start-btn");

    await expect(page.locator('.menu[data-mode="car_select"]')).toBeVisible();
    await expectMenuFits(page, viewport);
    await clickAfterScroll(page, "[data-preset-id]");

    await page.evaluate(() => window.controllerFixture.stageRoundResults());
    await expect(page.locator('.menu[data-mode="round_results"]')).toBeVisible();
    await expectMenuFits(page, viewport);
    await clickAfterScroll(page, "#advance-btn");

    await expect(page.locator('.menu[data-mode="upgrade"]')).toBeVisible();
    await expectMenuFits(page, viewport);
    await clickAfterScroll(page, "[data-upgrade-id]");
  });
}

import { expect, test, type Page } from "@playwright/test";

import { CAR_PRESET_IDS, CAR_PREVIEW_SCENARIO_IDS } from "../src/game/content";

type HookWindow = Window & {
  advanceTime?: (ms: number) => void;
  render_game_to_text?: () => string;
};

async function readTextState(page: Page) {
  await page.waitForFunction(
    () => typeof (window as HookWindow).render_game_to_text === "function",
  );
  const raw = await page.evaluate(
    () => (window as HookWindow).render_game_to_text?.() ?? "",
  );
  return JSON.parse(raw);
}

test("preview matrix stays aligned with content tables", async ({ page }) => {
  for (const presetId of CAR_PRESET_IDS) {
    for (const scenario of CAR_PREVIEW_SCENARIO_IDS) {
      await test.step(`${presetId}/${scenario}`, async () => {
        await page.goto(
          `/?preview=car&preset=${encodeURIComponent(presetId)}&scenario=${encodeURIComponent(scenario)}`,
        );
        await expect(page.locator("[data-startup-error]")).toHaveCount(0);
        const payload = await readTextState(page);
        expect(payload.mode).toBe("car_preview");
        expect(payload.preview).toEqual({
          kind: "car",
          presetId,
          scenario,
        });
      });
    }
  }
});

test("invalid preview parameters fail visibly instead of coercing", async ({
  page,
}) => {
  await page.goto("/?preview=car&preset=not-a-car&scenario=pristine");
  const startupError = page.locator("[data-startup-error]");
  await expect(startupError).toContainText("Invalid car preview preset");
  await expect(startupError).toContainText("bulldozer");

  const hookType = await page.evaluate(
    () => typeof (window as HookWindow).render_game_to_text,
  );
  expect(hookType).toBe("undefined");
});

test("runtime hooks stay callable through a tournament start flow", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#start-btn")).toBeVisible();
  await page.click("#start-btn");
  await page.click('[data-preset-id="bulldozer"]');

  await page.waitForFunction(
    () => typeof (window as HookWindow).advanceTime === "function",
  );
  await page.evaluate(() => (window as HookWindow).advanceTime?.(3500));

  await page.waitForFunction(() => {
    const read = (window as HookWindow).render_game_to_text;
    if (typeof read !== "function") {
      return false;
    }
    return JSON.parse(read()).mode === "running";
  });

  const payload = await readTextState(page);
  expect(payload.mode).toBe("running");
  expect(payload.session.selectedPreset).toBe("bulldozer");
  expect(payload.session.roundNumber).toBe(1);
  expect(payload.session.roundTitle).toBe("Dust Bowl");
  expect(payload.player?.presetId).toBe("bulldozer");
  expect(typeof payload.player?.x).toBe("number");
  expect(typeof payload.player?.y).toBe("number");
});

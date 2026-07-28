import { expect, readGamePayload, test } from "./fixtures";

test("boots the application and accepts pointer and keyboard gameplay input", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /Smashup\s+Derby/i })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start Career Night" }),
  ).toBeVisible();
  await expect(page.getByLabel("Smashup Derby arena")).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => ({
        advanceTime: typeof window.advanceTime,
        renderGameToText: typeof window.render_game_to_text,
      })),
    )
    .toEqual({ advanceTime: "function", renderGameToText: "function" });
  const menuPayload = await readGamePayload(page);
  expect(menuPayload.mode).toBe("menu");
  expect(menuPayload.session).toMatchObject({
    roundNumber: null,
    totalRounds: 0,
    roundTitle: null,
    modifierLabel: null,
  });
  expect(menuPayload.arena).toMatchObject({
    variant: null,
    modifier: null,
    title: null,
  });

  await page.getByRole("button", { name: "Start Career Night" }).click();
  await expect(page.getByRole("heading", { name: /Choose\s+Your Ride/i })).toBeVisible();
  const carSelectPayload = await readGamePayload(page);
  expect(carSelectPayload.mode).toBe("car_select");
  expect(carSelectPayload.session).toMatchObject({
    roundNumber: null,
    totalRounds: 0,
    roundTitle: null,
    modifierLabel: null,
  });
  await page.getByRole("button", { name: /Bulldozer/ }).click();

  await page.evaluate(() => window.advanceTime?.(3500));
  await expect.poll(async () => (await readGamePayload(page)).mode).toBe("running");
  const beforeInput = await readGamePayload(page);
  const playerBeforeInput = beforeInput.player as { x: number; y: number };

  await page.keyboard.down("w");
  await page.evaluate(() => window.advanceTime?.(750));
  await page.keyboard.up("w");
  await page.evaluate(() => window.advanceTime?.(1000 / 60));

  const afterInput = await readGamePayload(page);
  const afterPlayer = afterInput.player as {
    x: number;
    y: number;
    controls: { forward: number };
  };
  expect(afterInput.mode).toBe("running");
  expect((afterInput.session as { totalRounds: number }).totalRounds).toBe(5);
  expect(
    (afterInput.session as { roundPlans: Array<{ modifier: string }> })
      .roundPlans[4]?.modifier,
  ).toBe("redline");
  expect(
    Math.hypot(
      afterPlayer.x - playerBeforeInput.x,
      afterPlayer.y - playerBeforeInput.y,
    ),
  ).toBeGreaterThan(0);
  expect(afterPlayer.controls.forward).toBe(0);
});

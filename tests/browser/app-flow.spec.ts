import { expect, readGamePayload, test } from "./fixtures";

test("boots the application and accepts pointer and keyboard gameplay input", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /Smashup\s+Derby/i })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start Tournament" })).toBeVisible();
  await expect(page.getByLabel("Smashup Derby arena")).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => ({
        advanceTime: typeof window.advanceTime,
        renderGameToText: typeof window.render_game_to_text,
      })),
    )
    .toEqual({ advanceTime: "function", renderGameToText: "function" });

  await page.getByRole("button", { name: "Start Tournament" }).click();
  await expect(page.getByRole("heading", { name: /Choose\s+Your Ride/i })).toBeVisible();
  await page.getByRole("button", { name: /Bulldozer/ }).click();

  await page.evaluate(() => window.advanceTime?.(3500));
  await expect.poll(async () => (await readGamePayload(page)).mode).toBe("running");
  const beforeInput = await readGamePayload(page);
  const beforePlayer = beforeInput.player as { x: number; y: number };

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
  expect(
    Math.hypot(afterPlayer.x - beforePlayer.x, afterPlayer.y - beforePlayer.y),
  ).toBeGreaterThan(0);
  expect(afterPlayer.controls.forward).toBe(0);
});

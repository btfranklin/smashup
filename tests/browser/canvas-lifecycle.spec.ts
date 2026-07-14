import { expect, test } from "./fixtures";

async function inspectCanvasPixels(canvas: import("@playwright/test").Locator) {
  return canvas.evaluate((element) => {
    const canvasElement = element as HTMLCanvasElement;
    const ctx = canvasElement.getContext("2d");
    if (!ctx) {
      throw new Error("Native Canvas 2D context is unavailable.");
    }
    const { width, height } = canvasElement;
    const pixels = ctx.getImageData(0, 0, width, height).data;
    const colors = new Set<string>();
    let opaqueSamples = 0;
    const sampleStride = Math.max(4, Math.floor(pixels.length / 2000 / 4) * 4);
    for (let index = 0; index < pixels.length; index += sampleStride) {
      const color = `${pixels[index]},${pixels[index + 1]},${pixels[index + 2]},${pixels[index + 3]}`;
      colors.add(color);
      if (pixels[index + 3] > 0) {
        opaqueSamples += 1;
      }
    }
    return { colorCount: colors.size, opaqueSamples };
  });
}

test("native Canvas paints normal and representative preview states", async ({ page }) => {
  await page.goto("/");
  const canvas = page.getByLabel("Smashup Derby arena");
  await expect(canvas).toBeVisible();
  await expect.poll(async () => (await inspectCanvasPixels(canvas)).colorCount).toBeGreaterThan(10);
  await expect
    .poll(async () => (await inspectCanvasPixels(canvas)).opaqueSamples)
    .toBeGreaterThan(10);
  const normalPixels = await inspectCanvasPixels(canvas);
  expect(normalPixels.colorCount).toBeGreaterThan(10);
  expect(normalPixels.opaqueSamples).toBeGreaterThan(10);

  await page.goto("/?preview=car&preset=bulldozer&scenario=critical");
  await expect(canvas).toBeVisible();
  const previewPixels = await inspectCanvasPixels(canvas);
  expect(previewPixels.colorCount).toBeGreaterThan(10);
  expect(previewPixels.opaqueSamples).toBeGreaterThan(10);
});

test("uses native resize, RAF, and fullscreen lifecycle", async ({ page }) => {
  await page.addInitScript(() => {
    const nativeRequestAnimationFrame = window.requestAnimationFrame.bind(window);
    window.__nativeRafCallbacks = 0;
    window.requestAnimationFrame = (callback: FrameRequestCallback) =>
      nativeRequestAnimationFrame((time) => {
        window.__nativeRafCallbacks += 1;
        callback(time);
      });
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  const canvas = page.getByLabel("Smashup Derby arena");
  const frame = page.locator(".frame");
  await expect.poll(() => page.evaluate(() => window.__nativeRafCallbacks)).toBeGreaterThan(2);

  for (const viewport of [
    { width: 1280, height: 900 },
    { width: 600, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await expect
      .poll(async () => {
        const box = await canvas.boundingBox();
        return box ? box.width / box.height : 0;
      })
      .toBeCloseTo(1500 / 900, 2);
    const canvasBox = await canvas.boundingBox();
    const frameBox = await frame.boundingBox();
    expect(canvasBox).not.toBeNull();
    expect(frameBox).not.toBeNull();
    expect(canvasBox!.width).toBeLessThanOrEqual(frameBox!.width + 1);
    expect(canvasBox!.height).toBeLessThanOrEqual(frameBox!.height + 1);
  }

  await page.locator("body").click({ position: { x: 1, y: 1 } });
  await page.keyboard.press("f");
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.className)).toBe(
    "frame",
  );
  await page.keyboard.press("f");
  await expect.poll(() => page.evaluate(() => document.fullscreenElement)).toBeNull();
});

declare global {
  interface Window {
    __nativeRafCallbacks: number;
  }
}

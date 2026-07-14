import { expect, test } from "./fixtures";

type AudioProbe = {
  contexts: AudioContext[];
  resumeCalls: number;
  closeCalls: number;
};

async function installNativeAudioProbe(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    const NativeAudioContext = window.AudioContext;
    const probe: AudioProbe = {
      contexts: [],
      resumeCalls: 0,
      closeCalls: 0,
    };
    window.__audioProbe = probe;
    window.AudioContext = class InstrumentedAudioContext extends NativeAudioContext {
      constructor(options?: AudioContextOptions) {
        super(options);
        probe.contexts.push(this);
      }

      override async resume(): Promise<void> {
        probe.resumeCalls += 1;
        await super.resume();
      }

      override async close(): Promise<void> {
        probe.closeCalls += 1;
        await super.close();
      }
    };
  });
}

function readAudioProbe(page: import("@playwright/test").Page) {
  return page.evaluate(() => ({
    count: window.__audioProbe.contexts.length,
    states: window.__audioProbe.contexts.map((context) => context.state),
    resumeCalls: window.__audioProbe.resumeCalls,
    closeCalls: window.__audioProbe.closeCalls,
  }));
}

test("initializes native Web Audio under activation and resumes suspension", async ({
  page,
}) => {
  await installNativeAudioProbe(page);
  await page.goto("/");
  expect(await readAudioProbe(page)).toMatchObject({ count: 0, states: [] });

  await page.getByRole("button", { name: "Start Tournament" }).click();
  await expect.poll(async () => (await readAudioProbe(page)).count).toBe(1);
  await expect.poll(async () => (await readAudioProbe(page)).states).toEqual(["running"]);

  await page.evaluate(() => window.__audioProbe.contexts[0]?.suspend());
  await expect.poll(async () => (await readAudioProbe(page)).states).toEqual(["suspended"]);
  await page.getByRole("button", { name: /Bulldozer/ }).click();

  await expect.poll(async () => (await readAudioProbe(page)).states).toEqual(["running"]);
  expect(await readAudioProbe(page)).toMatchObject({ count: 1, resumeCalls: 1 });
  await page.keyboard.press("w");
  expect((await readAudioProbe(page)).count).toBe(1);
});

test("closes native audio and transfers browser-hook ownership on recreate", async ({
  page,
}) => {
  await installNativeAudioProbe(page);
  await page.goto("/tests/browser/controller-fixture.html");
  await page.evaluate(() => window.controllerFixture.create());
  await page.getByRole("button", { name: "Start Tournament" }).click();
  await expect.poll(async () => (await readAudioProbe(page)).states).toEqual(["running"]);

  await page.evaluate(() => window.controllerFixture.destroy());
  await expect.poll(async () => (await readAudioProbe(page)).states).toEqual(["closed"]);
  expect(await page.evaluate(() => window.controllerFixture.snapshot())).toEqual({
    active: false,
    mode: null,
    hooksInstalled: false,
  });

  await page.evaluate(() => window.controllerFixture.create());
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: /Choose\s+Your Ride/i })).toBeVisible();
  await expect.poll(async () => (await readAudioProbe(page)).states).toEqual([
    "closed",
    "running",
  ]);
  expect(await readAudioProbe(page)).toMatchObject({ count: 2, closeCalls: 1 });
  expect(await page.evaluate(() => window.controllerFixture.snapshot())).toEqual({
    active: true,
    mode: "car_select",
    hooksInstalled: true,
  });

  await page.evaluate(() => window.controllerFixture.destroy());
  await expect.poll(async () => (await readAudioProbe(page)).states).toEqual([
    "closed",
    "closed",
  ]);
});

declare global {
  interface Window {
    __audioProbe: AudioProbe;
  }
}

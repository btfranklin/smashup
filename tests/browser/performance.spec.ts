import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { Page } from "@playwright/test";

import {
  summarizePerformanceSamples,
  type PerformanceSnapshot,
} from "../../src/app/performance";
import { expect, test } from "./fixtures";

const DESKTOP_P95_BUDGET_MS = 12;
const DESKTOP_P99_BUDGET_MS = 16.7;
const STRESS_P95_BUDGET_MS = 25;
const LONG_TASK_MS = 50;
const INTERACTION_PAINT_BUDGET_MS = 50;
const SKIP_BATCH_LIMIT_MS = 12;
const SKIP_WALL_LIMIT_MS = 5_000;

type SceneName = "clean" | "collision" | "damaged";

type SceneResult = {
  name: SceneName;
  markerMs: number;
  endMs: number;
  durationsMs: number[];
  snapshot: PerformanceSnapshot;
};

function percentile(values: number[], ratio: number): number {
  const ordered = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.ceil(ordered.length * ratio) - 1);
  return ordered[index] ?? Number.POSITIVE_INFINITY;
}

async function preserveSample(name: string, payload: unknown): Promise<void> {
  const directory = path.resolve("output/performance-samples");
  await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(directory, `${name}.json`),
    `${JSON.stringify(payload, null, 2)}\n`,
    "utf8",
  );
}

async function createFixture(
  page: Page,
  options: { audio?: boolean; capacity?: number; manualFrames?: boolean } = {},
): Promise<void> {
  await page.goto("/tests/browser/controller-fixture.html");
  await page.evaluate(
    (createOptions) => window.controllerFixture.create(createOptions),
    { manualFrames: true, ...options },
  );
}

async function stageScene(page: Page, scene: SceneName): Promise<void> {
  await page.evaluate((sceneName) => {
    if (sceneName === "clean") {
      window.controllerFixture.stageCleanRound();
    } else if (sceneName === "collision") {
      window.controllerFixture.stageHeavyCollision();
    } else {
      window.controllerFixture.stageDamagedRound();
    }
  }, scene);
}

async function runFixedStepScene(
  page: Page,
  scene: SceneName,
  measuredSteps: number,
  restageEvery = 0,
  yieldEvery = 8,
): Promise<SceneResult> {
  await stageScene(page, scene);
  return page.evaluate(
    async ({ sceneName, steps, repeatEvery, yieldInterval }) => {
      const advance = window.advanceTime;
      if (!advance) {
        throw new Error("Fixed-step performance scene requires advanceTime.");
      }
      const yieldToBrowser = () =>
        new Promise<void>((resolve) => {
          const channel = new MessageChannel();
          channel.port1.onmessage = () => {
            channel.port1.close();
            channel.port2.close();
            resolve();
          };
          channel.port2.postMessage(undefined);
        });
      const yieldToFrame = () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => resolve());
        });
      for (let index = 0; index < 30; index += 1) {
        advance(1000 / 60);
      }
      await yieldToBrowser();
      const markerMs = performance.now();
      const durationsMs: number[] = [];
      for (let index = 0; index < steps; index += 1) {
        if (repeatEvery > 0 && index > 0 && index % repeatEvery === 0) {
          window.controllerFixture.stageHeavyCollision();
        }
        const startedAt = performance.now();
        advance(1000 / 60);
        durationsMs.push(performance.now() - startedAt);
        if (yieldInterval === 0) {
          await yieldToFrame();
        } else if (index % yieldInterval === yieldInterval - 1) {
          await yieldToBrowser();
        }
      }
      const endMs = performance.now();
      await (yieldInterval === 0 ? yieldToFrame() : yieldToBrowser());
      return {
        name: sceneName,
        markerMs,
        endMs,
        durationsMs,
        snapshot: window.controllerFixture.performanceSnapshot(),
      };
    },
    {
      sceneName: scene,
      steps: measuredSteps,
      repeatEvery: restageEvery,
      yieldInterval: yieldEvery,
    },
  );
}

function postWarmupLongTasks(result: SceneResult) {
  return result.snapshot.longTasks.filter(
    (entry) =>
      entry.startTimeMs < result.endMs &&
      entry.startTimeMs + entry.durationMs > result.markerMs &&
      entry.durationMs >= LONG_TASK_MS,
  );
}

function measuredSamples(result: SceneResult) {
  return result.snapshot.samples.filter(
    (sample) =>
      sample.timestampMs >= result.markerMs && sample.timestampMs <= result.endMs,
  );
}

test("@performance detects stalls in the first and final measured tasks", async ({
  page,
}) => {
  await createFixture(page, { audio: false });
  const result = await page.evaluate(async (stallMs) => {
    if (!PerformanceObserver.supportedEntryTypes.includes("longtask")) {
      throw new Error("The stall probe requires native long-task observation.");
    }
    const yieldToBrowser = () =>
      new Promise<void>((resolve) => {
        const channel = new MessageChannel();
        channel.port1.onmessage = () => {
          channel.port1.close();
          channel.port2.close();
          resolve();
        };
        channel.port2.postMessage(undefined);
      });
    const stall = (milliseconds: number) => {
      const startedAt = performance.now();
      while (performance.now() - startedAt < milliseconds) {}
    };

    await yieldToBrowser();
    stall(stallMs);
    await yieldToBrowser();
    // Keep the marker inside the first measured browser task.
    stall(5);
    const markerMs = performance.now();
    stall(stallMs);
    const firstTaskEndMs = performance.now();
    await yieldToBrowser();
    stall(stallMs);
    const endMs = performance.now();
    await yieldToBrowser();
    return {
      name: "clean" as const,
      markerMs,
      endMs,
      firstTaskEndMs,
      durationsMs: [],
      snapshot: window.controllerFixture.performanceSnapshot(),
    };
  }, LONG_TASK_MS + 25);

  const firstTask = result.snapshot.longTasks.find(
    (entry) =>
      entry.startTimeMs < result.markerMs &&
      entry.startTimeMs + entry.durationMs > result.markerMs,
  );
  const finalTask = result.snapshot.longTasks.find(
    (entry) =>
      entry.startTimeMs >= result.firstTaskEndMs && entry.startTimeMs < result.endMs,
  );
  expect(firstTask).toBeDefined();
  expect(finalTask).toBeDefined();
  const measuredTasks = postWarmupLongTasks(result);
  expect(measuredTasks).toEqual(expect.arrayContaining([firstTask, finalTask]));
  expect(
    result.snapshot.longTasks.some(
      (entry) => entry.startTimeMs + entry.durationMs <= result.markerMs,
    ),
  ).toBe(true);
  expect(measuredTasks).toHaveLength(2);
  await page.evaluate(() => window.controllerFixture.destroy());
});

test("@performance profiles deterministic clean, collision, and damaged scenes", async ({
  page,
}, testInfo) => {
  await createFixture(page, { audio: false, capacity: 8_000 });
  const scenes = [
    await runFixedStepScene(page, "clean", 240),
    await runFixedStepScene(page, "collision", 240, 24),
    await runFixedStepScene(page, "damaged", 240),
  ];
  const combinedDurations = scenes.flatMap((scene) => scene.durationsMs);
  const metrics = {
    budgets: {
      p95Ms: DESKTOP_P95_BUDGET_MS,
      p99Ms: DESKTOP_P99_BUDGET_MS,
      longTaskMs: LONG_TASK_MS,
    },
    scenes: scenes.map((scene) => ({
      name: scene.name,
      p95Ms: percentile(scene.durationsMs, 0.95),
      p99Ms: percentile(scene.durationsMs, 0.99),
      maximumMs: Math.max(...scene.durationsMs),
      longTasks: postWarmupLongTasks(scene),
      droppedSamples: scene.snapshot.droppedSamples,
      sampleCount: scene.snapshot.samples.length,
      telemetry: summarizePerformanceSamples(measuredSamples(scene)),
    })),
    combined: {
      p95Ms: percentile(combinedDurations, 0.95),
      p99Ms: percentile(combinedDurations, 0.99),
    },
  };
  await testInfo.attach("desktop-scenes.json", {
    body: JSON.stringify(metrics, null, 2),
    contentType: "application/json",
  });
  await preserveSample("desktop-scenes", metrics);

  const phases = new Set(
    scenes.flatMap((scene) =>
      scene.snapshot.samples.map((sample) => sample.phase),
    ),
  );
  expect([...phases]).toEqual(
    expect.arrayContaining([
      "simulation",
      "audio",
      "render",
      "menu",
    ]),
  );
  expect(scenes.every((scene) => scene.snapshot.droppedSamples === 0)).toBe(
    true,
  );
  expect(scenes.flatMap(postWarmupLongTasks)).toEqual([]);
  expect(percentile(combinedDurations, 0.95)).toBeLessThan(
    DESKTOP_P95_BUDGET_MS,
  );
  expect(percentile(combinedDurations, 0.99)).toBeLessThan(
    DESKTOP_P99_BUDGET_MS,
  );

  await page.evaluate(() => window.controllerFixture.destroy());
});

test("@performance keeps warm audio activation off the interaction path", async ({
  page,
}, testInfo) => {
  const audioRuns: Array<{
    label: "cold" | "warm";
    interactionPaintMs: number;
    prepareMs: number;
    voiceCount: number;
  }> = [];

  for (const label of ["cold", "warm"] as const) {
    await createFixture(page, { audio: true, capacity: 2_000 });
    await page.waitForTimeout(300);
    const beforeInteraction =
      await page.evaluate(() => window.controllerFixture.performanceSnapshot());
    const preparedAudio = beforeInteraction.samples
      .filter((sample) => sample.phase === "audio")
      .at(-1);
    expect(preparedAudio).toBeDefined();
    expect(preparedAudio?.audioVoicesCreated).toBeGreaterThanOrEqual(3);
    if (!preparedAudio) {
      throw new Error("Idle audio preparation sample missing.");
    }

    const paintMeasurement = page.evaluate(
      () =>
        new Promise<number>((resolve, reject) => {
          const startButton = document.querySelector<HTMLButtonElement>(
            "#start-btn",
          );
          if (!startButton) {
            throw new Error("Career start button missing.");
          }
          let startedAt = 0;
          const rememberPointerTime = () => {
            startedAt = performance.now();
          };
          startButton.addEventListener("pointerdown", rememberPointerTime, {
            capture: true,
            once: true,
          });
          startButton.addEventListener(
            "click",
            () => {
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  const heading =
                    document.querySelector<HTMLElement>(".menu h1");
                  if (!heading?.textContent?.includes("Choose")) {
                    reject(
                      new Error(
                        "Car-selection menu was not ready at the measured paint.",
                      ),
                    );
                    return;
                  }
                  resolve(performance.now() - startedAt);
                });
              });
            },
            { once: true },
          );
        }),
    );
    await page.getByRole("button", { name: "Start Career Night" }).click();
    const interactionPaintMs = await paintMeasurement;
    await page.getByRole("button", { name: /Bulldozer/ }).click();
    await page.evaluate(() => window.advanceTime?.(3_500));
    const afterStart =
      await page.evaluate(() => window.controllerFixture.performanceSnapshot());
    const latestAudio = afterStart.samples
      .filter((sample) => sample.phase === "audio")
      .at(-1);

    audioRuns.push({
      label,
      interactionPaintMs,
      prepareMs: preparedAudio.durationMs,
      voiceCount: latestAudio?.audioVoicesCreated ?? 0,
    });
    expect(interactionPaintMs).toBeLessThan(INTERACTION_PAINT_BUDGET_MS);
    expect(latestAudio?.audioVoicesCreated).toBeGreaterThanOrEqual(3);
    await page.evaluate(() => window.controllerFixture.destroy());
  }

  await createFixture(page, { audio: false });
  await stageScene(page, "clean");
  await page.evaluate(() => window.advanceTime?.(1_000));
  const silentSnapshot =
    await page.evaluate(() => window.controllerFixture.performanceSnapshot());
  expect(
    silentSnapshot.samples.every((sample) => sample.audioVoicesCreated === 0),
  ).toBe(true);
  await page.evaluate(() => window.controllerFixture.destroy());

  await testInfo.attach("audio-startup.json", {
    body: JSON.stringify(
      {
        interactionPaintBudgetMs: INTERACTION_PAINT_BUDGET_MS,
        runs: audioRuns,
      },
      null,
      2,
    ),
    contentType: "application/json",
  });
  await preserveSample("audio-startup", {
    interactionPaintBudgetMs: INTERACTION_PAINT_BUDGET_MS,
    runs: audioRuns,
  });
});

test("@performance yields spectator skip within its exact work cap", async ({
  page,
}, testInfo) => {
  await createFixture(page, {
    audio: false,
    capacity: 4_000,
    manualFrames: false,
  });
  await page.evaluate(() => window.controllerFixture.stageSpectating());
  await page.evaluate(() => {
    let heartbeat = 0;
    const beat = () => {
      heartbeat += 1;
      document.body.dataset.heartbeat = String(heartbeat);
      if (window.render_game_to_text) {
        const mode = JSON.parse(window.render_game_to_text()).mode as string;
        if (mode === "spectating") {
          requestAnimationFrame(beat);
        }
      }
    };
    requestAnimationFrame(beat);
  });

  const startedAt = Date.now();
  await page.getByRole("button", { name: "Skip to Results" }).click();
  await page.waitForFunction(
    () =>
      window.render_game_to_text &&
      JSON.parse(window.render_game_to_text()).mode === "round_results",
    undefined,
    { timeout: SKIP_WALL_LIMIT_MS },
  );
  const wallDurationMs = Date.now() - startedAt;
  const snapshot =
    await page.evaluate(() => window.controllerFixture.performanceSnapshot());
  const skipSamples = snapshot.samples.filter(
    (sample) => sample.phase === "skip",
  );
  const fixedSteps = skipSamples.reduce(
    (total, sample) => total + sample.fixedSteps,
    0,
  );
  const heartbeat = Number(
    await page.locator("body").getAttribute("data-heartbeat"),
  );
  const metrics = {
    wallDurationMs,
    heartbeat,
    fixedSteps,
    batchCount: skipSamples.length,
    p95Ms: percentile(
      skipSamples.map((sample) => sample.durationMs),
      0.95,
    ),
    maximumMs: Math.max(...skipSamples.map((sample) => sample.durationMs)),
    telemetry: summarizePerformanceSamples(snapshot.samples),
  };
  await testInfo.attach("spectator-skip.json", {
    body: JSON.stringify(metrics, null, 2),
    contentType: "application/json",
  });
  await preserveSample("spectator-skip", metrics);

  expect(skipSamples.length).toBeGreaterThan(0);
  expect(fixedSteps).toBeLessThanOrEqual(5_400);
  expect(wallDurationMs).toBeLessThan(SKIP_WALL_LIMIT_MS);
  expect(heartbeat).toBeGreaterThan(1);
  expect(
    skipSamples.every(
      (sample) =>
        sample.durationMs < SKIP_BATCH_LIMIT_MS || sample.fixedSteps === 1,
    ),
  ).toBe(true);
  await page.evaluate(() => window.controllerFixture.destroy());
});

test("@performance stays responsive with Chromium at 4x CPU throttling", async ({
  page,
}, testInfo) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  try {
    await createFixture(page, { audio: false, capacity: 4_000 });
    const result = await runFixedStepScene(page, "damaged", 120, 0, 0);
    const metrics = {
      budgetP95Ms: STRESS_P95_BUDGET_MS,
      p95Ms: percentile(result.durationsMs, 0.95),
      p99Ms: percentile(result.durationsMs, 0.99),
      maximumMs: Math.max(...result.durationsMs),
      longTasks: postWarmupLongTasks(result),
      telemetry: summarizePerformanceSamples(measuredSamples(result)),
    };
    await testInfo.attach("chromium-4x.json", {
      body: JSON.stringify(metrics, null, 2),
      contentType: "application/json",
    });
    await preserveSample("chromium-4x", metrics);

    expect(percentile(result.durationsMs, 0.95)).toBeLessThan(
      STRESS_P95_BUDGET_MS,
    );
    expect(postWarmupLongTasks(result)).toEqual([]);
    await page.evaluate(() => window.controllerFixture.destroy());
  } finally {
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    await cdp.detach();
  }
});

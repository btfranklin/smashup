// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  bootstrapApp,
  computeCanvasDisplaySize,
  createStateForSearch,
  installBrowserHooks,
  MAX_ADVANCE_TIME_MS,
  renderStartupError,
  resetInputState,
  setInputKeyState,
  shouldHideMenu,
  SPECTATOR_SKIP_MAX_STEPS,
} from "../src/app/bootstrap";
import { PLACEMENT_POINTS } from "../src/game/career";
import { chooseStarterCar } from "../src/game/session";
import {
  createControllerHarness,
  type ControllerOptions,
} from "./helpers/controller-harness";
import { createRoundSummaryFixture } from "./helpers/fixtures";
import { parsePayload } from "./helpers/payload-assertions";

let controllerHarness: ReturnType<typeof createControllerHarness>;
let harness: ReturnType<typeof createControllerHarness>["dom"];

beforeEach(() => {
  controllerHarness = createControllerHarness();
  harness = controllerHarness.dom;
});

afterEach(async () => {
  await controllerHarness.cleanup();
});

function createTestController(
  options: Partial<ControllerOptions> = {},
) {
  return controllerHarness.createController(options);
}

describe("bootstrap-core-menus", () => {
  it("renders a visible startup error for invalid preview params and does not install hooks", () => {
    const destroyCollector = vi.fn();
    window.history.replaceState(
      {},
      "",
      "/?preview=car&preset=bad-car&scenario=pristine",
    );

    const controller = bootstrapApp({
      appRoot: harness.appRoot,
      requestAnimationFrame: harness.requestAnimationFrame,
      performanceNow: harness.performanceNow,
      performanceCollector: {
        record: vi.fn(),
        snapshot: () => ({
          capacity: 1,
          droppedSamples: 0,
          samples: [],
          longTasks: [],
          garbageCollections: [],
        }),
        destroy: destroyCollector,
      },
    });

    expect(controller).toBeNull();
    expect(harness.appRoot.textContent).toContain("Startup Error");
    expect(harness.appRoot.textContent).toContain("Invalid car preview preset");
    expect(window.render_game_to_text).toBeUndefined();
    expect(destroyCollector).toHaveBeenCalledTimes(1);
  });

  it("boots the normal app shell with frame, canvas, and menu", () => {
    const controller = createTestController();

    expect(harness.appRoot.contains(controller.frame)).toBe(true);
    expect(controller.canvas.getAttribute("aria-label")).toContain("arena");
    expect(controller.menu.textContent).toContain("Start Career Night");
    expect(controller.menu.textContent).toContain("5 rounds");
    expect(window.advanceTime).toBeTypeOf("function");
    expect(window.render_game_to_text).toBeTypeOf("function");
  });

  it("boots preview mode with hidden menu content", () => {
    window.history.replaceState(
      {},
      "",
      "/?preview=car&preset=bulldozer&scenario=critical",
    );

    const controller = createTestController();

    expect(controller.state.mode).toBe("car_preview");
    expect(controller.menu.hidden).toBe(true);
    expect(controller.menu.textContent?.trim()).toBe("");
    expect(controller.menu.querySelector("button")).toBeNull();
  });

  it("advances from menu to car select and then into the round intro", () => {
    const controller = createTestController();

    harness.appRoot.querySelector<HTMLButtonElement>("#start-btn")?.click();
    expect(controller.state.mode).toBe("car_select");
    expect(controller.menu.textContent).toContain("5-round run");

    harness.appRoot
      .querySelector<HTMLButtonElement>('[data-preset-id="bulldozer"]')
      ?.click();
    expect(controller.state.mode).toBe("intro");
    expect(controller.state.session.playerBuild?.presetId).toBe("bulldozer");
  });

  it("uses content-ordered preset number shortcuts while in car select", () => {
    const controller = createTestController();

    harness.appRoot.querySelector<HTMLButtonElement>("#start-btn")?.click();
    document.dispatchEvent(new KeyboardEvent("keydown", { code: "Digit9" }));
    expect(controller.state.mode).toBe("car_select");

    document.dispatchEvent(new KeyboardEvent("keydown", { code: "Digit2" }));
    expect(controller.state.mode).toBe("intro");
    expect(controller.state.session.playerBuild?.presetId).toBe("darter");
  });

  it("keeps advanceTime deterministic and installs render_game_to_text", () => {
    const controller = createTestController();

    harness.appRoot.querySelector<HTMLButtonElement>("#start-btn")?.click();
    harness.appRoot
      .querySelector<HTMLButtonElement>('[data-preset-id="bulldozer"]')
      ?.click();
    const advanceTime = window.advanceTime;
    const renderGameToText = window.render_game_to_text;
    if (!advanceTime || !renderGameToText) {
      throw new Error("Browser hooks missing from test controller.");
    }

    advanceTime(3500);

    const payload = parsePayload(renderGameToText());
    expect(controller.state.mode).toBe("running");
    expect(payload.mode).toBe("running");
    expect((payload.session as { selectedPreset: string }).selectedPreset).toBe(
      "bulldozer",
    );
  });

  it("defines exact bounded and partition-independent advanceTime semantics", async () => {
    const run = async (durations: number[]) => {
      const controller = createTestController();
      chooseStarterCar(controller.state, "bulldozer", 42);
      controller.state.mode = "running";
      controller.state.session.countdown = 0;
      const beforeZero = JSON.stringify(controller.state);
      controller.advanceTime(0);
      expect(JSON.stringify(controller.state)).toBe(beforeZero);
      for (const duration of durations) {
        controller.advanceTime(duration);
      }
      const snapshot = JSON.stringify(controller.state);
      await controller.destroy();
      return snapshot;
    };

    const whole = await run([1000]);
    const partitioned = await run([
      7.5, 12.5, 80, 100, 200, 300, 125, 175,
    ]);
    expect(partitioned).toBe(whole);

    const controller = createTestController();
    for (const invalid of [
      -1,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      MAX_ADVANCE_TIME_MS + 0.001,
    ]) {
      expect(() => controller.advanceTime(invalid)).toThrow(RangeError);
    }
  });

  it("keeps the small bootstrap helpers table-testable", () => {
    const input = {
      left: false,
      right: false,
      forward: false,
      reverse: false,
    };
    expect(setInputKeyState(input, "KeyD", true)).toBe(true);
    expect(setInputKeyState(input, "Space", true)).toBe(false);
    expect(input.right).toBe(true);
    resetInputState(input);
    expect(input).toEqual({
      left: false,
      right: false,
      forward: false,
      reverse: false,
    });

    expect(computeCanvasDisplaySize(1500, 900, 600, 400)).toEqual({
      width: 600,
      height: 360,
    });
    expect(shouldHideMenu("running")).toBe(true);
    expect(shouldHideMenu("menu")).toBe(false);

    installBrowserHooks(window, {
      advanceTime: vi.fn(),
      renderGameToText: () => "{}",
    });
    const renderGameToText = window.render_game_to_text;
    if (!renderGameToText) {
      throw new Error("Render text hook missing after hook installation.");
    }
    expect(renderGameToText()).toBe("{}");

    renderStartupError(harness.appRoot, "Broken");
    expect(harness.appRoot.textContent).toContain("Broken");
    expect(createStateForSearch("?preview=car&preset=bulldozer&scenario=pristine").mode).toBe(
      "car_preview",
    );
  });

  it("renders round-results and upgrade flows through the menu", () => {
    const controller = createTestController();

    harness.appRoot.querySelector<HTMLButtonElement>("#start-btn")?.click();
    harness.appRoot
      .querySelector<HTMLButtonElement>('[data-preset-id="bulldozer"]')
      ?.click();
    controller.state.mode = "round_results";
    controller.state.session.lastRoundSummary = createRoundSummaryFixture({
      playerKnockouts: ["Rimshot"],
      biggestHitLabel: "Player into Rimshot",
      biggestHitSeverity: 0.9,
      awardIds: ["sledgehammer", "finisher"],
    });
    controller.syncMenu();
    expect(controller.menu.textContent).toContain("Round 1");
    expect(controller.menu.textContent).toContain("Sledgehammer");
    expect(controller.menu.textContent).toContain("+10");
    harness.appRoot.querySelector<HTMLButtonElement>("#advance-btn")?.click();
    expect(controller.state.mode).toBe("upgrade");

    controller.syncMenu();
    expect(controller.menu.textContent).toContain("Pit Choice");
    harness.appRoot
      .querySelector<HTMLButtonElement>('[data-upgrade-id="ram_rig"]')
      ?.click();
    expect(controller.state.mode).toBe("intro");
    expect(controller.state.session.roundIndex).toBe(1);
  });

  it("renders champion standings and supports keyboard restart", () => {
    const controller = createTestController();
    chooseStarterCar(controller.state, "bulldozer", 42);
    const placements = controller.state.cars.map((car, index) => ({
      driverId: car.id,
      label: car.label,
      presetId: car.presetId,
      isPlayer: car.isPlayer,
      place: index + 1,
      points: PLACEMENT_POINTS[index],
    }));
    controller.state.mode = "career_over";
    controller.state.session.completedRounds = Array.from(
      { length: 5 },
      (_, index) =>
        createRoundSummaryFixture({
          roundNumber: index + 1,
          title: `Round ${index + 1}`,
          placements,
          awardIds: index === 0 ? ["last_car_rolling"] : [],
        }),
    );
    controller.syncMenu();

    expect(
      controller.menu.querySelector(".career-finale.player-champion"),
    ).not.toBeNull();
    expect(controller.menu.querySelectorAll(".standings-table tbody tr")).toHaveLength(
      8,
    );
    expect(controller.menu.querySelector(".champion-sparks")).not.toBeNull();
    expect(controller.menu.textContent).toContain("Last Car Rolling");
    document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyR" }));
    expect(controller.state.mode).toBe("menu");
  });

  it("renders a restrained field-champion finale", () => {
    const controller = createTestController();
    chooseStarterCar(controller.state, "bulldozer", 42);
    const orderedCars = [
      controller.state.cars[1],
      controller.state.cars[0],
      ...controller.state.cars.slice(2),
    ];
    const placements = orderedCars.map((car, index) => ({
      driverId: car.id,
      label: car.label,
      presetId: car.presetId,
      isPlayer: car.isPlayer,
      place: index + 1,
      points: PLACEMENT_POINTS[index],
    }));
    controller.state.mode = "career_over";
    controller.state.session.completedRounds = Array.from(
      { length: 5 },
      (_, index) =>
        createRoundSummaryFixture({
          roundNumber: index + 1,
          playerWon: false,
          winnerLabel: orderedCars[0].label,
          placements,
        }),
    );

    controller.syncMenu();

    expect(controller.menu.textContent).toContain("Rimshot");
    expect(controller.menu.textContent).toContain("You finished 2nd");
    expect(controller.menu.querySelector(".champion-sparks")).toBeNull();
  });

  it("shows spectating controls and skips through the live simulation", () => {
    const controller = createTestController();
    harness.appRoot.querySelector<HTMLButtonElement>("#start-btn")?.click();
    harness.appRoot
      .querySelector<HTMLButtonElement>('[data-preset-id="bulldozer"]')
      ?.click();
    controller.state.mode = "spectating";
    controller.state.cars[0].disabled = true;
    controller.state.cars[0].eliminationTime = controller.state.sessionElapsed;
    controller.state.cars.slice(2).forEach((car, index) => {
      car.disabled = true;
      car.eliminationTime = controller.state.sessionElapsed - index - 1;
    });
    controller.syncMenu();

    const skip = controller.menu.querySelector<HTMLButtonElement>("#skip-btn");
    expect(skip?.textContent).toContain("Skip to Results");
    skip?.click();
    expect(
      controller.menu.querySelector<HTMLButtonElement>("#skip-btn")?.disabled,
    ).toBe(true);

    harness.flushAnimationFrames();

    expect(controller.state.mode).toBe("round_results");
    expect(controller.state.session.lastRoundSummary?.placements).toHaveLength(8);
    const completedElapsed = controller.state.sessionElapsed;
    harness.advanceClock(1_000);
    harness.flushAnimationFrames(1_000);
    expect(controller.state.sessionElapsed).toBe(completedElapsed);
  });

  it("condition-ranks a still-live field after exactly 5,400 skip steps", () => {
    const record = vi.fn();
    const controller = createTestController({
      performanceCollector: {
        record,
        snapshot: () => ({
          capacity: 1_000,
          droppedSamples: 0,
          samples: [],
          longTasks: [],
          garbageCollections: [],
        }),
        destroy: vi.fn(),
      },
    });
    chooseStarterCar(controller.state, "bulldozer", 42);
    controller.state.mode = "spectating";
    const player = controller.state.cars[0];
    player.disabled = true;
    player.eliminationTime = controller.state.sessionElapsed;
    for (const car of controller.state.cars.slice(1)) {
      car.disabled = false;
      car.eliminationTime = null;
      car.bodyArmor = 1_000_000_000;
      car.frontArmor = 1_000_000_000;
      car.systems = {
        engine: 1,
        radiator: 100,
        transmission: 1,
        steering: 1,
        overheat: 0,
      };
    }
    controller.syncMenu();
    const startedElapsed = controller.state.sessionElapsed;

    controller.menu.querySelector<HTMLButtonElement>("#skip-btn")?.click();
    for (
      let callback = 0;
      callback < 100 && controller.state.mode === "spectating";
      callback += 1
    ) {
      harness.flushAnimationFrames();
    }

    const skipSamples = record.mock.calls
      .map((call) => call[0] as { phase: string; fixedSteps?: number })
      .filter((sample) => sample.phase === "skip");
    expect(controller.state.mode).toBe("round_results");
    expect(controller.state.sessionElapsed - startedElapsed).toBeCloseTo(90, 8);
    expect(
      skipSamples.reduce(
        (total, sample) => total + (sample.fixedSteps ?? 0),
        0,
      ),
    ).toBe(SPECTATOR_SKIP_MAX_STEPS);
    expect(
      skipSamples.every((sample) => (sample.fixedSteps ?? 0) <= 60),
    ).toBe(true);
  });
});

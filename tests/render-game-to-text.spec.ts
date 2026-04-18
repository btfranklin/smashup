import { describe, expect, it } from "vitest";

import { renderGameToText } from "../src/game/debug";
import { createCarPreviewState, createInitialState } from "../src/game/session";
import { getArenaObjects } from "../src/game/content";
import { createCarFixture, createRunningState, getPlayerFixture } from "./helpers/fixtures";
import {
  expectPreviewPayload,
  expectRunningPayload,
  parsePayload,
} from "./helpers/payload-assertions";

describe("renderGameToText", () => {
  it("renders preview payloads that echo the selected preview pair", () => {
    const state = createCarPreviewState("bulldozer", "front_heavy");
    const payload = parsePayload(renderGameToText(state));

    expectPreviewPayload(payload, {
      presetId: "bulldozer",
      scenario: "front_heavy",
    });
    expect(payload.car).toMatchObject({
      presetId: "bulldozer",
      disabled: false,
    });
  });

  it("renders running payloads with rounded numbers and truncated previews", () => {
    const state = createRunningState("darter");
    const player = getPlayerFixture(state);
    player.x = 123.456;
    player.y = 789.123;
    player.angle = Math.PI / 3;
    player.vx = 12.34;
    player.vy = -56.78;
    state.arena.objects = getArenaObjects("junkyard").concat(
      Array.from({ length: 4 }, (_, index) => ({
        id: 100 + index,
        kind: "junk" as const,
        x: 400 + index,
        y: 500 + index,
        vx: 0,
        vy: 0,
        radius: 10,
        mass: 50,
        rotation: 0,
        spin: 0,
      })),
    );
    state.smokePuffs = Array.from({ length: 8 }, (_, index) => ({
      id: index + 1,
      sourceCarId: player.id,
      x: 10.123 + index,
      y: 20.456 + index,
      vx: 0,
      vy: 0,
      age: 0.123 + index * 0.01,
      ttl: 1,
      size: 10,
      density: 0.5,
      flame: 0.4,
    }));
    state.debrisParticles = Array.from({ length: 10 }, (_, index) => ({
      id: index + 1,
      x: index,
      y: index,
      vx: 0,
      vy: 0,
      age: 0.1,
      ttl: 1,
      size: 4,
      rotation: 0,
      spin: 0,
      tone: 0.5,
    }));
    state.recentCollisions = [
      {
        aId: player.id,
        bId: state.cars[1].id,
        point: { x: 0, y: 0 },
        normal: { x: 1, y: 0 },
        severity: 0.876,
        damageSeverity: 0.543,
        zoneA: "front",
        zoneB: "rear",
      },
    ];

    const payload = parsePayload(renderGameToText(state));

    expectRunningPayload(payload);
    expect(payload.player).toMatchObject({
      x: 123.5,
      y: 789.1,
    });
    expect((payload.arena as { objects: unknown[] }).objects).toHaveLength(8);
    expect((payload.effects as { smokePreview: unknown[] }).smokePreview).toHaveLength(
      6,
    );
    expect(
      (payload.recentCollisions as Array<{ severity: number }>)[0].severity,
    ).toBe(0.88);
  });

  it("includes coherent session, car, and event fields in normal non-running states", () => {
    const state = createInitialState();
    state.mode = "tournament_over";
    state.session.playerBuild = {
      presetId: "bulldozer",
      reverseForceBonus: 0,
      forwardSpeedBonus: 0,
      steeringBonus: 0,
      frontArmorBonus: 0,
      coolingBonus: 0,
      repairsUsed: 0,
    };
    state.cars = [
      createCarFixture({ id: 1, isPlayer: true, label: "Player" }),
      createCarFixture({ id: 2, label: "Rimshot", disabled: true }),
    ];
    state.playerId = 1;
    state.events.push({
      id: 1,
      text: "Done",
      kind: "result",
      ttl: 1.234,
      emphasis: 1,
    });

    const payload = parsePayload(renderGameToText(state));

    expect(payload.mode).toBe("tournament_over");
    expect(payload.remainingDrivers).toBe(1);
    expect(payload.recentEvents).toEqual([
      { text: "Done", kind: "result", ttl: 1.23 },
    ]);
  });

  it("handles missing player and null round plan branches", () => {
    const state = createInitialState();
    state.mode = "menu";
    state.playerId = 999;
    state.session.roundPlan = null;
    state.cars = [createCarFixture({ id: 2, isPlayer: false, label: "Rival" })];

    const payload = parsePayload(renderGameToText(state));

    expect(payload.player).toBeNull();
    expect((payload.session as { modifierLabel: string | null }).modifierLabel).toBeNull();
    expect((payload.cars as Array<{ label: string }>)[0].label).toBe("Rival");
  });

  it("falls back to the first preview car when the preview player id is missing", () => {
    const state = createCarPreviewState("backstab", "disabled");
    state.playerId = 999;

    const payload = parsePayload(renderGameToText(state));

    expect((payload.car as { presetId: string }).presetId).toBe("backstab");
    expect((payload.car as { disabled: boolean }).disabled).toBe(true);
  });
});

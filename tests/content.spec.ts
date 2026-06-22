import { describe, expect, it } from "vitest";

import {
  AI_ARCHETYPE_CONFIG,
  AI_ARCHETYPE_LABELS,
  CAR_PRESETS,
  CAR_PRESET_IDS,
  CAR_PREVIEW_SCENARIOS,
  CAR_PREVIEW_SCENARIO_IDS,
  ROUND_PLANS,
  SESSION_UPGRADES,
  TOTAL_ROUNDS,
  getArenaMudZones,
  getArenaObjects,
  getModifierSummary,
  isCarPreviewScenarioId,
  isCarPresetId,
} from "../src/game/content";

describe("content contracts", () => {
  it("keeps preset and preview ids aligned with exported records", () => {
    expect(CAR_PRESET_IDS).toEqual(Object.keys(CAR_PRESETS));
    expect(CAR_PREVIEW_SCENARIO_IDS).toEqual(
      Object.keys(CAR_PREVIEW_SCENARIOS),
    );
    for (const [id, preset] of Object.entries(CAR_PRESETS)) {
      expect(preset.id).toBe(id);
    }
    expect(new Set(CAR_PRESET_IDS).size).toBe(CAR_PRESET_IDS.length);
    expect(new Set(CAR_PREVIEW_SCENARIO_IDS).size).toBe(
      CAR_PREVIEW_SCENARIO_IDS.length,
    );
  });

  it("recognizes valid ids and rejects invalid ones", () => {
    expect(isCarPresetId("bulldozer")).toBe(true);
    expect(isCarPresetId("not-a-preset")).toBe(false);
    expect(isCarPreviewScenarioId("critical")).toBe(true);
    expect(isCarPreviewScenarioId("unknown")).toBe(false);
  });

  it("keeps AI labels and tuning aligned", () => {
    expect(Object.keys(AI_ARCHETYPE_CONFIG)).toEqual(
      Object.keys(AI_ARCHETYPE_LABELS),
    );
    for (const config of Object.values(AI_ARCHETYPE_CONFIG)) {
      expect(config.targetBias).toBeGreaterThan(0);
      expect(config.reverseAggression).toBeGreaterThan(0);
    }
  });

  it("keeps round plans sequential and consistent with total rounds", () => {
    expect(ROUND_PLANS).toHaveLength(TOTAL_ROUNDS);
    ROUND_PLANS.forEach((roundPlan, index) => {
      expect(roundPlan.id).toBe(index + 1);
      expect(roundPlan.title.length).toBeGreaterThan(0);
      expect(roundPlan.introLine.length).toBeGreaterThan(0);
      expect(["Standard Derby", "Hot Engines", "Lights Out"]).toContain(
        getModifierSummary(roundPlan.modifier),
      );
    });
  });

  it("returns mud zones only for the mud pit arena", () => {
    expect(getArenaMudZones("classic")).toEqual([]);
    const mudZones = getArenaMudZones("mud_pit");
    expect(mudZones).toHaveLength(3);
    mudZones.forEach((zone, index) => {
      expect(zone.id).toBe(index + 1);
      expect(zone.width).toBeGreaterThan(0);
      expect(zone.height).toBeGreaterThan(0);
      expect(zone.grip).toBeLessThan(1);
    });
  });

  it("returns stationary junkyard objects with stable ids", () => {
    expect(getArenaObjects("classic")).toEqual([]);
    const objects = getArenaObjects("junkyard");
    expect(objects).toHaveLength(6);
    objects.forEach((object, index) => {
      expect(object.id).toBe(index + 1);
      expect(object.kind === "junk" || object.kind === "tire").toBe(true);
      expect(object.radius).toBeGreaterThan(0);
      expect(object.mass).toBeGreaterThan(0);
      expect(object.vx).toBe(0);
      expect(object.vy).toBe(0);
    });
  });

  it("keeps session upgrades aligned with their record keys", () => {
    expect(Object.keys(SESSION_UPGRADES)).toEqual([
      "pit_patch",
      "ram_rig",
      "steering_clinic",
    ]);
    Object.entries(SESSION_UPGRADES).forEach(([id, upgrade]) => {
      expect(upgrade.id).toBe(id);
      expect(upgrade.title.length).toBeGreaterThan(0);
      expect(upgrade.description.length).toBeGreaterThan(0);
    });
  });
});

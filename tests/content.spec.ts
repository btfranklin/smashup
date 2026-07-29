import { describe, expect, it } from "vitest";

import {
  AI_ARCHETYPE_CONFIG,
  AI_ARCHETYPE_LABELS,
  ARENA_DEFINITIONS,
  CAR_PRESETS,
  CAR_PREVIEW_SCENARIOS,
  ROUND_MODIFIER_DEFINITIONS,
  SESSION_UPGRADES,
  WRECK_AWARD_DEFINITIONS,
  getModifierSummary,
} from "../src/game/content";
import {
  AI_ARCHETYPE_IDS,
  ARENA_VARIANT_IDS,
  CAR_PRESET_IDS,
  CAR_PREVIEW_SCENARIO_IDS,
  ROUND_MODIFIER_IDS,
  SESSION_UPGRADE_IDS,
  WRECK_AWARD_IDS,
  isAIArchetype,
  isArenaVariantId,
  isCarPreviewScenarioId,
  isCarPresetId,
  isRoundModifierId,
  isSessionUpgradeId,
  isWreckAwardId,
} from "../src/game/contentIds";

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

  it.each([
    ["car preset", isCarPresetId, "backstab"],
    ["car preview scenario", isCarPreviewScenarioId, "disabled"],
    ["AI archetype", isAIArchetype, "panic_driver"],
    ["arena variant", isArenaVariantId, "junkyard"],
    ["round modifier", isRoundModifierId, "redline"],
    ["session upgrade", isSessionUpgradeId, "steering_clinic"],
    ["Wreck Award", isWreckAwardId, "finisher"],
  ] as const)("recognizes valid %s ids and rejects other values", (_, guard, valid) => {
    expect(guard(valid)).toBe(true);
    expect(guard("not-an-id")).toBe(false);
    expect(guard(null)).toBe(false);
  });

  it("keeps AI labels and tuning aligned", () => {
    expect(AI_ARCHETYPE_IDS).toEqual(Object.keys(AI_ARCHETYPE_CONFIG));
    expect(Object.keys(AI_ARCHETYPE_CONFIG)).toEqual(
      Object.keys(AI_ARCHETYPE_LABELS),
    );
    for (const config of Object.values(AI_ARCHETYPE_CONFIG)) {
      expect(config.targetBias).toBeGreaterThan(0);
      expect(config.reverseAggression).toBeGreaterThan(0);
    }
  });

  it("single-sources arena, modifier, and award display content", () => {
    expect(ARENA_VARIANT_IDS).toEqual(Object.keys(ARENA_DEFINITIONS));
    expect(ROUND_MODIFIER_IDS).toEqual(
      Object.keys(ROUND_MODIFIER_DEFINITIONS),
    );
    expect(WRECK_AWARD_IDS).toEqual(Object.keys(WRECK_AWARD_DEFINITIONS));
    Object.entries(ARENA_DEFINITIONS).forEach(([id, definition]) => {
      expect(definition.id).toBe(id);
      expect(definition.title.length).toBeGreaterThan(0);
      expect(definition.introLine.length).toBeGreaterThan(0);
    });
    Object.entries(ROUND_MODIFIER_DEFINITIONS).forEach(([id, definition]) => {
      expect(definition.id).toBe(id);
      expect(definition.title.length).toBeGreaterThan(0);
      expect(definition.introLine.length).toBeGreaterThan(0);
      expect(getModifierSummary(definition.id)).toBe(definition.title);
    });
    Object.entries(WRECK_AWARD_DEFINITIONS).forEach(([id, definition]) => {
      expect(definition.id).toBe(id);
      expect(["impact", "survival", "style"]).toContain(definition.category);
      expect(definition.title.length).toBeGreaterThan(0);
      expect(definition.description.length).toBeGreaterThan(0);
    });
    expect(getModifierSummary("redline")).toBe("Redline");
  });

  it("keeps session upgrades aligned with their record keys", () => {
    expect(SESSION_UPGRADE_IDS).toEqual(Object.keys(SESSION_UPGRADES));
    Object.entries(SESSION_UPGRADES).forEach(([id, upgrade]) => {
      expect(upgrade.id).toBe(id);
      expect(upgrade.title.length).toBeGreaterThan(0);
      expect(upgrade.description.length).toBeGreaterThan(0);
    });
  });
});

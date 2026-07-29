export const CAR_PRESET_IDS = [
  "bulldozer",
  "darter",
  "backstab",
] as const;

export type CarPresetId = (typeof CAR_PRESET_IDS)[number];

export function isCarPresetId(value: unknown): value is CarPresetId {
  return (
    typeof value === "string" && CAR_PRESET_IDS.some((id) => id === value)
  );
}

export const CAR_PREVIEW_SCENARIO_IDS = [
  "pristine",
  "front_light",
  "front_heavy",
  "left_heavy",
  "rear_heavy",
  "critical",
  "disabled",
] as const;

export type CarPreviewScenarioId =
  (typeof CAR_PREVIEW_SCENARIO_IDS)[number];

export function isCarPreviewScenarioId(
  value: unknown,
): value is CarPreviewScenarioId {
  return (
    typeof value === "string" &&
    CAR_PREVIEW_SCENARIO_IDS.some((id) => id === value)
  );
}

export const AI_ARCHETYPE_IDS = [
  "bruiser",
  "circler",
  "scavenger",
  "panic_driver",
] as const;

export type AIArchetype = (typeof AI_ARCHETYPE_IDS)[number];

export function isAIArchetype(value: unknown): value is AIArchetype {
  return (
    typeof value === "string" && AI_ARCHETYPE_IDS.some((id) => id === value)
  );
}

export const ARENA_VARIANT_IDS = ["classic", "mud_pit", "junkyard"] as const;

export type ArenaVariantId = (typeof ARENA_VARIANT_IDS)[number];

export function isArenaVariantId(value: unknown): value is ArenaVariantId {
  return (
    typeof value === "string" && ARENA_VARIANT_IDS.some((id) => id === value)
  );
}

export const ROUND_MODIFIER_IDS = [
  "none",
  "hot_engines",
  "lights_out",
  "redline",
] as const;

export type RoundModifierId = (typeof ROUND_MODIFIER_IDS)[number];

export function isRoundModifierId(value: unknown): value is RoundModifierId {
  return (
    typeof value === "string" && ROUND_MODIFIER_IDS.some((id) => id === value)
  );
}

export const SESSION_UPGRADE_IDS = [
  "pit_patch",
  "ram_rig",
  "steering_clinic",
] as const;

export type SessionUpgradeId = (typeof SESSION_UPGRADE_IDS)[number];

export function isSessionUpgradeId(value: unknown): value is SessionUpgradeId {
  return (
    typeof value === "string" && SESSION_UPGRADE_IDS.some((id) => id === value)
  );
}

export const WRECK_AWARD_IDS = [
  "sledgehammer",
  "big_swing",
  "running_on_fumes",
  "lead_with_your_chin",
  "last_car_rolling",
  "wrecking_crew",
  "double_trouble",
  "finisher",
] as const;

export type WreckAwardId = (typeof WRECK_AWARD_IDS)[number];

export function isWreckAwardId(value: unknown): value is WreckAwardId {
  return (
    typeof value === "string" && WRECK_AWARD_IDS.some((id) => id === value)
  );
}

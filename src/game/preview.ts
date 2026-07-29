import {
  CAR_PRESET_IDS,
  CAR_PREVIEW_SCENARIO_IDS,
  isCarPresetId,
  isCarPreviewScenarioId,
  type CarPresetId,
  type CarPreviewScenarioId,
} from "./contentIds";

export type CarPreviewRequest = {
  presetId: CarPresetId;
  scenario: CarPreviewScenarioId;
};

export function parseCarPreviewRequest(
  search: string,
): CarPreviewRequest | null {
  const params = new URLSearchParams(search);
  if (params.get("preview") !== "car") {
    return null;
  }

  const presetId = params.get("preset");
  if (!isCarPresetId(presetId)) {
    throw new Error(
      `Invalid car preview preset "${presetId ?? "(missing)"}". Valid presets: ${CAR_PRESET_IDS.join(", ")}.`,
    );
  }

  const scenario = params.get("scenario");
  if (!isCarPreviewScenarioId(scenario)) {
    throw new Error(
      `Invalid car preview scenario "${scenario ?? "(missing)"}". Valid scenarios: ${CAR_PREVIEW_SCENARIO_IDS.join(", ")}.`,
    );
  }

  return { presetId, scenario };
}

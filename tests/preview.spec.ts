import { describe, expect, it } from "vitest";

import {
  CAR_PRESET_IDS,
  CAR_PREVIEW_SCENARIO_IDS,
} from "../src/game/content";
import { parseCarPreviewRequest } from "../src/game/preview";

describe("preview parsing", () => {
  it("ignores non-preview searches", () => {
    expect(parseCarPreviewRequest("")).toBeNull();
    expect(parseCarPreviewRequest("?preview=other")).toBeNull();
  });

  it("parses every valid preset and scenario combination", () => {
    for (const presetId of CAR_PRESET_IDS) {
      for (const scenario of CAR_PREVIEW_SCENARIO_IDS) {
        expect(
          parseCarPreviewRequest(
            `?preview=car&preset=${presetId}&scenario=${scenario}`,
          ),
        ).toEqual({
          presetId,
          scenario,
        });
      }
    }
  });

  it("throws descriptive errors for missing parameters", () => {
    expect(() => parseCarPreviewRequest("?preview=car&scenario=pristine")).toThrow(
      new RegExp(
        `Invalid car preview preset "\\(missing\\)".*${CAR_PRESET_IDS.join(", ")}`,
      ),
    );
    expect(() => parseCarPreviewRequest("?preview=car&preset=bulldozer")).toThrow(
      new RegExp(
        `Invalid car preview scenario "\\(missing\\)".*${CAR_PREVIEW_SCENARIO_IDS.join(", ")}`,
      ),
    );
  });

  it("throws descriptive errors for invalid ids", () => {
    expect(() =>
      parseCarPreviewRequest("?preview=car&preset=invalid&scenario=pristine"),
    ).toThrow(/Valid presets: bulldozer, darter, backstab/);
    expect(() =>
      parseCarPreviewRequest("?preview=car&preset=bulldozer&scenario=bad"),
    ).toThrow(
      /Valid scenarios: pristine, front_light, front_heavy, left_heavy, rear_heavy, critical, disabled/,
    );
  });
});

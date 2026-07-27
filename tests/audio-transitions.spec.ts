import { describe, expect, it } from "vitest";

import { getRoundResultCue } from "../src/game/audioTransitions";

describe("audio transition helper", () => {
  it("ignores unrelated transitions", () => {
    expect(getRoundResultCue("menu", "round_results", false)).toBeNull();
    expect(getRoundResultCue("intro", "running", false)).toBeNull();
    expect(getRoundResultCue("round_results", "career_over", false)).toBeNull();
  });

  it("emits the correct mood when the round ends", () => {
    expect(getRoundResultCue("running", "round_results", false)).toBe("happy");
    expect(getRoundResultCue("running", "round_results", true)).toBe("sad");
    expect(getRoundResultCue("running", "spectating", true)).toBe("sad");
    expect(getRoundResultCue("spectating", "round_results", true)).toBeNull();
  });
});

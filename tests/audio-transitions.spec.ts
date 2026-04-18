import { expect, test } from "@playwright/test";

import { getRoundResultCue } from "../src/game/audioTransitions";

test("round-result cue only fires on running to round_results", () => {
  expect(getRoundResultCue("menu", "round_results", false)).toBeNull();
  expect(getRoundResultCue("intro", "running", false)).toBeNull();
  expect(getRoundResultCue("running", "round_results", false)).toBe("happy");
  expect(getRoundResultCue("running", "round_results", true)).toBe("sad");
  expect(
    getRoundResultCue("round_results", "tournament_over", false),
  ).toBeNull();
});

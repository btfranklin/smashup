import { describe, expect, it } from "vitest";

import { pushEvent } from "../src/game/events";
import { createStateFixture } from "./helpers/fixtures";

describe("event feed helpers", () => {
  it("pushes events with stable ids and caps the feed to recent messages", () => {
    const state = createStateFixture();

    pushEvent(state, "Opening bell", "countdown", 1, 3);
    expect(state.events[0]).toEqual({
      id: 1,
      text: "Opening bell",
      kind: "countdown",
      ttl: 3,
      emphasis: 1,
    });
    expect(state.nextEventId).toBe(2);

    for (let index = 0; index < 9; index += 1) {
      pushEvent(state, `impact-${index}`, "impact");
    }

    expect(state.events).toHaveLength(8);
    expect(state.events.map((event) => event.text)).toEqual([
      "impact-1",
      "impact-2",
      "impact-3",
      "impact-4",
      "impact-5",
      "impact-6",
      "impact-7",
      "impact-8",
    ]);
    expect(state.events.at(-1)).toMatchObject({
      id: 10,
      kind: "impact",
      emphasis: 0.6,
      ttl: 2.2,
    });
  });
});

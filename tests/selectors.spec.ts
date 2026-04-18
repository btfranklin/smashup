import { describe, expect, it } from "vitest";

import {
  getActiveCars,
  getCarById,
  getOutlastedDriverLabels,
  getPlayerCar,
  getWinnerCar,
} from "../src/game/selectors";
import { createCarFixture, createStateFixture } from "./helpers/fixtures";

describe("selectors", () => {
  it("looks up cars by id and tolerates null ids", () => {
    const player = createCarFixture({ id: 10, label: "Player", isPlayer: true });
    const rival = createCarFixture({ id: 11, label: "Rival" });
    const state = createStateFixture({
      cars: [player, rival],
      playerId: player.id,
      winnerId: rival.id,
    });

    expect(getCarById(state, player.id)).toBe(player);
    expect(getCarById(state, null)).toBeUndefined();
    expect(getPlayerCar(state)).toBe(player);
    expect(getWinnerCar(state)).toBe(rival);
  });

  it("filters active cars and renders outlasted labels", () => {
    const player = createCarFixture({ id: 1, label: "Player", isPlayer: true });
    const downed = createCarFixture({ id: 2, label: "Scrap", disabled: true });
    const survivor = createCarFixture({ id: 3, label: "Rimshot" });
    const state = createStateFixture({
      cars: [player, downed, survivor],
      playerId: player.id,
      outlastedDriverIds: [3, 999],
    });

    expect(getActiveCars(state)).toEqual([player, survivor]);
    expect(getOutlastedDriverLabels(state)).toEqual(["Rimshot", "Driver 999"]);
  });
});

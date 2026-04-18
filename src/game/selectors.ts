import type { Car, GameState } from "./types";

export function getCarById(
  state: GameState,
  id: number | null,
): Car | undefined {
  if (id === null) {
    return undefined;
  }
  return state.cars.find((car) => car.id === id);
}

export function getPlayerCar(state: GameState): Car | undefined {
  return getCarById(state, state.playerId);
}

export function getWinnerCar(state: GameState): Car | undefined {
  return getCarById(state, state.winnerId);
}

export function getActiveCars(state: GameState): Car[] {
  return state.cars.filter((car) => !car.disabled);
}

export function getOutlastedDriverLabels(state: GameState): string[] {
  return state.outlastedDriverIds.map(
    (id) => getCarById(state, id)?.label ?? `Driver ${id}`,
  );
}

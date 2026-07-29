import type {
  Car,
  CarCondition,
  GameState,
  Mode,
  PlayerBuild,
  RoundPlan,
} from "./types";

export const ACTIVE_CAREER_MODES = [
  "intro",
  "running",
  "spectating",
  "round_results",
  "upgrade",
  "career_over",
] as const satisfies readonly Mode[];

export type ActiveCareerMode = (typeof ACTIVE_CAREER_MODES)[number];

export function isActiveCareerMode(mode: Mode): mode is ActiveCareerMode {
  return ACTIVE_CAREER_MODES.some((activeMode) => activeMode === mode);
}

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

export function requirePlayerCar(state: GameState): Car {
  const player = getPlayerCar(state);
  if (!player) {
    throw new Error(`Mode "${state.mode}" requires a player car.`);
  }
  return player;
}

export function requireCurrentRoundPlan(state: GameState): RoundPlan {
  if (!state.currentRoundPlan) {
    throw new Error(`Mode "${state.mode}" requires an active Career Night round.`);
  }
  return state.currentRoundPlan;
}

export function requirePlayerBuild(state: GameState): PlayerBuild {
  const build = state.session.playerBuild;
  if (!build) {
    throw new Error(`Mode "${state.mode}" requires an active player build.`);
  }
  return build;
}

export function requirePlayerCondition(state: GameState): CarCondition {
  const condition = state.session.playerCondition;
  if (!condition) {
    throw new Error(`Mode "${state.mode}" requires an active player condition.`);
  }
  return condition;
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

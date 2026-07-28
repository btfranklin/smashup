import { describe, expect, it } from "vitest";

import { buildCareerStandings } from "../src/game/career";
import { WRECK_AWARD_DEFINITIONS } from "../src/game/content";
import { getKnockoutCause } from "../src/game/damage";
import { renderGameToText } from "../src/game/debug";
import {
  advanceState,
  finishSpectatingRound,
} from "../src/game/runtime";
import {
  advanceAfterRound,
  applySessionUpgrade,
  chooseStarterCar,
  createInitialState,
} from "../src/game/session";
import type {
  GameState,
  SessionUpgradeId,
} from "../src/game/types";

const EXPECTED_PLACEMENT_POINTS = [10, 8, 6, 5, 4, 3, 2, 1];

function expectCurrentRoundConsistency(state: GameState): void {
  const plan = state.session.roundPlans[state.session.roundIndex];
  expect(plan).toBeDefined();
  expect(state.currentRoundPlan).toEqual(plan);
  expect(state.arena.mudZones.length > 0).toBe(
    plan.arenaVariant === "mud_pit",
  );
  expect(state.arena.objects.length > 0).toBe(
    plan.arenaVariant === "junkyard",
  );
}

function completePlayerWin(state: GameState): void {
  state.mode = "running";
  state.session.countdown = 0;
  state.cars.forEach((car, index) => {
    car.disabled = !car.isPlayer;
    car.eliminationTime = car.isPlayer ? null : state.elapsed - index - 1;
  });
  advanceState(state, 1 / 60);
  expect(state.mode).toBe("round_results");
}

function completePlayerWreck(state: GameState): void {
  state.mode = "running";
  state.session.countdown = 0;
  const player = state.cars.find((car) => car.isPlayer);
  if (!player) {
    throw new Error("Lifecycle fixture player missing.");
  }
  player.systems = {
    engine: 0.04,
    radiator: 0.06,
    transmission: 0.08,
    steering: 0.1,
    overheat: 0.98,
  };
  player.body.front = 0.8;
  player.disabled = true;
  player.eliminationTime = state.elapsed;

  state.cars.slice(1).forEach((car, index) => {
    car.disabled = index >= 2;
    car.eliminationTime = car.disabled ? state.elapsed - index - 1 : null;
  });

  advanceState(state, 1 / 60);
  expect(state.mode).toBe("spectating");
  finishSpectatingRound(state);
  expect(state.mode).toBe("round_results");
}

function parseDebugSession(state: GameState): Record<string, unknown> {
  const payload = JSON.parse(renderGameToText(state)) as {
    session: Record<string, unknown>;
  };
  return payload.session;
}

describe("five-round Career Night lifecycle", () => {
  it("carries production summaries through scoring, debug output, and final standings", () => {
    const state = createInitialState();
    chooseStarterCar(state, "bulldozer", 42);
    const upgrades: SessionUpgradeId[] = [
      "pit_patch",
      "ram_rig",
      "steering_clinic",
      "ram_rig",
    ];

    expect(state.session.roundPlans).toHaveLength(5);
    expect(state.session.roundPlans[4].modifier).toBe("redline");

    for (let roundIndex = 0; roundIndex < 5; roundIndex += 1) {
      expectCurrentRoundConsistency(state);
      if (roundIndex === 1) {
        completePlayerWreck(state);
      } else {
        completePlayerWin(state);
      }

      const summary = state.session.lastRoundSummary;
      expect(summary).not.toBeNull();
      expect(state.session.completedRounds).toHaveLength(roundIndex + 1);
      expect(state.session.completedRounds.at(-1)).toBe(summary);
      expect(summary!.roundNumber).toBe(roundIndex + 1);
      expect(summary!.placements).toHaveLength(8);
      expect(
        new Set(summary!.placements.map((entry) => entry.driverId)).size,
      ).toBe(8);
      expect(summary!.placements.map((entry) => entry.points)).toEqual(
        EXPECTED_PLACEMENT_POINTS,
      );
      expect(
        summary!.placements.reduce((total, entry) => total + entry.points, 0),
      ).toBe(39);
      if (!summary!.playerWrecked) {
        expect(
          summary!.awardIds.some(
            (awardId) =>
              WRECK_AWARD_DEFINITIONS[awardId].category === "survival",
          ),
        ).toBe(true);
      }

      const debugSession = parseDebugSession(state);
      expect(debugSession.completedRounds).toHaveLength(roundIndex + 1);
      expect(debugSession.standings).toHaveLength(8);

      advanceAfterRound(state);
      if (roundIndex < 4) {
        expect(state.mode).toBe("upgrade");
        applySessionUpgrade(state, upgrades[roundIndex]);
        expect(state.mode).toBe("intro");
        expectCurrentRoundConsistency(state);
        expect(getKnockoutCause(state.cars[0])).toBeNull();
      }
    }

    expect(state.mode).toBe("career_over");
    expect(
      state.session.completedRounds.map((round) => round.roundNumber),
    ).toEqual([1, 2, 3, 4, 5]);

    const standings = buildCareerStandings(state.session.completedRounds);
    expect(standings).toHaveLength(8);
    expect(standings.map((standing) => standing.rank)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
    ]);
    expect(
      standings.reduce((total, standing) => total + standing.points, 0),
    ).toBe(195);
    expect(
      standings.every((standing) => standing.roundPlacements.length === 5),
    ).toBe(true);
    for (const standing of standings) {
      const driverRounds = state.session.completedRounds.map((round) => {
        const placement = round.placements.find(
          (entry) => entry.driverId === standing.driverId,
        );
        if (!placement) {
          throw new Error(
            `Lifecycle summary missing driver ${standing.driverId}.`,
          );
        }
        return placement;
      });
      expect(standing.points).toBe(
        driverRounds.reduce((total, placement) => total + placement.points, 0),
      );
      expect(standing.wins).toBe(
        driverRounds.filter((placement) => placement.place === 1).length,
      );
      expect(standing.podiums).toBe(
        driverRounds.filter((placement) => placement.place <= 3).length,
      );
      expect(standing.roundPlacements).toEqual(
        driverRounds.map((placement) => placement.place),
      );
    }

    const finalDebug = parseDebugSession(state);
    expect(finalDebug.completedRounds).toHaveLength(5);
    expect(finalDebug.standings).toEqual(standings);
  });
});

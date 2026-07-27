import { createAppController, type AppController } from "../../src/app/bootstrap";
import { PLACEMENT_POINTS } from "../../src/game/career";
import type { WreckAwardId } from "../../src/game/types";
import "../../src/style.css";

const appRoot = document.querySelector<HTMLDivElement>("#fixture-root");
if (!appRoot) {
  throw new Error("Controller fixture root missing.");
}

let controller: AppController | null = null;

function stageCareerFinale(playerChampion: boolean): void {
  if (!controller) {
    throw new Error("Create the controller before staging a finale.");
  }
  const cars = playerChampion
    ? [...controller.state.cars]
    : [
        controller.state.cars[1],
        controller.state.cars[0],
        ...controller.state.cars.slice(2),
      ];
  const placements = cars.map((car, index) => ({
    driverId: car.id,
    label: car.label,
    presetId: car.presetId,
    isPlayer: car.isPlayer,
    place: index + 1,
    points: PLACEMENT_POINTS[index],
  }));
  controller.state.session.completedRounds = Array.from(
    { length: 5 },
    (_, index) => ({
      roundIndex: index + 1,
      title: `Fixture Round ${index + 1}`,
      playerWon: playerChampion,
      winnerLabel: cars[0].label,
      survivalTime: 60 + index,
      eliminatedByLabel: playerChampion ? null : cars[0].label,
      playerKnockouts: index === 0 ? ["Rimshot", "Rustline"] : [],
      biggestHitLabel: "Player into Rimshot",
      biggestHitSeverity: 0.82,
      knockoutReason: playerChampion ? null : "Engine Failure",
      placements,
      awardIds:
        index === 0
          ? ([
              "sledgehammer",
              "last_car_rolling",
              "double_trouble",
            ] as WreckAwardId[])
          : (["last_car_rolling"] as WreckAwardId[]),
    }),
  );
  controller.state.mode = "career_over";
  controller.menu.dataset.mode = "";
  controller.syncMenu();
}

window.controllerFixture = {
  create() {
    if (controller) {
      throw new Error("Destroy the current controller before creating another.");
    }
    controller = createAppController({ appRoot });
  },
  async destroy() {
    await controller?.destroy();
    controller = null;
  },
  snapshot() {
    return {
      active: controller !== null,
      mode: controller?.state.mode ?? null,
      hooksInstalled:
        typeof window.advanceTime === "function" &&
        typeof window.render_game_to_text === "function",
    };
  },
  stageChampionStandings() {
    stageCareerFinale(true);
  },
  stageFieldStandings() {
    stageCareerFinale(false);
  },
  stageSpectating() {
    if (!controller) {
      throw new Error("Create the controller before staging spectating.");
    }
    controller.state.mode = "spectating";
    controller.state.cars[0].disabled = true;
    controller.state.cars[0].eliminationTime = controller.state.elapsed;
    controller.state.cars.slice(3).forEach((car, index) => {
      car.disabled = true;
      car.eliminationTime = controller!.state.elapsed - index - 1;
    });
    controller.syncMenu();
  },
};

declare global {
  interface Window {
    controllerFixture: {
      create: () => void;
      destroy: () => Promise<void>;
      snapshot: () => {
        active: boolean;
        mode: string | null;
        hooksInstalled: boolean;
      };
      stageChampionStandings: () => void;
      stageFieldStandings: () => void;
      stageSpectating: () => void;
    };
  }
}

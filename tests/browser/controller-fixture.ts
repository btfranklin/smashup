import {
  createAppController,
  type AppController,
  type AudioDriver,
} from "../../src/app/bootstrap";
import {
  createPerformanceCollector,
  type PerformanceCollector,
  type PerformanceSnapshot,
} from "../../src/app/performance";
import { PLACEMENT_POINTS } from "../../src/game/career";
import { chooseStarterCar } from "../../src/game/session";
import type { WreckAwardId } from "../../src/game/contentIds";
import "../../src/style.css";

const CHAMPION_AWARD_IDS: WreckAwardId[] = [
  "sledgehammer",
  "last_car_rolling",
  "double_trouble",
];
const SURVIVAL_AWARD_IDS: WreckAwardId[] = ["last_car_rolling"];

const appRoot = document.querySelector<HTMLDivElement>("#fixture-root");
if (!appRoot) {
  throw new Error("Controller fixture root missing.");
}

let controller: AppController | null = null;
let performanceCollector: PerformanceCollector | null = null;

function silentAudioDriver(): AudioDriver {
  return {
    prepare() {},
    async resume() {},
    update() {},
    async destroy() {},
    getVoiceCreationCount: () => 0,
  };
}

function requireController(): AppController {
  if (!controller) {
    throw new Error("Create the controller before staging a scene.");
  }
  return controller;
}

function stageRunningRound(seed: number): AppController {
  const activeController = requireController();
  chooseStarterCar(activeController.state, "bulldozer", seed);
  activeController.state.mode = "running";
  activeController.state.session.countdown = 0;
  activeController.syncMenu();
  return activeController;
}

function stageCareerFinale(playerChampion: boolean): void {
  const activeController = stageRunningRound(0xf1a1e);
  const cars = playerChampion
    ? [...activeController.state.cars]
    : [
        activeController.state.cars[1],
        activeController.state.cars[0],
        ...activeController.state.cars.slice(2),
      ];
  const placements = cars.map((car, index) => ({
    driverId: car.id,
    label: car.label,
    presetId: car.presetId,
    isPlayer: car.isPlayer,
    place: index + 1,
    points: PLACEMENT_POINTS[index],
  }));
  activeController.state.session.completedRounds = Array.from(
    { length: 5 },
    (_, index) => ({
      roundNumber: index + 1,
      title: `Fixture Round ${index + 1}`,
      playerWon: playerChampion,
      playerWrecked: !playerChampion,
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
          ? [...CHAMPION_AWARD_IDS]
          : [...SURVIVAL_AWARD_IDS],
    }),
  );
  activeController.state.mode = "career_over";
  activeController.menu.dataset.mode = "";
  activeController.syncMenu();
}

window.controllerFixture = {
  create(options = {}) {
    if (controller) {
      throw new Error("Destroy the current controller before creating another.");
    }
    performanceCollector = createPerformanceCollector({
      capacity: options.capacity ?? 5_000,
    });
    controller = createAppController({
      appRoot,
      performanceCollector,
      ...(options.audio === false
        ? { createAudio: silentAudioDriver }
        : {}),
      ...(options.manualFrames
        ? {
            requestAnimationFrame: () => 0,
            cancelAnimationFrame: () => undefined,
          }
        : {}),
    });
  },
  async destroy() {
    await controller?.destroy();
    controller = null;
  },
  performanceSnapshot(): PerformanceSnapshot {
    if (!performanceCollector) {
      throw new Error("Create the controller before reading performance data.");
    }
    return performanceCollector.snapshot();
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
    const activeController = stageRunningRound(0x5a17);
    activeController.state.mode = "spectating";
    activeController.state.cars[0].disabled = true;
    activeController.state.cars[0].eliminationTime =
      activeController.state.sessionElapsed;
    activeController.state.cars.slice(3).forEach((car, index) => {
      car.disabled = true;
      car.eliminationTime = activeController.state.sessionElapsed - index - 1;
    });
    activeController.syncMenu();
  },
  stageCleanRound() {
    stageRunningRound(0xc1ea0);
  },
  stageHeavyCollision() {
    const activeController = stageRunningRound(0xc0111de);
    const [player, rival, ...others] = activeController.state.cars;
    player.x = activeController.state.arena.width * 0.5 - 28;
    player.y = activeController.state.arena.height * 0.5;
    player.angle = 0;
    player.vx = 170;
    player.vy = 0;
    rival.x = activeController.state.arena.width * 0.5 + 28;
    rival.y = activeController.state.arena.height * 0.5;
    rival.angle = Math.PI;
    rival.vx = -170;
    rival.vy = 0;
    for (const [index, car] of others.entries()) {
      car.x = 180 + index * 170;
      car.y = index % 2 === 0 ? 150 : 750;
      car.vx = 0;
      car.vy = 0;
    }
  },
  stageDamagedRound() {
    const activeController = stageRunningRound(0xda6a6ed);
    for (const [carIndex, car] of activeController.state.cars.entries()) {
      car.body.front = 0.72;
      car.body.rear = 0.68;
      car.body.left = 0.7;
      car.body.right = 0.66;
      car.systems.engine = 0.64;
      car.systems.radiator = 0.58;
      car.systems.transmission = 0.62;
      car.systems.steering = 0.65;
      car.systems.overheat = 0.82;
      car.frame.scars = Array.from({ length: 16 }, (_, scarIndex) => ({
        id: scarIndex + 1,
        x: ((scarIndex % 4) - 1.5) * 14,
        y: (Math.floor(scarIndex / 4) - 1.5) * 9,
        angle: (scarIndex * Math.PI) / 8,
        length: 8 + (scarIndex % 5),
        depth: 0.45 + (scarIndex % 3) * 0.15,
        width: 1.5 + (scarIndex % 2),
      }));
      car.frame.nextScarId = 17;
      car.smokeTimer = carIndex * 0.01;
    }
    activeController.state.carFragments = Array.from(
      { length: 220 },
      (_, index) => ({
        id: index + 1,
        sourceCarId: index % 8,
        x: 80 + (index % 22) * 62,
        y: 80 + Math.floor(index / 22) * 72,
        vx: 0,
        vy: 0,
        radius: 4,
        mass: 34,
        rotation: index * 0.1,
        spin: 0,
        color: "#857d72",
        edgeColor: "#37312d",
        points: [
          { x: -4, y: -2 },
          { x: 4, y: -2 },
          { x: 0, y: 4 },
        ],
      }),
    );
    activeController.state.nextCarFragmentId = 221;
    activeController.present();
  },
};

declare global {
  interface Window {
    controllerFixture: {
      create: (options?: {
        audio?: boolean;
        capacity?: number;
        manualFrames?: boolean;
      }) => void;
      destroy: () => Promise<void>;
      performanceSnapshot: () => PerformanceSnapshot;
      snapshot: () => {
        active: boolean;
        mode: string | null;
        hooksInstalled: boolean;
      };
      stageChampionStandings: () => void;
      stageFieldStandings: () => void;
      stageSpectating: () => void;
      stageCleanRound: () => void;
      stageHeavyCollision: () => void;
      stageDamagedRound: () => void;
    };
  }
}

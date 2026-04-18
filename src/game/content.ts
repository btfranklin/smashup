import { createFreshCondition } from "./conditions";
import type {
  AIArchetype,
  ArenaObject,
  CarCondition,
  CarPreviewScenarioId,
  ArenaVariantId,
  CarPresetId,
  MudZone,
  PlayerBuild,
  RoundModifierId,
  RoundPlan,
  SessionUpgradeId,
} from "./types";

export const TOTAL_ROUNDS = 3;

export const CAR_PRESETS: Record<
  CarPresetId,
  {
    id: CarPresetId;
    title: string;
    subtitle: string;
    description: string;
    color: string;
    accent: string;
    width: number;
    length: number;
    mass: number;
    wheelbase: number;
    engineForce: number;
    reverseForce: number;
    brakeForce: number;
    forwardMaxSpeed: number;
    reverseMaxSpeed: number;
    steeringSharpness: number;
    bodyArmor: number;
    frontArmor: number;
    tractionBias: number;
    engineTone: number;
  }
> = {
  bulldozer: {
    id: "bulldozer",
    title: "Bulldozer",
    subtitle: "Heavy and steady",
    description:
      "Stable under pressure, tougher at the nose, slower to rotate.",
    color: "#235873",
    accent: "#59b7dd",
    width: 56,
    length: 92,
    mass: 1425,
    wheelbase: 61,
    engineForce: 126000,
    reverseForce: 149000,
    brakeForce: 47000,
    forwardMaxSpeed: 300,
    reverseMaxSpeed: 252,
    steeringSharpness: 0.88,
    bodyArmor: 1.16,
    frontArmor: 1.24,
    tractionBias: 1.08,
    engineTone: 0.92,
  },
  darter: {
    id: "darter",
    title: "Darter",
    subtitle: "Quick and twitchy",
    description: "Snaps into turns and reaches speed fast, but folds sooner.",
    color: "#7a3721",
    accent: "#ef9257",
    width: 49,
    length: 82,
    mass: 1120,
    wheelbase: 54,
    engineForce: 136000,
    reverseForce: 137000,
    brakeForce: 39000,
    forwardMaxSpeed: 344,
    reverseMaxSpeed: 268,
    steeringSharpness: 1.18,
    bodyArmor: 0.86,
    frontArmor: 0.82,
    tractionBias: 0.96,
    engineTone: 1.12,
  },
  backstab: {
    id: "backstab",
    title: "Backstab",
    subtitle: "Reverse-hit specialist",
    description: "Best reverse launch and rear attack speed, weaker up front.",
    color: "#4d6d27",
    accent: "#9ad04a",
    width: 52,
    length: 86,
    mass: 1240,
    wheelbase: 57,
    engineForce: 124000,
    reverseForce: 168000,
    brakeForce: 42000,
    forwardMaxSpeed: 312,
    reverseMaxSpeed: 292,
    steeringSharpness: 1.02,
    bodyArmor: 0.96,
    frontArmor: 0.9,
    tractionBias: 1,
    engineTone: 1.02,
  },
};

export const CAR_PRESET_IDS = Object.freeze(
  Object.keys(CAR_PRESETS) as CarPresetId[],
);

export function isCarPresetId(value: string | null): value is CarPresetId {
  return value !== null && CAR_PRESET_IDS.includes(value as CarPresetId);
}

export const AI_ARCHETYPE_LABELS: Record<AIArchetype, string> = {
  bruiser: "Bruiser",
  circler: "Circler",
  scavenger: "Scavenger",
  panic_driver: "Panic Driver",
};

export const AI_ARCHETYPE_CONFIG: Record<
  AIArchetype,
  {
    targetBias: number;
    exposureBias: number;
    woundedBias: number;
    crowdTolerance: number;
    packBias: number;
    wallEscapeBias: number;
    jamBias: number;
    reverseAggression: number;
  }
> = {
  bruiser: {
    targetBias: 1.18,
    exposureBias: 0.92,
    woundedBias: 0.9,
    crowdTolerance: 1.35,
    packBias: 0.72,
    wallEscapeBias: 0.95,
    jamBias: 0.82,
    reverseAggression: 1.18,
  },
  circler: {
    targetBias: 0.9,
    exposureBias: 1.18,
    woundedBias: 0.75,
    crowdTolerance: 0.72,
    packBias: 1.18,
    wallEscapeBias: 1,
    jamBias: 1.08,
    reverseAggression: 0.9,
  },
  scavenger: {
    targetBias: 1.04,
    exposureBias: 1,
    woundedBias: 1.34,
    crowdTolerance: 0.9,
    packBias: 0.9,
    wallEscapeBias: 1,
    jamBias: 1,
    reverseAggression: 1.06,
  },
  panic_driver: {
    targetBias: 0.82,
    exposureBias: 0.9,
    woundedBias: 0.64,
    crowdTolerance: 0.66,
    packBias: 1.22,
    wallEscapeBias: 1.28,
    jamBias: 1.42,
    reverseAggression: 0.86,
  },
};

export const ROUND_PLANS: RoundPlan[] = [
  {
    id: 1,
    title: "Dust Bowl",
    introLine: "Eight cars, fresh paint, and nowhere to hide.",
    arenaVariant: "classic",
    modifier: "none",
  },
  {
    id: 2,
    title: "Mud Pit",
    introLine: "The center is slick and the engines are already running hot.",
    arenaVariant: "mud_pit",
    modifier: "hot_engines",
  },
  {
    id: 3,
    title: "Junkyard Night",
    introLine:
      "Loose junk in the dirt and busted lights from the opening bell.",
    arenaVariant: "junkyard",
    modifier: "lights_out",
  },
];

export const SESSION_UPGRADES: Record<
  SessionUpgradeId,
  {
    id: SessionUpgradeId;
    title: string;
    description: string;
  }
> = {
  pit_patch: {
    id: "pit_patch",
    title: "Pit Patch",
    description:
      "Restore battered systems and pull some damage back out of the shell.",
  },
  ram_rig: {
    id: "ram_rig",
    title: "Ram Rig",
    description:
      "Tune the drivetrain for nastier reverse launches and better front bracing.",
  },
  steering_clinic: {
    id: "steering_clinic",
    title: "Steering Clinic",
    description:
      "Straighten the front end and sharpen turn-in for the next round.",
  },
};

export function createDefaultPlayerBuild(presetId: CarPresetId): PlayerBuild {
  return {
    presetId,
    reverseForceBonus: 0,
    forwardSpeedBonus: 0,
    steeringBonus: 0,
    frontArmorBonus: 0,
    coolingBonus: 0,
    repairsUsed: 0,
  };
}

export const CAR_PREVIEW_SCENARIOS: Record<
  CarPreviewScenarioId,
  {
    title: string;
    condition: CarCondition;
    disabled?: boolean;
    smoke?: {
      density: number;
      flame: number;
      count: number;
    } | null;
  }
> = {
  pristine: {
    title: "Pristine",
    condition: createFreshCondition(),
    smoke: null,
  },
  front_light: {
    title: "Front Light Damage",
    condition: {
      systems: {
        engine: 0.9,
        radiator: 0.92,
        transmission: 0.95,
        steering: 0.94,
        overheat: 0,
      },
      body: { front: 0.18, rear: 0, left: 0, right: 0 },
      lights: {
        frontLeft: true,
        frontRight: false,
        rearLeft: true,
        rearRight: true,
      },
    },
    smoke: null,
  },
  front_heavy: {
    title: "Front Heavy Damage",
    condition: {
      systems: {
        engine: 0.64,
        radiator: 0.58,
        transmission: 0.71,
        steering: 0.67,
        overheat: 0.08,
      },
      body: { front: 0.56, rear: 0.04, left: 0.08, right: 0.1 },
      lights: {
        frontLeft: false,
        frontRight: false,
        rearLeft: true,
        rearRight: true,
      },
    },
    smoke: { density: 0.52, flame: 0, count: 3 },
  },
  left_heavy: {
    title: "Left-Side Damage",
    condition: {
      systems: {
        engine: 0.84,
        radiator: 0.93,
        transmission: 0.88,
        steering: 0.61,
        overheat: 0,
      },
      body: { front: 0.04, rear: 0.06, left: 0.56, right: 0 },
      lights: {
        frontLeft: true,
        frontRight: true,
        rearLeft: false,
        rearRight: true,
      },
    },
    smoke: null,
  },
  rear_heavy: {
    title: "Rear Heavy Damage",
    condition: {
      systems: {
        engine: 0.93,
        radiator: 0.95,
        transmission: 0.82,
        steering: 0.9,
        overheat: 0,
      },
      body: { front: 0, rear: 0.58, left: 0.04, right: 0.08 },
      lights: {
        frontLeft: true,
        frontRight: true,
        rearLeft: false,
        rearRight: false,
      },
    },
    smoke: null,
  },
  critical: {
    title: "Critical",
    condition: {
      systems: {
        engine: 0.28,
        radiator: 0.24,
        transmission: 0.34,
        steering: 0.42,
        overheat: 0.82,
      },
      body: { front: 0.74, rear: 0.12, left: 0.22, right: 0.18 },
      lights: {
        frontLeft: false,
        frontRight: false,
        rearLeft: true,
        rearRight: false,
      },
    },
    smoke: { density: 1, flame: 1, count: 5 },
  },
  disabled: {
    title: "Disabled",
    condition: {
      systems: {
        engine: 0.08,
        radiator: 0.1,
        transmission: 0.12,
        steering: 0.16,
        overheat: 1,
      },
      body: { front: 0.84, rear: 0.36, left: 0.28, right: 0.32 },
      lights: {
        frontLeft: false,
        frontRight: false,
        rearLeft: false,
        rearRight: false,
      },
    },
    disabled: true,
    smoke: null,
  },
};

export const CAR_PREVIEW_SCENARIO_IDS = Object.freeze(
  Object.keys(CAR_PREVIEW_SCENARIOS) as CarPreviewScenarioId[],
);

export function isCarPreviewScenarioId(
  value: string | null,
): value is CarPreviewScenarioId {
  return (
    value !== null &&
    CAR_PREVIEW_SCENARIO_IDS.includes(value as CarPreviewScenarioId)
  );
}

export function getArenaMudZones(variant: ArenaVariantId): MudZone[] {
  if (variant !== "mud_pit") {
    return [];
  }
  return [
    { id: 1, x: 420, y: 250, width: 320, height: 180, grip: 0.68 },
    { id: 2, x: 760, y: 420, width: 280, height: 210, grip: 0.62 },
    { id: 3, x: 1040, y: 180, width: 240, height: 160, grip: 0.7 },
  ];
}

export function getArenaObjects(variant: ArenaVariantId): ArenaObject[] {
  if (variant !== "junkyard") {
    return [];
  }

  const items: Array<
    Omit<ArenaObject, "id" | "vx" | "vy" | "rotation" | "spin">
  > = [
    { kind: "junk", x: 560, y: 250, radius: 26, mass: 240 },
    { kind: "tire", x: 720, y: 210, radius: 18, mass: 90 },
    { kind: "junk", x: 900, y: 430, radius: 28, mass: 260 },
    { kind: "tire", x: 1080, y: 620, radius: 18, mass: 90 },
    { kind: "junk", x: 470, y: 610, radius: 24, mass: 220 },
    { kind: "tire", x: 1240, y: 330, radius: 18, mass: 90 },
  ];

  return items.map((item, index) => ({
    id: index + 1,
    ...item,
    vx: 0,
    vy: 0,
    rotation: 0,
    spin: 0,
  }));
}

export function getModifierSummary(modifier: RoundModifierId): string {
  switch (modifier) {
    case "hot_engines":
      return "Hot Engines";
    case "lights_out":
      return "Lights Out";
    default:
      return "Standard Derby";
  }
}

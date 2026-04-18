export type Mode =
  | "menu"
  | "car_select"
  | "car_preview"
  | "intro"
  | "running"
  | "round_results"
  | "upgrade"
  | "tournament_over";

export type Vec2 = {
  x: number;
  y: number;
};

export type DriveControls = {
  steer: number;
  forward: number;
  reverse: number;
};

export type DamageZone = "front" | "rear" | "left" | "right";

export type DamagePhase = "healthy" | "wounded" | "failing" | "critical";

export type SystemName = "engine" | "radiator" | "transmission" | "steering";

export type CarPresetId = "bulldozer" | "darter" | "backstab";

export type CarPreviewScenarioId =
  | "pristine"
  | "front_light"
  | "front_heavy"
  | "left_heavy"
  | "rear_heavy"
  | "critical"
  | "disabled";

export type AIArchetype = "bruiser" | "circler" | "scavenger" | "panic_driver";

export type ArenaVariantId = "classic" | "mud_pit" | "junkyard";

export type RoundModifierId = "none" | "hot_engines" | "lights_out";

export type SessionUpgradeId = "pit_patch" | "ram_rig" | "steering_clinic";

export type LightState = {
  frontLeft: boolean;
  frontRight: boolean;
  rearLeft: boolean;
  rearRight: boolean;
};

export type SystemsState = {
  engine: number;
  radiator: number;
  transmission: number;
  steering: number;
  overheat: number;
};

export type SystemPhaseState = {
  engine: DamagePhase;
  radiator: DamagePhase;
  transmission: DamagePhase;
  steering: DamagePhase;
};

export type BodyState = {
  front: number;
  rear: number;
  left: number;
  right: number;
};

export type CollisionEvent = {
  aId: number;
  bId: number;
  point: Vec2;
  normal: Vec2;
  severity: number;
  damageSeverity: number;
  zoneA: DamageZone;
  zoneB: DamageZone;
};

export type SmokePuff = {
  id: number;
  sourceCarId: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  ttl: number;
  size: number;
  density: number;
  flame: number;
};

export type DebrisParticle = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  ttl: number;
  size: number;
  rotation: number;
  spin: number;
  tone: number;
};

export type DustPuff = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  ttl: number;
  size: number;
  alpha: number;
  tone: number;
};

export type MudZone = {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  grip: number;
};

export type ArenaObject = {
  id: number;
  kind: "tire" | "junk";
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  mass: number;
  rotation: number;
  spin: number;
};

export type EventMessage = {
  id: number;
  text: string;
  kind: "impact" | "warning" | "system" | "countdown" | "result";
  ttl: number;
  emphasis: number;
};

export type CameraState = {
  shake: number;
  nudgeX: number;
  nudgeY: number;
  freezeTime: number;
};

export type PlayerBuild = {
  presetId: CarPresetId;
  reverseForceBonus: number;
  forwardSpeedBonus: number;
  steeringBonus: number;
  frontArmorBonus: number;
  coolingBonus: number;
  repairsUsed: number;
};

export type CarCondition = {
  systems: SystemsState;
  body: BodyState;
  lights: LightState;
};

export type RoundPlan = {
  id: number;
  title: string;
  introLine: string;
  arenaVariant: ArenaVariantId;
  modifier: RoundModifierId;
};

export type RoundSummary = {
  roundIndex: number;
  title: string;
  playerWon: boolean;
  winnerLabel: string | null;
  survivalTime: number;
  eliminatedByLabel: string | null;
  playerKnockouts: string[];
  biggestHitLabel: string | null;
  biggestHitSeverity: number;
  knockoutReason: string | null;
};

export type SessionState = {
  totalRounds: number;
  roundIndex: number;
  roundPlan: RoundPlan | null;
  playerBuild: PlayerBuild | null;
  playerCondition: CarCondition | null;
  pendingUpgradeChoices: SessionUpgradeId[];
  completedRounds: RoundSummary[];
  lastRoundSummary: RoundSummary | null;
  countdown: number;
};

export type Car = {
  id: number;
  label: string;
  isPlayer: boolean;
  team: "left" | "right";
  color: string;
  accent: string;
  roofNumber: string;
  presetId: CarPresetId;
  aiArchetype: AIArchetype | null;
  x: number;
  y: number;
  angle: number;
  vx: number;
  vy: number;
  angularVelocity: number;
  width: number;
  length: number;
  mass: number;
  controls: DriveControls;
  driveInput: number;
  steerAngle: number;
  steerAngleTarget: number;
  wheelbase: number;
  engineForce: number;
  brakeForce: number;
  reverseForce: number;
  forwardMaxSpeed: number;
  reverseMaxSpeed: number;
  steeringSharpness: number;
  bodyArmor: number;
  frontArmor: number;
  tractionBias: number;
  engineTone: number;
  systems: SystemsState;
  phases: SystemPhaseState;
  body: BodyState;
  lights: LightState;
  disabled: boolean;
  eliminationTime: number | null;
  slipAmount: number;
  aiState: {
    targetId: number | null;
    jamTimer: number;
    resetTimer: number;
  };
  smokeTimer: number;
  smokeBurstCount: number;
};

export type GameState = {
  mode: Mode;
  arena: {
    width: number;
    height: number;
    wallPadding: number;
    variant: ArenaVariantId;
    modifier: RoundModifierId;
    title: string;
    introLine: string;
    mudZones: MudZone[];
    objects: ArenaObject[];
  };
  preview:
    | null
    | {
        kind: "car";
        presetId: CarPresetId;
        scenario: CarPreviewScenarioId;
      };
  session: SessionState;
  cars: Car[];
  playerId: number;
  tick: number;
  elapsed: number;
  winnerId: number | null;
  outlastedDriverIds: number[];
  recentCollisions: CollisionEvent[];
  smokePuffs: SmokePuff[];
  nextSmokePuffId: number;
  debrisParticles: DebrisParticle[];
  nextDebrisParticleId: number;
  dustPuffs: DustPuff[];
  nextDustPuffId: number;
  events: EventMessage[];
  nextEventId: number;
  camera: CameraState;
  pendingSystemEvents: Array<{
    carId: number;
    system: SystemName;
    phase: DamagePhase;
  }>;
  roundStats: {
    startElapsed: number;
    biggestHitSeverity: number;
    biggestHitLabel: string | null;
    eliminatedById: number | null;
    knockoutReason: string | null;
    playerKnockouts: string[];
    lastPlayerTargetId: number | null;
    finalTwoAnnounced: boolean;
  };
};

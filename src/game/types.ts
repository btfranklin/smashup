import type {
  AIArchetype,
  ArenaVariantId,
  CarPresetId,
  CarPreviewScenarioId,
  RoundModifierId,
  SessionUpgradeId,
  WreckAwardId,
} from "./contentIds";

export type Mode =
  | "menu"
  | "car_select"
  | "car_preview"
  | "intro"
  | "running"
  | "spectating"
  | "round_results"
  | "upgrade"
  | "career_over";

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

export type WreckAwardCategory = "impact" | "survival" | "style";

export type WreckAwardDefinition = {
  id: WreckAwardId;
  category: WreckAwardCategory;
  title: string;
  description: string;
};

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

export type FrameVertex = {
  id: string;
  baseX: number;
  baseY: number;
  x: number;
  y: number;
  stiffness: number;
};

export type CrumpleScar = {
  id: number;
  x: number;
  y: number;
  angle: number;
  length: number;
  depth: number;
  width: number;
};

export type CarFrameState = {
  vertices: FrameVertex[];
  scars: CrumpleScar[];
  crush: BodyState;
  nextScarId: number;
};

export type CollisionEvent = {
  aId: number;
  bId: number;
  aActiveAtImpact: boolean;
  bActiveAtImpact: boolean;
  aDisabledByImpact: boolean;
  bDisabledByImpact: boolean;
  point: Vec2;
  pointA: Vec2;
  pointB: Vec2;
  normal: Vec2;
  severity: number;
  damageSeverity: number;
  damageTakenA: number;
  damageTakenB: number;
  zoneA: DamageZone;
  zoneB: DamageZone;
  deformationA: number;
  deformationB: number;
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

export type CarFragment = {
  id: number;
  sourceCarId: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  mass: number;
  rotation: number;
  spin: number;
  color: string;
  edgeColor: string;
  points: Vec2[];
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

export type ArenaGeometry = {
  width: number;
  height: number;
  wallPadding: number;
};

export type ArenaState = ArenaGeometry & {
  mudZones: MudZone[];
  objects: ArenaObject[];
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
  frame?: CarFrameState | null;
};

export type RoundPlan = {
  id: number;
  title: string;
  introLine: string;
  arenaVariant: ArenaVariantId;
  modifier: RoundModifierId;
};

export type RoundPlacement = {
  driverId: number;
  label: string;
  presetId: CarPresetId;
  isPlayer: boolean;
  place: number;
  points: number;
};

export type CareerStanding = {
  driverId: number;
  label: string;
  presetId: CarPresetId;
  isPlayer: boolean;
  rank: number;
  points: number;
  wins: number;
  podiums: number;
  roundPlacements: number[];
};

export type RoundSummary = {
  roundNumber: number;
  title: string;
  playerWon: boolean;
  playerWrecked: boolean;
  winnerLabel: string | null;
  survivalTime: number;
  eliminatedByLabel: string | null;
  playerKnockouts: string[];
  biggestHitLabel: string | null;
  biggestHitSeverity: number;
  knockoutReason: string | null;
  placements: RoundPlacement[];
  awardIds: WreckAwardId[];
};

export type SessionState = {
  roundIndex: number;
  runSeed: number | null;
  roundPlans: RoundPlan[];
  playerBuild: PlayerBuild | null;
  playerCondition: CarCondition | null;
  completedRounds: RoundSummary[];
  lastRoundSummary: RoundSummary | null;
  countdown: number;
};

export type RoundStats = {
  startElapsed: number;
  biggestHitSeverity: number;
  biggestHitLabel: string | null;
  eliminatedById: number | null;
  playerKnockouts: string[];
  strongestPlayerHitSeverity: number;
  playerContactLedger: Record<
    number,
    {
      elapsed: number;
      severity: number;
    }
  >;
  strongestPlayerKnockoutSeverity: number;
  finalTwoAnnounced: boolean;
  lastPlayerSystemPhases: SystemPhaseState | null;
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
  body: BodyState;
  frame: CarFrameState;
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
  currentRoundPlan: RoundPlan | null;
  arena: ArenaState;
  preview: null | {
    kind: "car";
    presetId: CarPresetId;
    scenario: CarPreviewScenarioId;
  };
  session: SessionState;
  cars: Car[];
  playerId: number;
  roundTick: number;
  sessionElapsed: number;
  winnerId: number | null;
  outlastedDriverIds: number[];
  recentCollisions: CollisionEvent[];
  smokePuffs: SmokePuff[];
  nextSmokePuffId: number;
  debrisParticles: DebrisParticle[];
  nextDebrisParticleId: number;
  carFragments: CarFragment[];
  nextCarFragmentId: number;
  dustPuffs: DustPuff[];
  nextDustPuffId: number;
  events: EventMessage[];
  nextEventId: number;
  camera: CameraState;
  roundStats: RoundStats;
};

export type Mode = "menu" | "running" | "finished";

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

export type Car = {
  id: number;
  label: string;
  isPlayer: boolean;
  team: "left" | "right";
  color: string;
  accent: string;
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
  steerAngle: number;
  steerAngleTarget: number;
  wheelbase: number;
  engineForce: number;
  brakeForce: number;
  reverseForce: number;
  forwardMaxSpeed: number;
  reverseMaxSpeed: number;
  systems: SystemsState;
  body: BodyState;
  lights: LightState;
  disabled: boolean;
  eliminationTime: number | null;
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
  };
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
};

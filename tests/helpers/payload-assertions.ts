import { expect } from "vitest";

export function parsePayload(raw: string) {
  return JSON.parse(raw) as Record<string, unknown>;
}

export function expectPreviewPayload(
  payload: Record<string, unknown>,
  expected: { presetId: string; scenario: string },
) {
  expect(payload.mode).toBe("car_preview");
  expect(payload.preview).toEqual({
    kind: "car",
    presetId: expected.presetId,
    scenario: expected.scenario,
  });
  expect(payload.arena).toMatchObject({
    width: expect.any(Number),
    height: expect.any(Number),
  });
}

export function expectRunningPayload(payload: Record<string, unknown>) {
  expect(payload.mode).toBe("running");
  expect(payload.session).toMatchObject({
    roundNumber: expect.any(Number),
    selectedPreset: expect.any(String),
  });
  expect(payload.player).toMatchObject({
    id: expect.any(Number),
    presetId: expect.any(String),
    x: expect.any(Number),
    y: expect.any(Number),
  });
  expect(payload.effects).toMatchObject({
    smokePuffs: expect.any(Number),
    debrisParticles: expect.any(Number),
    dustPuffs: expect.any(Number),
  });
}

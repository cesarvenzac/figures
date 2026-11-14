import { describe, expect, it } from "vitest";

import { DEFAULT_FIGURE, FACES, LOOKS, SHAPES } from "./figure.ts";
import { REST } from "./figure-motion.ts";
import { posed } from "./figure-pose.ts";
import { DRAINED, eyeFrame, puffsOf, sceneFor, type SceneInput } from "./figure-scene.ts";
import { apply, bodyTurn, BOTTOM, CAMERA, CUBELET_GAP, dot, FLOOR, HOVER, type Mat3, PUFFS, type Vec3 } from "./figure-space.ts";

const input = (overrides: Partial<SceneInput> = {}): SceneInput => ({
  figure: DEFAULT_FIGURE,
  face: { ...FACES.neutral },
  glyph: "rect",
  glyphTo: "rect",
  glyphMix: 0,
  open: 1,
  pose: { ...REST },
  baseYaw: 0,
  eyeYaw: 0,
  trailing: null,
  look: LOOKS.neutral,
  flow: 0,
  hue: 0,
  arcAngle: 0,
  rings: 0,
  time: 0,
  swell: 1,
  palette: { a: [0.5, 0.5, 0.5], b: [0.3, 0.3, 0.3], d: [0, 0.33, 0.67] },
  split: 0,
  cells: null,
  turning: null,
  ink: [0.01, 0.01, 0.01],
  ...overrides,
});

/** Toward the camera, from the middle. */
const camera: Vec3 = [0, Math.sin(CAMERA.pitch), Math.cos(CAMERA.pitch)];
const worldForward = (scene: ReturnType<typeof sceneFor>) => apply(Array.from(scene.body.rotation) as Mat3, Array.from(scene.eyes.forward) as Vec3);

describe("a figure's scene", () => {
  it("stands every shape on the ground (a cloud floats over it), its eyes toward the camera", () => {
    for (const shape of SHAPES) {
      const scene = sceneFor(input({ figure: { ...DEFAULT_FIGURE, shape } }));
      expect(scene.bottom, shape).toBeCloseTo(FLOOR + HOVER[shape], 5);
      expect(dot(worldForward(scene), camera), shape).toBeGreaterThan(0.75);
      for (const value of [...scene.body.rotation, ...scene.body.position, ...scene.body.scale, ...scene.eyes.origin]) expect(Number.isFinite(value)).toBe(true);
    }
  });

  it("lifts it off the ground for a hop, and squashes it as it lands, keeping its feet down", () => {
    const up = sceneFor(input({ pose: { ...REST, lift: 0.3 } }));
    expect(up.bottom).toBeCloseTo(FLOOR + 0.3, 5);
    const squashed = sceneFor(input({ pose: { ...REST, squash: 0.85 } }));
    expect(squashed.body.scale[1]).toBeCloseTo(0.85);
    expect(squashed.body.scale[0]).toBeGreaterThan(1);
    expect(squashed.bottom).toBeCloseTo(FLOOR, 5);
  });

  it("keeps the eyes facing out after a turn has brought another face round", () => {
    const turned = sceneFor(input({ figure: { ...DEFAULT_FIGURE, shape: "cube" }, baseYaw: 90, eyeYaw: 90 }));
    expect(dot(worldForward(turned), camera)).toBeGreaterThan(0.75);
    // Before the eyes move over, they're on the face turning away.
    const halfway = sceneFor(input({ figure: { ...DEFAULT_FIGURE, shape: "cube" }, baseYaw: 90, eyeYaw: 0 }));
    expect(dot(worldForward(halfway), camera)).toBeLessThan(0.4);
  });

  it("lets a sphere's eyes trail its turn, and catch up", () => {
    const sphere = { ...DEFAULT_FIGURE, shape: "sphere" as const };
    const body = bodyTurn(60, 0, 0);
    const caught = eyeFrame({ figure: sphere, pose: REST, eyeYaw: 0, trailing: { yaw: 60, pitch: 0, roll: 0 }, split: 0 }, body);
    const rest = eyeFrame({ figure: sphere, pose: REST, eyeYaw: 0, trailing: null, split: 0 }, body);
    caught.forward.forEach((value, i) => expect(value).toBeCloseTo(rest.forward[i], 5));
    const behind = eyeFrame({ figure: sphere, pose: REST, eyeYaw: 0, trailing: { yaw: 20, pitch: 0, roll: 0 }, split: 0 }, body);
    // Still at 20° while the body is at 60°: in the body, the eyes sit 40° back.
    expect(behind.forward[0]).toBeLessThan(-0.5);
  });

  it("spreads the cube's eyes onto its cubelets as it splits, and carries the eyes to a star's face as it morphs", () => {
    const split = sceneFor(input({ figure: { ...DEFAULT_FIGURE, shape: "cube" }, split: 1 }));
    expect(split.eyes.gap).toBeCloseTo(CUBELET_GAP);
    const star = sceneFor(input({ figure: { ...DEFAULT_FIGURE, shape: "sphere" }, pose: { ...REST, morphTo: "star", morph: 1 } }));
    expect(star.eyes.origin[2]).toBeCloseTo(0.27, 2);
    expect(star.morphTo).toBe(2);
    // Other shapes don't split.
    expect(sceneFor(input({ split: 1 })).split).toBe(0);
  });

  it("passes each shape's own parts to the shader, and only that shape's", () => {
    const cube = { ...DEFAULT_FIGURE, shape: "cube" as const };
    const block = { ...DEFAULT_FIGURE, shape: "block" as const };
    const turning = posed({ split: 1, layers: { axis: 0, angles: [1, 0, -1] } });
    expect(Array.from(sceneFor(input({ figure: block, pose: turning })).layers)).toEqual([0, 1, 0, -1]);
    // The thinking cube's own turn wins over a pose's.
    expect(Array.from(sceneFor(input({ figure: cube, pose: turning, split: 1, turning: { axis: 1, layer: 1, angle: 0.5 } })).layers)).toEqual([1, 0, 0, 0.5]);
    // A sphere has no layers, a cube no capstone.
    expect(sceneFor(input({ pose: turning })).layers[0]).toBe(-1);
    expect(Array.from(sceneFor(input({ figure: cube, pose: posed({ pieces: [0.1, 0.2, 0.3, 0.4] }) })).pieces)).toEqual([0, 0, 0, 0]);
    // Beads and bits, as many as there are.
    const moons = sceneFor(input({ pose: posed({ beads: [[1, 0, 0, 0.1], [0, 1, 0, 0.1]], bits: [{ kind: "z", x: 0.2, y: 0.4, size: 0.1, alpha: 0.5 }] }) }));
    expect(moons.beadCount).toBe(2);
    expect(Array.from(moons.beads.slice(0, 4))).toEqual([1, 0, 0, expect.closeTo(0.1)]);
    expect(moons.bitKinds[0]).toBe(3);
    expect(moons.bits[3]).toBeCloseTo(0.5);
  });

  it("puts the cloud's puffs where its pose moves them, its eyes riding the face puff", () => {
    const cloud = { ...DEFAULT_FIGURE, shape: "cloud" as const };
    const still = sceneFor(input({ figure: cloud }));
    expect(Array.from(still.puffs.slice(0, 4)).map((value) => Number(value.toFixed(4)))).toEqual([...PUFFS[0]]);
    const bounced = posed({ puffs: PUFFS.map((_, i) => [0, i === 0 ? 0.1 : 0, 0, 1] as [number, number, number, number]) });
    expect(puffsOf(bounced)[0][1]).toBeCloseTo(PUFFS[0][1] + 0.1);
    expect(sceneFor(input({ figure: cloud, pose: bounced })).eyes.origin[1]).toBeCloseTo(still.eyes.origin[1] + 0.1, 4);
    // Its rainbow and lightning are its own.
    expect(Array.from(sceneFor(input({ figure: cloud, pose: posed({ rainbow: 1, rainbowSweep: 0.5 }) })).rainbow)).toEqual([0.5, 1]);
    expect(Array.from(sceneFor(input({ pose: posed({ rainbow: 1, rainbowSweep: 0.5 }) })).rainbow)).toEqual([0, 0]);
  });

  it("keeps a shrunk sphere on the ground, and greys a figure as its budget runs out or a failure drains it", () => {
    const shrunk = sceneFor(input({ pose: posed({ core: 0.5 }) }));
    expect(shrunk.bottom).toBeCloseTo(FLOOR, 5);
    expect(shrunk.body.position[1]).toBeCloseTo(FLOOR - BOTTOM.sphere * 0.5, 5);
    expect(shrunk.core).toBe(0.5);
    expect(sceneFor(input({ drain: 1 })).aura.saturation).toBeCloseTo(LOOKS.neutral.saturation * DRAINED);
    const drained = sceneFor(input({ pose: posed({ dim: 0.5 }) })).aura;
    expect(drained.saturation).toBeCloseTo(LOOKS.neutral.saturation * 0.5);
    expect(drained.energy).toBeLessThan(LOOKS.neutral.energy);
  });

  it("lets a move's glyph take over the eyes while it lasts, and shuts them for its own blink", () => {
    const starry = sceneFor(input({ pose: { ...REST, glyph: "star", glyphMix: 0.7 } }));
    expect(starry.eyes.glyphTo).toBe(3);
    expect(starry.eyes.glyphMix).toBeCloseTo(0.7);
    expect(sceneFor(input({ pose: { ...REST, shut: 1 } })).eyes.open).toBeLessThan(0.1);
  });
});

import type { Glyph } from "./figure.ts";
import { type Ball, type BitKind, type Morph, MOST } from "./figure-space.ts";

/**
 * A figure's pose: what's added to how it holds itself at rest, at one moment of a move or a loop
 * (figure-motion.ts, figure-acts.ts). The body's: turns in degrees (toward the picture's
 * right, tipped up, leaning right), a lift off the ground and a slide sideways in world units (the
 * figure's box is 2 wide), a squash (its height's share; its width keeps the volume), a pulse (all
 * of it), a morph into another shape, the eyes become another shape for a moment, a blink of its
 * own, the eyes' size and the colour's strength. Then each shape's own parts: the cube's cubelets
 * and the block's dials parting and turning, the cube's cubelets flying apart, the pyramid's
 * slabs sliding and its capstone lifting and spinning, the pyramid leaning like jelly, the sphere
 * swelling and shrinking, with moons and droplets beside it (or a cloud's raindrops), the cloud's
 * puffs moving, a ripple, a dent or wrinkles on the surface, the colour rolling round, bits in front
 * (hearts, stars, z's, sparks), the cloud's rainbow and its lightning. Pure data.
 */

/** Layers turning about one axis: how far each of the three (−1, 0, 1) has turned, in radians. */
export type Layers = { axis: 0 | 1 | 2; angles: [number, number, number] };

/** A bit drawn in front of the figure: where in the picture (world units from its middle), how big, how opaque. */
export type Bit = { kind: Exclude<BitKind, "none">; x: number; y: number; size: number; alpha: number };

export type Pose = {
  yaw: number;
  pitch: number;
  roll: number;
  lift: number;
  x: number;
  squash: number;
  pulse: number;
  morph: number;
  morphTo: Morph;
  glyph?: Glyph;
  glyphMix: number;
  shut: number;
  /** The eyes' size, as a share. */
  eyes: number;
  /** How much colour and light it has, as a share: a failure drains it for a moment. */
  dim: number;
  split: number;
  spread: number;
  layers: Layers | null;
  /** The pyramid apart: the middle slab's slide, the capstone's slide, lift and spin (radians). */
  pieces: readonly [number, number, number, number];
  shear: number;
  core: number;
  beads: readonly Ball[];
  /** The cloud's puffs, moved (x, y, z) and swollen (w, a share) from where they rest; null where they rest. */
  puffs: readonly Ball[] | null;
  /** A ripple over the surface: its height, and how far it has run (radians). */
  wave: number;
  wavePhase: number;
  dent: number;
  wrinkle: number;
  /** How far its colour has rolled round, in radians. */
  colourRoll: number;
  bits: readonly Bit[];
  /** The cloud's rainbow: how strongly it shows, and how far it has swept across. */
  rainbow: number;
  rainbowSweep: number;
  /** Its lightning: how bright, and which zigzag. */
  bolt: number;
  boltSeed: number;
};

const NONE: readonly never[] = Object.freeze([]);

export const REST: Readonly<Pose> = Object.freeze({
  yaw: 0,
  pitch: 0,
  roll: 0,
  lift: 0,
  x: 0,
  squash: 1,
  pulse: 1,
  morph: 0,
  morphTo: "none",
  glyphMix: 0,
  shut: 0,
  eyes: 1,
  dim: 1,
  split: 0,
  spread: 0,
  layers: null,
  pieces: Object.freeze([0, 0, 0, 0]) as readonly [number, number, number, number],
  shear: 0,
  core: 1,
  beads: NONE,
  puffs: null,
  wave: 0,
  wavePhase: 0,
  dent: 0,
  wrinkle: 0,
  colourRoll: 0,
  bits: NONE,
  rainbow: 0,
  rainbowSweep: 0,
  bolt: 0,
  boltSeed: 0,
});

/** A pose from its parts, the rest at rest. */
export const posed = (parts: Partial<Pose>): Pose => ({ ...REST, ...parts });

const turned = (layers: Layers | null) => (layers ? Math.abs(layers.angles[0]) + Math.abs(layers.angles[1]) + Math.abs(layers.angles[2]) : 0);

/** Two sets of layers at once: about one axis they add; about two, the one turned further wins. */
function bothLayers(a: Layers | null, b: Layers | null): Layers | null {
  if (!a || !b) return a ?? b;
  if (a.axis === b.axis) return { axis: a.axis, angles: [a.angles[0] + b.angles[0], a.angles[1] + b.angles[1], a.angles[2] + b.angles[2]] };
  return turned(b) > turned(a) ? b : a;
}

function bothPuffs(a: readonly Ball[] | null, b: readonly Ball[] | null): readonly Ball[] | null {
  if (!a || !b) return a ?? b;
  return a.map((puff, i) => [puff[0] + b[i][0], puff[1] + b[i][1], puff[2] + b[i][2], puff[3] * b[i][3]] as Ball);
}

/** The most of a list there's room for, the strongest kept. */
const most = <T>(list: readonly T[], room: number, strength: (item: T) => number) => (list.length <= room ? list : [...list].sort((x, y) => strength(y) - strength(x)).slice(0, room));

/** A move's pose added to another's: turns, lifts and slides add, sizes multiply, the stronger morph, glyph, ripple and flash win. */
export function combine(a: Pose, b: Pose): Pose {
  const morph = b.morph > a.morph ? b : a;
  const glyph = b.glyphMix > a.glyphMix ? b : a;
  const wave = b.wave > a.wave ? b : a;
  const bolt = b.bolt > a.bolt ? b : a;
  return {
    yaw: a.yaw + b.yaw,
    pitch: a.pitch + b.pitch,
    roll: a.roll + b.roll,
    lift: a.lift + b.lift,
    x: a.x + b.x,
    squash: a.squash * b.squash,
    pulse: a.pulse * b.pulse,
    morph: morph.morph,
    morphTo: morph.morphTo,
    glyph: glyph.glyph,
    glyphMix: glyph.glyphMix,
    shut: Math.max(a.shut, b.shut),
    eyes: a.eyes * b.eyes,
    dim: a.dim * b.dim,
    split: Math.max(a.split, b.split),
    spread: Math.max(a.spread, b.spread),
    layers: bothLayers(a.layers, b.layers),
    pieces: [a.pieces[0] + b.pieces[0], a.pieces[1] + b.pieces[1], a.pieces[2] + b.pieces[2], a.pieces[3] + b.pieces[3]],
    shear: a.shear + b.shear,
    core: a.core * b.core,
    beads: most([...a.beads, ...b.beads], MOST.beads, (bead) => bead[3]),
    puffs: bothPuffs(a.puffs, b.puffs),
    wave: wave.wave,
    wavePhase: wave.wavePhase,
    dent: Math.max(a.dent, b.dent),
    wrinkle: Math.max(a.wrinkle, b.wrinkle),
    colourRoll: a.colourRoll + b.colourRoll,
    bits: most([...a.bits, ...b.bits], MOST.bits, (bit) => bit.alpha),
    rainbow: Math.max(a.rainbow, b.rainbow),
    rainbowSweep: Math.max(a.rainbowSweep, b.rainbowSweep),
    bolt: bolt.bolt,
    boltSeed: bolt.boltSeed,
  };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** The body's part of a pose, part way from one to another (a loop changing into the next): its turns, lift, slide and squash. */
export function blendBody(a: Pose, b: Pose, t: number): Pose {
  return {
    ...b,
    yaw: lerp(a.yaw, b.yaw, t),
    pitch: lerp(a.pitch, b.pitch, t),
    roll: lerp(a.roll, b.roll, t),
    lift: lerp(a.lift, b.lift, t),
    x: lerp(a.x, b.x, t),
    squash: lerp(a.squash, b.squash, t),
    pulse: lerp(a.pulse, b.pulse, t),
  };
}

import { type Face, type Figure, type Glyph, GLYPHS, type Look, SHAPES } from "./figure.ts";
import { REST_YAW } from "./figure-motion.ts";
import type { Pose } from "./figure-pose.ts";
import {
  apply,
  applyInverse,
  type Ball,
  BIT_KINDS,
  bodyTurn,
  BOTTOM,
  type CosinePalette,
  CUBELET_GAP,
  type EyeFrame,
  EYES,
  type FigureScene,
  FLOOR,
  frameFacing,
  HOVER,
  IDENTITY_CELLS,
  MORPHS,
  MOST,
  PUFFS,
  turnAbout,
  type Vec3,
} from "./figure-space.ts";

/**
 * Everything about a figure at one moment, put together as the shader takes it: its shape turned,
 * lifted, squashed and swollen, the eyes on the face that's in front (or trailing the sphere's
 * turn), their glyph and lids, the shape's own parts as its pose has them (the cube's cubelets,
 * the block's dials, the pyramid's pieces, the sphere's moons, the cloud's puffs and raindrops),
 * the bits in front of it, and its Aura. Pure, so a still figure, a live one and the tests build
 * the same scene.
 */

/** How much of its own colour shows in the middle, through Aura's milk (the experiment had 0.42; a little more tells the colourways apart). */
export const MILK = 0.55;
/** How far the halo reaches, in world units. */
export const REACH = 0.8;
/** How much colour a figure keeps once it's drained all it can (`drain` 1). */
export const DRAINED = 0.45;

export type SceneInput = {
  figure: Figure;
  /** Its expression's eyes and head as they are now, the gaze, sway and glances already in. */
  face: Face;
  glyph: Glyph;
  glyphTo: Glyph;
  glyphMix: number;
  /** How open a blink leaves the eyes, 0–1. */
  open: number;
  pose: Pose;
  /** How far round its turns have taken it, in degrees, and the turn of the face the eyes are on (the same, once they've moved to it). */
  baseYaw: number;
  eyeYaw: number;
  /** A sphere's eyes trail its turns: where they are, as the body's own angles would have them. Null, they're painted on. */
  trailing: { yaw: number; pitch: number; roll: number } | null;
  look: Look;
  /** The Aura's phases: how far the colour has flowed, the hue turned, the rim light travelled, the rings spread; and the clock, for a blob's wobble. */
  flow: number;
  hue: number;
  arcAngle: number;
  rings: number;
  time: number;
  swell: number;
  palette: CosinePalette;
  /** The cube's scramble as it thinks: how far it has split, each cell's cubelet's turn, and a layer mid-turn. */
  split: number;
  cells: Float32Array | null;
  turning: { axis: number; layer: number; angle: number } | null;
  ink: Vec3;
  /** How much of its colour has drained away, 0–1 (an agent's budget running out, say). */
  drain?: number;
};

const MORPH_EYES: Record<"blob" | "star" | "heart", { origin: Vec3; forward: Vec3 }> = {
  blob: { origin: [0, 0.1, 0.78], forward: [0, 0.12, 1] },
  star: { origin: [0, 0.03, 0.27], forward: [0, 0, 1] },
  heart: { origin: [0, 0.06, 0.29], forward: [0, 0, 1] },
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const RADIANS = Math.PI / 180;

/** The cloud's puffs as a pose has moved and swollen them. */
export function puffsOf(pose: Pick<Pose, "puffs">): Ball[] {
  return PUFFS.map((puff, i) => {
    const moved = pose.puffs?.[i];
    return moved ? [puff[0] + moved[0], puff[1] + moved[1], puff[2] + moved[2], puff[3] * moved[3]] : [...puff];
  });
}

/** The eyes' frame in body space: on the face in front, carried toward a morph's face, trailing a sphere's turn, riding the cloud's face puff. */
export function eyeFrame(input: Pick<SceneInput, "figure" | "pose" | "eyeYaw" | "trailing" | "split">, body: ReturnType<typeof bodyTurn>): EyeFrame {
  const shape = input.figure.shape;
  const rest = EYES[shape];
  let origin = rest.origin;
  let forward = rest.forward;
  const { morph, morphTo } = input.pose;
  // The cloud's face puff carries its eyes as it bobs.
  const face = shape === "cloud" ? input.pose.puffs?.[0] : null;
  if (face) origin = [origin[0] + face[0], origin[1] + face[1], origin[2] + face[2] + PUFFS[0][3] * (face[3] - 1)];
  if (morphTo !== "none" && morph > 0) {
    const target = MORPH_EYES[morphTo];
    origin = lerp3(origin, target.origin, morph);
    forward = lerp3(forward, target.forward, morph);
  }
  // On the face the body's turns have brought round.
  if (input.eyeYaw) {
    const around = turnAbout(1, -input.eyeYaw * RADIANS);
    origin = apply(around, origin);
    forward = apply(around, forward);
  }
  // A sphere's eyes where they trail to: placed by the trailing angles, read back in the body.
  if (input.trailing) {
    const trail = bodyTurn(input.trailing.yaw, input.trailing.pitch, input.trailing.roll);
    origin = applyInverse(body, apply(trail, origin));
    forward = applyInverse(body, apply(trail, forward));
  }
  const split = Math.max(input.split, shape === "cube" ? input.pose.split : 0);
  const gap = shape === "cube" ? lerp(rest.gap, CUBELET_GAP, split) : rest.gap;
  return frameFacing(forward, origin, rest.width, rest.height, gap);
}

/** An empty scene, to fill. */
export function emptyScene(palette: CosinePalette): FigureScene {
  return {
    shape: 0,
    morphTo: 0,
    morph: 0,
    time: 0,
    body: { rotation: new Float32Array(9), position: new Float32Array(3), scale: new Float32Array(3) },
    split: 0,
    spread: 0,
    cells: IDENTITY_CELLS(),
    layers: new Float32Array([-1, 0, 0, 0]),
    pieces: new Float32Array(4),
    shear: 0,
    core: 1,
    beads: new Float32Array(MOST.beads * 4),
    beadCount: 0,
    puffs: new Float32Array(MOST.puffs * 4),
    surface: new Float32Array(4),
    roll: 0,
    bits: new Float32Array(MOST.bits * 4),
    bitKinds: new Float32Array(MOST.bits),
    rainbow: new Float32Array(2),
    bolt: new Float32Array(2),
    eyes: {
      origin: new Float32Array(3),
      right: new Float32Array(3),
      up: new Float32Array(3),
      forward: new Float32Array(3),
      width: 0,
      height: 0,
      gap: 0,
      size: 1,
      dx: 0,
      dy: 0,
      left: new Float32Array(3),
      right3: new Float32Array(3),
      glyph: 0,
      glyphTo: 0,
      glyphMix: 0,
      open: 1,
    },
    aura: { palette, hue: 0, flow: 0, swirl: 0, energy: 0, saturation: 1, halo: 1, ripple: 0, rings: 0, arc: 0, arcAngle: 0, milk: MILK },
    ink: new Float32Array(3),
    floor: FLOOR,
    bottom: 0,
    reach: REACH,
  };
}

/** The scene for one moment of one figure; `into` is reused when given, so a figure drawn every frame makes no garbage. */
export function sceneFor(input: SceneInput, into?: FigureScene): FigureScene {
  const { figure, face, pose, look } = input;
  const shape = figure.shape;
  const yaw = REST_YAW[shape] + face.yaw + pose.yaw + input.baseYaw;
  const pitch = face.pitch + pose.pitch;
  const roll = face.roll + pose.roll;
  const turn = bodyTurn(yaw, pitch, roll);
  const size = input.swell * pose.pulse;
  const sy = pose.squash * size;
  const sx = size / Math.sqrt(pose.squash);
  // A sphere shrunk (deflated, splashed) still stands on the ground.
  const bottom = shape === "sphere" ? BOTTOM.sphere * pose.core : BOTTOM[shape];
  const y = FLOOR - bottom * sy + pose.lift + HOVER[shape];
  const frame = eyeFrame(input, turn);
  const scene = into ?? emptyScene(input.palette);
  const cube = shape === "cube";
  const parted = cube || shape === "block";
  scene.shape = SHAPES.indexOf(shape);
  scene.morphTo = MORPHS.indexOf(pose.morphTo);
  scene.morph = pose.morphTo === "none" ? 0 : pose.morph;
  scene.time = input.time;
  scene.body.rotation.set(turn);
  scene.body.position.set([pose.x, y, 0]);
  scene.body.scale.set([sx, sy, sx]);

  // Each shape's own parts.
  scene.split = parted ? Math.max(cube ? input.split : 0, pose.split) : 0;
  scene.spread = cube ? pose.spread : 0;
  if (input.cells && cube) scene.cells.set(input.cells);
  else scene.cells.set(IDENTITY_CELLS());
  const layers = cube && input.turning ? null : parted ? pose.layers : null;
  if (cube && input.turning) {
    const angles = [0, 0, 0];
    angles[input.turning.layer + 1] = input.turning.angle;
    scene.layers.set([input.turning.axis, ...angles]);
  } else scene.layers.set(layers ? [layers.axis, ...layers.angles] : [-1, 0, 0, 0]);
  scene.pieces.set(shape === "pyramid" ? pose.pieces : [0, 0, 0, 0]);
  scene.shear = shape === "pyramid" ? pose.shear : 0;
  scene.core = shape === "sphere" ? pose.core : 1;
  scene.surface.set(shape === "sphere" ? [pose.wave, pose.wavePhase, pose.dent, pose.wrinkle] : [0, 0, 0, 0]);
  scene.beads.fill(0);
  const beads = pose.beads.slice(0, MOST.beads);
  beads.forEach((bead, i) => scene.beads.set(bead, i * 4));
  scene.beadCount = beads.length;
  scene.puffs.fill(0);
  if (shape === "cloud") puffsOf(pose).forEach((puff, i) => scene.puffs.set(puff, i * 4));
  scene.roll = pose.colourRoll;
  scene.bits.fill(0);
  scene.bitKinds.fill(0);
  pose.bits.slice(0, MOST.bits).forEach((bit, i) => {
    scene.bits.set([bit.x, bit.y, bit.size, bit.alpha], i * 4);
    scene.bitKinds[i] = BIT_KINDS.indexOf(bit.kind);
  });
  scene.rainbow.set(shape === "cloud" ? [pose.rainbowSweep, pose.rainbow] : [0, 0]);
  scene.bolt.set(shape === "cloud" ? [pose.bolt, pose.boltSeed] : [0, 0]);

  const eyes = scene.eyes;
  eyes.origin.set(frame.origin);
  eyes.right.set(frame.right);
  eyes.up.set(frame.up);
  eyes.forward.set(frame.forward);
  eyes.width = frame.width;
  eyes.height = frame.height;
  eyes.gap = frame.gap;
  eyes.size = face.size * lerp(1, 0.92, scene.split) * pose.eyes;
  eyes.dx = face.dx;
  eyes.dy = face.dy;
  eyes.left.set([face.li, face.lo, face.smile]);
  eyes.right3.set([face.li, face.lo, face.smile]);
  // A pose's glyph (a star's starry eyes) wins over the expression's while it lasts.
  const posed = pose.glyph && pose.glyphMix > 0;
  eyes.glyph = GLYPHS.indexOf(posed ? (input.glyphMix > 0.5 ? input.glyphTo : input.glyph) : input.glyph);
  eyes.glyphTo = GLYPHS.indexOf(posed ? pose.glyph! : input.glyphTo);
  eyes.glyphMix = posed ? pose.glyphMix : input.glyphMix;
  eyes.open = Math.min(input.open, 1 - pose.shut * 0.95);
  const aura = scene.aura;
  const drained = 1 - (1 - DRAINED) * Math.min(1, Math.max(0, input.drain ?? 0));
  aura.palette = input.palette;
  aura.hue = input.hue;
  aura.flow = input.flow;
  aura.swirl = look.swirl;
  aura.energy = look.energy * lerp(1, pose.dim, 0.6);
  aura.saturation = look.saturation * pose.dim * drained;
  aura.halo = look.halo;
  aura.ripple = look.ripple;
  aura.rings = input.rings;
  aura.arc = look.arc;
  aura.arcAngle = input.arcAngle;
  aura.milk = MILK;
  scene.ink.set(input.ink);
  scene.bottom = y + bottom * sy;
  return scene;
}

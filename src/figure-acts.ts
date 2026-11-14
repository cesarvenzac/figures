import type { Loop, Reaction, Shape } from "./figure.ts";
import { arc, bump, easeIn, easeInOut, easeOut, easeOutBack, hold, keys, noise, phaseOf, span, TURN, wobble } from "./figure-curves.ts";
import { type Bit, type Layers, type Pose, posed, REST } from "./figure-pose.ts";
import { type Ball, BODY, BOTTOM, FLOOR, HOVER, pictureY, PUFFS, TOP } from "./figure-space.ts";

/**
 * What each shape does its own way, as the cube solves itself like a Rubik's cube while it thinks:
 * pure functions of time, giving a pose (figure-pose.ts) with the shape's own parts.
 *
 * Reactions, once, `p` from 0 to 1 (`actAt`):
 * - Petted: heart eyes and hearts floating up; the cube twirls its top layer, the sphere dents and
 *   ripples like jelly, the pyramid leans like jelly, the block's dials rock as it purrs, the
 *   cloud's puffs bounce one after another.
 * - A run finished: starry eyes and sparks; the cube bursts into its cubelets, twisting, and snaps
 *   back; the sphere splashes into droplets that fly out and run back together; the pyramid
 *   launches its capstone, spinning, and catches it; the block spins its dials like a slot machine,
 *   the eyes coming round last; the cloud's puffs pop and a rainbow sweeps over it.
 * - A run failed: × × eyes and drained colour; the cube's layers glitch and it slumps; the sphere
 *   deflates, wrinkled, and fills again; the pyramid's slabs slip sideways and back; the block's
 *   dials jam and jerk; the cloud storms, rain and lightning.
 * - Work starting, switched off, switched on: a determined nod, a yawn as the eyes close, a
 *   stretch as they open wide; each shape turning a layer, a capstone or its dials its own way.
 *
 * Loops, at `t` seconds, as strong as `env` (0 to 1: how far it has come in, or gone out)
 * (`actLoopAt`): thinking, the sphere's moons orbit, the pyramid's capstone floats and turns, the
 * block's dials turn like a cryptex's, the cloud boils (the cube's Rubik's turns are
 * rubik.ts); at work, the cube's layers tick like clockwork, the sphere's colour rolls
 * with a moon going round, the capstone stamps, the block's side dials roll like wheels, the cloud
 * rains; asleep, z's rise and the cube's cubelets loosen; worried, goosebumps, a rattle, a grey
 * drizzle. A loop that turns something (`QUANTUM`) comes back to where it started every so many
 * seconds, so it can stop there.
 */

/** Where in the picture a shape's top is, as it rests (world units from the picture's middle). */
export const topOf = (shape: Shape) => pictureY(FLOOR + HOVER[shape] - BOTTOM[shape] + TOP[shape]);
/** Where in the picture its middle is. */
export const middleOf = (shape: Shape) => pictureY(FLOOR + HOVER[shape] - BOTTOM[shape]);

/** The cloud's puffs from left to right, for a wave running across it. */
const LEFT_TO_RIGHT = [...PUFFS.keys()].sort((a, b) => PUFFS[a][0] - PUFFS[b][0]);
const waveOrder = (puff: number) => LEFT_TO_RIGHT.indexOf(puff);

/** The cloud's puffs, each moved and swollen by `of(puff, order)`: [dx, dy, dz, scale]. */
const puffs = (of: (puff: number, order: number) => Ball): Ball[] => PUFFS.map((_, i) => of(i, waveOrder(i)));

/** Eyes become a shape for a while, in and out again. */
const eyesAs = (glyph: Pose["glyph"], p: number, from: number, to: number, fade = 0.08) => ({ glyph, glyphMix: hold(p, from, from + fade, to - fade, to) });

/** Layers turning: the angles of the three, about an axis; none once they're all home. */
const layers = (axis: Layers["axis"], low: number, middle: number, high: number): Layers | null => (low || middle || high ? { axis, angles: [low, middle, high] } : null);

const within = (value: number, most: number) => Math.max(-most, Math.min(most, value));

// ---------------------------------------------------------------------------------------------
// Bits

/** Hearts floating up from above its head, one after another from `from`, each living `life` of the move. */
export function hearts(p: number, shape: Shape, from: number, every: number, life: number, count: number): Bit[] {
  const top = topOf(shape);
  const bits: Bit[] = [];
  for (let i = 0; i < count; i++) {
    const q = span(p, from + i * every, from + i * every + life);
    if (q <= 0 || q >= 1) continue;
    const side = i % 2 ? -1 : 1;
    bits.push({
      kind: "heart",
      x: side * (0.14 + 0.08 * i) + 0.06 * Math.sin(q * Math.PI * 2 + i),
      y: Math.min(1.3, top + 0.12 + 0.48 * easeOut(q)),
      size: 0.24 * easeOutBack(span(q, 0, 0.3), 2) * (1 - 0.25 * q),
      alpha: span(q, 0, 0.12) * (1 - span(q, 0.6, 1)),
    });
  }
  return bits;
}

/** Sparks round it, popping one after another from `from`, each living `life`. */
export function sparks(p: number, shape: Shape, from: number, life: number): Bit[] {
  const middle = middleOf(shape);
  const bits: Bit[] = [];
  for (let i = 0; i < 4; i++) {
    const q = span(p, from + i * 0.07, from + i * 0.07 + life);
    if (q <= 0 || q >= 1) continue;
    const angle = (0.14 + 0.24 * i) * Math.PI;
    const reach = 0.92 + 0.22 * easeOut(q);
    bits.push({ kind: "spark", x: within(Math.cos(angle) * reach * 1.08, 1.3), y: within(middle + 0.12 + Math.sin(angle) * reach * 0.86, 1.3), size: 0.2 * bump(q), alpha: bump(q) });
  }
  return bits;
}

/** A z, `q` (0 to 1) through its rise: drifting up and away from its head, growing and fading. */
function zAt(q: number, shape: Shape, strength: number): Bit | null {
  if (q < 0 || q >= 1) return null;
  return {
    kind: "z",
    x: 0.36 + 0.3 * q + 0.04 * Math.sin(q * 6),
    y: Math.min(1.3, topOf(shape) + 0.02 + 0.5 * q),
    size: 0.13 + 0.08 * q,
    alpha: span(q, 0, 0.15) * (1 - span(q, 0.55, 1)) * 0.85 * strength,
  };
}

/** Z's asleep: one rising every 2.2 seconds, each for 3.3, the first once it has had time to doze off. */
export function zs(t: number, shape: Shape, strength = 1): Bit[] {
  const asleep = t - 1.8;
  if (asleep < 0) return [];
  const latest = Math.floor(asleep / 2.2);
  return [0, 1].map((k) => zAt((asleep - (latest - k) * 2.2) / 3.3, shape, strength)).filter((bit): bit is Bit => bit !== null);
}

/** A raindrop under the cloud, `q` (0 to 1) through its life: it forms on the cloud's underside, falls and is gone at the ground. */
function raindrop(q: number, x: number, lift: number, size = 0.075): Ball | null {
  if (q <= 0 || q >= 1) return null;
  const base = BODY.cloud.base;
  const ground = BOTTOM.cloud - HOVER.cloud - lift + 0.03;
  if (q < 0.25) return [x, base - 0.02, 0.12, size * easeOut(q / 0.25)];
  const fall = span(q, 0.25, 0.9);
  const y = base - 0.03 + (ground - base) * fall * fall;
  return [x, y, 0.12, size * (1 - span(q, 0.82, 1)) * (1 + 0.15 * fall)];
}

// ---------------------------------------------------------------------------------------------
// Reactions

/** Where a reaction has got to `p` of the way through (0 to 1), for a shape, at an energy's amplitude. */
export function actAt(act: Reaction, p: number, shape: Shape, amp = 1): Pose {
  switch (act) {
    case "pet":
      return pet(p, shape, amp);
    case "celebrate":
      return celebrate(p, shape, amp);
    case "fail":
      return fail(p, shape, amp);
    case "start":
      return start(p, shape, amp);
    case "doze":
      return doze(p, shape, amp);
    case "wake":
      return wake(p, shape, amp);
  }
}

function pet(p: number, shape: Shape, amp: number): Pose {
  const pose = posed({
    ...eyesAs("heart", p, 0.06, 0.92),
    squash: keys(p, [
      [0, 1],
      [0.1, 1 - 0.09 * amp],
      [0.24, 1 + 0.05 * amp],
      [0.4, 1 - 0.015 * amp],
      [0.55, 1],
    ]),
    pitch: 6 * bump(span(p, 0.1, 0.9)),
    bits: hearts(p, shape, 0.12, 0.16, 0.5, 3),
  });
  if (shape === "cube") {
    // Its top layer twirls right round, as a head scratched.
    pose.split = hold(p, 0.03, 0.13, 0.82, 0.94);
    pose.layers = layers(1, 0, 0, TURN * easeInOut(span(p, 0.13, 0.8)));
  } else if (shape === "sphere") {
    // A dent where it's poked, a ripple running out from it, and a jelly's wobble.
    pose.dent = 0.12 * hold(p, 0.03, 0.09, 0.14, 0.28);
    pose.wave = 0.04 * amp * span(p, 0.1, 0.2) * (1 - span(p, 0.25, 0.95));
    pose.wavePhase = p * 30;
    pose.squash *= 1 + 0.07 * amp * wobble(span(p, 0.12, 1), 3);
  } else if (shape === "pyramid") {
    pose.shear = 0.2 * amp * wobble(span(p, 0.08, 1), 2.5);
  } else if (shape === "block") {
    // Its dials rock one after another, and it purrs.
    const q = span(p, 0.1, 0.92);
    const rock = (dial: number) => 0.32 * amp * Math.sin(2 * Math.PI * (1.6 * q - dial * 0.12)) * (1 - q) ** 1.2 * span(q, 0, 0.1);
    pose.split = hold(p, 0.03, 0.12, 0.86, 0.96);
    pose.layers = layers(0, rock(0), rock(1), rock(2));
    pose.x = 0.006 * amp * Math.sin(2 * Math.PI * 22 * p) * hold(p, 0.1, 0.2, 0.8, 0.9);
  } else {
    pose.puffs = puffs((_, order) => {
      const q = span(p, 0.08 + order * 0.07, 0.4 + order * 0.07);
      return [0, 0.11 * amp * bump(q), 0, 1 + 0.1 * bump(q)];
    });
  }
  return pose;
}

function celebrate(p: number, shape: Shape, amp: number): Pose {
  const pose = posed({ ...eyesAs("star", p, 0.08, 0.95), bits: sparks(p, shape, 0.26, 0.3) });
  if (shape === "cube") {
    // It bursts into its cubelets, twisting as it spins, and snaps back together.
    pose.split = hold(p, 0, 0.1, 0.84, 0.95);
    pose.spread = 0.85 * amp * easeOut(span(p, 0.1, 0.32)) * (1 - easeIn(span(p, 0.58, 0.78)));
    const twist = 0.8 * bump(span(p, 0.1, 0.78));
    pose.layers = layers(1, -twist, 0, twist);
    pose.yaw = 360 * easeInOut(span(p, 0.12, 0.7));
    pose.lift = 0.22 * amp * arc(span(p, 0.08, 0.76));
    pose.squash = keys(p, [
      [0, 1],
      [0.06, 1 - 0.1 * amp],
      [0.16, 1 + 0.05 * amp],
      [0.7, 1],
      [0.8, 1 - 0.14 * amp],
      [0.9, 1 + 0.03 * amp],
      [1, 1],
    ]);
  } else if (shape === "sphere") {
    // It splashes into six droplets that fly out, hang a beat and run back together.
    pose.core = keys(p, [
      [0, 1],
      [0.1, 1.06],
      [0.2, 0.5],
      [0.55, 0.5],
      [0.75, 1.04],
      [0.86, 0.98],
      [1, 1],
    ]);
    const out = 0.15 + 0.85 * easeOut(span(p, 0.12, 0.32)) * (1 - easeInOut(span(p, 0.52, 0.74)));
    const size = 0.19 * span(p, 0.1, 0.18) * (1 - span(p, 0.7, 0.8));
    if (size > 0)
      pose.beads = Array.from({ length: 6 }, (_, i) => {
        const angle = ((i * 60 + 15) * Math.PI) / 180 + 0.4 * span(p, 0.2, 0.7);
        return [Math.cos(angle) * out, Math.sin(angle) * out * 0.9, 0.25 * Math.sin(2 * angle) * out, size] as Ball;
      });
    pose.squash = 1 + 0.06 * amp * wobble(span(p, 0.74, 1), 2);
  } else if (shape === "pyramid") {
    // It launches its capstone, spinning twice, and catches it.
    const lift = keys(p, [
      [0, 0],
      [0.1, 0],
      [0.42, 0.46 * amp],
      [0.7, 0],
      [0.77, 0.06 * amp],
      [0.84, 0],
    ]);
    pose.pieces = [0, 0, lift, 2 * TURN * easeInOut(span(p, 0.1, 0.72))];
    pose.squash = keys(p, [
      [0, 1],
      [0.08, 1 - 0.08 * amp],
      [0.16, 1],
      [0.68, 1],
      [0.72, 1 - 0.1 * amp],
      [0.82, 1 + 0.03 * amp],
      [1, 1],
    ]);
  } else if (shape === "block") {
    // A slot machine: every dial spins and stops in turn, the middle one, eyes and all, last.
    const stop = (from: number, to: number, turns: number) => turns * TURN * easeOutBack(span(p, from, to), 0.6);
    pose.split = hold(p, 0, 0.08, 0.86, 0.96);
    pose.layers = layers(0, stop(0.08, 0.48, 2), stop(0.08, 0.72, 4), stop(0.08, 0.6, 3));
    pose.lift = 0.12 * amp * arc(span(p, 0.74, 0.92));
    pose.squash = keys(p, [
      [0, 1],
      [0.72, 1],
      [0.76, 1 - 0.08 * amp],
      [0.84, 1 + 0.04 * amp],
      [0.94, 1 - 0.04 * amp],
      [1, 1],
    ]);
    Object.assign(pose, eyesAs("star", p, 0.72, 0.97));
  } else {
    // Its puffs pop one after another and a rainbow sweeps over it.
    pose.puffs = puffs((_, order) => {
      const q = span(p, 0.08 + order * 0.05, 0.36 + order * 0.05);
      return [0, 0.04 * amp * bump(q), 0, 1 + 0.2 * amp * bump(q)];
    });
    pose.rainbow = hold(p, 0.12, 0.2, 0.78, 0.96);
    pose.rainbowSweep = 1.1 * easeInOut(span(p, 0.14, 0.48));
    pose.lift = 0.14 * amp * arc(span(p, 0.1, 0.6));
  }
  return pose;
}

function fail(p: number, shape: Shape, amp: number): Pose {
  const slump = keys(p, [
    [0, 1],
    [0.6, 1],
    [0.68, 1 - 0.12 * amp],
    [0.8, 1 - 0.05 * amp],
    [1, 1],
  ]);
  const pose = posed({
    ...eyesAs("cross", p, 0.1, 0.88),
    dim: 1 - 0.55 * hold(p, 0.08, 0.3, 0.75, 1),
    squash: slump,
    pitch: keys(p, [
      [0, 0],
      [0.62, 0],
      [0.72, -12],
      [1, 0],
    ]),
  });
  if (shape === "cube") {
    // Its layers glitch, jumping from one wrong place to the next, then it slumps.
    const step = Math.floor(p / 0.04);
    const glitch = hold(p, 0.06, 0.1, 0.44, 0.55);
    const jump = (layer: number) => (noise(step, layer) - 0.5) * 0.9 * amp * glitch;
    pose.split = hold(p, 0.03, 0.08, 0.55, 0.65);
    pose.layers = layers(1, jump(1), jump(2), jump(3));
    pose.x = 0.06 * amp * (noise(step, 7) - 0.5) * glitch;
  } else if (shape === "sphere") {
    // It goes down like a balloon, wrinkling, flat on the ground, and fills again.
    pose.core = keys(p, [
      [0, 1],
      [0.06, 1.04],
      [0.32, 0.72],
      [0.62, 0.72],
      [0.84, 1.04],
      [0.92, 0.99],
      [1, 1],
    ]);
    pose.wrinkle = hold(p, 0.1, 0.3, 0.6, 0.82);
    pose.squash = keys(p, [
      [0, 1],
      [0.3, 0.82],
      [0.42, 0.72],
      [0.6, 0.76],
      [0.84, 1.05],
      [1, 1],
    ]);
    pose.x = 0.02 * Math.sin(p * 80) * hold(p, 0.08, 0.12, 0.3, 0.36);
  } else if (shape === "pyramid") {
    // Its slabs slip sideways, teeter, and slide back.
    const teeter = 0.03 * Math.sin(2 * Math.PI * 3 * span(p, 0.26, 0.6)) * hold(p, 0.26, 0.3, 0.55, 0.6);
    const middle = 0.22 * amp * (easeOut(span(p, 0.08, 0.26)) - easeInOut(span(p, 0.6, 0.84))) + teeter;
    const top = -0.26 * amp * (easeOut(span(p, 0.14, 0.32)) - easeInOut(span(p, 0.62, 0.86))) - teeter;
    pose.pieces = [middle, top, 0, 0];
  } else if (shape === "block") {
    // Its dials jam: they try to turn, jerking back and forth, and give up.
    const jerk = (phase: number) => {
      const s = Math.sin(2 * Math.PI * 9 * p + phase);
      return Math.sign(s) * Math.abs(s) ** 0.5;
    };
    pose.split = hold(p, 0.03, 0.1, 0.8, 0.92);
    const trying = hold(p, 0.1, 0.16, 0.5, 0.6);
    pose.layers = layers(0, 0.3 * amp * jerk(0) * trying, 0.12 * jerk(1) * hold(p, 0.2, 0.25, 0.4, 0.5), -0.3 * amp * jerk(2) * trying);
    pose.x = 0.012 * amp * Math.sin(2 * Math.PI * 24 * p) * hold(p, 0.1, 0.14, 0.5, 0.6);
  } else {
    // A storm: it rises dark, rain pours and lightning strikes twice.
    const lift = 0.22 * amp * hold(p, 0.05, 0.2, 0.75, 0.95);
    pose.lift = lift;
    pose.dim = 1 - 0.72 * hold(p, 0.05, 0.25, 0.75, 1);
    const flash = (at: number, length: number) => hold(p, at, at + 0.005, at + length, at + length + 0.012);
    pose.bolt = Math.max(flash(0.32, 0.035), 0.4 * flash(0.372, 0.02), flash(0.41, 0.04));
    pose.boltSeed = p < 0.395 ? 1 : 2;
    pose.beads = Array.from({ length: 6 }, (_, i) => raindrop(span(p, 0.12 + i * 0.1, 0.32 + i * 0.1), (noise(i, 3) - 0.5) * 0.9, lift)).filter((drop): drop is Ball => drop !== null);
    pose.x = 0.012 * Math.sin(p * 90) * hold(p, 0.3, 0.32, 0.46, 0.5);
  }
  return pose;
}

function start(p: number, shape: Shape, amp: number): Pose {
  const pose = posed({
    pitch: keys(p, [
      [0, 0],
      [0.15, -9],
      [0.4, 5],
      [0.6, 0],
    ]),
    squash: keys(p, [
      [0, 1],
      [0.12, 1 - 0.07 * amp],
      [0.3, 1 + 0.05 * amp],
      [0.45, 1],
    ]),
  });
  const quarter = Math.PI / 2;
  if (shape === "cube") {
    // Cracks its knuckles: the top layer and the bottom one turn a quarter and back.
    pose.split = hold(p, 0.03, 0.1, 0.72, 0.84);
    pose.layers = layers(1, -quarter * (easeOutBack(span(p, 0.16, 0.34)) - easeInOut(span(p, 0.44, 0.62))), 0, quarter * (easeOutBack(span(p, 0.1, 0.28)) - easeInOut(span(p, 0.38, 0.56))));
  } else if (shape === "sphere") {
    // Winds up: a moon buds off and whips once round it.
    const angle = TURN * easeInOut(span(p, 0.12, 0.72));
    const reach = 0.8 + 0.22 * hold(p, 0.08, 0.2, 0.66, 0.8);
    const size = 0.12 * hold(p, 0.06, 0.16, 0.7, 0.82);
    if (size > 0) pose.beads = [[Math.cos(angle) * reach, 0.05, Math.sin(angle) * reach, size]];
  } else if (shape === "pyramid") {
    pose.pieces = [0, 0, 0.05 * hold(p, 0.06, 0.15, 0.62, 0.74), TURN * easeInOut(span(p, 0.1, 0.7))];
  } else if (shape === "block") {
    pose.split = hold(p, 0.03, 0.1, 0.72, 0.84);
    pose.layers = layers(0, TURN * easeInOut(span(p, 0.1, 0.6)), 0, -TURN * easeInOut(span(p, 0.14, 0.64)));
  } else {
    pose.puffs = puffs((_, order) => [0, 0, 0, 1 + 0.1 * amp * bump(span(p, 0.1 + order * 0.05, 0.36 + order * 0.05))]);
    pose.lift = 0.08 * amp * arc(span(p, 0.2, 0.6));
  }
  return pose;
}

function doze(p: number, shape: Shape, amp: number): Pose {
  // A yawn, the lids coming down, and it's asleep: the eyes hand over to the sleeping ones.
  const pose = posed({
    glyph: "rect",
    glyphMix: 1 - span(p, 0.72, 0.86),
    shut: easeInOut(span(p, 0.1, 0.7)) * (1 - span(p, 0.86, 0.96)),
    squash: keys(p, [
      [0, 1],
      [0.12, 1 + 0.07 * amp],
      [0.28, 1 + 0.07 * amp],
      [0.45, 1 - 0.04 * amp],
      [0.7, 1],
    ]),
    pitch: keys(p, [
      [0, 0],
      [0.12, 8],
      [0.3, 8],
      [0.55, -6],
      [1, 0],
    ]),
  });
  if (shape === "cube") {
    // Powers down: its top layer turns once, slower and slower.
    pose.split = hold(p, 0.05, 0.12, 0.8, 0.92);
    pose.layers = layers(1, 0, 0, TURN * easeOut(span(p, 0.1, 0.78)));
  } else if (shape === "sphere") {
    pose.core = 1 - 0.05 * hold(p, 0.3, 0.5, 0.8, 1);
  } else if (shape === "pyramid") {
    pose.pieces = [0, 0, 0.06 * hold(p, 0.1, 0.2, 0.3, 0.6), 0];
  } else if (shape === "block") {
    pose.split = hold(p, 0.05, 0.12, 0.84, 0.94);
    pose.layers = layers(0, TURN * easeOut(span(p, 0.1, 0.8)), 0, TURN * easeOut(span(p, 0.12, 0.84)));
  } else {
    pose.puffs = puffs(() => [0, 0, 0, 1 - 0.06 * hold(p, 0.3, 0.6, 0.8, 1)]);
  }
  return pose;
}

function wake(p: number, shape: Shape, amp: number): Pose {
  // A stretch as the eyes open, wide for a moment, and a little hop.
  const pose = posed({
    glyph: "line",
    glyphMix: 1 - span(p, 0.2, 0.32),
    eyes: 1 + 0.25 * hold(p, 0.3, 0.38, 0.55, 0.8),
    squash: keys(p, [
      [0, 1],
      [0.12, 1 - 0.08 * amp],
      [0.28, 1 + 0.1 * amp],
      [0.42, 1],
    ]),
    lift: 0.12 * amp * arc(span(p, 0.3, 0.62)),
  });
  const quarter = Math.PI / 2;
  if (shape === "cube") {
    // Boots up: its bottom layer and its top one turn a quarter, crossing, and back.
    pose.split = hold(p, 0.04, 0.1, 0.7, 0.8);
    pose.layers = layers(1, quarter * (easeOutBack(span(p, 0.1, 0.24)) - easeInOut(span(p, 0.46, 0.62))), 0, -quarter * (easeOutBack(span(p, 0.2, 0.34)) - easeInOut(span(p, 0.5, 0.66))));
  } else if (shape === "sphere") {
    pose.wave = 0.03 * span(p, 0.1, 0.2) * (1 - span(p, 0.3, 0.9));
    pose.wavePhase = p * 26;
  } else if (shape === "pyramid") {
    const lift = keys(p, [
      [0, 0],
      [0.1, 0],
      [0.28, 0.2 * amp],
      [0.48, 0],
      [0.54, 0.03],
      [0.6, 0],
    ]);
    pose.pieces = [0, 0, lift, TURN * easeInOut(span(p, 0.1, 0.5))];
  } else if (shape === "block") {
    pose.split = hold(p, 0.04, 0.1, 0.62, 0.72);
    pose.layers = layers(0, TURN * easeInOut(span(p, 0.08, 0.45)), 0, -TURN * easeInOut(span(p, 0.2, 0.56)));
  } else {
    pose.puffs = puffs((_, order) => [0, 0, 0, 1 + 0.16 * amp * bump(span(p, 0.1 + order * 0.06, 0.34 + order * 0.06))]);
  }
  return pose;
}

// ---------------------------------------------------------------------------------------------
// Loops

/**
 * How often each shape's loop comes back to where it started, in seconds at lively energy: a
 * loop that turns its parts stops only then, so nothing jumps. 0 is any time. The thinking cube's
 * Rubik's turns finish their own round (figure-motion.ts).
 */
export const QUANTUM: Record<Loop, Record<Shape, number>> = {
  breathe: { cube: 0, sphere: 0, pyramid: 0, block: 0, cloud: 0 },
  float: { cube: 0, sphere: 0, pyramid: 0, block: 0, cloud: 0 },
  think: { cube: 0, sphere: 0, pyramid: 3, block: 5.4, cloud: 0 },
  work: { cube: 3.6, sphere: 2.8, pyramid: 0.8, block: 1.6, cloud: 0 },
  rest: { cube: 0, sphere: 0, pyramid: 0, block: 0, cloud: 0 },
  worry: { cube: 0, sphere: 0, pyramid: 0, block: 0, cloud: 0 },
};

/** How long a loop's own act takes to come in and to go out, in seconds. */
export const ENVELOPE = { in: 0.6, out: 0.5 } as const;

/** The block's dials as it thinks, like cracking a cryptex: [dial (−1 left, 1 right), quarter turns], one every 0.8 s from half a second in. Each dial ends where it began. */
const CRYPTEX: [number, number][] = [
  [-1, 1],
  [1, -1],
  [-1, 1],
  [1, -1],
  [-1, -2],
  [1, 2],
];

/** The cube's layers at work, ticking like clockwork: a quarter turn every 0.9 s, the top one forward twice and back twice, the bottom one the other way, half a tick behind. */
function clockwork(t: number) {
  const tick = (at: number, directions: number[]) => {
    const q = phaseOf(at, 3.6) * 3.6;
    let angle = 0;
    directions.forEach((direction, i) => {
      angle += (direction * Math.PI) / 2 * easeOutBack(span(q, i * 0.9, i * 0.9 + 0.32), 1.4);
    });
    return angle;
  };
  return { low: tick(t - 0.45, [-1, -1, 1, 1]), high: tick(t, [1, 1, -1, -1]) };
}

/** Where a shape's own loop act is at `t` seconds, as strong as `env`. */
export function actLoopAt(loop: Loop, t: number, shape: Shape, amp = 1, env = 1): Pose {
  if (env <= 0 || loop === "breathe" || loop === "float") return REST;
  const pose = posed({});
  if (loop === "think") {
    if (shape === "sphere") {
      // Three moons bud off it and orbit, each on its own tilted path.
      const reach = 0.62 + 0.4 * easeOut(env);
      pose.beads = [0.35, -0.5, 0.95].map((tilt, i) => {
        const angle = i * 2.1 + (0.9 + 0.25 * i) * t;
        return [reach * Math.cos(angle), reach * Math.sin(angle) * Math.sin(tilt), reach * Math.sin(angle) * Math.cos(tilt), 0.14 * env] as Ball;
      });
    } else if (shape === "pyramid") {
      // Its capstone floats up and turns slowly, bobbing.
      pose.pieces = [0, 0, 0.24 * easeOut(env) + 0.03 * Math.sin(t * 2.2) * env, (TURN * t) / 3];
    } else if (shape === "block") {
      // Its side dials turn a quarter at a time, as if cracking a code.
      pose.split = env;
      const angles = [0, 0, 0];
      CRYPTEX.forEach(([dial, quarters], i) => {
        const from = 0.5 + i * 0.8;
        const length = Math.abs(quarters) > 1 ? 0.6 : 0.45;
        angles[dial + 1] += ((quarters * Math.PI) / 2) * easeOutBack(span(phaseOf(t, 5.4) * 5.4, from, from + length), 1.3);
      });
      pose.layers = layers(0, angles[0], 0, angles[2]);
    } else if (shape === "cloud") {
      // Its puffs boil, rolling round and swelling.
      pose.puffs = puffs((i) => {
        const calm = i === 0 ? 0.35 : 1;
        return [
          0.07 * calm * env * Math.sin((TURN * t) / 3 + i * 1.7),
          0.06 * calm * env * Math.sin((TURN * t) / 2 + i * 2.3),
          0,
          1 + 0.1 * calm * env * Math.sin((TURN * t) / 1.5 + i * 1.1),
        ];
      });
    }
  } else if (loop === "work") {
    if (shape === "cube") {
      pose.split = env;
      const { low, high } = clockwork(t);
      pose.layers = layers(1, low, 0, high);
    } else if (shape === "sphere") {
      // Its colour rolls round as a ball rolls, a small moon whizzing round it.
      pose.colourRoll = (TURN * t) / 2.8;
      const angle = (TURN * t) / 1.4;
      pose.beads = [[0.98 * Math.cos(angle), 0.98 * Math.sin(angle) * 0.55, 0.98 * Math.sin(angle) * 0.83, 0.09 * env]];
    } else if (shape === "pyramid") {
      // Its capstone stamps, lifted slowly and brought down hard.
      const q = phaseOf(t, 0.8);
      const lift = q < 0.55 ? easeOut(q / 0.55) : 1 - easeIn(span(q, 0.55, 0.75));
      pose.pieces = [0, 0, 0.16 * amp * env * lift, 0];
      pose.squash = 1 - 0.04 * amp * env * bump(span(q, 0.75, 0.9));
    } else if (shape === "block") {
      // Its side dials roll like wheels.
      pose.split = env;
      const roll = (TURN * t) / 1.6;
      pose.layers = layers(0, roll, 0, roll);
    } else if (shape === "cloud") {
      // It rains: a drop every 0.6 s, forming, falling.
      const drops: Ball[] = [];
      for (let k = 0; k < 2; k++) {
        const born = Math.floor(t / 0.6) - k;
        const drop = raindrop((t - born * 0.6) / 1, [-0.32, 0.12, -0.06, 0.34][((born % 4) + 4) % 4], 0, 0.07 * env);
        if (drop) drops.push(drop);
      }
      pose.beads = drops;
      pose.dim = 1 - 0.1 * env;
    }
  } else if (loop === "rest") {
    pose.bits = zs(t, shape, env);
    const breath = 0.5 - 0.5 * Math.cos((TURN * t) / 4.5);
    if (shape === "cube") pose.split = 0.3 * env * breath;
    else if (shape === "pyramid") pose.pieces = [0, 0, 0.03 * env * breath, 0];
    else if (shape === "cloud") pose.puffs = puffs(() => [0, 0, 0, 1 - 0.04 * env]);
  } else if (loop === "worry") {
    const burst = Math.max(0, Math.sin(t * 2.1)) ** 6;
    if (shape === "sphere") pose.wrinkle = 0.3 * env * burst;
    else if (shape === "pyramid") pose.pieces = [0, 0, 0.018 * env * burst * Math.abs(Math.sin(t * 60)), 0];
    else if (shape === "cloud") {
      pose.dim = 1 - 0.2 * env;
      const q = phaseOf(t, 1.5);
      const drop = raindrop(q / 0.7, 0.1, 0, 0.06 * env);
      if (drop) pose.beads = [drop];
    }
  }
  return pose;
}

export { REST };

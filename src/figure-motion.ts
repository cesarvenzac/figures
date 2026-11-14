import { type Loop, type Once, REACTIONS, type Reaction, type Shape } from "./figure.ts";
import { actAt, actLoopAt, ENVELOPE, QUANTUM } from "./figure-acts.ts";
import { arc, bump, clamp01, easeInOut, easeOut, easeOutBack, into, keys, span, wobble } from "./figure-curves.ts";
import { combine, type Pose, REST } from "./figure-pose.ts";
import { type Move, thinkingMoves } from "./rubik.ts";

/**
 * How the figures move: each move and loop as a pure function of time, so the live figure,
 * a still one and the tests all agree on where it is. Moves and loops give a pose
 * (figure-pose.ts): what's added to how the figure holds itself at rest. The moves
 * anything can make are here; what each shape does its own way (petted, a run finished, asleep…)
 * is figure-acts.ts.
 *
 * The moves are character animation's old rules: a crouch before a jump and a squash when it
 * lands, a stretch as it rises, an overshoot that settles, a beat held at the top.
 */

export { combine, type Pose, REST };

/** How each shape stands at rest, turned a little so its sides show (the sphere has none to show). */
export const REST_YAW: Record<Shape, number> = { cube: -18, sphere: 0, pyramid: -20, block: -12, cloud: -10 };

/** How far a turn takes each shape round: a cube or a pyramid shows its next face, a block its other side (its ends would be another creature); a sphere rolls away and back, and a cloud drifts. */
export const TURN_BY: Record<Shape, number> = { cube: 90, sphere: 0, pyramid: 90, block: 180, cloud: 0 };
/** When, through a turn, the eyes move to the face now in front: while they're shut. */
export const SWITCH_AT = 0.45;

const isReaction = (move: Once): move is Reaction => (REACTIONS as readonly string[]).includes(move);

// ---------------------------------------------------------------------------------------------
// Moves

/** Where a move has got to `p` of the way through (0 to 1), for a shape, at an energy's amplitude. */
export function moveAt(move: Once, p: number, shape: Shape, amp = 1): Pose {
  if (isReaction(move)) return actAt(move, p, shape, amp);
  const pose: Pose = { ...REST };
  const sphere = shape === "sphere";
  switch (move) {
    case "hop": {
      pose.squash = keys(p, [
        [0, 1],
        [0.16, 1 - 0.14 * amp],
        [0.28, 1 + 0.1 * amp],
        [0.5, 1],
        [0.7, 1 + 0.05 * amp],
        [0.78, 1 - 0.12 * amp],
        [0.9, 1 + 0.03 * amp],
        [1, 1],
      ]);
      pose.lift = 0.34 * amp * arc(span(p, 0.2, 0.76));
      pose.pitch = keys(p, [
        [0, 0],
        [0.16, -5],
        [0.4, 7 * amp],
        [0.78, -4],
        [1, 0],
      ]);
      break;
    }
    case "bounce": {
      pose.squash = keys(p, [
        [0, 1],
        [0.22, 1 - 0.07 * amp],
        [0.5, 1 + 0.04 * amp],
        [0.75, 1 - 0.015 * amp],
        [1, 1],
      ]);
      pose.lift = 0.06 * amp * arc(span(p, 0.25, 0.72));
      break;
    }
    case "spin": {
      pose.yaw = 360 * easeInOut(span(p, 0.08, 0.9)) - 14 * amp * bump(span(p, 0, 0.16));
      pose.lift = 0.14 * amp * arc(span(p, 0.12, 0.88));
      pose.squash = keys(p, [
        [0, 1],
        [0.1, 1 - 0.06 * amp],
        [0.3, 1 + 0.04 * amp],
        [0.85, 1],
        [0.92, 1 - 0.05 * amp],
        [1, 1],
      ]);
      break;
    }
    case "turn": {
      if (sphere) {
        // A sphere rolls a little way and back, its eyes carried round and catching up.
        pose.x = 0.26 * amp * bump(p);
        pose.roll = ((pose.x / 0.8) * 180) / Math.PI;
        break;
      }
      if (shape === "cloud") {
        // A cloud drifts off a little way and back, leaning into it.
        pose.x = 0.24 * amp * bump(p);
        pose.roll = -6 * amp * Math.sin(2 * Math.PI * clamp01(p));
        pose.lift = 0.04 * amp * bump(p);
        break;
      }
      pose.yaw = TURN_BY[shape] * easeOutBack(span(p, 0.06, 0.82), 1.4);
      pose.lift = 0.05 * amp * bump(span(p, 0.06, 0.6));
      pose.shut = span(p, 0.1, 0.3) - span(p, 0.55, 0.75);
      break;
    }
    case "flip": {
      pose.pitch = -360 * easeInOut(span(p, 0.14, 0.82));
      pose.lift = 0.42 * amp * arc(span(p, 0.12, 0.86));
      pose.squash = keys(p, [
        [0, 1],
        [0.1, 1 - 0.14 * amp],
        [0.2, 1 + 0.08 * amp],
        [0.8, 1],
        [0.88, 1 - 0.1 * amp],
        [1, 1],
      ]);
      break;
    }
    case "nod": {
      pose.pitch = -17 * amp * Math.sin(4 * Math.PI * p) * (1 - p) ** 0.5;
      pose.lift = -0.012 * amp * bump(p);
      break;
    }
    case "shake": {
      pose.yaw = 24 * amp * wobble(p, 2.5);
      break;
    }
    case "wave": {
      pose.roll = 12 * amp * wobble(p, 2);
      pose.yaw = -9 * amp * wobble(span(p, 0.06, 1), 2);
      pose.squash = 1 + 0.04 * amp * wobble(p, 4);
      break;
    }
    case "pop": {
      // A star for a beat, twirling into it, eyes starry.
      const star = into(p, 0.1, 0.32, 0.72, 0.95);
      pose.morphTo = "star";
      pose.morph = clamp01(star);
      pose.yaw = 360 * easeInOut(span(p, 0.08, 0.5));
      pose.lift = 0.16 * amp * arc(span(p, 0.06, 0.55));
      pose.squash = keys(p, [
        [0, 1],
        [0.08, 1 - 0.1 * amp],
        [0.2, 1 + 0.06 * amp],
        [0.5, 1],
      ]);
      pose.glyph = "star";
      pose.glyphMix = clamp01(span(p, 0.14, 0.3) - span(p, 0.7, 0.88));
      break;
    }
    case "melt": {
      // Into a blob that sags, then pulled back together with a bounce.
      const blob = into(p, 0, 0.32, 0.68, 0.92);
      pose.morphTo = "blob";
      pose.morph = clamp01(blob);
      pose.squash = 1 - 0.16 * clamp01(blob) + 0.05 * amp * wobble(span(p, 0.86, 1), 1.5);
      pose.roll = 4 * amp * Math.sin(p * Math.PI * 3) * clamp01(blob);
      break;
    }
    case "love": {
      // A heart that beats twice, the eyes happy.
      const heart = into(p, 0.08, 0.3, 0.74, 0.95);
      pose.morphTo = "heart";
      pose.morph = clamp01(heart);
      pose.pulse = 1 + 0.08 * clamp01(heart) * Math.max(0, Math.sin(2 * Math.PI * 2.2 * span(p, 0.3, 0.74))) ** 3;
      pose.lift = 0.05 * amp * bump(span(p, 0.05, 0.4));
      pose.glyph = "arc";
      pose.glyphMix = clamp01(span(p, 0.1, 0.24) - span(p, 0.74, 0.9));
      break;
    }
  }
  return pose;
}

// ---------------------------------------------------------------------------------------------
// Loops

/**
 * How the body moves in a loop at `t` seconds, any shape: breathing is the Aura's own swell; at
 * work it bobs; thinking (but for the cube, which solves itself instead) and floating it drifts and
 * sways; asleep it sinks a little; worried it trembles now and then.
 */
export function bodyLoopAt(loop: Loop, t: number, shape: Shape, amp = 1): Pose {
  const pose: Pose = { ...REST };
  if (loop === "work") {
    pose.lift = 0.025 * amp * Math.abs(Math.sin(t * 5.2));
    pose.squash = 1 - 0.015 * amp * Math.cos(t * 10.4);
  } else if (loop === "float" || (loop === "think" && shape !== "cube")) {
    pose.lift = 0.06 * amp * (0.5 + 0.5 * Math.sin(t * 1.7));
    pose.yaw = 9 * amp * Math.sin(t * 0.8);
    pose.roll = 3 * amp * Math.sin(t * 1.1 + 1);
  } else if (loop === "rest") {
    pose.lift = shape === "cloud" ? -0.06 : 0;
    pose.squash = 1 - 0.012 * (0.5 + 0.5 * Math.sin(t * 1.4));
    pose.x = shape === "cloud" ? 0.03 * Math.sin(t * 0.5) : 0;
  } else if (loop === "worry") {
    // A tremble, in bursts.
    const burst = Math.max(0, Math.sin(t * 2.1)) ** 6;
    pose.x = 0.012 * amp * burst * Math.sin(t * 71);
    pose.roll = 1.6 * amp * burst * Math.sin(t * 53 + 1);
  }
  return pose;
}

/** Where a loop is at `t` seconds: the body's part, and the shape's own (`actLoopAt`) at full strength. */
export function loopAt(loop: Loop, t: number, shape: Shape, amp = 1): Pose {
  return combine(bodyLoopAt(loop, t, shape, amp), actLoopAt(loop, t, shape, amp, 1));
}

/**
 * A shape's own loop act as it plays (the cube's Rubik's turns, the block's cryptex…): which loop,
 * when it began (ms, on the page's clock), and when it was told to stop turning, if it was.
 */
export type LoopAct = { loop: Loop; from: number; stop: number | null };

/** How often a loop act comes back to where it started, in seconds at lively energy: the thinking cube's round, or the shape's own (`QUANTUM`). */
export const quantumOf = (loop: Loop, shape: Shape) => (loop === "think" && shape === "cube" ? THINKING_CYCLE : QUANTUM[loop][shape]);

/** When a loop act told to stop at `now` stops turning: the next time it's back where it started (now, if nothing of it turns). */
export function stopFor(act: LoopAct, now: number, shape: Shape, speed: number) {
  const quantum = quantumOf(act.loop, shape) * speed * 1000;
  if (!quantum || now <= act.from) return Math.max(now, act.from);
  return act.from + Math.ceil((now - act.from) / quantum) * quantum;
}

/**
 * A loop act at `now`: its clock (seconds, at lively energy) and how strong it is, coming in over
 * `ENVELOPE.in` and going out over `ENVELOPE.out` once it has stopped turning; null once it's gone.
 * Its clock stands still from its stop, so whatever it turns stays home while it fades.
 */
export function loopActAt(act: LoopAct, now: number, shape: Shape, speed: number): { t: number; env: number } | null {
  if (now < act.from) return { t: 0, env: 0 };
  const turns = quantumOf(act.loop, shape) > 0;
  const clock = turns && act.stop !== null ? Math.min(now, act.stop) : now;
  const t = (clock - act.from) / 1000 / speed;
  const rise = span((now - act.from) / 1000, 0, ENVELOPE.in * speed);
  if (act.stop === null) return { t, env: rise };
  const fall = 1 - span((now - act.stop) / 1000, 0, ENVELOPE.out * speed);
  if (now >= act.stop && fall <= 0) return null;
  return { t, env: Math.min(rise, fall) };
}

// ---------------------------------------------------------------------------------------------
// The cube's Rubik's turns, while it thinks

/** The thinking cube's timing, in seconds: it splits, makes its moves (a scramble, then its solution), holds, joins and rests. */
export const THINKING = { split: 0.4, move: 0.46, pause: 0.12, moves: 4, hold: 0.35, join: 0.4, rest: 1 } as const;
export const THINKING_CYCLE = THINKING.split + THINKING.moves * 2 * (THINKING.move + THINKING.pause) + THINKING.hold + THINKING.join + THINKING.rest;

/**
 * Where the thinking cube is at `t` seconds: how far it has split into cubelets, the moves done
 * so far this round (to be applied to a solved cube), and the move under way with how far it has
 * turned (radians). Each round scrambles by its own moves and solves itself by the end.
 */
export function thinkingAt(t: number, seed: number): { split: number; done: Move[]; turning: { move: Move; angle: number } | null } {
  const round = Math.floor(t / THINKING_CYCLE);
  let at = t - round * THINKING_CYCLE;
  const moves = thinkingMoves(seed + round * 7919, THINKING.moves);
  const total = moves.length * (THINKING.move + THINKING.pause);
  let split = 1;
  if (at < THINKING.split) split = easeOut(at / THINKING.split);
  const turningFrom = THINKING.split;
  const joinFrom = turningFrom + total + THINKING.hold;
  if (at >= joinFrom) split = 1 - easeInOut(span(at, joinFrom, joinFrom + THINKING.join));
  at -= turningFrom;
  if (at < 0 || at >= total) return { split, done: at < 0 ? [] : moves, turning: null };
  const step = THINKING.move + THINKING.pause;
  const index = Math.floor(at / step);
  const into = (at - index * step) / THINKING.move;
  if (into >= 1) return { split, done: moves.slice(0, index + 1), turning: null };
  const move = moves[index];
  return { split, done: moves.slice(0, index), turning: { move, angle: (easeInOut(into) * move.turns * Math.PI) / 2 } };
}

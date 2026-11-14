/**
 * The curves the figures move by (figure-motion.ts and figure-acts.ts): easing,
 * keyframes, bumps and wobbles, each a pure function of how far through something is.
 */

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
/** Where `p` is between `from` and `to`, 0 to 1. */
export const span = (p: number, from: number, to: number) => clamp01((p - from) / (to - from));
export const easeOut = (x: number) => 1 - (1 - x) ** 3;
export const easeIn = (x: number) => x ** 3;
export const easeInOut = (x: number) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2);
/** Past the end and back: an overshoot that settles. */
export const easeOutBack = (x: number, s = 1.7) => 1 + (s + 1) * (x - 1) ** 3 + s * (x - 1) ** 2;
/** Up and down again, 0 at both ends and 1 in the middle. */
export const bump = (x: number) => Math.sin(Math.PI * clamp01(x));
/** A ball's arc, 0 at both ends and 1 in the middle. */
export const arc = (x: number) => 4 * clamp01(x) * (1 - clamp01(x));
/** A wobble that dies away: `cycles` swings over 0–1. */
export const wobble = (x: number, cycles: number) => Math.sin(2 * Math.PI * cycles * clamp01(x)) * (1 - clamp01(x)) ** 1.4;

/** A value through keyframes, eased in and out between each: [p, value] pairs, p rising. */
export function keys(p: number, frames: [number, number][]) {
  if (p <= frames[0][0]) return frames[0][1];
  for (let i = 1; i < frames.length; i++) {
    const [p1, v1] = frames[i];
    const [p0, v0] = frames[i - 1];
    if (p <= p1) return v0 + (v1 - v0) * easeInOut(span(p, p0, p1));
  }
  return frames[frames.length - 1][1];
}

/** In and out again, held between: 0 to 1 from `start` to `full`, back to 0 from `leave` to `end`, eased both ways. */
export const hold = (p: number, start: number, full: number, leave: number, end: number) => Math.min(easeInOut(span(p, start, full)), 1 - easeInOut(span(p, leave, end)));

/** Into a morph and out again, held at the top: 0 to 1 by `full`, back to 0 from `leave` to `end`, overshooting on the way in. */
export const into = (p: number, start: number, full: number, leave: number, end = 1) => Math.min(easeOutBack(span(p, start, full), 1.2), 1 - easeInOut(span(p, leave, end)));

/** A number from a seed and an index, the same every time, 0 to 1. */
export const noise = (seed: number, index: number) => {
  const x = Math.sin(seed * 12.9898 + index * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/** Where `t` is in a cycle of `period`, 0 to 1. */
export const phaseOf = (t: number, period: number) => ((t % period) + period) % period / period;

const TAU = Math.PI * 2;
/** A whole turn in radians. */
export const TURN = TAU;

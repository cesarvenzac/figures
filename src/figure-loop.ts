/** One frame loop for every moving figure on the page (AgentFigure.tsx): their eyes tween, blink and glance on it. */

const steps = new Set<(dt: number, now: number) => void>();
let frame = 0;
let last = 0;

function tick(now: number) {
  const dt = Math.min(0.05, last ? (now - last) / 1000 : 1 / 60);
  last = now;
  for (const step of steps) step(dt, now);
  frame = steps.size ? requestAnimationFrame(tick) : 0;
  if (!frame) last = 0;
}

/** Runs `step` every frame, with the seconds since the last and the time now, until the returned function is called. */
export function animate(step: (dt: number, now: number) => void) {
  steps.add(step);
  frame ||= requestAnimationFrame(tick);
  return () => {
    steps.delete(step);
  };
}

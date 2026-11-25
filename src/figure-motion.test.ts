import { describe, expect, it } from "vitest";

import { MOVES, ONCE, REACTIONS, SHAPES } from "./figure.ts";
import { arc, bump, easeOutBack, keys, span } from "./figure-curves.ts";
import { type Asked, bodyLoopAt, combine, type LoopAct, loopActAt, loopAt, moveAt, playFor, quantumOf, REST, stopFor, SWITCH_AT, THINKING, THINKING_CYCLE, thinkingAt, TURN_BY } from "./figure-motion.ts";
import type { Pose } from "./figure-pose.ts";
import { applyMove, isSolved, solved } from "./rubik.ts";

/** An angle as the turn it makes: a whole turn round is no turn at all. */
const turn = (degrees: number) => ((((degrees + 180) % 360) + 360) % 360) - 180;
const turnRadians = (radians: number) => turn((radians * 180) / Math.PI);

/** Whether a pose is at rest, every part of it: turns by whole turns count as home. */
function expectAtRest(pose: Pose, label: string, { glyph = true } = {}) {
  expect(turn(pose.yaw), `${label} yaw`).toBeCloseTo(0, 3);
  expect(turn(pose.pitch), `${label} pitch`).toBeCloseTo(0, 3);
  expect(turn(pose.roll), `${label} roll`).toBeCloseTo(0, 3);
  expect(pose.lift, `${label} lift`).toBeCloseTo(0, 3);
  expect(pose.x, `${label} x`).toBeCloseTo(0, 3);
  expect(pose.squash, `${label} squash`).toBeCloseTo(1, 3);
  expect(pose.pulse, `${label} pulse`).toBeCloseTo(1, 3);
  expect(pose.morph, `${label} morph`).toBeCloseTo(0, 3);
  expect(pose.shut, `${label} shut`).toBeCloseTo(0, 3);
  if (glyph) expect(pose.glyphMix, `${label} glyph`).toBeCloseTo(0, 3);
  expect(pose.eyes, `${label} eyes`).toBeCloseTo(1, 3);
  expect(pose.dim, `${label} dim`).toBeCloseTo(1, 3);
  expect(pose.split, `${label} split`).toBeCloseTo(0, 3);
  expect(pose.spread, `${label} spread`).toBeCloseTo(0, 3);
  for (const angle of pose.layers?.angles ?? []) expect(turnRadians(angle), `${label} layers`).toBeCloseTo(0, 3);
  expect(pose.pieces[0], `${label} slab`).toBeCloseTo(0, 3);
  expect(pose.pieces[1], `${label} capstone's slide`).toBeCloseTo(0, 3);
  expect(pose.pieces[2], `${label} capstone's lift`).toBeCloseTo(0, 3);
  expect(turnRadians(pose.pieces[3]), `${label} capstone's spin`).toBeCloseTo(0, 3);
  expect(pose.shear, `${label} shear`).toBeCloseTo(0, 3);
  expect(pose.core, `${label} core`).toBeCloseTo(1, 3);
  for (const bead of pose.beads) expect(bead[3], `${label} bead`).toBeCloseTo(0, 3);
  for (const puff of pose.puffs ?? []) {
    puff.slice(0, 3).forEach((value) => expect(value, `${label} puff`).toBeCloseTo(0, 3));
    expect(puff[3], `${label} puff's size`).toBeCloseTo(1, 3);
  }
  expect(pose.wave, `${label} wave`).toBeCloseTo(0, 3);
  expect(pose.dent, `${label} dent`).toBeCloseTo(0, 3);
  expect(pose.wrinkle, `${label} wrinkle`).toBeCloseTo(0, 3);
  expect(turnRadians(pose.colourRoll), `${label} colour`).toBeCloseTo(0, 3);
  for (const bit of pose.bits) expect(bit.alpha, `${label} bit`).toBeCloseTo(0, 3);
  expect(pose.rainbow, `${label} rainbow`).toBeCloseTo(0, 3);
  expect(pose.bolt, `${label} bolt`).toBeCloseTo(0, 3);
}

describe("figure motion", () => {
  it("starts and ends every move at rest, for every shape", () => {
    for (const shape of SHAPES) {
      for (const move of ONCE) {
        // Dozing off starts with the eyes still open, waking with them still shut: the expression has already changed.
        expectAtRest(moveAt(move, 0, shape), `${shape} ${move} start`, { glyph: move !== "doze" && move !== "wake" });
        const end = moveAt(move, 1, shape);
        // A turn keeps where it got to: the figure takes it on as its own.
        if (move === "turn") expect(turn(end.yaw - TURN_BY[shape]), `${shape} turn`).toBeCloseTo(0, 3);
        else expectAtRest(end, `${shape} ${move} end`);
      }
    }
  });

  it("knows the moves anything makes from the reactions each shape makes its own way", () => {
    expect([...MOVES, ...REACTIONS]).toEqual([...ONCE]);
    expect(moveAt("pet", 0.5, "cube").glyph).toBe("heart");
    expect(moveAt("celebrate", 0.5, "cube").glyph).toBe("star");
    expect(moveAt("fail", 0.5, "cube").glyph).toBe("cross");
  });

  it("crouches before a hop, rises, and squashes as it lands", () => {
    expect(moveAt("hop", 0.16, "cube").squash).toBeLessThan(0.9);
    expect(moveAt("hop", 0.48, "cube").lift).toBeGreaterThan(0.3);
    expect(moveAt("hop", 0.78, "cube").squash).toBeLessThan(0.92);
    // Bouncier energy, higher hop.
    expect(moveAt("hop", 0.48, "cube", 1.35).lift).toBeGreaterThan(moveAt("hop", 0.48, "cube").lift);
  });

  it("spins all the way round and flips head over heels", () => {
    expect(moveAt("spin", 0.92, "sphere").yaw).toBeCloseTo(360, 0);
    expect(moveAt("flip", 0.85, "cube").pitch).toBeCloseTo(-360, 0);
    expect(moveAt("flip", 0.5, "cube").lift).toBeGreaterThan(0.35);
  });

  it("shuts the eyes through a turn, while they move to the face coming round; a sphere rolls away and back, a cloud drifts", () => {
    expect(moveAt("turn", SWITCH_AT, "cube").shut).toBeCloseTo(1, 2);
    expect(moveAt("turn", 0.9, "cube").shut).toBeCloseTo(0, 2);
    expect(TURN_BY.block).toBe(180);
    const rolling = moveAt("turn", 0.5, "sphere");
    expect(rolling.x).toBeGreaterThan(0.2);
    expect(rolling.roll).toBeGreaterThan(10);
    expect(rolling.shut).toBe(0);
    const drifting = moveAt("turn", 0.5, "cloud");
    expect(drifting.x).toBeGreaterThan(0.2);
    expect(drifting.yaw).toBe(0);
  });

  it("turns into a star, a blob and a heart for a beat, fully in the middle", () => {
    expect(moveAt("pop", 0.5, "cube")).toMatchObject({ morphTo: "star", glyph: "star" });
    expect(moveAt("pop", 0.5, "cube").morph).toBeGreaterThan(0.95);
    expect(moveAt("melt", 0.5, "pyramid")).toMatchObject({ morphTo: "blob" });
    expect(moveAt("melt", 0.5, "pyramid").squash).toBeLessThan(0.9);
    expect(moveAt("love", 0.5, "block")).toMatchObject({ morphTo: "heart", glyph: "arc" });
  });

  it("adds two poses: turns and lifts add, squashes multiply, the stronger morph and glyph win", () => {
    const both = combine({ ...REST, yaw: 10, squash: 0.9, morph: 0.4, morphTo: "blob" }, { ...REST, yaw: 5, squash: 1.1, morph: 0.8, morphTo: "star" });
    expect(both.yaw).toBe(15);
    expect(both.squash).toBeCloseTo(0.99);
    expect(both).toMatchObject({ morph: 0.8, morphTo: "star" });
  });

  it("floats while it thinks, unless it's a cube, which solves itself instead; asleep a cloud sinks, worried anything trembles", () => {
    expect(bodyLoopAt("think", 1, "cube")).toEqual(REST);
    expect(bodyLoopAt("think", 1, "sphere").lift).toBeGreaterThan(0);
    expect(bodyLoopAt("breathe", 1, "pyramid")).toEqual(REST);
    expect(bodyLoopAt("work", 0.3, "block").lift).toBeGreaterThan(0);
    expect(bodyLoopAt("rest", 1, "cloud").lift).toBeLessThan(0);
    // Its trembles come in bursts.
    const trembles = Array.from({ length: 200 }, (_, i) => Math.abs(bodyLoopAt("worry", i * 0.02, "cube").x));
    expect(Math.max(...trembles)).toBeGreaterThan(0.005);
    expect(Math.min(...trembles)).toBeLessThan(0.0005);
    // A loop whole is its body's part and its shape's own act.
    expect(loopAt("work", 0.4, "pyramid").pieces[2]).toBeGreaterThan(0);
  });

  it("splits the thinking cube, scrambles it, and has it solved and whole again by the end of each round", () => {
    expect(thinkingAt(0, 7)).toMatchObject({ split: 0, done: [], turning: null });
    expect(thinkingAt(THINKING.split + 0.01, 7).split).toBeCloseTo(1);
    // Mid-round, a layer is turning, never more than a quarter turn.
    let turned = 0;
    for (let t = THINKING.split; t < THINKING_CYCLE; t += 0.05) {
      const at = thinkingAt(t, 7);
      if (at.turning) {
        turned++;
        expect(Math.abs(at.turning.angle)).toBeLessThanOrEqual(Math.PI / 2 + 1e-9);
      }
    }
    expect(turned).toBeGreaterThan(20);
    const end = thinkingAt(THINKING_CYCLE - 0.01, 7);
    expect(end.split).toBeCloseTo(0, 2);
    expect(isSolved(end.done.reduce(applyMove, solved()))).toBe(true);
    // Halfway through its moves, it's scrambled.
    const half = thinkingAt(THINKING.split + THINKING.moves * (THINKING.move + THINKING.pause) - 0.05, 7);
    expect(isSolved(half.done.reduce(applyMove, solved()))).toBe(false);
    // The same seed, the same round; the next round, other moves.
    expect(thinkingAt(1.3, 7)).toEqual(thinkingAt(1.3, 7));
    expect(thinkingAt(THINKING_CYCLE + 2, 7).done).not.toEqual(thinkingAt(2, 7).done);
  });

  it("brings a loop's own act in, lets it come home when told to stop, and fades it out there", () => {
    const act: LoopAct = { loop: "work", from: 1000, stop: null };
    // Coming in.
    expect(loopActAt(act, 1000, "cube", 1)?.env).toBe(0);
    expect(loopActAt(act, 1300, "cube", 1)?.env).toBeCloseTo(0.5);
    expect(loopActAt(act, 2000, "cube", 1)).toMatchObject({ env: 1, t: 1 });
    // Told to stop at 2 s in, the cube's clockwork stops once it's home: a whole turn of its ticks later.
    const stop = stopFor(act, 3000, "cube", 1);
    expect(stop).toBe(1000 + quantumOf("work", "cube") * 1000);
    const stopping = { ...act, stop };
    expect(loopActAt(stopping, stop - 100, "cube", 1)?.env).toBe(1);
    // From its stop, its clock stands still while it fades.
    expect(loopActAt(stopping, stop + 200, "cube", 1)?.t).toBeCloseTo(quantumOf("work", "cube"));
    expect(loopActAt(stopping, stop + 200, "cube", 1)?.env).toBeLessThan(1);
    expect(loopActAt(stopping, stop + 600, "cube", 1)).toBeNull();
    // Nothing of a loop turns that needs to come home: it stops at once, and its clock runs on as it fades.
    expect(stopFor({ loop: "rest", from: 0, stop: null }, 5000, "cube", 1)).toBe(5000);
    expect(loopActAt({ loop: "rest", from: 0, stop: 5000 }, 5200, "cube", 1)?.t).toBeCloseTo(5.2);
    // Slower energy, slower clock.
    expect(loopActAt(act, 3000, "cube", 1.3)?.t).toBeCloseTo(2 / 1.3);
    // The thinking cube finishes its round.
    expect(quantumOf("think", "cube")).toBe(THINKING_CYCLE);
  });

  it("eases as it should", () => {
    expect(span(5, 0, 10)).toBe(0.5);
    expect(bump(0.5)).toBeCloseTo(1);
    expect(arc(0)).toBe(0);
    expect(easeOutBack(1)).toBeCloseTo(1);
    expect(Math.max(...Array.from({ length: 50 }, (_, i) => easeOutBack(i / 49)))).toBeGreaterThan(1);
    expect(keys(0.5, [[0, 0], [1, 10]])).toBeCloseTo(5);
    expect(keys(-1, [[0, 3], [1, 10]])).toBe(3);
  });
});

describe("a move asked for from outside", () => {
  it("starts once for each `at`, however often it's asked in the same words or the figure stops and starts moving", () => {
    // As AgentFigure asks: what it played last kept from one look to the next.
    let played: string | null = null;
    const look = (play: Asked | undefined, moving: boolean) => {
      const next = playFor(play, moving, played);
      played = next.played;
      return next.start;
    };
    expect(look({ motion: "spin", at: 1 }, true)).toBe("spin");
    // Asked again in the same words, as an inline `play` is on every render: nothing.
    expect(look({ motion: "spin", at: 1 }, true)).toBeNull();
    // Off screen and back: nothing.
    expect(look({ motion: "spin", at: 1 }, false)).toBeNull();
    expect(look({ motion: "spin", at: 1 }, true)).toBeNull();
    // A new `at` plays it again, and a new move at the same moment too.
    expect(look({ motion: "spin", at: 2 }, true)).toBe("spin");
    expect(look({ motion: "hop", at: 2 }, true)).toBe("hop");
    // Asked while it isn't moving, it waits until it is, a newer one taking its place.
    expect(look({ motion: "nod", at: 3 }, false)).toBeNull();
    expect(look({ motion: "pet", at: 4 }, false)).toBeNull();
    expect(look({ motion: "pet", at: 4 }, true)).toBe("pet");
    expect(look({ motion: "pet", at: 4 }, true)).toBeNull();
    // Nothing asked for a while, then the same again: still nothing.
    expect(look(undefined, true)).toBeNull();
    expect(look({ motion: "pet", at: 4 }, true)).toBeNull();
    // A loop isn't a move to make, and it isn't made later either.
    expect(look({ motion: "work", at: 5 }, true)).toBeNull();
    expect(look({ motion: "work", at: 5 }, true)).toBeNull();
    // Every move and reaction can be asked for.
    for (const [k, motion] of ONCE.entries()) expect(look({ motion, at: 10 + k }, true)).toBe(motion);
  });
});

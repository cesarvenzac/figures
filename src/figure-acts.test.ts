import { describe, expect, it } from "vitest";

import { LOOPS, REACTIONS, SHAPES } from "./figure.ts";
import { actAt, actLoopAt, ENVELOPE, hearts, middleOf, QUANTUM, sparks, topOf, zs } from "./figure-acts.ts";
import { REST } from "./figure-pose.ts";
import { BODY, BOTTOM, HOVER, MOST } from "./figure-space.ts";

const TAU = Math.PI * 2;
/** How far an angle is from a whole number of turns. */
const offTurn = (radians: number) => Math.abs(radians - Math.round(radians / TAU) * TAU);

describe("each shape's own acts", () => {
  it("throws hearts, sparks and z's that stay inside the figure's picture", () => {
    for (const shape of SHAPES)
      for (const act of REACTIONS)
        for (let p = 0; p <= 1; p += 0.02) {
          const pose = actAt(act, p, shape);
          expect(pose.bits.length, `${shape} ${act}`).toBeLessThanOrEqual(MOST.bits);
          expect(pose.beads.length, `${shape} ${act}`).toBeLessThanOrEqual(MOST.beads);
          for (const bit of pose.bits) {
            expect(Math.abs(bit.x) + bit.size / 2, `${shape} ${act} x`).toBeLessThan(1.5);
            expect(Math.abs(bit.y) + bit.size / 2, `${shape} ${act} y`).toBeLessThan(1.5);
            expect(bit.alpha).toBeGreaterThanOrEqual(0);
            expect(bit.alpha).toBeLessThanOrEqual(1);
          }
        }
    // Hearts rise above its head and fade; sparks pop round it; z's drift up and away.
    const early = hearts(0.2, "cube", 0.12, 0.16, 0.5, 3)[0];
    const late = hearts(0.5, "cube", 0.12, 0.16, 0.5, 3)[0];
    expect(early.y).toBeGreaterThan(topOf("cube"));
    expect(late.y).toBeGreaterThan(early.y);
    expect(hearts(0.95, "cube", 0.12, 0.16, 0.5, 3).every((heart) => heart.alpha < 0.5)).toBe(true);
    expect(sparks(0.4, "sphere", 0.26, 0.3).length).toBeGreaterThan(1);
    expect(middleOf("cloud")).toBeLessThan(topOf("cloud"));
    // Asleep, a z only once it has had time to doze off; then one rising after another.
    expect(zs(1, "block")).toEqual([]);
    expect(zs(3, "block").length).toBeGreaterThan(0);
    expect(zs(3, "block").every((z) => z.kind === "z")).toBe(true);
  });

  it("pets each shape its own way, the eyes in hearts", () => {
    const at = (shape: (typeof SHAPES)[number]) => actAt("pet", 0.45, shape);
    expect(at("cube").layers?.axis).toBe(1);
    expect(at("cube").layers?.angles[2]).toBeGreaterThan(1);
    expect(actAt("pet", 0.06, "sphere").dent).toBeGreaterThan(0.05);
    expect(at("sphere").wave).toBeGreaterThan(0.01);
    expect(Math.max(...Array.from({ length: 50 }, (_, i) => Math.abs(actAt("pet", i / 49, "pyramid").shear)))).toBeGreaterThan(0.1);
    expect(at("block").layers?.axis).toBe(0);
    expect(at("cloud").puffs?.some((puff) => puff[1] > 0.02)).toBe(true);
    for (const shape of SHAPES) {
      expect(at(shape).glyph).toBe("heart");
      expect(at(shape).bits.some((bit) => bit.kind === "heart")).toBe(true);
    }
  });

  it("celebrates a finished run: bursting, splashing, launching, spinning its dials, a rainbow", () => {
    const burst = actAt("celebrate", 0.4, "cube");
    expect(burst.spread).toBeGreaterThan(0.6);
    expect(burst.split).toBe(1);
    const splash = actAt("celebrate", 0.4, "sphere");
    expect(splash.beads).toHaveLength(6);
    expect(splash.core).toBeLessThan(0.6);
    expect(Math.hypot(splash.beads[0][0], splash.beads[0][1])).toBeGreaterThan(0.6);
    expect(actAt("celebrate", 0.42, "pyramid").pieces[2]).toBeGreaterThan(0.3);
    // The slot machine stops its dials in turn, the middle one, with the eyes, last, each on a whole number of turns.
    const slots = actAt("celebrate", 0.55, "block").layers!;
    expect(offTurn(slots.angles[0])).toBeCloseTo(0, 3);
    expect(offTurn(slots.angles[1])).toBeGreaterThan(0.01);
    const rainbow = actAt("celebrate", 0.6, "cloud");
    expect(rainbow.rainbow).toBe(1);
    expect(rainbow.rainbowSweep).toBeGreaterThan(1);
    for (const shape of SHAPES) expect(actAt("celebrate", 0.85, shape).glyph).toBe("star");
  });

  it("fails each shape its own way, its colour draining", () => {
    // The cube's layers glitch from one wrong place to the next.
    const glitches = new Set(Array.from({ length: 10 }, (_, i) => actAt("fail", 0.2 + i * 0.02, "cube").layers?.angles[2].toFixed(3)));
    expect(glitches.size).toBeGreaterThan(3);
    expect(actAt("fail", 0.5, "sphere").core).toBeLessThan(0.8);
    expect(actAt("fail", 0.4, "sphere").wrinkle).toBeGreaterThan(0.5);
    expect(actAt("fail", 0.4, "pyramid").pieces[0]).toBeGreaterThan(0.1);
    expect(actAt("fail", 0.4, "pyramid").pieces[1]).toBeLessThan(-0.1);
    // The storm: lightning twice, and rain.
    const flashes = Array.from({ length: 200 }, (_, i) => actAt("fail", i / 199, "cloud").bolt);
    expect(Math.max(...flashes)).toBeGreaterThan(0.9);
    expect(actAt("fail", 0.5, "cloud").beads.length).toBeGreaterThan(0);
    for (const shape of SHAPES) {
      expect(actAt("fail", 0.3, shape).dim).toBeLessThan(0.6);
      expect(actAt("fail", 0.3, shape).glyph).toBe("cross");
    }
  });

  it("dozes off with the eyes closing slowly, and wakes with them opening wide", () => {
    expect(actAt("doze", 0.05, "cube")).toMatchObject({ glyph: "rect", glyphMix: 1 });
    expect(actAt("doze", 0.6, "cube").shut).toBeGreaterThan(0.8);
    expect(actAt("wake", 0.05, "cube")).toMatchObject({ glyph: "line", glyphMix: 1 });
    expect(actAt("wake", 0.45, "cube").eyes).toBeGreaterThan(1.15);
    expect(actAt("wake", 0.45, "cube").glyphMix).toBe(0);
  });

  it("does nothing of its own at no strength, nor while it only breathes or floats", () => {
    for (const shape of SHAPES)
      for (const loop of LOOPS) {
        expect(actLoopAt(loop, 1.7, shape, 1, 0), `${shape} ${loop}`).toEqual(REST);
        if (loop === "breathe" || loop === "float") expect(actLoopAt(loop, 1.7, shape, 1, 1)).toEqual(REST);
      }
    expect(ENVELOPE.in).toBeGreaterThan(0);
  });

  it("comes home at each of its quantum's ends, so a loop can stop there without a jump", () => {
    for (const shape of SHAPES)
      for (const loop of LOOPS) {
        const quantum = QUANTUM[loop][shape];
        if (!quantum) continue;
        for (const k of [1, 2, 3]) {
          const home = actLoopAt(loop, k * quantum, shape, 1, 1);
          for (const angle of home.layers?.angles ?? []) expect(offTurn(angle), `${shape} ${loop} layers at ${k}`).toBeCloseTo(0, 2);
          expect(offTurn(home.pieces[3]), `${shape} ${loop} capstone at ${k}`).toBeCloseTo(0, 2);
          expect(offTurn(home.colourRoll), `${shape} ${loop} colour at ${k}`).toBeCloseTo(0, 2);
          expect(home.pieces[2], `${shape} ${loop} capstone down at ${k}`).toBeLessThan(shape === "pyramid" && loop === "think" ? 0.3 : 0.01);
        }
      }
  });

  it("thinks, works, sleeps and worries each its own way", () => {
    // The sphere's moons, budding from it as the act comes in.
    expect(actLoopAt("think", 2, "sphere", 1, 1).beads).toHaveLength(3);
    expect(actLoopAt("think", 2, "sphere", 1, 0.01).beads.every((moon) => Math.hypot(moon[0], moon[1], moon[2]) < BODY.sphere.radius)).toBe(true);
    expect(actLoopAt("think", 2, "pyramid", 1, 1).pieces[2]).toBeGreaterThan(0.18);
    expect(actLoopAt("think", 1.2, "block", 1, 1).split).toBe(1);
    expect(actLoopAt("think", 1, "cloud", 1, 1).puffs).not.toBeNull();
    // At work: the clockwork ticks, the colour rolls, the capstone stamps, the wheels roll, it rains.
    expect(actLoopAt("work", 0.2, "cube", 1, 1).layers?.axis).toBe(1);
    expect(actLoopAt("work", 0.7, "sphere", 1, 1).colourRoll).toBeGreaterThan(1);
    const stamps = Array.from({ length: 40 }, (_, i) => actLoopAt("work", i * 0.02, "pyramid", 1, 1).pieces[2]);
    expect(Math.max(...stamps)).toBeGreaterThan(0.12);
    expect(Math.min(...stamps)).toBeLessThan(0.01);
    expect(actLoopAt("work", 0.4, "block", 1, 1).layers?.angles[1]).toBe(0);
    // Raindrops form under the cloud and fall to the ground.
    const drops = Array.from({ length: 60 }, (_, i) => actLoopAt("work", i * 0.04, "cloud", 1, 1).beads).flat();
    expect(drops.length).toBeGreaterThan(20);
    for (const drop of drops) {
      expect(drop[1]).toBeLessThanOrEqual(BODY.cloud.base);
      expect(drop[1]).toBeGreaterThan(BOTTOM.cloud - HOVER.cloud - 0.05);
    }
    expect(actLoopAt("rest", 3, "cube", 1, 1).bits.some((bit) => bit.kind === "z")).toBe(true);
    expect(Math.max(...Array.from({ length: 100 }, (_, i) => actLoopAt("worry", i * 0.05, "sphere", 1, 1).wrinkle))).toBeGreaterThan(0.2);
    expect(actLoopAt("worry", 1, "cloud", 1, 1).dim).toBeLessThan(1);
  });
});

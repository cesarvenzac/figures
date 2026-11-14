import { describe, expect, it } from "vitest";

import { blendBody, combine, posed, REST } from "./figure-pose.ts";

describe("a figure's pose", () => {
  it("is at rest with nothing of its own moving, and can't be changed in place", () => {
    expect(posed({})).toEqual(REST);
    expect(Object.isFrozen(REST)).toBe(true);
    expect(Object.isFrozen(REST.pieces)).toBe(true);
  });

  it("adds layers turning about one axis, and keeps the one turned further about two", () => {
    const top = posed({ layers: { axis: 1, angles: [0, 0, 1] } });
    const bottom = posed({ layers: { axis: 1, angles: [-0.5, 0, 0.2] } });
    expect(combine(top, bottom).layers).toEqual({ axis: 1, angles: [-0.5, 0, 1.2] });
    const dials = posed({ layers: { axis: 0, angles: [2, 0, 2] } });
    expect(combine(top, dials).layers?.axis).toBe(0);
    expect(combine(REST, top).layers).toEqual(top.layers);
  });

  it("puts beads and bits together, as many as the shader draws, the biggest and brightest kept", () => {
    const beads = combine(posed({ beads: Array.from({ length: 4 }, (_, i) => [i, 0, 0, 0.1 + i * 0.01] as [number, number, number, number]) }), posed({ beads: Array.from({ length: 4 }, () => [0, 0, 0, 0.05] as [number, number, number, number]) })).beads;
    expect(beads).toHaveLength(6);
    expect(beads.filter((bead) => bead[3] === 0.05)).toHaveLength(2);
    const bits = combine(posed({ bits: [0.2, 0.9, 0.5].map((alpha) => ({ kind: "heart" as const, x: 0, y: 0, size: 0.1, alpha })) }), posed({ bits: [0.1, 0.8].map((alpha) => ({ kind: "z" as const, x: 0, y: 0, size: 0.1, alpha })) })).bits;
    expect(bits.map((bit) => bit.alpha)).toEqual([0.9, 0.8, 0.5, 0.2]);
  });

  it("moves the cloud's puffs by both, swells them by both, and multiplies its colour and size", () => {
    const one = posed({ puffs: [[0.1, 0, 0, 1.1]], dim: 0.8, core: 0.9, eyes: 1.2 });
    const two = posed({ puffs: [[0, 0.2, 0, 1.2]], dim: 0.5, core: 0.5, eyes: 1 });
    const both = combine(one, two);
    expect(both.puffs?.[0][0]).toBeCloseTo(0.1);
    expect(both.puffs?.[0][1]).toBeCloseTo(0.2);
    expect(both.puffs?.[0][3]).toBeCloseTo(1.32);
    expect(both.dim).toBeCloseTo(0.4);
    expect(both.core).toBeCloseTo(0.45);
    expect(both.eyes).toBeCloseTo(1.2);
  });

  it("turns one loop's body into the next's, keeping the next one's own parts", () => {
    const from = posed({ lift: 0.2, yaw: 10 });
    const to = posed({ lift: 0, yaw: 0, split: 1 });
    const half = blendBody(from, to, 0.5);
    expect(half.lift).toBeCloseTo(0.1);
    expect(half.yaw).toBeCloseTo(5);
    expect(half.split).toBe(1);
  });
});

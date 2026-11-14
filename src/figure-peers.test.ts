import { describe, expect, it } from "vitest";

import { eventToWatch, gazeAt, glanceTarget, isBusy, type Peer, watchedBy } from "./figure-peers.ts";

const peer = (id: number, mood: Peer["mood"], x: number, extra: Partial<Peer> = {}): Peer => ({ id, mood, box: { x, y: 0, width: 60, height: 60 }, event: 0, watching: null, ...extra });

describe("figures noticing each other", () => {
  it("turns to the latest moment still going, never its own, and not while asleep", () => {
    const self = peer(1, "idle", 0);
    const others = [peer(2, "happy", 200, { event: 5000 }), peer(3, "trouble", 400, { event: 6000 }), peer(4, "idle", 600, { event: 900 })];
    expect(eventToWatch(self, [self, ...others], 1000)?.id).toBe(3);
    expect(eventToWatch({ ...self, event: 9000 }, [{ ...self, event: 9000 }], 1000)).toBeNull();
    expect(eventToWatch({ ...self, mood: "sleep" }, others, 1000)).toBeNull();
    expect(eventToWatch(self, others, 7000)).toBeNull();
  });

  it("looks straight at another figure, the eyes and head turning as far as they go", () => {
    const right = gazeAt(peer(1, "idle", 0).box!, peer(2, "idle", 300).box!);
    expect(right.x).toBeGreaterThan(0.9);
    expect(Math.abs(right.y)).toBeLessThan(0.01);
    const below = gazeAt({ x: 0, y: 0, width: 60, height: 60 }, { x: 0, y: 300, width: 60, height: 60 });
    expect(below.y).toBeGreaterThan(0.6);
    expect(below.x).toBeCloseTo(0);
  });

  it("glances, with nothing to do, at one that's busy; busy, it sometimes looks back at one watching", () => {
    const idle = peer(1, "idle", 0);
    const working = peer(2, "working", 200);
    const thinking = peer(3, "thinking", 400);
    expect([2, 3]).toContain(glanceTarget(idle, [idle, working, thinking, peer(4, "idle", 600)], () => 0.6)?.id);
    expect(glanceTarget(working, [idle, working, thinking], () => 0.1)).toBeNull();
    expect(glanceTarget({ ...idle, mood: "sleep" }, [working], () => 0.1)).toBeNull();
    expect(glanceTarget(idle, [idle, peer(4, "happy", 600)], () => 0.1)).toBeNull();
    expect(watchedBy(working, [{ ...idle, watching: 2 }])?.id).toBe(1);
    expect(watchedBy(idle, [{ ...working, watching: 1 }])).toBeNull();
    expect(isBusy("thinking")).toBe(true);
    expect(isBusy("happy")).toBe(false);
  });
});

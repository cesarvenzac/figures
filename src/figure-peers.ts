import type { Mood } from "./figure.ts";

/**
 * The figures on a page notice each other: when one is petted, finishes or fails, the
 * others turn to look; and now and then one with nothing to do glances at one that's busy, which
 * sometimes looks back. Pure: who to look at, and which way.
 */

/** Where a figure is on the page, in pixels. */
export type Box = { x: number; y: number; width: number; height: number };

/** A figure as the others see it: its state, where it is, its moment (an event still going, ms), and who it's looking at. */
export type Peer = { id: number; mood: Mood; box: Box | null; event: number; watching: number | null };

/** How long the others watch a figure's moment, in ms. */
export const WATCH_FOR = 1600;

/** Busy: at work or setting up. */
export const isBusy = (mood: Mood) => mood === "working" || mood === "thinking";

/** The figure whose moment the others should turn to: the latest still going, never itself, and nobody asleep looks. */
export function eventToWatch(self: Peer, peers: Iterable<Peer>, now: number): Peer | null {
  if (self.mood === "sleep") return null;
  let latest: Peer | null = null;
  for (const peer of peers) if (peer.id !== self.id && peer.event > now && peer.box && (!latest || peer.event > latest.event)) latest = peer;
  return latest;
}

/** Where to look, −1 to 1 each way, to see one box from another: straight at it, as far as the eyes and head go. */
export function gazeAt(from: Box, to: Box, most = 0.95): { x: number; y: number } {
  const dx = to.x + to.width / 2 - (from.x + from.width / 2);
  const dy = to.y + to.height / 2 - (from.y + from.height / 2);
  const distance = Math.hypot(dx, dy) || 1;
  return { x: (dx / distance) * most, y: (dy / distance) * most * 0.7 };
}

/** A busy figure to glance at, at random, for one that isn't busy itself (or asleep); null if there's none. */
export function glanceTarget(self: Peer, peers: readonly Peer[], random: () => number): Peer | null {
  if (self.mood === "sleep" || isBusy(self.mood)) return null;
  const busy = peers.filter((peer) => peer.id !== self.id && peer.box && isBusy(peer.mood));
  return busy.length ? busy[Math.floor(random() * busy.length) % busy.length] : null;
}

/** Who's looking at this figure, if it might look back: a busy figure caught being watched. */
export function watchedBy(self: Peer, peers: Iterable<Peer>): Peer | null {
  if (!isBusy(self.mood)) return null;
  for (const peer of peers) if (peer.id !== self.id && peer.watching === self.id && peer.box) return peer;
  return null;
}

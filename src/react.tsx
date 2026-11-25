"use client";

import { type CSSProperties, type RefObject, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";

import {
  BLINK_FOR,
  type Colourway,
  COLOURWAYS,
  ENERGY,
  type Expression,
  type Face,
  FACE_KEYS,
  FACES,
  type Figure,
  FLAT,
  type Glyph,
  hashOf,
  INK,
  LOOK_KEYS,
  LOOKS,
  type Look,
  type Loop,
  type Mood,
  MOOD,
  type Motion,
  OFF_LOOK,
  ONCE,
  type Once,
  ONCE_FOR,
  reactionTo,
  springStep,
  type Sprung,
  swellAt,
} from "./figure.ts";
import { actLoopAt } from "./figure-acts.ts";
import { easeInOut, span } from "./figure-curves.ts";
import { drawFigure, MOST_PIXELS, NOT_YET, shaderState, watchShader } from "./figure-gl.ts";
import { animate } from "./figure-loop.ts";
import { bodyLoopAt, combine, type LoopAct, loopActAt, moveAt, playFor, REST_YAW, stopFor, SWITCH_AT, thinkingAt, THINKING_CYCLE, TURN_BY } from "./figure-motion.ts";
import { eventToWatch, gazeAt, glanceTarget, type Peer, WATCH_FOR, watchedBy } from "./figure-peers.ts";
import { blendBody, type Pose, REST } from "./figure-pose.ts";
import { sceneFor, type SceneInput } from "./figure-scene.ts";
import { type CosinePalette, type FigureScene, paletteThrough, type Vec3 } from "./figure-space.ts";
import { applyMove, cellsOf, solved } from "./rubik.ts";

/**
 * The figures in React: `AgentFigure`, one live and in 3D, and `AgentDot`, its colours alone.
 * Client components; nothing else to load, no stylesheet.
 */

const joined = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(" ") || undefined;

const REDUCE = "(prefers-reduced-motion: reduce)";
const subscribeToMotion = (callback: () => void) => {
  const query = window.matchMedia(REDUCE);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
};
/** Whether the visitor asked for less motion: false on the server and while hydrating, then their setting, kept current. */
const useReducedMotion = () => useSyncExternalStore(subscribeToMotion, () => window.matchMedia(REDUCE).matches, () => false);

/** Where the page's shader stands (figure-gl.ts): being made ready, as the server has it, until the browser says. */
const useShader = () => useSyncExternalStore(watchShader, shaderState, () => NOT_YET);

/** True while the element is in the viewport and the tab is in front. */
function useOnScreen(ref: RefObject<Element | null>) {
  const [onScreen, setOnScreen] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let intersecting = false;
    const update = () => setOnScreen(intersecting && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => {
      intersecting = entry.isIntersecting;
      update();
    });
    observer.observe(element);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, [ref]);
  return onScreen;
}

/** The canvas is this much bigger than the figure's box, for its halo, its shadow, its hops and what it throws off. */
const CANVAS = 1.5;
/** How long after the pointer last moved the figures stop following it and look at each other again, in ms. */
const POINTER_FRESH = 1600;
/** How long a loop's body takes to turn into the next loop's, in ms. */
const BLEND = 500;
/** A walking hop's height at its top, in world units (the figure's box is 2 wide): lower than a hop on the spot (0.34). */
const WALK_LIFT = 0.22;

// One pointer for every figure on the page: a listener while any is looking, a frame at a time.
let pointer: { x: number; y: number; at: number } | null = null;
const lookers = new Set<() => void>();
let pointerFrame = 0;
function onMove(event: PointerEvent) {
  if (event.pointerType === "touch") return;
  pointer = { x: event.clientX, y: event.clientY, at: performance.now() };
  pointerFrame ||= requestAnimationFrame(() => {
    pointerFrame = 0;
    for (const look of lookers) look();
  });
}
function follow(look: () => void) {
  if (!lookers.size) window.addEventListener("pointermove", onMove, { passive: true });
  lookers.add(look);
  return () => {
    lookers.delete(look);
    if (!lookers.size) window.removeEventListener("pointermove", onMove);
  };
}

// Every moving figure on the page, as the others see it (lib/agents/figure-peers.ts).
const peers = new Map<number, Peer & { element: HTMLElement }>();
let nextPeer = 1;
function boxOf(element: HTMLElement) {
  const box = element.getBoundingClientRect();
  return { x: box.left, y: box.top, width: box.width, height: box.height };
}
/** Tells the other figures to look at this one for a moment. */
function announce(id: number) {
  const peer = peers.get(id);
  if (!peer) return;
  peer.event = performance.now() + WATCH_FOR;
  // The page may have scrolled since: where everyone is, now.
  for (const each of peers.values()) each.box = boxOf(each.element);
}

// Colours as the shader takes them, worked out once a colour: any CSS colour, a custom property
// (`var(--name)`) read from the page's root.
const linears = new Map<string, Vec3>();
const palettes = new Map<string, CosinePalette>();
function linearOf(css: string): Vec3 {
  const known = linears.get(css);
  if (known) return known;
  const variable = /^var\(\s*(--[\w-]+)\s*(?:,\s*(.+))?\)$/.exec(css.trim());
  const colour = variable ? getComputedStyle(document.documentElement).getPropertyValue(variable[1]).trim() || variable[2] || "" : css;
  const context = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
  context.fillStyle = colour || "#888";
  context.fillRect(0, 0, 1, 1);
  const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
  const made = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as Vec3;
  linears.set(css, made);
  return made;
}
function paletteOf(colours: Colourway) {
  const key = `${colours.main}|${colours.light}|${colours.deep}`;
  const known = palettes.get(key);
  if (known) return known;
  const made = paletteThrough(linearOf(colours.main), linearOf(colours.light), linearOf(colours.deep));
  palettes.set(key, made);
  return made;
}

/** How long the 3D drawing takes to fade in, over the flat one when that was there, in ms. */
const FADE = 300;
const FADING = `opacity ${FADE}ms cubic-bezier(0.22, 1, 0.36, 1)`;
/** The canvas's own styles, overhanging the figure's box on every side and letting the pointer through; it fades in once it has drawn. */
const CANVAS_STYLE: CSSProperties = { position: "absolute", left: "-25%", top: "-25%", width: "150%", height: "150%", pointerEvents: "none", opacity: 0, transition: FADING };
const LIT_STYLE: CSSProperties = { ...CANVAS_STYLE, opacity: 1 };

const wait = (from: number, to: number) => from + Math.random() * (to - from);
const sprungFrom = (look: Look) => Object.fromEntries(LOOK_KEYS.map((key) => [key, { value: look[key], velocity: 0 }])) as Record<keyof Look, Sprung>;
const valuesOf = (sprung: Record<keyof Look, Sprung>) => Object.fromEntries(LOOK_KEYS.map((key) => [key, sprung[key].value])) as Look;

type Playing = { motion: Once; start: number; duration: number; from: number; switched: boolean };

/** Everything a live figure keeps between frames. */
type Sim = {
  face: Face;
  glyphFrom: Glyph;
  glyphTo: Glyph;
  glyphMix: number;
  look: Record<keyof Look, Sprung>;
  flow: number;
  hue: number;
  arcAngle: number;
  rings: number;
  baseYaw: number;
  eyeYaw: number;
  trail: { yaw: Sprung; pitch: Sprung; roll: Sprung; seen: [number, number, number] } | null;
  playing: Playing | null;
  /** The loop the body moves in, and the one it's turning from (and since when). */
  body: { loop: Loop; from: Loop; at: number };
  /** The shape's own loop act playing, and the next one, waiting for it to come home. */
  act: LoopAct;
  queued: Loop | null;
  /** No loop act starts before this (a reaction plays first). */
  holdActs: number;
  cube: { key: string; cells: Float32Array };
  drag: { yaw: Sprung; pitch: Sprung; held: boolean };
  busyUntil: number;
  scene?: FigureScene;
};

/**
 * An agent's figure (figure.ts), `size` pixels square: a cube, a sphere, a pyramid, a
 * block or a cloud, really in 3D, in the original Aura's iridescent material in its colourway,
 * with two eyes painted on its face, drawn by one shader for the whole page (figure-gl.ts).
 *
 * Its state (`mood`) gives its expression and how it moves, the shape's own act included (the
 * cube's Rubik's turns as it thinks, the block's dials as wheels at work, z's asleep: figure-acts
 * ts); and as its state changes it reacts, the shape its own way: a run finished, it celebrates;
 * failed, it fails; work starting, it gets going; switched off, it dozes off; on again, it wakes;
 * its finished run seen to, it nods. Clicked (`pet`) while it moves, it's petted, and doesn't open
 * the card it's on. `expression` and `motion` set its face and loop outright (the editor's
 * preview), `play` a move to make, once for each `at`.
 *
 * It holds its head as its expression does, blinks, glances, sways, turns toward the pointer on a
 * desktop (`look`; every figure but a switched-off one), looks at the others on the page when one
 * of them has a moment and now and then at whichever is busy, does its habit while it waits, and
 * smiles with a small bounce when the card it's on is hovered (`react`). `grab` lets it be turned
 * by hand, springing back when let go. `aim` turns its eyes somewhere of its own in place of the
 * pointer and the others' glances (the Lab's playground: at whoever it's talking to), and `lift`
 * hops it off the ground as it walks, its shadow staying there. Its energy scales every move;
 * `drain` (0–1: an agent's budget running out, say) greys it. Its colours are its colourway's
 * (`COLOURWAYS`) unless `colours` says otherwise, and its eyes `INK` unless `ink` does: any CSS
 * colours, a custom property (`var(--name)`) read from the page's root once. All of it is worked
 * out by figure-motion.ts, figure-acts.ts and figure-scene.ts on one frame loop for the page
 * (figure-loop.ts); a still figure (`still`, reduced motion, off screen) is drawn once. Until the
 * page's shader is ready (made ready without holding up the page: figure-gl.ts), it's its flat
 * drawing, fading into the 3D one where it stands once that's drawn; where there's no WebGL 2 it
 * stays flat. A drawing, hidden from assistive tech: the words beside it say who it is and what
 * it's doing.
 */
export function AgentFigure({
  figure,
  mood = "idle",
  expression: asked,
  motion: askedMotion,
  play,
  size = 48,
  look = true,
  react = true,
  pet = true,
  still = false,
  grab = false,
  drain = 0,
  aim,
  lift,
  colours: given,
  ink = INK,
  className,
  style,
}: {
  figure: Figure;
  mood?: Mood;
  expression?: Expression;
  /** A loop to move in, in place of its state's. */
  motion?: Motion;
  /** A move to make, once for each `at` (a new `at` or `motion` makes it again); one asked for while it holds still waits until it moves. */
  play?: { motion: Motion; at: number };
  size?: number;
  look?: boolean;
  react?: boolean;
  pet?: boolean;
  still?: boolean;
  grab?: boolean;
  drain?: number;
  /** Where it looks, from −1 to 1 each way (right and down), in place of the pointer and the others; only another's moment turns it away. */
  aim?: { x: number; y: number };
  /** How far off the ground it is at a moment (frame time, as `performance.now()`), from 0 to 1: a hop's height. Read every frame. */
  lift?: (now: number) => number;
  /** Its colours, in place of its colourway's: any CSS colours, `var(--name)` included. */
  colours?: Colourway;
  /** Its eyes' colour, a CSS colour. */
  ink?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onScreen = useOnScreen(ref);
  const reduced = useReducedMotion();
  const moving = onScreen && !reduced && !still;
  const shader = useShader();
  const ready = shader.readiness === "ready";
  const generation = shader.generation;
  // A canvas that can't be drawn on: the flat drawing, for good.
  const [broken, setBroken] = useState(false);
  const usable = shader.readiness !== "unavailable" && !broken;
  // The shader's generation the canvas has drawn in, and the one whose fade has ended: the flat
  // drawing stands in until then (from the server on, and while a lost context comes back), except
  // for a figure that first came once the shader was ready, which fades in from nothing as before.
  const [litIn, setLitIn] = useState(0);
  const [shownIn, setShownIn] = useState(() => (ready ? generation : 0));
  const lit = usable && ready && litIn === generation;
  const flat = !usable || !ready || shownIn !== generation;
  const litRef = useRef(0);
  const [ratio, setRatio] = useState(2);
  const [override, setOverride] = useState<Expression | null>(null);
  const state = MOOD[mood];
  const expression = override ?? asked ?? state.expression;
  const loop: Loop = askedMotion && !ONCE.includes(askedMotion as Once) ? (askedMotion as Loop) : state.loop;
  const energy = ENERGY[figure.energy];
  const off = mood === "sleep";
  const pixels = Math.min(MOST_PIXELS, Math.round(size * CANVAS * ratio));
  const seed = hashOf(`${figure.shape}${figure.palette}${figure.habit}`);
  const colours = given ?? COLOURWAYS[figure.palette];
  const paint = `${colours.main}|${colours.light}|${colours.deep}|${ink}`;

  const sim = useRef<Sim>(null as unknown as Sim);
  sim.current ??= {
    face: { ...FACES[expression] },
    glyphFrom: FACES[expression].glyph,
    glyphTo: FACES[expression].glyph,
    glyphMix: 0,
    look: sprungFrom(off ? OFF_LOOK : LOOKS[expression]),
    flow: (seed % 1000) / 100,
    hue: 0,
    arcAngle: 0,
    rings: 0,
    baseYaw: 0,
    eyeYaw: 0,
    trail: null,
    playing: null,
    body: { loop, from: loop, at: 0 },
    act: { loop, from: 0, stop: null },
    queued: null,
    holdActs: 0,
    cube: { key: "", cells: cellsOf(solved()) },
    drag: { yaw: { value: 0, velocity: 0 }, pitch: { value: 0, velocity: 0 }, held: false },
    busyUntil: 0,
  };
  const gaze = useRef({ x: 0, y: 0 });
  const glance = useRef({ x: 0, y: 0, until: 0, next: 0 });
  const watch = useRef({ x: 0, y: 0, until: 0, of: 0, moment: false, next: 0, back: 0 });
  const hover = useRef({ until: 0, last: -Infinity });
  const blink = useRef({ next: 0, start: -1 });
  const peerId = useRef(0);
  const lastMood = useRef<Mood | null>(null);
  // Read by the frame loop as they are now, without starting it again.
  const aimRef = useRef(aim);
  const liftRef = useRef(lift);
  useEffect(() => {
    aimRef.current = aim;
    liftRef.current = lift;
  }, [aim, lift]);

  // How sharp to draw: the screen's own pixels, up to two a pixel.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the screen's pixel ratio is only known in the browser.
    setRatio(Math.min(2, Math.max(1, window.devicePixelRatio || 1)));
  }, []);

  /** Builds this moment's scene and draws it; false when there's no shader. */
  const draw = (now: number, open = 1) => {
    const canvas = canvasRef.current;
    if (!canvas) return true;
    const s = sim.current;
    const t = now / 1000;
    const shape = figure.shape;
    // The body's loop, turning from the last one into this one.
    const blend = easeInOut(span(now, s.body.at, s.body.at + BLEND));
    let pose: Pose = blend < 1 ? blendBody(bodyLoopAt(s.body.from, t, shape, energy.amp), bodyLoopAt(s.body.loop, t, shape, energy.amp), blend) : bodyLoopAt(s.body.loop, t, shape, energy.amp);
    // The shape's own act, when it's moving: once one has gone home, the next begins.
    let split = 0;
    let turning: SceneInput["turning"] = null;
    if (moving && !still) {
      let playing = loopActAt(s.act, now, shape, energy.speed);
      if (!playing && s.queued) {
        s.act = { loop: s.queued, from: Math.max(now, s.holdActs), stop: null };
        s.queued = null;
        playing = loopActAt(s.act, now, shape, energy.speed);
      }
      if (playing && playing.env > 0) {
        if (s.act.loop === "think" && shape === "cube") {
          // The cube's Rubik's turns: it splits, scrambles, solves itself and joins up each round.
          const thinking = thinkingAt(playing.t, seed);
          split = thinking.split;
          const key = `${Math.floor(playing.t / THINKING_CYCLE)}:${thinking.done.length}`;
          if (key !== s.cube.key) s.cube = { key, cells: cellsOf(thinking.done.reduce(applyMove, solved())) };
          if (thinking.turning) turning = { axis: thinking.turning.move.axis, layer: thinking.turning.move.layer, angle: thinking.turning.angle };
        } else pose = combine(pose, actLoopAt(s.act.loop, playing.t, shape, energy.amp, playing.env));
      }
    }
    const playing = s.playing;
    if (playing) {
      const p = Math.min(1, (now - playing.start) / playing.duration);
      pose = combine(pose, moveAt(playing.motion, p, shape, energy.amp));
    }
    // Turned by hand, and off the ground as it walks.
    pose = { ...pose, yaw: pose.yaw + s.drag.yaw.value, pitch: pose.pitch + s.drag.pitch.value, lift: pose.lift + WALK_LIFT * (liftRef.current?.(now) ?? 0) };
    let trailing: SceneInput["trailing"] = null;
    if (shape === "sphere" && s.trail) trailing = { yaw: s.trail.yaw.value, pitch: s.trail.pitch.value, roll: s.trail.roll.value };
    const lookNow = valuesOf(s.look);
    s.scene = sceneFor(
      {
        figure,
        face: s.face,
        glyph: s.glyphFrom,
        glyphTo: s.glyphTo,
        glyphMix: s.glyphMix,
        open,
        pose,
        baseYaw: s.baseYaw,
        eyeYaw: s.eyeYaw,
        trailing,
        look: lookNow,
        flow: s.flow,
        hue: s.hue,
        arcAngle: s.arcAngle,
        rings: s.rings,
        time: t,
        swell: swellAt(lookNow, t),
        palette: paletteOf(colours),
        split,
        cells: split > 0 ? s.cube.cells : null,
        turning,
        ink: linearOf(ink),
        drain,
      },
      s.scene,
    );
    if (!drawFigure(canvas, s.scene)) return false;
    if (litRef.current !== generation) {
      litRef.current = generation;
      setLitIn(generation);
    }
    return true;
  };
  /** Drawn, or the flat drawing for good where the shader is ready and the canvas still can't be drawn on. */
  const drawOrBreak = (now: number, open?: number) => {
    if (!draw(now, open) && shaderState().readiness === "ready") setBroken(true);
  };

  // Once the 3D drawing has faded in, the flat one goes.
  useEffect(() => {
    if (!lit || shownIn === generation) return;
    const timer = setTimeout(() => setShownIn(generation), FADE);
    return () => clearTimeout(timer);
  }, [lit, shownIn, generation]);

  // A still figure, drawn once as its expression has it, once the shader is ready (and again if the context comes back).
  useEffect(() => {
    if (moving || !ready || broken) return;
    const s = sim.current;
    s.face = { ...FACES[expression] };
    s.glyphFrom = s.glyphTo = FACES[expression].glyph;
    s.glyphMix = 0;
    s.look = sprungFrom(off ? OFF_LOOK : LOOKS[expression]);
    s.playing = null;
    s.trail = null;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- whether the canvas drew (and so fades in) is only known once it has.
    drawOrBreak(performance.now());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moving, ready, generation, broken, expression, figure.shape, paint, off, pixels, drain]);

  // A new shape starts from its own front.
  useEffect(() => {
    const s = sim.current;
    s.baseYaw = s.eyeYaw = 0;
    s.trail = null;
    s.playing = null;
  }, [figure.shape]);

  /** Starts a move now (from its start, if it's the one already under way). */
  const start = (motion: Once) => {
    const s = sim.current;
    if (s.playing?.motion === "turn" && !s.playing.switched) return;
    s.playing = { motion, start: performance.now(), duration: ONCE_FOR[motion] * energy.speed, from: s.baseYaw, switched: false };
  };

  // Its state changing: it reacts (a run finished, it celebrates…), and its loop turns into the
  // next: the body at once, the shape's own act once the last one has come home and the reaction
  // has played.
  useEffect(() => {
    const s = sim.current;
    const now = performance.now();
    const from = lastMood.current;
    lastMood.current = mood;
    if (from && from !== mood && moving) {
      const reaction = reactionTo(from, mood);
      if (reaction) {
        start(reaction);
        s.holdActs = now + ONCE_FOR[reaction] * energy.speed * 0.8;
        if (reaction === "celebrate" || reaction === "fail") announce(peerId.current);
      }
    }
    if (s.body.loop !== loop) s.body = { loop, from: s.body.loop, at: now };
    if (s.act.loop === loop) {
      // Asked back before it went: carry on.
      if (s.act.stop !== null && loopActAt(s.act, now, figure.shape, energy.speed)) s.act.stop = null;
      s.queued = null;
      return;
    }
    if (loopActAt(s.act, now, figure.shape, energy.speed)?.env) {
      s.act.stop ??= stopFor(s.act, now, figure.shape, energy.speed);
      s.queued = loop;
    } else {
      s.act = { loop, from: Math.max(now, s.holdActs), stop: null };
      s.queued = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mood, loop]);

  // While it moves: the face tweens toward its expression, the eyes blink and glance, its Aura
  // glows and flows, it makes its moves, and it's drawn, every frame while something's happening
  // and every other one while it only breathes.
  useEffect(() => {
    if (!moving || !ready || broken) return;
    const s = sim.current;
    const face = FACES[expression];
    const target = off ? OFF_LOOK : LOOKS[expression];
    blink.current.next = performance.now() + wait(600, 2600);
    glance.current.next = performance.now() + wait(1500, 5000);
    watch.current.next = performance.now() + wait(3000, 9000);
    const phase = (seed % 628) / 100;
    let frames = 0;
    return animate((dt, now) => {
      const t = now / 1000;
      const g = glance.current;
      if (!face.scan && !face.dx && figure.habit !== "look" && now > g.next) Object.assign(g, { x: (Math.random() - 0.5) * 1.6, y: (Math.random() - 0.5) * 0.9, until: now + wait(700, 1300), next: now + wait(4000, 9000) });
      // The others on the page: another's moment to turn to (before anything), or, while the
      // pointer is still, a busy one to glance at, or one caught looking at this one to look back at.
      const w = watch.current;
      const self = peers.get(peerId.current);
      const pointerFresh = pointer !== null && now - pointer.at < POINTER_FRESH;
      if (self?.box) {
        const moment = eventToWatch(self, peers.values(), now);
        if (moment?.box) {
          if (!w.moment || w.of !== moment.id) Object.assign(w, { ...gazeAt(self.box, moment.box), of: moment.id, moment: true });
          w.until = moment.event;
        } else if (!pointerFresh && now > w.until) {
          const watcher = watchedBy(self, peers.values());
          if (watcher?.box && w.back !== watcher.id) {
            w.back = watcher.id;
            if (Math.random() < 0.5) Object.assign(w, { ...gazeAt(self.box, watcher.box), until: now + 900, of: watcher.id, moment: false });
          } else if (now > w.next) {
            const busy = glanceTarget(self, [...peers.values()], Math.random);
            if (busy?.box) Object.assign(w, { ...gazeAt(self.box, busy.box), until: now + wait(1100, 1700), of: busy.id, moment: false });
            w.next = now + wait(6000, 14000);
          }
          if (!watcher) w.back = 0;
        }
        self.watching = now < w.until ? w.of : null;
      }
      const aimed = aimRef.current;
      const watching = now < w.until && (w.moment || (!pointerFresh && !aimed));
      // Where it looks, from −1 to 1 each way: the pointer, the others, a glance, scanning its work.
      const scan = face.scan ? Math.sin(t * 2.3 + phase) : 0;
      const toward = aimed ?? gaze.current;
      const x = (watching ? w.x : toward.x) + (now < g.until ? g.x : 0) + scan;
      const y = (watching ? w.y : toward.y) + (now < g.until ? g.y : 0);
      const bob = face.bob ? Math.abs(Math.sin(t * 8.5 + phase)) : 0;
      const amp = energy.amp;
      const goal: Face = {
        ...face,
        dx: face.dx + x * 0.035,
        dy: face.dy - y * 0.025 + bob * 0.02,
        // Watching another's moment, its eyes widen a little.
        size: face.size + (face.pulse ? Math.sin(t * 3 + phase) * 0.03 : 0) + (watching && w.moment ? 0.08 : 0),
        yaw: face.yaw + x * 22 + Math.sin(t * 0.6 + phase) * 3 * amp,
        pitch: face.pitch - y * 14 + bob * 3 + Math.sin(t * 0.43 + phase * 2) * 2 * amp,
        roll: face.roll + Math.sin(t * 0.37 + phase) * 1.5 * amp,
      };
      const k = 1 - Math.exp((-dt * 10) / energy.speed);
      for (const key of FACE_KEYS) s.face[key] += (goal[key] - s.face[key]) * k;
      // The eyes' shape: a smile while hovered, else the expression's, morphing from one to the other.
      const glyph: Glyph = now < hover.current.until ? "arc" : face.glyph;
      if (glyph !== s.glyphTo) {
        s.glyphFrom = s.glyphMix > 0.5 ? s.glyphTo : s.glyphFrom;
        s.glyphTo = glyph;
        s.glyphMix = 0;
      }
      s.glyphMix = Math.min(1, s.glyphMix + dt * 6);
      if (s.glyphMix >= 1) s.glyphFrom = s.glyphTo;
      let open = 1;
      const b = blink.current;
      if (face.blink !== "none" && s.glyphTo === "rect") {
        if (b.start < 0 && now > b.next) b.start = now;
        if (b.start >= 0) {
          const p = (now - b.start) / BLINK_FOR[face.blink];
          if (p >= 1) {
            b.start = -1;
            // Now and then twice in a row.
            b.next = now + (Math.random() < 0.18 ? 140 : wait(2400, 6200));
          } else open = 1 - Math.sin(Math.PI * p) * 0.94;
        }
      }
      // Its Aura springs toward the look, and flows.
      for (const key of LOOK_KEYS) s.look[key] = springStep(s.look[key], target[key], Math.min(dt, 1 / 30));
      const speed = s.look.speed.value;
      s.flow += (speed * dt) / energy.speed;
      s.hue += (0.015 + speed * 0.03) * dt;
      s.arcAngle += 0.85 * dt;
      s.rings += 3.2 * dt;
      // A move: when it's done, its turn is kept; halfway through a turn, the eyes move to the face coming round.
      const playing = s.playing;
      if (playing) {
        const p = (now - playing.start) / playing.duration;
        if (playing.motion === "turn" && !playing.switched && p >= SWITCH_AT && TURN_BY[figure.shape]) {
          playing.switched = true;
          s.eyeYaw = (playing.from + TURN_BY[figure.shape]) % 360;
        }
        if (p >= 1) {
          if (playing.motion === "turn" && TURN_BY[figure.shape]) s.baseYaw = (playing.from + TURN_BY[figure.shape]) % 360;
          s.playing = null;
        }
      }
      // Turned by hand: springs home once let go.
      if (!s.drag.held) {
        s.drag.yaw = springStep(s.drag.yaw, 0, Math.min(dt, 1 / 30));
        s.drag.pitch = springStep(s.drag.pitch, 0, Math.min(dt, 1 / 30));
      }
      // A sphere's eyes trail its turns a moment behind, catching up with a little overshoot.
      if (figure.shape === "sphere") {
        const pose = s.playing ? moveAt(s.playing.motion, Math.min(1, (now - s.playing.start) / s.playing.duration), "sphere", amp) : REST;
        const angles: [number, number, number] = [REST_YAW.sphere + s.face.yaw + pose.yaw + s.drag.yaw.value, s.face.pitch + pose.pitch + s.drag.pitch.value, s.face.roll + pose.roll];
        if (!s.trail) s.trail = { yaw: { value: angles[0], velocity: 0 }, pitch: { value: angles[1], velocity: 0 }, roll: { value: angles[2], velocity: 0 }, seen: angles };
        const trail = s.trail;
        (["yaw", "pitch", "roll"] as const).forEach((axis, i) => {
          // A jump (a spin ending at a whole turn) moves the eyes with it, not round again.
          const jump = angles[i] - trail.seen[i];
          if (Math.abs(jump) > 90) trail[axis].value += jump;
          trail[axis] = trailStep(trail[axis], angles[i], Math.min(dt, 1 / 30));
        });
        trail.seen = angles;
      } else s.trail = null;
      // Drawn every frame while something's happening, every other while it only breathes.
      frames++;
      const acting = s.act.loop !== "breathe" && s.act.loop !== "float";
      const walking = (liftRef.current?.(now) ?? 0) > 0;
      const busy = s.playing || acting || s.queued || now < s.busyUntil || now < hover.current.until || now < w.until || s.drag.held || Math.abs(s.drag.yaw.value) > 0.5 || pointerFresh || walking;
      if (!busy && frames % 2) return;
      drawOrBreak(now, open);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moving, ready, generation, broken, expression, figure.shape, figure.habit, paint, energy.speed, energy.amp, off, pixels, drain]);

  // Its state's move, now and then (a pleased figure turns into a star for a beat).
  useEffect(() => {
    if (!moving || !state.now || asked) return;
    let timer: ReturnType<typeof setTimeout>;
    const next = () => {
      timer = setTimeout(
        () => {
          if (!sim.current.playing) start(state.now!);
          next();
        },
        wait(...(state.every ?? [6000, 12000])) * energy.speed,
      );
    };
    next();
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moving, state.now, asked, energy.speed]);

  // Its habit, while it waits: looking around, humming, napping, spinning, wobbling, shape-shifting.
  useEffect(() => {
    if (!moving || mood !== "idle" || asked) return;
    let timer: ReturnType<typeof setTimeout>;
    let shifts = 0;
    const steps = (list: [() => void, number][]) => {
      let i = 0;
      const step = () => {
        if (i >= list.length) return next();
        const [act, hold] = list[i++];
        act();
        timer = setTimeout(step, hold);
      };
      step();
    };
    const lookTo = (x: number, y: number, hold: number) => () => Object.assign(glance.current, { x, y, until: performance.now() + hold, next: Infinity });
    const next = () => {
      timer = setTimeout(
        () => {
          if (figure.habit === "look") steps([[lookTo(-1, 0.2, 1000), 1000], [lookTo(1, -0.25, 1000), 1000], [lookTo(0, 0, 0), 0]]);
          else if (figure.habit === "hum") steps([[() => setOverride("speaking"), 2200], [() => setOverride(null), 0]]);
          else if (figure.habit === "nap") steps([[() => setOverride("tired"), 2400], [() => setOverride("sleeping"), 4200], [() => setOverride(null), 0]]);
          else {
            if (!sim.current.playing) start(figure.habit === "morph" ? (shifts++ % 2 ? "pop" : "melt") : figure.habit === "spin" ? "spin" : "wave");
            next();
          }
        },
        figure.habit === "look" ? wait(3500, 7000) : wait(7000, 13000),
      );
    };
    next();
    return () => {
      clearTimeout(timer);
      setOverride(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moving, mood, asked, figure.habit]);

  // Hovering the card it's on: a smile and a small bounce, not on every pass.
  useEffect(() => {
    const host = ref.current?.closest("a, button, [data-figure-host]");
    if (!moving || !react || !host || off) return;
    const enter = () => {
      const now = performance.now();
      const h = hover.current;
      if (now - h.last < 2500) return;
      h.last = now;
      h.until = now + 1300;
      if (!sim.current.playing) start("bounce");
    };
    host.addEventListener("pointerenter", enter);
    return () => host.removeEventListener("pointerenter", enter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moving, react, off]);

  // It turns toward the pointer on a desktop, head and eyes: every figure but a switched-off one.
  useEffect(() => {
    if (!moving || !look || off || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const turnTo = () => {
      const box = ref.current?.getBoundingClientRect();
      if (!box || !pointer) return;
      const dx = pointer.x - (box.left + box.width / 2);
      const dy = pointer.y - (box.top + box.height / 2);
      const distance = Math.hypot(dx, dy) || 1;
      const reach = Math.min(1, distance / Math.max(180, box.width * 3));
      gaze.current = { x: (dx / distance) * reach, y: (dy / distance) * reach };
    };
    turnTo();
    const stop = follow(turnTo);
    return () => {
      stop();
      gaze.current = { x: 0, y: 0 };
    };
  }, [moving, look, off]);

  // One of the figures on the page, for the others to look at; where it is, read again on scroll.
  useEffect(() => {
    const element = ref.current;
    if (!moving || !element) return;
    const id = (peerId.current ||= nextPeer++);
    peers.set(id, { id, mood, box: boxOf(element), event: 0, watching: null, element });
    const place = () => {
      const peer = peers.get(id);
      if (peer) peer.box = boxOf(element);
    };
    window.addEventListener("scroll", place, { passive: true });
    window.addEventListener("resize", place);
    return () => {
      peers.delete(id);
      window.removeEventListener("scroll", place);
      window.removeEventListener("resize", place);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moving]);
  useEffect(() => {
    const peer = peers.get(peerId.current);
    if (peer) peer.mood = mood;
  }, [mood]);

  // A move asked for from outside, as it arrives: once for each `at`, read by what it says (an
  // inline `play` is a new object every render), and not again as the figure comes back on screen;
  // one asked for while it isn't moving waits until it is. After the figure joins the others,
  // so they turn to its moment.
  const played = useRef<string | null>(null);
  const playMotion = play?.motion;
  const playAt = play?.at;
  useEffect(() => {
    const next = playFor(playMotion === undefined || playAt === undefined ? undefined : { motion: playMotion, at: playAt }, moving, played.current);
    played.current = next.played;
    if (!next.start) return;
    start(next.start);
    if (next.start === "pet" || next.start === "celebrate" || next.start === "fail") announce(peerId.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playMotion, playAt, moving]);

  // Petted: clicked, it's petted (and the card it's on doesn't open); dragged where `grab` is on,
  // it turns with the pointer and springs home when let go.
  useEffect(() => {
    const root = ref.current;
    if (!root || !moving || (!grab && !pet)) return;
    const s = sim.current;
    let from: { x: number; y: number; yaw: number; pitch: number } | null = null;
    let dragged = false;
    const down = (event: PointerEvent) => {
      if (!grab || event.button !== 0) return;
      from = { x: event.clientX, y: event.clientY, yaw: s.drag.yaw.value, pitch: s.drag.pitch.value };
      dragged = false;
    };
    const move = (event: PointerEvent) => {
      if (!from) return;
      const dx = event.clientX - from.x;
      const dy = event.clientY - from.y;
      if (!dragged && Math.hypot(dx, dy) < 5) return;
      if (!dragged) {
        dragged = true;
        s.drag.held = true;
        root.setPointerCapture(event.pointerId);
        root.style.cursor = "grabbing";
      }
      const yaw = from.yaw + (dx / size) * 220;
      const pitch = Math.max(-70, Math.min(70, from.pitch - (dy / size) * 160));
      s.drag.yaw = { value: yaw, velocity: (yaw - s.drag.yaw.value) * 60 };
      s.drag.pitch = { value: pitch, velocity: (pitch - s.drag.pitch.value) * 60 };
    };
    const up = () => {
      from = null;
      s.drag.held = false;
      root.style.cursor = "";
      // Home the short way round.
      s.drag.yaw.value = ((((s.drag.yaw.value + 180) % 360) + 360) % 360) - 180;
    };
    const click = (event: MouseEvent) => {
      if (!dragged && !pet) return;
      event.preventDefault();
      event.stopPropagation();
      if (dragged) {
        dragged = false;
        return;
      }
      if (off) return;
      if (s.playing?.motion !== "pet") start("pet");
      announce(peerId.current);
    };
    root.addEventListener("pointerdown", down);
    root.addEventListener("pointermove", move);
    root.addEventListener("pointerup", up);
    root.addEventListener("pointercancel", up);
    root.addEventListener("click", click, true);
    return () => {
      root.removeEventListener("pointerdown", down);
      root.removeEventListener("pointermove", move);
      root.removeEventListener("pointerup", up);
      root.removeEventListener("pointercancel", up);
      root.removeEventListener("click", click, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grab, pet, moving, size, off]);

  const pettable = pet && !grab && moving && !off;
  return (
    <div
      ref={ref}
      aria-hidden="true"
      data-mood={mood}
      data-expression={expression}
      data-moving={moving ? "" : undefined}
      className={joined("figure", grab && "figure-grab", pettable && "figure-pet", className)}
      style={{
        position: "relative",
        display: "inline-block",
        flexShrink: 0,
        verticalAlign: "middle",
        width: size,
        height: size,
        cursor: grab ? "grab" : pettable ? "pointer" : undefined,
        touchAction: grab ? "none" : undefined,
        ...style,
      }}
    >
      {flat ? <FlatFigure figure={figure} expression={expression} off={off} colours={colours} ink={ink} shown={!lit} /> : null}
      {usable ? <canvas ref={canvasRef} width={pixels} height={pixels} data-lit={lit ? "" : undefined} style={lit ? LIT_STYLE : CANVAS_STYLE} /> : null}
    </div>
  );
}

/** A trailing spring: quick, a little under critically damped, so the eyes catch up and overshoot a touch. */
function trailStep(current: Sprung, target: number, dt: number): Sprung {
  const force = 230 * (target - current.value) - 22 * current.velocity;
  const velocity = current.velocity + force * dt;
  return { value: current.value + velocity * dt, velocity };
}

/** The figure flat, seen from the front: where there's no WebGL 2 to draw it, and until the shader is ready. It fades out as the 3D drawing fades in over it (`shown`). */
function FlatFigure({ figure, expression, off, colours, ink, shown }: { figure: Figure; expression: Expression; off: boolean; colours: Colourway; ink: string; shown: boolean }) {
  const id = useId();
  const art = FLAT[figure.shape];
  const face = FACES[expression];
  const [fx, fy] = art.face;
  const { w, h, gap } = art.eye;
  return (
    <svg viewBox="0 0 100 100" className="figure-flat" style={{ position: "absolute", inset: 0, display: "block", width: "100%", height: "100%", opacity: shown ? (off ? 0.7 : 1) : 0, transition: FADING, ...(off ? { filter: "grayscale(1)" } : null) }}>
      <defs>
        <linearGradient id={`${id}-body`} x1="0.15" y1="0.1" x2="0.85" y2="0.95">
          <stop offset="0" style={{ stopColor: colours.light }} />
          <stop offset="0.55" style={{ stopColor: colours.main }} />
          <stop offset="1" style={{ stopColor: colours.deep }} />
        </linearGradient>
      </defs>
      <path d={art.d} fill={`url(#${id}-body)`} />
      {[-1, 1].map((side) => {
        const cx = fx + side * gap;
        const ew = w * face.size;
        const eh = (face.glyph === "rect" ? h : h * 0.2) * face.size;
        return <rect key={side} x={cx - ew / 2} y={fy - eh / 2} width={ew} height={eh} style={{ fill: ink }} />;
      })}
    </svg>
  );
}

/** An agent's colours alone, as a dot `size` pixels across: where a whole figure wouldn't read (a table's row). */
export function AgentDot({ figure, colours = COLOURWAYS[figure.palette], size = 8, className, style }: { figure: Figure; colours?: Colourway; size?: number; className?: string; style?: CSSProperties }) {
  return (
    <span
      aria-hidden="true"
      className={className}
      style={{
        display: "inline-block",
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: "50%",
        background: `linear-gradient(135deg, ${colours.light}, ${colours.main} 50%, ${colours.deep})`,
        ...style,
      }}
    />
  );
}

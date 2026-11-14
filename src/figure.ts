/**
 * The figures: a solid (a cube, a sphere, a pyramid, a block, a cloud) in an iridescent material,
 * its colours its colourway's three, and two eyes painted on its face. Nothing else: no mouth, no hats, arms or legs. They say everything with their eyes and the
 * way they hold and move themselves, as Anki's Cozmo does: lids cut into the eyes for each
 * expression (an upper lid that slopes, a lower one that rises in an arc), or the eyes become a
 * shape (^ ^, − −, stars, hearts, × ×, > <), the head turns and tips with them, and the body
 * moves: it hops, spins, turns to a new face, flips, nods, shakes, wobbles, turns into a star, a
 * blob or a heart for a moment. Each shape also has acts of its own for what happens to it
 * (figure-acts.ts): the cube solves itself like a Rubik's cube while it thinks, the
 * block turns its dials like a cryptex, the pyramid's capstone floats, the sphere has moons, the
 * cloud boils; and so on at work, when a run finishes or fails, when it's petted, put to sleep or
 * woken.
 *
 * Pure. A figure is its shape, colours, energy (calm, lively, bouncy: how big and quick it moves)
 * and habit (what it does when nothing's happening). `FACES` says how each expression sets the
 * eyes and the head, `LOOKS` how its Aura glows and flows, `MOOD` which expression and motion each
 * of its states shows; figure-motion.ts moves it, figure-scene.ts turns all of it into what the
 * shader draws. `svgOf` writes a flat still for anywhere outside the page. `figureFor` makes a
 * figure from any word, the same every time.
 */

export const SHAPES = ["cube", "sphere", "pyramid", "block", "cloud"] as const;
export const ENERGIES = ["calm", "lively", "bouncy"] as const;
export const HABITS = ["look", "hum", "nap", "spin", "wave", "morph"] as const;
/** Eight colourways, by number (`COLOURWAYS`). */
export const PALETTES = [1, 2, 3, 4, 5, 6, 7, 8] as const;

export type Shape = (typeof SHAPES)[number];
export type Energy = (typeof ENERGIES)[number];
export type Habit = (typeof HABITS)[number];
export type Palette = (typeof PALETTES)[number];

export type Figure = { shape: Shape; energy: Energy; habit: Habit; palette: Palette };

/** The flat shapes the figures had before they were solids, read back as the solid each became. */
const SOLID_OF: Record<string, Shape> = { square: "cube", circle: "sphere", triangle: "pyramid", rectangle: "block" };

/** What its eyes say. */
export const EXPRESSIONS = ["neutral", "happy", "sad", "tired", "thinking", "working", "listening", "speaking", "sleeping", "surprised", "trouble", "love", "excited", "failed"] as const;
export type Expression = (typeof EXPRESSIONS)[number];

/** What its eyes can be, in the order the shader numbers them: a rectangle (lids cut into it), ^ ^, − −, stars, hearts, × ×, > <. */
export const GLYPHS = ["rect", "arc", "line", "star", "heart", "cross", "squeeze"] as const;
export type Glyph = (typeof GLYPHS)[number];

/** How it moves while it stays in a state: still but breathing, at work, thinking, floating, asleep, worried. */
export const LOOPS = ["breathe", "work", "think", "float", "rest", "worry"] as const;
export type Loop = (typeof LOOPS)[number];
/** The moves anything can make once, then back to its loop. */
export const MOVES = ["hop", "bounce", "spin", "turn", "flip", "nod", "shake", "wave", "pop", "melt", "love"] as const;
/** What it does when something happens to it, each shape its own way (figure-acts.ts): petted, a run finished or failed, work starting, switched off or on. */
export const REACTIONS = ["pet", "celebrate", "fail", "start", "doze", "wake"] as const;
export const ONCE = [...MOVES, ...REACTIONS] as const;
export type Once = (typeof ONCE)[number];
export type Reaction = (typeof REACTIONS)[number];
export type Motion = Loop | Once;
export const MOTIONS: readonly Motion[] = [...LOOPS, ...ONCE];
/** How long each move takes, in ms at lively energy. */
export const ONCE_FOR: Record<Once, number> = {
  hop: 900,
  bounce: 480,
  spin: 1050,
  turn: 850,
  flip: 1100,
  nod: 800,
  shake: 700,
  wave: 1200,
  pop: 1500,
  melt: 1700,
  love: 1500,
  pet: 1400,
  celebrate: 2400,
  fail: 2200,
  start: 1100,
  doze: 2000,
  wake: 1600,
};

/** What the agent it stands for is doing: waiting, at work, thinking (setting up), done (something to look at), in trouble, or switched off. */
export type Mood = "idle" | "working" | "thinking" | "happy" | "trouble" | "sleep";
export const MOODS: readonly Mood[] = ["idle", "working", "thinking", "happy", "trouble", "sleep"];

/** What each state shows: its expression, the loop it moves in, and a move it makes now and then (every so many ms, at random between two). */
export const MOOD: Record<Mood, { expression: Expression; loop: Loop; now?: Once; every?: [number, number] }> = {
  idle: { expression: "neutral", loop: "breathe" },
  working: { expression: "working", loop: "work" },
  thinking: { expression: "thinking", loop: "think" },
  happy: { expression: "happy", loop: "breathe", now: "pop", every: [11000, 19000] },
  trouble: { expression: "trouble", loop: "worry", now: "shake", every: [8000, 14000] },
  sleep: { expression: "sleeping", loop: "rest" },
};

/**
 * What it does as its state changes, the moment it changes: a run finished, it celebrates; one
 * failed, it fails; work starting, it gets going; switched off, it dozes off; switched on, it
 * wakes; its finished run seen to, a nod. Nothing for a change it was already making (setting up,
 * then working).
 */
export function reactionTo(from: Mood, to: Mood): Once | null {
  if (from === to) return null;
  if (to === "sleep") return "doze";
  if (from === "sleep") return "wake";
  if (to === "happy") return "celebrate";
  if (to === "trouble") return "fail";
  if ((to === "working" || to === "thinking") && from !== "working" && from !== "thinking") return "start";
  if (from === "happy" && to === "idle") return "nod";
  return null;
}

/**
 * The eyes' settings for an expression: the upper lid's edge at each eye's inner and outer side, as
 * a share of its height (`li`, `lo`: 0 open, 1 shut), how far a lower lid rises in an arc
 * (`smile`, 0–1), their size, and where they look on the face (`dx`, `dy`, in body units: the
 * cube's face is 1.2 wide).
 */
export type Lids = { li: number; lo: number; smile: number; size: number; dx: number; dy: number };
export const LID_KEYS = ["li", "lo", "smile", "size", "dx", "dy"] as const satisfies readonly (keyof Lids)[];

/** How it holds its head, in degrees: turned toward the picture's right (`yaw`), tipped up (`pitch`), leaning to the picture's right (`roll`). */
export type Turn = { yaw: number; pitch: number; roll: number };
export const TURN_KEYS = ["yaw", "pitch", "roll"] as const satisfies readonly (keyof Turn)[];

/** An expression whole: its eyes and its head, what the live figure tweens. */
export type Face = Lids & Turn;
export const FACE_KEYS = [...LID_KEYS, ...TURN_KEYS] as const;

/**
 * Each expression: what its eyes are (`glyph`), their lids and gaze, how it holds its head (it goes
 * where the eyes look: down when sad, up and aside when thinking, aslant when listening), and how
 * the eyes move on their own: scanning side to side, bobbing as it talks, swelling as it listens;
 * how it blinks.
 */
export const FACES: Record<Expression, Face & { glyph: Glyph; scan?: boolean; bob?: boolean; pulse?: boolean; blink: "quick" | "slow" | "none" }> = {
  neutral: { glyph: "rect", li: 0, lo: 0, smile: 0, size: 1, dx: 0, dy: 0, yaw: 0, pitch: 0, roll: 0, blink: "quick" },
  happy: { glyph: "arc", li: 0, lo: 0, smile: 0, size: 1.05, dx: 0, dy: 0.01, yaw: 0, pitch: 8, roll: 0, blink: "none" },
  sad: { glyph: "rect", li: 0.05, lo: 0.5, smile: 0, size: 0.96, dx: 0, dy: -0.03, yaw: 0, pitch: -14, roll: -5, blink: "slow" },
  tired: { glyph: "rect", li: 0.5, lo: 0.5, smile: 0, size: 1, dx: 0, dy: -0.015, yaw: 0, pitch: -8, roll: 3, blink: "slow" },
  thinking: { glyph: "rect", li: 0.2, lo: 0.04, smile: 0, size: 1, dx: 0.045, dy: 0.045, yaw: 14, pitch: 12, roll: 5, blink: "quick" },
  working: { glyph: "rect", li: 0.3, lo: 0.3, smile: 0.12, size: 0.98, dx: 0, dy: -0.01, yaw: 0, pitch: -7, roll: 0, scan: true, blink: "quick" },
  listening: { glyph: "rect", li: 0, lo: 0, smile: 0, size: 1.12, dx: 0, dy: 0, yaw: -6, pitch: 0, roll: -9, pulse: true, blink: "quick" },
  speaking: { glyph: "rect", li: 0.03, lo: 0.03, smile: 0.22, size: 1, dx: 0, dy: 0, yaw: 0, pitch: 3, roll: 0, bob: true, blink: "quick" },
  sleeping: { glyph: "line", li: 0, lo: 0, smile: 0, size: 1, dx: 0, dy: -0.025, yaw: 0, pitch: -16, roll: 7, blink: "none" },
  surprised: { glyph: "rect", li: 0, lo: 0, smile: 0, size: 1.3, dx: 0, dy: 0.015, yaw: 0, pitch: 10, roll: 0, blink: "none" },
  trouble: { glyph: "squeeze", li: 0, lo: 0, smile: 0, size: 1, dx: 0, dy: 0, yaw: 0, pitch: -4, roll: 6, blink: "none" },
  love: { glyph: "heart", li: 0, lo: 0, smile: 0, size: 1.15, dx: 0, dy: 0.01, yaw: 0, pitch: 6, roll: -4, blink: "none" },
  excited: { glyph: "star", li: 0, lo: 0, smile: 0, size: 1.15, dx: 0, dy: 0.015, yaw: 0, pitch: 10, roll: 0, blink: "none" },
  failed: { glyph: "cross", li: 0, lo: 0, smile: 0, size: 1, dx: 0, dy: -0.01, yaw: 0, pitch: -10, roll: -6, blink: "none" },
};

/** How long a blink takes, by kind, in ms. */
export const BLINK_FOR = { quick: 150, slow: 320 } as const;

/**
 * How its Aura glows and flows, as the Aura experiment's states did: brightness and halo strength
 * (`energy`), how fast its colour flows (`speed`) and churns (`swirl`), how far its halo reaches,
 * rings travelling out through it (`ripple`), a light running round its rim (`arc`), colour (0
 * grey to 1 full), and how much a breath, speech or a voice heard swells it.
 */
export type Look = { energy: number; speed: number; swirl: number; halo: number; ripple: number; arc: number; saturation: number; breath: number; talk: number; listen: number };
export const LOOK_KEYS = ["energy", "speed", "swirl", "halo", "ripple", "arc", "saturation", "breath", "talk", "listen"] as const satisfies readonly (keyof Look)[];

const IDLE: Look = { energy: 0.6, speed: 0.22, swirl: 0.35, halo: 0.85, ripple: 0, arc: 0, saturation: 0.95, breath: 1, talk: 0, listen: 0 };
const DONE: Look = { energy: 1.15, speed: 0.5, swirl: 0.3, halo: 1.5, ripple: 0, arc: 0, saturation: 1, breath: 0.5, talk: 0, listen: 0 };
const ASLEEP: Look = { energy: 0.3, speed: 0.06, swirl: 0.2, halo: 0.55, ripple: 0, arc: 0, saturation: 0.15, breath: 1.4, talk: 0, listen: 0 };

export const LOOKS: Record<Expression, Look> = {
  neutral: IDLE,
  happy: DONE,
  sad: { ...IDLE, energy: 0.45, speed: 0.12, saturation: 0.75 },
  tired: { ...IDLE, energy: 0.4, speed: 0.1, saturation: 0.8, breath: 1.3 },
  thinking: { energy: 0.75, speed: 1.5, swirl: 1, halo: 0.95, ripple: 0, arc: 1, saturation: 1, breath: 0, talk: 0, listen: 0 },
  working: { energy: 0.8, speed: 1.1, swirl: 0.8, halo: 1, ripple: 0, arc: 0.55, saturation: 1, breath: 0, talk: 0, listen: 0 },
  listening: { energy: 0.85, speed: 0.4, swirl: 0.45, halo: 1.35, ripple: 1, arc: 0, saturation: 1, breath: 0.3, talk: 0, listen: 1 },
  speaking: { energy: 0.9, speed: 0.6, swirl: 0.5, halo: 1.15, ripple: 0.25, arc: 0, saturation: 1, breath: 0, talk: 1, listen: 0 },
  sleeping: ASLEEP,
  surprised: { ...DONE, energy: 1, speed: 0.8, ripple: 0.4 },
  trouble: { ...IDLE, energy: 0.7, speed: 0.9, swirl: 0.9, saturation: 1, ripple: 0.3, halo: 1 },
  love: { ...DONE, energy: 1.2, halo: 1.6 },
  excited: { ...DONE, speed: 0.9, swirl: 0.6 },
  failed: { ...IDLE, energy: 0.35, speed: 0.08, saturation: 0.45, breath: 0.6 },
};

/** A switched-off figure's look, whatever its face: grey and dim, barely breathing. */
export const OFF_LOOK = ASLEEP;

export const DEFAULT_FIGURE: Figure = { shape: "sphere", energy: "lively", habit: "look", palette: 1 };

/** How much bigger, and how much quicker, each energy moves. */
export const ENERGY: Record<Energy, { amp: number; speed: number }> = { calm: { amp: 0.65, speed: 1.3 }, lively: { amp: 1, speed: 1 }, bouncy: { amp: 1.35, speed: 0.82 } };

/** A colourway: its colour, a lighter neighbour, a deeper one, any CSS colours. Its Aura passes through all three. */
export type Colourway = { main: string; light: string; deep: string };

/** The eight colourways: blue, green, sun, pink, violet, teal, orange and red. */
export const COLOURWAYS: Record<Palette, Colourway> = {
  1: { main: "oklch(65% 0.19 254)", light: "oklch(78% 0.13 220)", deep: "oklch(60% 0.2 285)" },
  2: { main: "oklch(77% 0.18 150)", light: "oklch(88% 0.14 120)", deep: "oklch(68% 0.14 180)" },
  3: { main: "oklch(88% 0.16 92)", light: "oklch(93% 0.1 110)", deep: "oklch(78% 0.17 65)" },
  4: { main: "oklch(72% 0.2 356)", light: "oklch(84% 0.11 330)", deep: "oklch(70% 0.19 20)" },
  5: { main: "oklch(64% 0.2 300)", light: "oklch(78% 0.13 320)", deep: "oklch(58% 0.2 270)" },
  6: { main: "oklch(76% 0.13 192)", light: "oklch(88% 0.09 170)", deep: "oklch(66% 0.13 225)" },
  7: { main: "oklch(76% 0.17 58)", light: "oklch(87% 0.12 80)", deep: "oklch(68% 0.2 35)" },
  8: { main: "oklch(66% 0.21 27)", light: "oklch(80% 0.12 40)", deep: "oklch(60% 0.22 5)" },
};

/** The eyes' ink: a near black. */
export const INK = "oklch(20% 0.004 265)";

// ---------------------------------------------------------------------------------------------
// The Aura experiment's signals, kept as it had them

/** A spring per value: stiff enough to change state in a few tenths of a second, damped just under critical. */
export const SPRING = { stiffness: 90, damping: 16 };
export type Sprung = { value: number; velocity: number };
export function springStep(current: Sprung, target: number, dt: number): Sprung {
  const force = SPRING.stiffness * (target - current.value) - SPRING.damping * current.velocity;
  const velocity = current.velocity + force * dt;
  return { value: current.value + velocity * dt, velocity };
}

const noise = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** A slow breath, −1 to 1, about once every four and a half seconds. */
export const breathAt = (t: number) => Math.sin(t * 2 * Math.PI * 0.22);

/** Speech, 0 to 1: syllables at four and a half a second, each its own loudness, in phrases with a pause between some. */
export function speechAt(t: number) {
  const syllables = t * 4.5;
  const index = Math.floor(syllables);
  const phrase = Math.floor(index / 6);
  if (noise(phrase * 7.3) < 0.3 && index % 6 >= 3) return 0;
  const amount = 0.35 + 0.65 * noise(index);
  return amount * Math.sin(Math.PI * (syllables - index)) ** 2;
}

/** A voice heard, 0 to 1: louder and softer, never quite still. */
export const voiceAt = (t: number) => Math.max(0, Math.min(1, 0.5 + 0.28 * Math.sin(t * 5.1) + 0.18 * Math.sin(t * 8.7 + 1.3) + 0.12 * Math.sin(t * 13.3 + 2.1)));

/** How much each signal swells the body, at full strength. */
export const SWELL = { breath: 0.014, talk: 0.05, listen: 0.03 };

/** The body's size, as a share of its resting size, from the sprung amounts and the clock. */
export const swellAt = (look: Pick<Look, "breath" | "talk" | "listen">, t: number) =>
  1 + look.breath * SWELL.breath * breathAt(t) + look.talk * SWELL.talk * speechAt(t) + look.listen * SWELL.listen * voiceAt(t);

// ---------------------------------------------------------------------------------------------
// Making and reading figures

/** A 32-bit hash of a word (FNV-1a), the seed of its figure. */
export function hashOf(text: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Numbers from a seed, the same every time (mulberry32). */
function numbers(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T>(list: readonly T[], next: () => number) => list[Math.floor(next() * list.length) % list.length];

/** A figure made from a word (an agent's name, a shuffle's count): the same word, the same creature. */
export function figureFor(seed: string): Figure {
  const next = numbers(hashOf(seed));
  return { shape: pick(SHAPES, next), energy: pick(ENERGIES, next), habit: pick(HABITS, next), palette: pick(PALETTES, next) };
}

const oneOf = <T extends string | number>(list: readonly T[], value: unknown, fallback: T): T => (list.includes(value as T) ? (value as T) : fallback);

/** A figure as it's stored, read back: a flat shape from before as the solid it became, anything missing or unknown the default's part. */
export function readFigure(value: unknown): Figure {
  const v = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const shape = typeof v.shape === "string" && v.shape in SOLID_OF ? SOLID_OF[v.shape] : v.shape;
  return {
    shape: oneOf(SHAPES, shape, DEFAULT_FIGURE.shape),
    energy: oneOf(ENERGIES, v.energy, DEFAULT_FIGURE.energy),
    habit: oneOf(HABITS, v.habit, DEFAULT_FIGURE.habit),
    palette: oneOf(PALETTES, v.palette, DEFAULT_FIGURE.palette),
  };
}

/** Whether a value is a whole figure, every part known: what a form may save. */
export const isFigure = (value: unknown): value is Figure => {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return SHAPES.includes(v.shape as Shape) && ENERGIES.includes(v.energy as Energy) && HABITS.includes(v.habit as Habit) && PALETTES.includes(v.palette as Palette);
};

// ---------------------------------------------------------------------------------------------
// A flat still, for anywhere the shader can't draw (a social card, a browser without WebGL 2)

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Each shape seen from the front, on a 100-unit square: its outline, and where its eyes sit (their middle, each eye's width and height, how far each is from the middle). */
export const FLAT: Record<Shape, { d: string; face: [number, number]; eye: { w: number; h: number; gap: number } }> = {
  cube: { d: "M22 22H78Q84 22 84 28V82Q84 88 78 88H22Q16 88 16 82V28Q16 22 22 22Z", face: [50, 54], eye: { w: 9, h: 13, gap: 12 } },
  sphere: { d: "M14 54A36 36 0 1 0 86 54A36 36 0 1 0 14 54Z", face: [50, 50], eye: { w: 9, h: 13, gap: 12 } },
  pyramid: { d: "M44 14Q50 6 56 14L92 82Q95 88 88 88H12Q5 88 8 82Z", face: [50, 66], eye: { w: 8, h: 11, gap: 10 } },
  block: { d: "M14 36H86Q92 36 92 42V82Q92 88 86 88H14Q8 88 8 82V42Q8 36 14 36Z", face: [50, 62], eye: { w: 9, h: 13, gap: 14 } },
  cloud: {
    d: "M18 64H82Q88 64 88 70V76Q88 82 82 82H18Q12 82 12 76V70Q12 64 18 64ZM12 66A17 17 0 1 1 46 66A17 17 0 1 1 12 66ZM27 52A24 24 0 1 1 75 52A24 24 0 1 1 27 52ZM56 66A16 16 0 1 1 88 66A16 16 0 1 1 56 66Z",
    face: [51, 58],
    eye: { w: 8, h: 12, gap: 11 },
  },
};

/**
 * A figure as an SVG file, `size` pixels square, seen from the front: its shape in its colours (a
 * light wash at the top left, the deep colour at the bottom right), its eyes as `expression` has
 * them (a rectangle cut by its upper lid, or a bar for closed and happy eyes). Colours are any CSS
 * colours, its colourway's and `INK` unless given; `id` names its gradient, unique on a page.
 */
export function svgOf(figure: Figure, expression: Expression = "neutral", given: Partial<Colourway & { ink: string }> = {}, size = 100, id = "figure") {
  const colours = { ...COLOURWAYS[figure.palette], ink: INK, ...given };
  const art = FLAT[figure.shape];
  const face = FACES[expression];
  const [fx, fy] = art.face;
  const { w, h, gap } = art.eye;
  const eyes = [-1, 1]
    .map((side) => {
      const cx = fx + side * gap + face.dx * 60;
      const cy = fy - face.dy * 60;
      const ew = w * face.size;
      const eh = h * face.size;
      const top = cy - eh / 2;
      if (face.glyph !== "rect") return `<rect x="${r2(cx - ew * 0.62)}" y="${r2(cy - eh * 0.09)}" width="${r2(ew * 1.24)}" height="${r2(eh * 0.18)}" fill="${colours.ink}"/>`;
      // The upper lid, as the shader cuts it: lower at the outer side for a sad face, at the inner for a troubled one.
      const [atLeft, atRight] = side < 0 ? [top + face.lo * eh, top + face.li * eh] : [top + face.li * eh, top + face.lo * eh];
      return `<polygon points="${r2(cx - ew / 2)},${r2(atLeft)} ${r2(cx + ew / 2)},${r2(atRight)} ${r2(cx + ew / 2)},${r2(cy + eh / 2)} ${r2(cx - ew / 2)},${r2(cy + eh / 2)}" fill="${colours.ink}"/>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}"><defs><linearGradient id="${id}-body" x1="0.15" y1="0.1" x2="0.85" y2="0.95"><stop offset="0" stop-color="${colours.light}"/><stop offset="0.55" stop-color="${colours.main}"/><stop offset="1" stop-color="${colours.deep}"/></linearGradient></defs><path d="${art.d}" fill="url(#${id}-body)"/>${eyes}</svg>`;
}

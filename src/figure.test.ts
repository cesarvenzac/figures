import { describe, expect, it } from "vitest";

import {
  breathAt,
  COLOURWAYS,
  DEFAULT_FIGURE,
  EXPRESSIONS,
  FACE_KEYS,
  FACES,
  type Figure,
  figureFor,
  GLYPHS,
  isFigure,
  LOOK_KEYS,
  LOOKS,
  LOOPS,
  MOOD,
  MOODS,
  OFF_LOOK,
  ONCE,
  ONCE_FOR,
  PALETTES,
  reactionTo,
  readFigure,
  SHAPES,
  speechAt,
  springStep,
  svgOf,
  swellAt,
  voiceAt,
} from "./figure.ts";

describe("figures", () => {
  it("are five solids, and the flat shapes from before are read back as the solid each became", () => {
    expect(SHAPES).toEqual(["cube", "sphere", "pyramid", "block", "cloud"]);
    expect(readFigure({ shape: "cloud" }).shape).toBe("cloud");
    expect(readFigure({ shape: "square" }).shape).toBe("cube");
    expect(readFigure({ shape: "circle" }).shape).toBe("sphere");
    expect(readFigure({ shape: "triangle" }).shape).toBe("pyramid");
    expect(readFigure({ shape: "rectangle" }).shape).toBe("block");
    // Saved again, they're the solids.
    expect(isFigure({ shape: "square", energy: "calm", habit: "look", palette: 1 })).toBe(false);
    expect(isFigure({ shape: "cube", energy: "calm", habit: "look", palette: 1 })).toBe(true);
  });

  it("reads a stored figure, filling what's missing or unknown", () => {
    expect(readFigure(null)).toEqual(DEFAULT_FIGURE);
    expect(readFigure({ shape: "block", palette: 9 })).toEqual({ ...DEFAULT_FIGURE, shape: "block" });
    expect(readFigure({ shape: "star", eyes: "block", energy: "bouncy", habit: "morph", palette: 4 })).toEqual({ shape: "sphere", energy: "bouncy", habit: "morph", palette: 4 });
    const whole: Figure = { shape: "pyramid", energy: "calm", habit: "nap", palette: 3 };
    expect(isFigure(whole)).toBe(true);
    expect(isFigure({ shape: "pyramid" })).toBe(false);
  });

  it("makes the same figure from the same word, and many from many", () => {
    expect(figureFor("Proofreader")).toEqual(figureFor("Proofreader"));
    const made = new Set(Array.from({ length: 60 }, (_, n) => JSON.stringify(figureFor(`agent ${n}`))));
    expect(made.size).toBeGreaterThan(40);
    for (let n = 0; n < 40; n++) expect(isFigure(figureFor(String(n)))).toBe(true);
  });

  it("sets every part of the eyes and head for every expression, the eyes a shape the shader knows", () => {
    for (const expression of EXPRESSIONS) {
      const face = FACES[expression];
      for (const key of FACE_KEYS) expect(Number.isFinite(face[key]), `${expression}.${key}`).toBe(true);
      expect(GLYPHS).toContain(face.glyph);
      expect(face.li).toBeGreaterThanOrEqual(0);
      expect(face.lo).toBeLessThanOrEqual(1);
    }
    // Each eye shape is some expression's.
    for (const glyph of GLYPHS) expect(EXPRESSIONS.some((expression) => FACES[expression].glyph === glyph), glyph).toBe(true);
  });

  it("turns the head the way the eyes look", () => {
    for (const expression of EXPRESSIONS) {
      const { pitch, dy } = FACES[expression];
      // Tipped up, it looks up the face; tipped down, down.
      if (Math.abs(pitch) >= 5 && dy) expect(Math.sign(dy), expression).toBe(Math.sign(pitch));
    }
    expect(FACES.thinking.yaw).toBeGreaterThan(0);
    expect(FACES.thinking.dx).toBeGreaterThan(0);
    expect(FACES.neutral).toMatchObject({ yaw: 0, pitch: 0, roll: 0, glyph: "rect" });
  });

  it("gives every expression an Aura, and a switched-off figure a grey one", () => {
    for (const expression of EXPRESSIONS) for (const key of LOOK_KEYS) expect(Number.isFinite(LOOKS[expression][key]), `${expression}.${key}`).toBe(true);
    expect(OFF_LOOK.saturation).toBeLessThan(0.3);
    expect(LOOKS.thinking.arc).toBeGreaterThan(0.5);
    expect(LOOKS.listening.ripple).toBeGreaterThan(0.5);
    expect(LOOKS.happy.energy).toBeGreaterThan(LOOKS.neutral.energy);
  });

  it("knows what each state shows, and how long every move takes", () => {
    for (const mood of MOODS) {
      const state = MOOD[mood];
      expect(EXPRESSIONS).toContain(state.expression);
      expect(LOOPS).toContain(state.loop);
      if (state.now) {
        expect(ONCE).toContain(state.now);
        expect(state.every![0]).toBeGreaterThan(5000);
        expect(state.every![1]).toBeGreaterThan(state.every![0]);
      }
    }
    for (const motion of ONCE) {
      expect(ONCE_FOR[motion]).toBeGreaterThan(300);
    }
  });

  it("reacts as its state changes: a run finished, failed or starting, switched off or on, a finished run seen to", () => {
    expect(reactionTo("working", "happy")).toBe("celebrate");
    expect(reactionTo("thinking", "trouble")).toBe("fail");
    expect(reactionTo("idle", "thinking")).toBe("start");
    expect(reactionTo("happy", "working")).toBe("start");
    expect(reactionTo("idle", "sleep")).toBe("doze");
    expect(reactionTo("sleep", "idle")).toBe("wake");
    expect(reactionTo("happy", "idle")).toBe("nod");
    // Setting up, then working, is one go.
    expect(reactionTo("thinking", "working")).toBeNull();
    expect(reactionTo("idle", "idle")).toBeNull();
    for (const from of MOODS) for (const to of MOODS) {
      const reaction = reactionTo(from, to);
      if (reaction) expect(ONCE).toContain(reaction);
    }
    // Asleep it sleeps; in trouble it worries.
    expect(MOOD.sleep.loop).toBe("rest");
    expect(MOOD.trouble.loop).toBe("worry");
  });

  it("has eight colourways, each three colours", () => {
    expect(PALETTES).toHaveLength(8);
    for (const palette of PALETTES) {
      const colourway = COLOURWAYS[palette];
      expect(Object.keys(colourway)).toEqual(["main", "light", "deep"]);
      for (const colour of Object.values(colourway)) expect(colour).toMatch(/^oklch\(\d+% [\d.]+ \d+\)$/);
    }
  });

  it("swells with breath, speech and a voice, never far from its size", () => {
    for (let t = 0; t < 20; t += 0.37) {
      expect(Math.abs(breathAt(t))).toBeLessThanOrEqual(1);
      expect(speechAt(t)).toBeGreaterThanOrEqual(0);
      expect(speechAt(t)).toBeLessThanOrEqual(1);
      expect(voiceAt(t)).toBeGreaterThanOrEqual(0);
      expect(voiceAt(t)).toBeLessThanOrEqual(1);
      const swell = swellAt({ breath: 1, talk: 1, listen: 1 }, t);
      expect(swell).toBeGreaterThan(0.95);
      expect(swell).toBeLessThan(1.1);
    }
    expect(swellAt({ breath: 0, talk: 0, listen: 0 }, 3)).toBe(1);
  });

  it("springs a look to its target", () => {
    let sprung = { value: 0, velocity: 0 };
    for (let i = 0; i < 120; i++) sprung = springStep(sprung, 1, 1 / 60);
    expect(sprung.value).toBeCloseTo(1, 2);
  });

  it("writes a flat still as SVG, its eyes square-cornered", () => {
    const svg = svgOf({ ...DEFAULT_FIGURE, shape: "block" }, "sad", { main: "#38f", light: "#9cf", deep: "#53c", ink: "#111" }, 128, "pub");
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="128" height="128">')).toBe(true);
    expect(svg).toContain('stop-color="#9cf"');
    expect(svg.match(/fill="#111"/g)).toHaveLength(2);
    expect(svg).not.toContain("rx=");
    expect(svg).not.toContain("undefined");
    expect(svg).not.toContain("NaN");
    // Happy and asleep, the eyes are bars.
    expect(svgOf(DEFAULT_FIGURE, "sleeping", { main: "#38f", light: "#9cf", deep: "#53c", ink: "#111" })).not.toContain("<polygon");
    // Its own colours unless given.
    const own = svgOf({ ...DEFAULT_FIGURE, palette: 2 });
    expect(own).toContain(`stop-color="${COLOURWAYS[2].light}"`);
    expect(own).toContain('fill="oklch(20% 0.004 265)"');
    // A cloud too: its puffs one path.
    const cloud = svgOf({ ...DEFAULT_FIGURE, shape: "cloud" }, "neutral", { main: "#38f", light: "#9cf", deep: "#53c", ink: "#111" });
    expect(cloud.match(/<path /g)).toHaveLength(1);
    expect(cloud).not.toContain("NaN");
  });
});

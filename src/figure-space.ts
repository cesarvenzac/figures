/**
 * The figures in 3D: the camera, each shape's size, where its eyes sit, and the scene
 * the shader draws (components/figures/figure-gl.ts). Pure: numbers and small maths, so what
 * the figure does can be worked out, tested, and drawn anywhere.
 *
 * World space: y up, the camera in front (+z) and a little above, looking at the middle. Body
 * space: the shape's own, its front facing +z, turned and lifted into the world by the body's
 * transform. Distances are in units where the figure's box is 2 wide.
 */

/** The camera: how far it is, how far it looks down (radians), and half the picture's height at the middle (world units). */
export const CAMERA = { distance: 7, pitch: 0.25, half: 1.5 } as const;

/** The ground, where every shape stands. */
export const FLOOR = -0.86;

/**
 * Each shape's size, in body space. The cube and block are boxes with rounded edges (half their
 * width each way, and the rounding); the block turns as three dials round its length, parted
 * `dial` either side of its middle. The pyramid stands on a square base `half` wide each way at
 * `base`, its apex `height` above, and comes apart in three at its `cuts` (a slab, then the
 * capstone). The sphere is a sphere; the cloud is its puffs (`PUFFS`), flat underneath at `base`.
 */
export const BODY = {
  cube: { half: 0.6, round: 0.12 },
  sphere: { radius: 0.8 },
  pyramid: { half: 0.82, height: 1.34, base: -0.52, round: 0.06, cuts: [0.06, 0.38] as [number, number] },
  block: { half: [0.86, 0.5, 0.5] as [number, number, number], round: 0.12, dial: 0.35 },
  cloud: { base: -0.48, blend: 0.15 },
} as const;

export type Vec3 = [number, number, number];
/** A ball: where it is in body space, and its radius. */
export type Ball = [number, number, number, number];

/** The cloud's puffs as it rests, in body space: the first, the largest, carries the face. */
export const PUFFS: readonly Ball[] = [
  [0, 0.12, 0.02, 0.56],
  [-0.56, -0.12, 0.02, 0.38],
  [0.58, -0.1, 0, 0.4],
  [-0.3, 0.28, -0.04, 0.35],
  [0.02, 0.04, -0.28, 0.46],
  [0.04, -0.22, 0.06, 0.42],
];

/** How far below its middle each shape reaches, so it stands on the ground. */
export const BOTTOM = {
  cube: -BODY.cube.half,
  sphere: -BODY.sphere.radius,
  pyramid: BODY.pyramid.base - BODY.pyramid.round,
  block: -BODY.block.half[1],
  cloud: BODY.cloud.base,
} as const;

/** How high above its middle each shape reaches. */
export const TOP = { cube: BODY.cube.half, sphere: BODY.sphere.radius, pyramid: BODY.pyramid.base + BODY.pyramid.height + BODY.pyramid.round, block: BODY.block.half[1], cloud: 0.68 } as const;

/** How far above the ground each shape floats at rest: a cloud hovers. */
export const HOVER = { cube: 0, sphere: 0, pyramid: 0, block: 0, cloud: 0.26 } as const;

/** The 3D shapes, in the order the shader numbers them. */
export const SHAPES_3D = ["cube", "sphere", "pyramid", "block", "cloud"] as const;
export type Shape3D = (typeof SHAPES_3D)[number];

/** What a shape can turn into for a moment, in the order the shader numbers them (0 is none). */
export const MORPHS = ["none", "blob", "star", "heart"] as const;
export type Morph = (typeof MORPHS)[number];

/** Where the eyes sit on a shape: the face's middle (`origin`), its right, up and outward directions, the eyes' width and height, and how far each is from the middle. */
export type EyeFrame = { origin: Vec3; right: Vec3; up: Vec3; forward: Vec3; width: number; height: number; gap: number };

const norm = (v: Vec3): Vec3 => {
  const length = Math.hypot(...v) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
};
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const scale = (v: Vec3, s: number): Vec3 => [v[0] * s, v[1] * s, v[2] * s];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

/** A frame facing `forward`, upright as far as it can be. */
export function frameFacing(forward: Vec3, origin: Vec3, width: number, height: number, gap: number): EyeFrame {
  const f = norm(forward);
  const up = norm(add([0, 1, 0], scale(f, -f[1])));
  return { origin, forward: f, up, right: cross(up, f), width, height, gap };
}

const pyramidFace = (() => {
  const { half, height, base, round } = BODY.pyramid;
  const normal = norm([0, half, height]);
  const along = 0.3;
  const point: Vec3 = [0, base + height * along, half * (1 - along)];
  return { normal, origin: add(point, scale(normal, round)) };
})();

/** The eyes on each shape, as it rests. */
export const EYES: Record<Shape3D, EyeFrame> = {
  cube: frameFacing([0, 0, 1], [0, 0.02, BODY.cube.half], 0.15, 0.22, 0.2),
  sphere: frameFacing([0, 0.12, 1], scale(norm([0, 0.12, 1]), BODY.sphere.radius), 0.15, 0.22, 0.2),
  pyramid: frameFacing(pyramidFace.normal, pyramidFace.origin, 0.145, 0.21, 0.185),
  block: frameFacing([0, 0, 1], [0, 0.02, BODY.block.half[2]], 0.15, 0.22, 0.23),
  cloud: frameFacing([0, 0.04, 1], [0, 0.09, 0.58], 0.15, 0.22, 0.2),
};

/** The picture's height of a point at height `y` and depth `z` in the world, as the camera sees it (world units at the middle). */
export function pictureY(y: number, z = 0) {
  const { distance, pitch } = CAMERA;
  return ((y * Math.cos(pitch) - z * Math.sin(pitch)) * distance) / (distance - y * Math.sin(pitch) - z * Math.cos(pitch));
}

/** Where a cube's eyes sit once it splits into cubelets: on the middle row's outer two, so no gap runs through them. */
export const CUBELET_GAP = (2 * BODY.cube.half) / 3;

/** A 3×3 rotation, column-major (as WebGL takes it). */
export type Mat3 = [number, number, number, number, number, number, number, number, number];

export const IDENTITY: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

/** a·b, both column-major. */
export function multiply(a: Mat3, b: Mat3): Mat3 {
  const out = [0, 0, 0, 0, 0, 0, 0, 0, 0] as Mat3;
  for (let column = 0; column < 3; column++)
    for (let row = 0; row < 3; row++) out[column * 3 + row] = a[row] * b[column * 3] + a[3 + row] * b[column * 3 + 1] + a[6 + row] * b[column * 3 + 2];
  return out;
}

/** A turn about x, y or z by `angle` radians (right-handed: a positive turn about z takes x toward y). */
export function turnAbout(axis: 0 | 1 | 2, angle: number): Mat3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  if (axis === 0) return [1, 0, 0, 0, c, s, 0, -s, c];
  if (axis === 1) return [c, 0, -s, 0, 1, 0, s, 0, c];
  return [c, s, 0, -s, c, 0, 0, 0, 1];
}

/** m·v, m column-major. */
export const apply = (m: Mat3, v: Vec3): Vec3 => [m[0] * v[0] + m[3] * v[1] + m[6] * v[2], m[1] * v[0] + m[4] * v[1] + m[7] * v[2], m[2] * v[0] + m[5] * v[1] + m[8] * v[2]];

/** mᵀ·v: a world direction in body space. */
export const applyInverse = (m: Mat3, v: Vec3): Vec3 => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];

const RADIANS = Math.PI / 180;

/**
 * The body's turn from how it holds itself, in degrees: turned toward the picture's right (`yaw`),
 * tipped up (`pitch`), leaning to the picture's right (`roll`). Rolled, then tipped, then turned.
 */
export function bodyTurn(yaw: number, pitch: number, roll: number): Mat3 {
  return multiply(turnAbout(1, yaw * RADIANS), multiply(turnAbout(0, -pitch * RADIANS), turnAbout(2, -roll * RADIANS)));
}

/** A cosine palette, Inigo Quilez's `a + b·cos(2π(t + d))` per channel, in linear RGB. */
export type CosinePalette = { a: Vec3; b: Vec3; d: Vec3 };

/** A cosine palette at `t`, as the shader computes it. */
export const paletteAt = (palette: CosinePalette, t: number): Vec3 =>
  [0, 1, 2].map((i) => palette.a[i] + palette.b[i] * Math.cos(2 * Math.PI * (t + palette.d[i]))) as Vec3;

/**
 * The cosine palette that passes through three colours (linear RGB) a third of the way round
 * each: a colourway's own, lighter and deeper tokens, so the figure's rainbow keeps to its family
 * and its tokens stay the one place its colours are said. Per channel, c(t) = a + C·cos 2πt +
 * S·sin 2πt, solved from the three samples.
 */
export function paletteThrough(first: Vec3, second: Vec3, third: Vec3): CosinePalette {
  const a = [0, 0, 0] as Vec3;
  const b = [0, 0, 0] as Vec3;
  const d = [0, 0, 0] as Vec3;
  for (let i = 0; i < 3; i++) {
    a[i] = (first[i] + second[i] + third[i]) / 3;
    const c = first[i] - a[i];
    const s = (second[i] - third[i]) / Math.sqrt(3);
    b[i] = Math.hypot(c, s);
    d[i] = Math.atan2(-s, c) / (2 * Math.PI);
  }
  return { a, b, d };
}

/** Everything the shader needs for one frame of one figure. */
export type FigureScene = {
  shape: number;
  morphTo: number;
  morph: number;
  /** Seconds, for a blob's wobble. */
  time: number;
  body: { rotation: Float32Array; position: Float32Array; scale: Float32Array };
  /** 0 a solid cube (or block), 1 split into its 27 cubelets (or three dials). */
  split: number;
  /** How far the cube's cubelets have flown apart, as a share of their size. */
  spread: number;
  /** Each cell's cubelet's turn from where it started, 27 column-major 3×3s (rubik.ts). */
  cells: Float32Array;
  /** Layers turning: the axis (−1 for none), then how far each layer (−1, 0, 1) has turned, in radians. The cube's layers, the block's dials. */
  layers: Float32Array;
  /** The pyramid apart: its middle slab's slide, its capstone's slide, lift and spin (radians). */
  pieces: Float32Array;
  /** How far the pyramid's top leans, jelly-like. */
  shear: number;
  /** The sphere's own size, as a share. */
  core: number;
  /** Small balls beside the body (a sphere's moons and droplets, a cloud's raindrops), each x, y, z and radius in body space; a radius of 0 is none. */
  beads: Float32Array;
  beadCount: number;
  /** The cloud's puffs, each x, y, z and radius in body space. */
  puffs: Float32Array;
  /** The surface moved: a ripple's height and how far it has run, a poke's dent, wrinkles. */
  surface: Float32Array;
  /** How far the colour has rolled round, in radians: the sphere at work. */
  roll: number;
  /** Bits drawn in front: hearts, stars, z's and sparks, each x and y in the picture from its middle, size and opacity; and each one's kind (`BIT_KINDS`). */
  bits: Float32Array;
  bitKinds: Float32Array;
  /** The cloud's rainbow: how far it has swept across, and how strongly it shows. */
  rainbow: Float32Array;
  /** A lightning flash under the cloud: how bright, and which zigzag. */
  bolt: Float32Array;
  eyes: {
    origin: Float32Array;
    right: Float32Array;
    up: Float32Array;
    forward: Float32Array;
    width: number;
    height: number;
    gap: number;
    size: number;
    dx: number;
    dy: number;
    /** Each eye's lids: inner, outer, smile. */
    left: Float32Array;
    right3: Float32Array;
    glyph: number;
    glyphTo: number;
    glyphMix: number;
    /** How open a blink leaves them, 0–1. */
    open: number;
  };
  aura: {
    palette: CosinePalette;
    hue: number;
    flow: number;
    swirl: number;
    energy: number;
    saturation: number;
    halo: number;
    ripple: number;
    rings: number;
    arc: number;
    arcAngle: number;
    /** How much of its own colour shows in the middle, through the milk (Aura's 0.42). */
    milk: number;
  };
  ink: Float32Array;
  floor: number;
  /** The body's lowest point, for its shadow. */
  bottom: number;
  /** How far the halo reaches, in world units. */
  reach: number;
};

/** What a bit in front of the figure can be, in the order the shader numbers them (0 is none). */
export const BIT_KINDS = ["none", "heart", "star", "z", "spark"] as const;
export type BitKind = (typeof BIT_KINDS)[number];

/** How many beads, puffs and bits the shader draws at most. */
export const MOST = { beads: 6, puffs: 6, bits: 4 } as const;

export const IDENTITY_CELLS = () => {
  const cells = new Float32Array(27 * 9);
  for (let i = 0; i < 27; i++) cells.set(IDENTITY, i * 9);
  return cells;
};

export { add, cross, dot, norm, scale };

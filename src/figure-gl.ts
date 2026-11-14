import { BODY, CAMERA, type FigureScene, MOST } from "./figure-space.ts";

/**
 * The figures, drawn: real 3D shapes (a cube, a sphere, a pyramid, a block, a cloud) found
 * by raymarching their distance fields in one fragment shader, in the original Aura's material, the
 * eyes painted on their surface. No geometry and no textures: every pixel asks the shapes how far
 * it is from them.
 *
 * Aura's material, as its experiment drew it on a sphere: colour as noise warped by noise
 * (MaterialX's Perlin noise, as Three's TSL gave it), flowing, through a cosine palette; a rainbow
 * running round the rim, turned from the direction itself so it has no seam; milky towards the
 * middle like a ball of thick glass lit from inside; a gloss where the light lands; and a halo of
 * the rim's own colour outside, with rings while it listens and a light running round while it
 * thinks. Here the rim follows each shape's surface (how far it faces away), so a cube's front is
 * milky and its edges and faces turned away run with colour.
 *
 * Everything that moves arrives as numbers (`FigureScene`, figure-space.ts): how the
 * body is turned, lifted and squashed, a morph into a blob, a star or a heart, where the eyes are
 * and how their lids sit; and each shape's own parts: the cube's cubelets (turning a layer, as a
 * Rubik's cube does, or flying apart), the block's three dials, the pyramid's slabs and capstone,
 * the sphere's size, ripples and moons, the cloud's puffs and raindrops. In front of it, hearts,
 * stars, z's and sparks; behind and under a cloud, its rainbow and its lightning. One WebGL 2 context for every figure on the
 * page (a browser keeps only a few): each figure is drawn into it and copied onto its own canvas
 * straight away. Where WebGL 2 is missing or lost, `drawFigure` says so and the figure keeps its
 * still drawing.
 */

/** The largest figure drawn, in device pixels; a bigger one is drawn at this and scaled. */
export const MOST_PIXELS = 512;

const VERTEX = `#version 300 es
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2. - 1., 0., 1.);
}`;

const f = (n: number) => n.toFixed(4);

const FRAGMENT = `#version 300 es
precision highp float;
precision highp int;

uniform vec2 uSize;
uniform int uShape;
uniform int uMorphTo;
uniform float uMorph;
uniform float uTime;
uniform mat3 uBody;
uniform vec3 uBodyPos;
uniform vec3 uBodyScale;
uniform float uSplit;
uniform float uSpread;
uniform mat3 uCells[27];
uniform vec4 uLayers;
uniform vec4 uPieces;
uniform float uShear;
uniform float uCore;
uniform vec4 uBeads[${MOST.beads}];
uniform int uBeadCount;
uniform vec4 uPuffs[${MOST.puffs}];
uniform vec4 uSurface;
uniform float uRoll;
uniform vec4 uBits[${MOST.bits}];
uniform vec4 uBitKinds;
uniform vec2 uRainbow;
uniform vec2 uBolt;
uniform vec3 uEyeO;
uniform vec3 uEyeR;
uniform vec3 uEyeU;
uniform vec3 uEyeF;
uniform vec4 uEyeSize;
uniform vec2 uLook;
uniform vec3 uLidL;
uniform vec3 uLidR;
uniform vec4 uGlyph;
uniform vec3 uInk;
uniform vec3 uPalA;
uniform vec3 uPalB;
uniform vec3 uPalD;
uniform float uHue;
uniform float uFlow;
uniform float uSwirl;
uniform float uEnergy;
uniform float uSaturation;
uniform float uHalo;
uniform float uRipple;
uniform float uRings;
uniform float uArc;
uniform float uArcAngle;
uniform float uFloorY;
uniform float uBottom;
uniform float uReach;
uniform float uMilk;
out vec4 colour;

const float TAU = 6.2831853;
const float OFFSET = 17.3;
const float CUBE_B = ${f(BODY.cube.half)};
const float CUBE_R = ${f(BODY.cube.round)};
const float SPHERE_R = ${f(BODY.sphere.radius)};
const float PYR_HALF = ${f(BODY.pyramid.half)};
const float PYR_H = ${f(BODY.pyramid.height)};
const float PYR_BASE = ${f(BODY.pyramid.base)};
const float PYR_R = ${f(BODY.pyramid.round)};
const float CUT_LOW = ${f(BODY.pyramid.cuts[0])};
const float CUT_HIGH = ${f(BODY.pyramid.cuts[1])};
const vec3 BLOCK_B = vec3(${f(BODY.block.half[0])}, ${f(BODY.block.half[1])}, ${f(BODY.block.half[2])});
const float BLOCK_R = ${f(BODY.block.round)};
const float DIAL = ${f(BODY.block.dial)};
const float CLOUD_BASE = ${f(BODY.cloud.base)};
const float CLOUD_K = ${f(BODY.cloud.blend)};
// Where a poke lands on the sphere: its face.
const vec3 POKE = vec3(0., .1191, .9929);
const float CAM_DIST = ${f(CAMERA.distance)};
const float CAM_PITCH = ${f(CAMERA.pitch)};
const float VIEW_HALF = ${f(CAMERA.half)};

// ---------------------------------------------------------------------------------------------
// MaterialX's Perlin noise (Bob Jenkins' hash), as Three's mx_perlin_noise_float, and its fractal.

uint rotl32(uint x, int k) { return (x << uint(k)) | (x >> uint(32 - k)); }
uint bjfinal(uint a, uint b, uint c) {
  c ^= b; c -= rotl32(b, 14);
  a ^= c; a -= rotl32(c, 11);
  b ^= a; b -= rotl32(a, 25);
  c ^= b; c -= rotl32(b, 16);
  a ^= c; a -= rotl32(c, 4);
  b ^= a; b -= rotl32(a, 14);
  c ^= b; c -= rotl32(b, 24);
  return c;
}
uint hashInt(int x, int y, int z) {
  uint s = 0xdeadbeefu + (3u << 2u) + 13u;
  return bjfinal(s + uint(x), s + uint(y), s + uint(z));
}
float gradient(uint hash, float x, float y, float z) {
  uint h = hash & 15u;
  float u = h < 8u ? x : y;
  float v = h < 4u ? y : ((h == 12u || h == 14u) ? x : z);
  return ((h & 1u) != 0u ? -u : u) + ((h & 2u) != 0u ? -v : v);
}
float fade(float t) { return t * t * t * (t * (t * 6. - 15.) + 10.); }
float perlin(vec3 p) {
  vec3 i = floor(p);
  vec3 q = p - i;
  int X = int(i.x), Y = int(i.y), Z = int(i.z);
  float u = fade(q.x), v = fade(q.y), w = fade(q.z);
  float a = mix(mix(gradient(hashInt(X, Y, Z), q.x, q.y, q.z), gradient(hashInt(X + 1, Y, Z), q.x - 1., q.y, q.z), u),
                mix(gradient(hashInt(X, Y + 1, Z), q.x, q.y - 1., q.z), gradient(hashInt(X + 1, Y + 1, Z), q.x - 1., q.y - 1., q.z), u), v);
  float b = mix(mix(gradient(hashInt(X, Y, Z + 1), q.x, q.y, q.z - 1.), gradient(hashInt(X + 1, Y, Z + 1), q.x - 1., q.y, q.z - 1.), u),
                mix(gradient(hashInt(X, Y + 1, Z + 1), q.x, q.y - 1., q.z - 1.), gradient(hashInt(X + 1, Y + 1, Z + 1), q.x - 1., q.y - 1., q.z - 1.), u), v);
  return .982 * mix(a, b, w);
}
// mx_fractal_noise_float(p, 2 octaves, lacunarity 2, diminish 0.5)
float fbm(vec3 p) { return perlin(p) + .5 * perlin(p * 2.); }

// ---------------------------------------------------------------------------------------------
// Shapes

float sdRoundBox(vec3 p, vec3 b, float r) {
  vec3 q = abs(p) - b + r;
  return length(max(q, 0.)) + min(max(q.x, max(q.y, q.z)), 0.) - r;
}
// Inigo Quilez's square pyramid: base 1 wide at y 0, apex at h.
float sdPyramid(vec3 p, float h) {
  float m2 = h * h + .25;
  p.xz = abs(p.xz);
  p.xz = (p.z > p.x) ? p.zx : p.xz;
  p.xz -= .5;
  vec3 q = vec3(p.z, h * p.y - .5 * p.x, h * p.x + .5 * p.y);
  float s = max(-q.x, 0.);
  float t = clamp((q.y - .5 * p.z) / (m2 + .25), 0., 1.);
  float a = m2 * (q.x + s) * (q.x + s) + q.y * q.y;
  float b = m2 * (q.x + .5 * t) * (q.x + .5 * t) + (q.y - m2 * t) * (q.y - m2 * t);
  float d2 = min(q.y, -q.x * m2 - q.y * .5) > 0. ? 0. : min(a, b);
  return sqrt((d2 + q.z * q.z) / m2) * sign(max(q.z, -p.y));
}
float sdStar5(vec2 p, float r, float rf) {
  const vec2 k1 = vec2(.809016994375, -.587785252292);
  const vec2 k2 = vec2(-k1.x, k1.y);
  p.x = abs(p.x);
  p -= 2. * max(dot(k1, p), 0.) * k1;
  p -= 2. * max(dot(k2, p), 0.) * k2;
  p.x = abs(p.x);
  p.y -= r;
  vec2 ba = rf * vec2(-k1.y, k1.x) - vec2(0., 1.);
  float h = clamp(dot(p, ba) / dot(ba, ba), 0., r);
  return length(p - ba * h) * sign(p.y * ba.x - p.x * ba.y);
}
float dot2(vec2 v) { return dot(v, v); }
float sdHeart(vec2 p) {
  p.x = abs(p.x);
  if (p.y + p.x > 1.) return sqrt(dot2(p - vec2(.25, .75))) - sqrt(2.) / 4.;
  return sqrt(min(dot2(p - vec2(0., 1.)), dot2(p - .5 * max(p.x + p.y, 0.)))) * sign(p.x - p.y);
}
float extrude(vec3 p, float d2, float h) {
  vec2 w = vec2(d2, abs(p.z) - h);
  return min(max(w.x, w.y), 0.) + length(max(w, 0.));
}

vec3 turnAbout(vec3 p, int axis, float t) {
  float c = cos(t), s = sin(t);
  if (axis == 0) return vec3(p.x, c * p.y - s * p.z, s * p.y + c * p.z);
  if (axis == 1) return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
  return vec3(c * p.x - s * p.y, s * p.x + c * p.y, p.z);
}
float smin(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.) / k;
  return min(a, b) - h * h * k * .25;
}
float smax(float a, float b, float k) { return -smin(-a, -b, k); }

// Layers turning about one axis (the cube's, the block's dials): which layer a point is in, its
// edges at ±e, and the point as it was before its layer turned. bound is how far the point is from
// its layer's faces: a ray steps no further, since the next layer may be turned otherwise.
float layerOf(float x, float e) { return x < -e ? -1. : (x > e ? 1. : 0.); }
float layerTurn(float l) { return l < 0. ? uLayers.y : (l > 0. ? uLayers.w : uLayers.z); }
vec3 unturn(vec3 p, float e, out float bound) {
  bound = 1e9;
  if (uLayers.x < 0.) return p;
  int a = int(uLayers.x + .5);
  float x = p[a];
  float l = layerOf(x, e);
  bound = l == 0. ? e - abs(x) : abs(x) - e;
  return turnAbout(p, a, -layerTurn(l));
}
vec3 unturnDir(vec3 p, vec3 v, float e) {
  if (uLayers.x < 0.) return v;
  int a = int(uLayers.x + .5);
  return turnAbout(v, a, -layerTurn(layerOf(p[a], e)));
}

// The cube as 27 cubelets, its layers perhaps turning: the gaps open with uSplit, and the
// cubelets fly apart with uSpread. Two distances: how far a ray may safely step (x), and how far
// the nearest cubelet is (y), for its edge.
float cellSize() { return (2. * CUBE_B / 3.) * (1. + .08 * uSplit + uSpread); }
vec2 cubelets(vec3 p) {
  float S = cellSize();
  float h = CUBE_B / 3. - .014;
  float bound;
  vec3 q = unturn(p, S * .5, bound);
  vec3 c = clamp(floor(q / S + .5), -1., 1.);
  float d = sdRoundBox(q - c * S, vec3(h), .05);
  // Near a turning layer's faces, step no further than to them; far off, the whole cube's
  // reach (a turning corner pokes out of its box) is a safe step.
  float outer = length(p) - (2.6 * S + .12);
  return vec2(min(d, max(max(bound, .004), outer)), d);
}

// The block as three dials round its length, each turned on its own like a cryptex's.
vec2 dials(vec3 p) {
  float bound;
  vec3 q = unturn(p, DIAL, bound);
  float l = layerOf(p.x, DIAL);
  float g = .01 + .016 * uSplit;
  float slab = l < 0. ? q.x + DIAL + g : (l > 0. ? DIAL + g - q.x : abs(q.x) - (DIAL - g));
  float d = smax(sdRoundBox(q, BLOCK_B, BLOCK_R), slab, .035);
  float outer = length(p) - 1.25;
  return vec2(min(d, max(max(bound, .004), outer)), d);
}

// The pyramid, perhaps apart: a slab sliding out of its middle, its capstone lifted and spun, and
// leaning like jelly.
float pyr(vec3 p) {
  vec3 q = (p - vec3(0., PYR_BASE, 0.)) / (PYR_HALF * 2.);
  return sdPyramid(q, PYR_H / (PYR_HALF * 2.)) * (PYR_HALF * 2.) - PYR_R;
}
vec3 leaned(vec3 p) {
  if (abs(uShear) < 1e-5) return p;
  float up = clamp((p.y - PYR_BASE) / PYR_H, 0., 1.3);
  return vec3(p.x - uShear * up * up, p.y, p.z);
}
vec3 inMiddle(vec3 p) { return p - vec3(uPieces.x, 0., 0.); }
vec3 inCap(vec3 p) { return turnAbout(p - vec3(uPieces.y, uPieces.z, 0.), 1, -uPieces.w); }
vec3 pieceDistances(vec3 p) {
  vec3 m = inMiddle(p), c = inCap(p);
  return vec3(max(pyr(p), p.y - CUT_LOW), max(pyr(m), max(CUT_LOW - m.y, m.y - CUT_HIGH)), max(pyr(c), CUT_HIGH - c.y));
}
bool apart() { return dot(abs(uPieces), vec4(1.)) > 1e-5; }
float pyramid(vec3 p) {
  p = leaned(p);
  if (!apart()) return pyr(p);
  vec3 d = pieceDistances(p);
  return min(d.x, min(d.y, d.z));
}

// The sphere, its size, a poke's dent and the ripple running from it, and wrinkles.
float sphere(vec3 p) {
  float d = length(p) - SPHERE_R * uCore;
  if (uSurface.x > 1e-4 || uSurface.z > 1e-4) {
    float a = acos(clamp(dot(p, POKE) / max(length(p), 1e-4), -1., 1.));
    d += uSurface.z * exp(-a * a * 7.);
    d += uSurface.x * sin(a * 8. - uSurface.y) * exp(-a * .4) * smoothstep(0., .25, a);
  }
  if (uSurface.w > 1e-4) d += uSurface.w * .04 * sin(p.x * 15.) * sin(p.y * 13. + 1.) * sin(p.z * 14. + 2.);
  return d;
}

// The cloud: its puffs run together, flat underneath.
float cloud(vec3 p) {
  float d = 1e9;
  for (int i = 0; i < ${MOST.puffs}; i++) {
    vec4 b = uPuffs[i];
    if (b.w > 0.) d = smin(d, length(p - b.xyz) - b.w, CLOUD_K);
  }
  return smax(d, CLOUD_BASE - p.y, .08);
}

// Small balls beside the body: a sphere's moons and droplets, a cloud's raindrops.
float beads(vec3 p) {
  float d = 1e9;
  for (int i = 0; i < ${MOST.beads}; i++) {
    if (i >= uBeadCount) break;
    vec4 b = uBeads[i];
    if (b.w > 0.) d = min(d, length(p - b.xyz) - b.w);
  }
  return d;
}

vec2 shape(vec3 p) {
  if (uShape == 0) {
    float solid = sdRoundBox(p, vec3(CUBE_B), CUBE_R);
    if (uSplit <= .001) return vec2(solid);
    vec2 split = cubelets(p);
    return vec2(mix(solid, split.x, uSplit), mix(solid, split.y, uSplit));
  }
  if (uShape == 1) return vec2(sphere(p));
  if (uShape == 2) return vec2(pyramid(p));
  if (uShape == 3) {
    float solid = sdRoundBox(p, BLOCK_B, BLOCK_R);
    if (uSplit <= .001) return vec2(solid);
    vec2 parted = dials(p);
    return vec2(mix(solid, parted.x, uSplit), mix(solid, parted.y, uSplit));
  }
  return vec2(cloud(p));
}
float morphTarget(vec3 p) {
  if (uMorphTo == 1) {
    float wobble = sin(p.x * 4.1 + uTime * 2.3) * sin(p.y * 3.7 - uTime * 1.9) * sin(p.z * 4.3 + uTime * 1.6);
    return (length(p * vec3(1., 1.06, 1.)) - SPHERE_R * .96 - .07 * wobble) * .8;
  }
  if (uMorphTo == 2) return extrude(p, sdStar5(p.xy - vec2(0., .02), .88, .5) + .09, .14) - .13;
  return extrude(p, sdHeart(p.xy / 1.5 + vec2(0., .52)) * 1.5 + .06, .16) - .13;
}
vec2 body(vec3 p) {
  vec2 d = shape(p);
  if (uMorphTo > 0 && uMorph > .001) d = mix(d, vec2(morphTarget(p)), uMorph);
  if (uBeadCount > 0) {
    float b = beads(p);
    d = vec2(smin(d.x, b, .12), smin(d.y, b, .12));
  }
  return d;
}

vec3 toBody(vec3 p) { return transpose(uBody) * ((p - uBodyPos) / uBodyScale); }
vec2 march(vec3 p) {
  float s = min(uBodyScale.x, min(uBodyScale.y, uBodyScale.z));
  return body(toBody(p)) * s;
}
float map(vec3 p) { return march(p).y; }
vec3 normalAt(vec3 p) {
  const vec2 k = vec2(1., -1.);
  const float e = .0015;
  return normalize(k.xyy * map(p + k.xyy * e) + k.yyx * map(p + k.yyx * e) + k.yxy * map(p + k.yxy * e) + k.xxx * map(p + k.xxx * e));
}

// Where a point of the body was before its parts moved, so its colour and its eyes travel with
// them: a cubelet scrambled or flown apart, a dial or a layer turned, the capstone lifted and
// spun, the sphere swollen. Any other point, the point itself.
bool rigid() { return uMorph <= .5; }
mat3 cellOf(vec3 p, out vec3 q, out vec3 shift) {
  float S = cellSize();
  float bound;
  q = unturn(p, S * .5, bound);
  vec3 c = clamp(floor(q / S + .5), -1., 1.);
  int i = int(c.x + 1.) + int(c.y + 1.) * 3 + int(c.z + 1.) * 9;
  shift = c * (S - 2. * CUBE_B / 3.);
  return uCells[i];
}
// Which of the pyramid's pieces a point is on: 0 the base, 1 the middle slab, 2 the capstone.
int pieceOf(vec3 p) {
  if (!apart()) return 0;
  vec3 d = pieceDistances(leaned(p));
  return d.z < min(d.x, d.y) ? 2 : (d.y < d.x ? 1 : 0);
}
vec3 solvedPoint(vec3 p) {
  if (!rigid()) return p;
  if (uShape == 0) {
    vec3 q, shift;
    mat3 m = cellOf(p, q, shift);
    return transpose(m) * (q - shift);
  }
  if (uShape == 1) return p / max(uCore, .05);
  if (uShape == 2) {
    int piece = pieceOf(p);
    vec3 q = leaned(p);
    return piece == 2 ? inCap(q) : (piece == 1 ? inMiddle(q) : q);
  }
  if (uShape == 3) {
    float bound;
    return unturn(p, DIAL, bound);
  }
  return p;
}
vec3 solvedDir(vec3 p, vec3 v) {
  if (!rigid()) return v;
  if (uShape == 0) {
    vec3 q, shift;
    mat3 m = cellOf(p, q, shift);
    return transpose(m) * unturnDir(p, v, cellSize() * .5);
  }
  if (uShape == 2 && pieceOf(p) == 2) return turnAbout(v, 1, -uPieces.w);
  if (uShape == 3) return unturnDir(p, v, DIAL);
  return v;
}

// ---------------------------------------------------------------------------------------------
// Eyes, painted on: shapes in the face's own plane, square-cornered.

float sdBox2(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return length(max(d, 0.)) + min(max(d.x, d.y), 0.);
}
float sdStroke(vec2 p, vec2 a, vec2 b, float th) {
  float l = length(b - a);
  vec2 d = (b - a) / l;
  vec2 q = p - (a + b) * .5;
  q = mat2(d.x, -d.y, d.y, d.x) * q;
  q = abs(q) - vec2(l + th, th) * .5;
  return length(max(q, 0.)) + min(max(q.x, q.y), 0.);
}
// The upper lid's edge at x: a line from the eye's outer side to its inner one.
float lidAt(float x, float side, vec3 lid) {
  float w = uEyeSize.x, h = uEyeSize.y;
  float top = h * .5;
  float inner = top - lid.x * h, outer = top - lid.y * h;
  float left = side < 0. ? outer : inner;
  float right = side < 0. ? inner : outer;
  return left + (right - left) * (x / w + .5);
}
float glyph(int id, vec2 e, float side, vec3 lid) {
  float w = uEyeSize.x, h = uEyeSize.y;
  if (id == 0) {
    float d = sdBox2(e, vec2(w, h) * .5);
    float top = h * .5;
    float slope = (lidAt(w * .5, side, lid) - lidAt(-w * .5, side, lid)) / w;
    d = max(d, (e.y - lidAt(e.x, side, lid)) / sqrt(1. + slope * slope));
    float ry = h * .62, rx = w * .98;
    float cy = mix(-h * .5 - ry - h * .06, h * .06 - ry, lid.z);
    vec2 k = vec2(e.x / rx, (e.y - cy) / ry);
    return max(d, -(length(k) - 1.) * min(rx, ry));
  }
  if (id == 1) {
    float th = h * .2;
    return min(sdStroke(e, vec2(-w * .58, -h * .14), vec2(0., h * .2), th), sdStroke(e, vec2(0., h * .2), vec2(w * .58, -h * .14), th));
  }
  if (id == 2) return sdBox2(e, vec2(w * .62, h * .085));
  if (id == 3) return sdStar5(e * vec2(1., 1.) - vec2(0., -h * .04), w * 1.02, .46);
  if (id == 4) return sdHeart(e / (w * 1.25) + vec2(0., .55)) * (w * 1.25);
  if (id == 5) {
    float th = h * .18, s = w * .52;
    return min(sdStroke(e, vec2(-s), vec2(s), th), sdStroke(e, vec2(-s, s), vec2(s, -s), th));
  }
  float th = h * .19, sx = -side;
  vec2 a = vec2(-w * .44 * sx, h * .34), b = vec2(w * .4 * sx, 0.), c = vec2(-w * .44 * sx, -h * .34);
  return min(sdStroke(e, a, b, th), sdStroke(e, b, c, th));
}
// Both eyes at a point of the face's plane: their distance (x), and the glints' (y).
vec2 eyes(vec2 xy) {
  float size = uEyeSize.w, gap = uEyeSize.z;
  float open = max(uGlyph.w, .06);
  float rect = (uGlyph.x < .5 ? 1. - uGlyph.z : 0.) + (uGlyph.y < .5 ? uGlyph.z : 0.);
  float best = 1e9, glint = 1e9;
  for (int i = 0; i < 2; i++) {
    float side = i == 0 ? -1. : 1.;
    vec3 lid = i == 0 ? uLidL : uLidR;
    vec2 e = (xy - vec2(side * gap, 0.) - uLook) / size;
    e.y /= open;
    float d = mix(glyph(int(uGlyph.x + .5), e, side, lid), glyph(int(uGlyph.y + .5), e, side, lid), uGlyph.z) * size * min(1., open * 1.6);
    best = min(best, d);
    // The glint: the eye's top left, just under the upper lid wherever it has come down to.
    float w = uEyeSize.x, h = uEyeSize.y;
    float gs = w * .27, gx = -w * .34;
    float top = min(h * .39, min(lidAt(gx, side, lid), lidAt(gx + gs, side, lid)) - h * .07);
    float g = sdBox2(e - vec2(gx + gs * .5, top - gs * .5), vec2(gs * .5)) * size;
    glint = min(glint, rect > .5 ? max(g, d) : 1e9);
  }
  return vec2(best, glint);
}

// ---------------------------------------------------------------------------------------------
// Bits in front: a z (three strokes), and a spark (four points).

float sdZ(vec2 p, float s) {
  float th = s * .36;
  return min(min(sdStroke(p, vec2(-s, s), vec2(s, s), th), sdStroke(p, vec2(s, s), vec2(-s, -s), th)), sdStroke(p, vec2(-s, -s), vec2(s, -s), th));
}
float sdSpark(vec2 p, float s) {
  vec2 q = abs(p) / s;
  return (sqrt(q.x) + sqrt(q.y) - 1.) * s * .42;
}
float hash1(float n) { return fract(sin(n * 127.1 + 311.7) * 43758.5453); }

// ---------------------------------------------------------------------------------------------
// Aura's material

vec3 palette(float t) { return uPalA + uPalB * cos(TAU * (uPalD + t)); }
// The palette at a direction's angle, turned by offset, with no angle (so no seam):
// cos(θ + φ) = cos θ cos φ − sin θ sin φ.
vec3 around(vec2 toward, float offset) {
  vec3 phase = (uPalD + offset) * TAU;
  return uPalA + uPalB * (toward.x * cos(phase) - toward.y * sin(phase));
}
vec3 grey(vec3 c) { return mix(vec3(dot(c, vec3(.2126, .7152, .0722))), c, uSaturation); }
vec3 toSrgb(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1. / 2.4)) - .055, step(.0031308, c)); }

void main() {
  vec2 ndc = gl_FragCoord.xy / uSize * 2. - 1.;
  vec3 target = vec3(0.);
  vec3 ro = target + vec3(0., sin(CAM_PITCH), cos(CAM_PITCH)) * CAM_DIST;
  vec3 fw = normalize(target - ro);
  vec3 rt = normalize(cross(fw, vec3(0., 1., 0.)));
  vec3 up = cross(rt, fw);
  vec3 rd = normalize(fw + (ndc.x * rt + ndc.y * up) * (VIEW_HALF / CAM_DIST));
  float pixel = (2. * VIEW_HALF / CAM_DIST) / uSize.y;

  // March, keeping the closest the ray came (relative to a pixel there): a near miss is part of
  // the edge, so the silhouette is smoothed without drawing it twice.
  float t = CAM_DIST - 2.4;
  float tEnd = CAM_DIST + 2.4;
  float closest = 1e9;
  float tClosest = t;
  bool hit = false;
  for (int i = 0; i < 110; i++) {
    vec3 p = ro + rd * t;
    vec2 d = march(p);
    float ratio = d.y / (pixel * t);
    if (ratio < closest) { closest = ratio; tClosest = t; }
    if (ratio < .08) { hit = true; break; }
    t += max(d.x * .82, pixel * t * .25);
    if (t > tEnd) break;
  }
  float cover = hit ? 1. : clamp(1. - closest, 0., 1.);
  vec3 p = ro + rd * (hit ? t : tClosest);
  vec3 n = normalAt(p);
  // In the camera's frame: x right, y up, z toward the viewer, as Aura shaded its sphere.
  vec3 nc = vec3(dot(n, rt), dot(n, up), dot(n, -fw));
  float z = clamp(nc.z, 0., 1.);
  float r = clamp(length(nc.xy), 0., 1.);
  // Where the pixel sits round the figure, in the picture.
  vec2 screen = ndc * VIEW_HALF - vec2(uBodyPos.x, (uBodyPos.y - target.y) * cos(CAM_PITCH));
  vec2 around2 = normalize(screen + vec2(1e-4));
  vec2 toward = normalize(nc.xy + around2 * .35 + vec2(1e-4));

  // The body's own point (before a scramble), for its colour and its eyes.
  vec3 pb = toBody(p);
  vec3 ps = solvedPoint(pb);
  vec3 nb = transpose(uBody) * n;
  vec3 ns = solvedDir(pb, nb);
  // Its colour may roll round on its own (the eyes stay where they are).
  vec3 pc = abs(uRoll) > 1e-5 ? turnAbout(ps, 0, -uRoll) : ps;

  // Colour as a field: noise warped by noise, in 3D so it wraps the body, flowing with time.
  float scale = uSwirl * .6 + .75;
  vec3 point = pc * 1.25 * scale + vec3(OFFSET, uFlow * .07 + OFFSET, uFlow * .19);
  float warp = fbm(point);
  float field = fbm(point + vec3(warp * (uSwirl * .9 + .2)));
  vec3 inner = palette(field * (uSwirl * .45 + .55) + uHue);
  float churn = fbm(vec3(toward * 1.6 + OFFSET, uFlow * .23)) * uSwirl * .18;
  vec3 ring = around(toward, uHue + churn);
  vec3 surface = mix(inner, ring, smoothstep(.5, 1., r) * .8);
  float rim = pow(1. - z, 1.4);
  surface = mix(vec3(.975, .97, .99), surface, clamp(rim * .6 + uMilk, 0., 1.));
  surface *= mix(1., .9, smoothstep(.82, 1., r));
  vec3 light = normalize(vec3(-.45, .62, .65));
  float lit = dot(nc, light);
  surface *= mix(.88, 1.03, lit * .5 + .5);
  vec2 glossAt = nc.xy - vec2(-.33, .4);
  surface += exp(-dot(glossAt, glossAt) * 11.) * .26;
  vec2 heading = vec2(cos(uArcAngle * TAU), sin(uArcAngle * TAU));
  float comet = smoothstep(.3, 1., dot(around2, heading)) * uArc;
  surface += mix(ring, vec3(1.), .5) * comet * smoothstep(.6, 1., r) * .5;
  surface = grey(surface) * mix(.92, 1.05, clamp(uEnergy, 0., 1.3));

  // The eyes, in the face's plane, on the side that faces the way they do.
  vec3 rel = ps - uEyeO;
  vec2 xy = vec2(dot(rel, uEyeR), dot(rel, uEyeU));
  vec2 eye = eyes(xy);
  float aa = max(fwidth(eye.x), 1e-4) * .75;
  float facing = smoothstep(.25, .5, dot(ns, uEyeF)) * step(-.3, dot(rel, uEyeF));
  // Only on the body itself: never a moon or a raindrop passing in front.
  if (uBeadCount > 0) facing *= smoothstep(-.005, .02, beads(pb) - shape(pb).y);
  float ink = (1. - smoothstep(-aa, aa, eye.x)) * facing;
  float shine = (1. - smoothstep(-aa, aa, eye.y)) * facing;
  vec3 inkColour = uInk * mix(.9, 1.15, lit * .5 + .5) + exp(-dot(glossAt, glossAt) * 11.) * .12;
  surface = mix(surface, inkColour, ink);
  surface = mix(surface, vec3(.96), shine * .94);

  // Outside: the halo, the rim's own rainbow fading with distance, rings travelling out while
  // it listens; and a soft shadow on the ground.
  float beyond = max(closest * pixel * tClosest, 0.) / uReach;
  float reach = exp(-beyond * 2.2 / max(uHalo, .05));
  float rings = (sin(beyond * 20. - uRings) * .5 + .5) * uRipple * reach;
  float glow = reach * .55 * uEnergy + rings * .22 + comet * reach * .35;
  // Gone before the canvas's edge, so no card or column ever cuts it square.
  glow *= 1. - smoothstep(.55, .96, length(ndc));
  vec3 ringOut = around(around2, uHue);
  vec3 luma = vec3(dot(ringOut, vec3(.2126, .7152, .0722)));
  vec3 haloColour = clamp(grey((ringOut - luma) * 1.4 + luma), 0., 1.);
  float haloA = clamp(glow, 0., .9) * (1. - cover);

  float shadowA = 0.;
  if (rd.y < 0.) {
    float tf = (uFloorY - ro.y) / rd.y;
    vec3 fp = ro + rd * tf;
    vec2 off = (fp.xz - uBodyPos.xz) / vec2(1., .55);
    float lift = max(uBottom - uFloorY, 0.);
    float spread = .62 * (1. + lift * .8);
    shadowA = exp(-dot(off, off) / (spread * spread)) * .2 / (1. + lift * 4.);
  }
  shadowA *= (1. - cover) * (1. - haloA);

  vec3 c = toSrgb(clamp(surface, 0., 1.));
  vec3 h = toSrgb(haloColour);
  float alpha = cover + haloA + shadowA;
  colour = vec4(c * cover + h * haloA, alpha);

  vec2 picture = ndc * VIEW_HALF;
  float px = 2. * VIEW_HALF / uSize.y;
  float base = uBottom * cos(CAM_PITCH);

  // The cloud's rainbow, behind it: an arc over it in its colours, sweeping in from the left.
  if (uRainbow.y > 0.) {
    vec2 v = picture - vec2(uBodyPos.x, base);
    float band = (length(v) - 1.) / .26;
    float along = 1. - atan(max(v.y, 0.), v.x) / 3.14159;
    float shown = smoothstep(0., .06, band) * (1. - smoothstep(.94, 1., band)) * step(0., v.y);
    shown *= 1. - smoothstep(uRainbow.x - .08, uRainbow.x, along);
    shown *= 1. - smoothstep(.86, 1., length(ndc));
    float a = shown * uRainbow.y * .8 * (1. - colour.a);
    colour = vec4(colour.rgb + toSrgb(grey(palette(clamp(band, 0., 1.) * .66))) * a, colour.a + a);
  }

  // Lightning from under the cloud to the ground: a zigzag, and its glow.
  if (uBolt.x > 0.) {
    vec2 top = vec2(uBodyPos.x + .04, base + .03);
    vec2 bottom = vec2(uBodyPos.x - .03, uFloorY * cos(CAM_PITCH));
    float d = 1e9;
    vec2 a = top;
    for (int i = 1; i <= 4; i++) {
      float f = float(i) / 4.;
      vec2 b = mix(top, bottom, f);
      if (i < 4) b.x += (hash1(uBolt.y * 7.3 + float(i)) - .5) * .2;
      d = min(d, sdStroke(picture, a, b, .055 * (1.2 - f * .5)));
      a = b;
    }
    // The bolt in its deep colour, so it shows on a light page; its glow in its light one.
    float core = (1. - smoothstep(-px, px, d)) * uBolt.x;
    float glowA = exp(-max(d, 0.) * 22.) * .55 * uBolt.x * (1. - core);
    vec3 boltColour = toSrgb(grey(mix(palette(2. / 3.), palette(0.), .25)));
    vec3 glowColour = toSrgb(grey(palette(1. / 3.)));
    colour = vec4(colour.rgb * (1. - glowA) + glowColour * glowA, colour.a * (1. - glowA) + glowA);
    colour = vec4(colour.rgb * (1. - core) + boltColour * core, colour.a * (1. - core) + core);
  }

  // Bits in front of it all: hearts in its own colour, stars in its deep one, z's in ink, sparks.
  for (int i = 0; i < ${MOST.bits}; i++) {
    float kind = uBitKinds[i];
    vec4 b = uBits[i];
    if (kind < .5 || b.w <= 0.) continue;
    vec2 e = picture - b.xy;
    float d;
    vec3 tint;
    if (kind < 1.5) {
      d = sdHeart(e / b.z + vec2(0., .5)) * b.z;
      tint = mix(palette(0.), palette(1. / 3.), smoothstep(-.5, .9, e.y / b.z) * .45);
    } else if (kind < 2.5) {
      d = sdStar5(e, b.z, .45);
      tint = mix(palette(2. / 3.), palette(0.), .3);
    } else if (kind < 3.5) {
      d = sdZ(e, b.z * .5);
      tint = uInk;
    } else {
      d = sdSpark(e, b.z);
      tint = mix(palette(2. / 3.), palette(0.), .5);
    }
    float a = (1. - smoothstep(-px * .75, px * .75, d)) * b.w;
    vec3 shade = toSrgb(clamp(grey(tint), 0., 1.));
    colour = vec4(colour.rgb * (1. - a) + shade * a, colour.a * (1. - a) + a);
  }
}`;

type Uniform =
  | "uSize"
  | "uShape"
  | "uMorphTo"
  | "uMorph"
  | "uTime"
  | "uBody"
  | "uBodyPos"
  | "uBodyScale"
  | "uSplit"
  | "uSpread"
  | "uCells"
  | "uLayers"
  | "uPieces"
  | "uShear"
  | "uCore"
  | "uBeads"
  | "uBeadCount"
  | "uPuffs"
  | "uSurface"
  | "uRoll"
  | "uBits"
  | "uBitKinds"
  | "uRainbow"
  | "uBolt"
  | "uEyeO"
  | "uEyeR"
  | "uEyeU"
  | "uEyeF"
  | "uEyeSize"
  | "uLook"
  | "uLidL"
  | "uLidR"
  | "uGlyph"
  | "uInk"
  | "uPalA"
  | "uPalB"
  | "uPalD"
  | "uHue"
  | "uFlow"
  | "uSwirl"
  | "uEnergy"
  | "uSaturation"
  | "uHalo"
  | "uRipple"
  | "uRings"
  | "uArc"
  | "uArcAngle"
  | "uFloorY"
  | "uBottom"
  | "uReach"
  | "uMilk";

const NAMES: Uniform[] = [
  "uSize",
  "uShape",
  "uMorphTo",
  "uMorph",
  "uTime",
  "uBody",
  "uBodyPos",
  "uBodyScale",
  "uSplit",
  "uSpread",
  "uCells",
  "uLayers",
  "uPieces",
  "uShear",
  "uCore",
  "uBeads",
  "uBeadCount",
  "uPuffs",
  "uSurface",
  "uRoll",
  "uBits",
  "uBitKinds",
  "uRainbow",
  "uBolt",
  "uEyeO",
  "uEyeR",
  "uEyeU",
  "uEyeF",
  "uEyeSize",
  "uLook",
  "uLidL",
  "uLidR",
  "uGlyph",
  "uInk",
  "uPalA",
  "uPalB",
  "uPalD",
  "uHue",
  "uFlow",
  "uSwirl",
  "uEnergy",
  "uSaturation",
  "uHalo",
  "uRipple",
  "uRings",
  "uArc",
  "uArcAngle",
  "uFloorY",
  "uBottom",
  "uReach",
  "uMilk",
];

type Renderer = { gl: WebGL2RenderingContext; at: Record<Uniform, WebGLUniformLocation | null> };

/** Not tried yet (undefined), unavailable (null), or ready. */
let renderer: Renderer | null | undefined;
const contexts = new WeakMap<HTMLCanvasElement, CanvasRenderingContext2D | null>();
const restored = new Set<() => void>();

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  console.error(gl.getShaderInfoLog(shader));
  return null;
}

function create(): Renderer | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = MOST_PIXELS;
  const gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false });
  if (!gl) return null;
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
  const program = gl.createProgram();
  if (!vertex || !fragment || !program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);
  const at = Object.fromEntries(NAMES.map((name) => [name, gl.getUniformLocation(program, name)])) as Renderer["at"];
  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    renderer = null;
  });
  canvas.addEventListener("webglcontextrestored", () => {
    renderer = undefined;
    for (const redraw of restored) redraw();
  });
  return { gl, at };
}

/** Whether figures can be drawn here at all (WebGL 2, and the shader compiled). */
export function canDraw() {
  if (renderer === undefined) renderer = create();
  return Boolean(renderer && !renderer.gl.isContextLost());
}

/** Draws a figure's scene onto `target` (its own canvas, in device pixels). False when there's no WebGL 2, or it was lost. */
export function drawFigure(target: HTMLCanvasElement, scene: FigureScene): boolean {
  if (renderer === undefined) renderer = create();
  const r = renderer;
  if (!r || r.gl.isContextLost()) return false;
  let context = contexts.get(target);
  if (context === undefined) {
    context = target.getContext("2d");
    contexts.set(target, context);
  }
  if (!context) return false;
  const { gl, at } = r;
  const size = Math.min(MOST_PIXELS, target.width);
  const { body, eyes, aura } = scene;
  gl.viewport(0, 0, size, size);
  gl.uniform2f(at.uSize, size, size);
  gl.uniform1i(at.uShape, scene.shape);
  gl.uniform1i(at.uMorphTo, scene.morphTo);
  gl.uniform1f(at.uMorph, scene.morph);
  gl.uniform1f(at.uTime, scene.time);
  gl.uniformMatrix3fv(at.uBody, false, body.rotation);
  gl.uniform3fv(at.uBodyPos, body.position);
  gl.uniform3fv(at.uBodyScale, body.scale);
  gl.uniform1f(at.uSplit, scene.split);
  gl.uniform1f(at.uSpread, scene.spread);
  gl.uniformMatrix3fv(at.uCells, false, scene.cells);
  gl.uniform4fv(at.uLayers, scene.layers);
  gl.uniform4fv(at.uPieces, scene.pieces);
  gl.uniform1f(at.uShear, scene.shear);
  gl.uniform1f(at.uCore, scene.core);
  gl.uniform4fv(at.uBeads, scene.beads);
  gl.uniform1i(at.uBeadCount, scene.beadCount);
  gl.uniform4fv(at.uPuffs, scene.puffs);
  gl.uniform4fv(at.uSurface, scene.surface);
  gl.uniform1f(at.uRoll, scene.roll);
  gl.uniform4fv(at.uBits, scene.bits);
  gl.uniform4fv(at.uBitKinds, scene.bitKinds);
  gl.uniform2fv(at.uRainbow, scene.rainbow);
  gl.uniform2fv(at.uBolt, scene.bolt);
  gl.uniform3fv(at.uEyeO, eyes.origin);
  gl.uniform3fv(at.uEyeR, eyes.right);
  gl.uniform3fv(at.uEyeU, eyes.up);
  gl.uniform3fv(at.uEyeF, eyes.forward);
  gl.uniform4f(at.uEyeSize, eyes.width, eyes.height, eyes.gap, eyes.size);
  gl.uniform2f(at.uLook, eyes.dx, eyes.dy);
  gl.uniform3fv(at.uLidL, eyes.left);
  gl.uniform3fv(at.uLidR, eyes.right3);
  gl.uniform4f(at.uGlyph, eyes.glyph, eyes.glyphTo, eyes.glyphMix, eyes.open);
  gl.uniform3fv(at.uInk, scene.ink);
  gl.uniform3fv(at.uPalA, aura.palette.a);
  gl.uniform3fv(at.uPalB, aura.palette.b);
  gl.uniform3fv(at.uPalD, aura.palette.d);
  gl.uniform1f(at.uHue, aura.hue);
  gl.uniform1f(at.uFlow, aura.flow);
  gl.uniform1f(at.uSwirl, aura.swirl);
  gl.uniform1f(at.uEnergy, aura.energy);
  gl.uniform1f(at.uSaturation, aura.saturation);
  gl.uniform1f(at.uHalo, aura.halo);
  gl.uniform1f(at.uRipple, aura.ripple);
  gl.uniform1f(at.uRings, aura.rings);
  gl.uniform1f(at.uArc, aura.arc);
  gl.uniform1f(at.uArcAngle, aura.arcAngle);
  gl.uniform1f(at.uFloorY, scene.floor);
  gl.uniform1f(at.uBottom, scene.bottom);
  gl.uniform1f(at.uReach, scene.reach);
  gl.uniform1f(at.uMilk, aura.milk);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  // The drawing sits at the bottom left of the shared canvas; copy it before the browser clears it.
  context.clearRect(0, 0, target.width, target.height);
  context.drawImage(gl.canvas, 0, MOST_PIXELS - size, size, size, 0, 0, target.width, target.height);
  return true;
}

/** Calls `redraw` when a lost context comes back, so a figure can draw again. */
export function onRestored(redraw: () => void) {
  restored.add(redraw);
  return () => {
    restored.delete(redraw);
  };
}

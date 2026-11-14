import { describe, expect, it } from "vitest";

import { apply, bodyTurn, BODY, BOTTOM, CAMERA, cross, CUBELET_GAP, dot, EYES, IDENTITY, multiply, paletteAt, paletteThrough, pictureY, PUFFS, SHAPES_3D, TOP, turnAbout, type Vec3 } from "./figure-space.ts";

const close = (a: Vec3, b: Vec3, digits = 5) => a.forEach((value, i) => expect(value).toBeCloseTo(b[i], digits));

describe("figure space", () => {
  it("fits a cosine palette through a colourway's three colours, a third of the way round each", () => {
    const main: Vec3 = [0.2, 0.4, 0.9];
    const light: Vec3 = [0.5, 0.75, 0.95];
    const deep: Vec3 = [0.35, 0.1, 0.8];
    const palette = paletteThrough(main, light, deep);
    close(paletteAt(palette, 0), main);
    close(paletteAt(palette, 1 / 3), light);
    close(paletteAt(palette, 2 / 3), deep);
    // Smooth all the way round, so a hue that keeps turning never jumps.
    close(paletteAt(palette, 1), main);
  });

  it("turns the body as the figure's words say: yaw toward the picture's right, pitch up, roll leaning right", () => {
    const front: Vec3 = [0, 0, 1];
    const top: Vec3 = [0, 1, 0];
    expect(apply(bodyTurn(30, 0, 0), front)[0]).toBeGreaterThan(0.4);
    expect(apply(bodyTurn(0, 30, 0), front)[1]).toBeGreaterThan(0.4);
    expect(apply(bodyTurn(0, 0, 30), top)[0]).toBeGreaterThan(0.4);
    close(apply(bodyTurn(0, 0, 0), front), front);
  });

  it("takes four quarter turns round any axis back to where they started", () => {
    for (const axis of [0, 1, 2] as const) {
      const quarter = turnAbout(axis, Math.PI / 2);
      const whole = multiply(multiply(quarter, quarter), multiply(quarter, quarter));
      whole.forEach((value, i) => expect(value).toBeCloseTo(IDENTITY[i], 6));
    }
    // A positive turn about z takes x toward y.
    close(apply(turnAbout(2, Math.PI / 2), [1, 0, 0]), [0, 1, 0]);
  });

  it("puts every shape on the ground, and its eyes on a face that looks out, square to it", () => {
    expect(BOTTOM.cube).toBe(-BODY.cube.half);
    expect(BOTTOM.sphere).toBe(-BODY.sphere.radius);
    for (const shape of SHAPES_3D) {
      const { origin, right, up, forward, width, height, gap } = EYES[shape];
      expect(dot(forward, forward)).toBeCloseTo(1);
      expect(dot(right, up)).toBeCloseTo(0);
      expect(dot(up, forward)).toBeCloseTo(0);
      close(cross(up, forward), right);
      // It looks out of the shape, not into it.
      expect(dot(origin, forward), shape).toBeGreaterThan(0.2);
      expect(width).toBeLessThan(height);
      expect(gap).toBeGreaterThan(width / 2);
    }
    // On the cube and the block, both eyes sit inside the face, clear of the rounded edges.
    expect(EYES.cube.gap + EYES.cube.width / 2).toBeLessThan(BODY.cube.half - BODY.cube.round);
    expect(EYES.block.gap + EYES.block.width / 2).toBeLessThan(BODY.block.half[0] - BODY.block.round);
    // The pyramid's face tips up toward the sky.
    expect(EYES.pyramid.forward[1]).toBeGreaterThan(0.3);
    // Split into cubelets, the cube's eyes sit on the middle row's outer two.
    expect(CUBELET_GAP).toBeCloseTo((2 * BODY.cube.half) / 3);
    // The block's eyes both sit on its middle dial, so they turn with it; the pyramid's are below its cuts.
    expect(EYES.block.gap + EYES.block.width / 2).toBeLessThan(BODY.block.dial);
    expect(EYES.pyramid.origin[1] + EYES.pyramid.height * 0.65).toBeLessThan(BODY.pyramid.cuts[0]);
  });

  it("builds the cloud from its puffs, its face on the biggest, flat underneath, and knows how tall each shape stands", () => {
    const face = PUFFS[0];
    expect(PUFFS.every((puff) => puff[3] <= face[3])).toBe(true);
    const fromFace = Math.hypot(EYES.cloud.origin[0] - face[0], EYES.cloud.origin[1] - face[1], EYES.cloud.origin[2] - face[2]);
    expect(fromFace).toBeCloseTo(face[3], 1);
    expect(BOTTOM.cloud).toBe(BODY.cloud.base);
    for (const shape of SHAPES_3D) expect(TOP[shape] - BOTTOM[shape], shape).toBeGreaterThan(0.9);
    // The camera looks down a little: a point above the middle is seen a little lower, below it a little higher.
    expect(pictureY(0)).toBe(0);
    expect(pictureY(1)).toBeLessThan(1.05);
    expect(pictureY(1)).toBeGreaterThan(Math.cos(CAMERA.pitch));
  });
});

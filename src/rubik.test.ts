import { describe, expect, it } from "vitest";

import { applyMove, cellAt, cellIndex, cellsOf, inverse, isSolved, type Move, scramble, solved, thinkingMoves } from "./rubik.ts";

const determinant = (m: number[]) => m[0] * (m[4] * m[8] - m[7] * m[5]) - m[3] * (m[1] * m[8] - m[7] * m[2]) + m[6] * (m[1] * m[5] - m[4] * m[2]);

describe("the thinking cube's Rubik's turns", () => {
  it("numbers its 27 cells both ways", () => {
    for (let i = 0; i < 27; i++) expect(cellIndex(...cellAt(i))).toBe(i);
  });

  it("is solved by a move and its inverse, and by four quarter turns of a layer", () => {
    for (const axis of [0, 1, 2] as const) {
      for (const layer of [-1, 0, 1] as const) {
        const move: Move = { axis, layer, turns: 1 };
        expect(isSolved(applyMove(solved(), move))).toBe(false);
        expect(isSolved(applyMove(applyMove(solved(), move), inverse(move)))).toBe(true);
        let cube = solved();
        for (let i = 0; i < 4; i++) cube = applyMove(cube, move);
        expect(isSolved(cube)).toBe(true);
        expect(isSolved(applyMove(applyMove(solved(), { ...move, turns: 2 }), { ...move, turns: 2 }))).toBe(true);
      }
    }
  });

  it("moves only the turning layer's cubelets, each a whole turn of its own", () => {
    const cube = applyMove(applyMove(solved(), { axis: 1, layer: 1, turns: 1 }), { axis: 0, layer: -1, turns: -1 });
    const top = applyMove(solved(), { axis: 1, layer: 1, turns: 1 });
    top.forEach((orientation, index) => {
      if (cellAt(index)[1] !== 1) expect(orientation).toEqual(solved()[index]);
    });
    for (const orientation of cube) {
      expect(orientation.every((value) => Number.isInteger(value))).toBe(true);
      expect(determinant(orientation)).toBe(1);
    }
  });

  it("scrambles by quarter turns, never the same axis twice running, and solves itself after", () => {
    const moves = scramble(42, 8);
    expect(moves).toHaveLength(8);
    for (let i = 1; i < moves.length; i++) expect(moves[i].axis).not.toBe(moves[i - 1].axis);
    expect(scramble(42, 8)).toEqual(moves);
    const round = thinkingMoves(42, 4);
    expect(round).toHaveLength(8);
    expect(isSolved(round.reduce(applyMove, solved()))).toBe(true);
    expect(isSolved(round.slice(0, 4).reduce(applyMove, solved()))).toBe(false);
  });

  it("hands the shader its cells as 27 column-major 3×3s", () => {
    const cells = cellsOf(applyMove(solved(), { axis: 2, layer: 1, turns: 1 }));
    expect(cells).toHaveLength(27 * 9);
    expect(Array.from(cells.slice(0, 9))).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  });
});

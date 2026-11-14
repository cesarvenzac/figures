import { apply, IDENTITY, type Mat3, multiply, turnAbout, type Vec3 } from "./figure-space.ts";

/**
 * The cube figure's Rubik's turns, as it thinks: 27 cells, each holding the turn its cubelet has
 * taken from where it started, so the shader can find any point's place in the solved cube and
 * draw its colour and its eyes there (they travel with their cubelets). Pure.
 *
 * A move turns one layer (all cells with the same x, y or z: −1, 0 or 1) a quarter or a half
 * round its axis. Cells are numbered (x + 1) + (y + 1)·3 + (z + 1)·9.
 */

export type Move = { axis: 0 | 1 | 2; layer: -1 | 0 | 1; turns: 1 | -1 | 2 };
/** Each cell's cubelet's turn from where it started, column-major. */
export type Cube = Mat3[];

export const cellIndex = (x: number, y: number, z: number) => x + 1 + (y + 1) * 3 + (z + 1) * 9;
export const cellAt = (index: number): Vec3 => [(index % 3) - 1, (Math.floor(index / 3) % 3) - 1, Math.floor(index / 9) - 1];

export const solved = (): Cube => Array.from({ length: 27 }, () => [...IDENTITY] as Mat3);

/** A quarter or half turn has whole numbers in it: rounded, so turns never drift. */
const whole = <T extends number[]>(values: T) => values.map((value) => Math.round(value) || 0) as T;

/** The cube after a move: each cell of the layer passes its cubelet on to where the turn takes it, turned with it. */
export function applyMove(cube: Cube, move: Move): Cube {
  const turn = whole(turnAbout(move.axis, (move.turns * Math.PI) / 2));
  const next = cube.slice();
  cube.forEach((orientation, index) => {
    const cell = cellAt(index);
    if (cell[move.axis] !== move.layer) return;
    const [x, y, z] = whole(apply(turn, cell));
    next[cellIndex(x, y, z)] = whole(multiply(turn, orientation));
  });
  return next;
}

/** The move that undoes `move`. */
export const inverse = (move: Move): Move => ({ ...move, turns: move.turns === 2 ? 2 : ((-move.turns) as 1 | -1) });

/** Whether every cubelet is back where it started. */
export const isSolved = (cube: Cube) => cube.every((orientation) => orientation.every((value, i) => value === IDENTITY[i]));

/**
 * A few moves to scramble the cube by, the same for the same seed: never the same axis twice in a
 * row (two turns of one axis read as one), quarter turns either way.
 */
export function scramble(seed: number, count: number): Move[] {
  let state = seed >>> 0 || 1;
  const next = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const moves: Move[] = [];
  let last = -1;
  while (moves.length < count) {
    const axis = Math.floor(next() * 3) as 0 | 1 | 2;
    if (axis === last) continue;
    last = axis;
    moves.push({ axis, layer: (Math.floor(next() * 3) - 1) as -1 | 0 | 1, turns: next() < 0.5 ? 1 : -1 });
  }
  return moves;
}

/** A scramble and its solution, one after the other: the cube thinks, then puts itself back. */
export const thinkingMoves = (seed: number, count = 4): Move[] => {
  const moves = scramble(seed, count);
  return [...moves, ...[...moves].reverse().map(inverse)];
};

/** The cells as the shader takes them: 27 column-major 3×3s. */
export function cellsOf(cube: Cube, into = new Float32Array(27 * 9)) {
  cube.forEach((orientation, index) => into.set(orientation, index * 9));
  return into;
}

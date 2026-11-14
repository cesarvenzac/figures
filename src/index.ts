/**
 * Small figures for the agents in your interface: a cube, a sphere, a pyramid, a block or a cloud,
 * really in 3D, in an iridescent material, with two eyes painted on its face. They say everything
 * with their eyes and the way they move: waiting, at work, thinking, done, in trouble or asleep,
 * reacting as that changes, looking at the pointer and at each other, petted when clicked.
 *
 *   import { figureFor } from "@cesarvenzac/figures";
 *   import { AgentFigure } from "@cesarvenzac/figures/react";
 *
 *   <AgentFigure figure={figureFor("Ada")} mood="thinking" size={48} />
 *
 * A figure is four choices (`Figure`): its shape, its energy, its habit and its colourway.
 * `figureFor` makes one from any word, the same every time; `readFigure` reads a stored one back.
 * `svgOf` writes a flat still, for anywhere a live one can't go (an email, a social card).
 *
 * Plain TypeScript, no dependencies; this entry runs anywhere. The live figure is
 * `@cesarvenzac/figures/react`, drawn with WebGL 2, one context for the whole page.
 */

export {
  type Colourway,
  COLOURWAYS,
  DEFAULT_FIGURE,
  ENERGIES,
  type Energy,
  type Expression,
  EXPRESSIONS,
  type Figure,
  figureFor,
  HABITS,
  type Habit,
  INK,
  isFigure,
  LOOPS,
  type Loop,
  type Mood,
  MOODS,
  type Motion,
  MOTIONS,
  MOVES,
  ONCE,
  type Once,
  type Palette,
  PALETTES,
  type Reaction,
  REACTIONS,
  reactionTo,
  readFigure,
  type Shape,
  SHAPES,
  svgOf,
} from "./figure.ts";

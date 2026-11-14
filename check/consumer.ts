// The package as someone installing it uses it: typechecked against its published types (as
// NodeNext and as a bundler resolves them) and run, by check/run.sh.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  COLOURWAYS,
  EXPRESSIONS,
  type Figure,
  figureFor,
  INK,
  isFigure,
  type Mood,
  MOODS,
  reactionTo,
  readFigure,
  SHAPES,
  svgOf,
} from "@cesarvenzac/figures";
import { AgentDot, AgentFigure } from "@cesarvenzac/figures/react";

const ada: Figure = figureFor("Ada");
if (!isFigure(ada) || JSON.stringify(figureFor("Ada")) !== JSON.stringify(ada)) throw new Error("figureFor isn't the same every time");
if (readFigure({ shape: "square" }).shape !== "cube") throw new Error("a stored flat shape isn't read back as its solid");
if (reactionTo("working", "happy") !== "celebrate") throw new Error("finishing doesn't celebrate");

const still = svgOf(ada, "happy", { ink: "#000" }, 64);
if (!still.startsWith("<svg") || !still.includes(COLOURWAYS[ada.palette].main)) throw new Error("svgOf drew nothing in its colourway");

const mood: Mood = "thinking";
const live = renderToStaticMarkup(createElement(AgentFigure, { figure: ada, mood, size: 32, ink: INK }));
if (!live.includes("<canvas")) throw new Error("AgentFigure drew no canvas");
const dot = renderToStaticMarkup(createElement(AgentDot, { figure: ada, colours: { main: "red", light: "pink", deep: "darkred" } }));
if (!dot.includes("linear-gradient(135deg, pink, red 50%, darkred)")) throw new Error("AgentDot isn't its colours");

console.log(`${SHAPES.length} shapes, ${EXPRESSIONS.length} expressions, ${MOODS.length} moods; Ada is a ${ada.energy} ${ada.shape}, ${live.length} characters live`);

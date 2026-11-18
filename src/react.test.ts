import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { COLOURWAYS, DEFAULT_FIGURE, figureFor, FLAT } from "./figure.ts";
import { AgentDot, AgentFigure } from "./react.tsx";

describe("AgentFigure", () => {
  it("draws its box at its size, hidden from assistive tech, with its canvas half as big again and no stylesheet needed", () => {
    const markup = renderToStaticMarkup(createElement(AgentFigure, { figure: figureFor("Ada"), mood: "thinking", size: 40, className: "here" }));
    expect(markup).toMatch(/^<div aria-hidden="true" data-mood="thinking" data-expression="thinking" class="figure here" style="position:relative;display:inline-block;flex-shrink:0;vertical-align:middle;width:40px;height:40px/);
    // Its canvas: twice the box at two pixels a pixel, until the browser says otherwise, and hidden until it has drawn.
    expect(markup).toContain('<canvas width="120" height="120" style="position:absolute;left:-25%;top:-25%;width:150%;height:150%;pointer-events:none;opacity:0;');
  });

  it("is its flat drawing until the shader is ready, filling its box under the canvas, so something shows from the server on and nothing moves when the 3D one fades in", () => {
    const markup = renderToStaticMarkup(createElement(AgentFigure, { figure: { ...DEFAULT_FIGURE, shape: "cube" }, size: 40 }));
    expect(markup).toMatch(/^<div [^>]+><svg viewBox="0 0 100 100" class="figure-flat" style="position:absolute;inset:0;display:block;width:100%;height:100%;opacity:1;transition:opacity 300ms[^"]*">.*<\/svg><canvas [^>]+><\/canvas><\/div>$/);
    expect(markup).toContain(FLAT.cube.d);
    // Switched off, greyed and fainter, as where there's no WebGL 2.
    expect(renderToStaticMarkup(createElement(AgentFigure, { figure: DEFAULT_FIGURE, mood: "sleep" }))).toContain("opacity:0.7;transition:opacity 300ms cubic-bezier(0.22, 1, 0.36, 1);filter:grayscale(1)");
  });

  it("says how it's handled: petted with a pointer cursor once moving, turned by hand with a grab", () => {
    const grabbed = renderToStaticMarkup(createElement(AgentFigure, { figure: DEFAULT_FIGURE, grab: true }));
    expect(grabbed).toContain("figure-grab");
    expect(grabbed).toContain("cursor:grab;touch-action:none");
    // On the server nothing moves yet, so nothing is pettable.
    expect(renderToStaticMarkup(createElement(AgentFigure, { figure: DEFAULT_FIGURE }))).not.toContain("cursor");
  });

  it("lets its own styles win", () => {
    const markup = renderToStaticMarkup(createElement(AgentFigure, { figure: DEFAULT_FIGURE, style: { display: "block" } }));
    expect(markup).toContain("position:relative;display:block;");
  });
});

describe("AgentDot", () => {
  it("is its colourway as a dot, or the colours it's given", () => {
    const own = renderToStaticMarkup(createElement(AgentDot, { figure: { ...DEFAULT_FIGURE, palette: 4 } }));
    const { light, main, deep } = COLOURWAYS[4];
    expect(own).toBe(`<span aria-hidden="true" style="display:inline-block;width:8px;height:8px;flex-shrink:0;border-radius:50%;background:linear-gradient(135deg, ${light}, ${main} 50%, ${deep})"></span>`);
    const given = renderToStaticMarkup(createElement(AgentDot, { figure: DEFAULT_FIGURE, size: 12, colours: { main: "var(--a)", light: "var(--b)", deep: "var(--c)" } }));
    expect(given).toContain("width:12px");
    expect(given).toContain("linear-gradient(135deg, var(--b), var(--a) 50%, var(--c))");
  });
});

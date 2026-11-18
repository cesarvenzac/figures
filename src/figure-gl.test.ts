import { afterEach, describe, expect, it, vi } from "vitest";

import { prepare, type Wait } from "./figure-gl.ts";

/**
 * A WebGL 2 context as a browser runs one: its calls go to a GPU process, which gets through them
 * in its own time (`finish`), and a question about work not finished yet holds the page's main
 * thread until it is (`stalls`). Fences and `KHR_parallel_shader_compile`'s completion answer at
 * once, done or not.
 */
function context({ parallel = false, compiles = true } = {}) {
  let issued = 0;
  let finished = 0;
  const log: string[] = [];
  let stalls = 0;
  /** A question that waits for everything issued before it. */
  const ask = (what: string) => {
    log.push(what);
    if (finished < issued) {
      stalls++;
      finished = issued;
    }
  };
  const work = (what: string) => {
    log.push(what);
    issued++;
  };
  const COMPLETION_STATUS_KHR = 0x91b1;
  const gl = {
    VERTEX_SHADER: 1,
    FRAGMENT_SHADER: 2,
    COMPILE_STATUS: 3,
    LINK_STATUS: 4,
    SYNC_GPU_COMMANDS_COMPLETE: 5,
    SYNC_STATUS: 6,
    SIGNALED: 7,
    UNSIGNALED: 8,
    TRIANGLES: 9,
    getExtension: (name: string) => (parallel && name === "KHR_parallel_shader_compile" ? { COMPLETION_STATUS_KHR } : null),
    createShader: (type: number) => ({ type }),
    createProgram: () => ({}),
    shaderSource: () => log.push("source"),
    compileShader: () => work("compile"),
    attachShader: () => log.push("attach"),
    linkProgram: () => work("link"),
    flush: () => log.push("flush"),
    getProgramParameter: (_: unknown, name: number) => {
      if (name === COMPLETION_STATUS_KHR) {
        log.push("completed?");
        return finished === issued;
      }
      ask("linked?");
      return compiles;
    },
    getShaderParameter: () => {
      ask("compiled?");
      return compiles;
    },
    getShaderInfoLog: () => "ERROR: 0:1: nope",
    getProgramInfoLog: () => "",
    useProgram: () => log.push("use"),
    getUniformLocation: (_: unknown, name: string) => name,
    viewport: (_x: number, _y: number, width: number, height: number) => log.push(`viewport ${width}×${height}`),
    uniform2f: () => undefined,
    drawArrays: () => work("draw"),
    fenceSync: () => {
      log.push("fence");
      return { at: issued };
    },
    getSyncParameter: (sync: { at: number }) => {
      log.push("signalled?");
      return finished >= sync.at ? 7 : 8;
    },
    deleteSync: () => undefined,
    isContextLost: () => false,
  };
  return {
    gl: gl as unknown as WebGL2RenderingContext,
    log,
    get stalls() {
      return stalls;
    },
    /** The GPU process gets through everything issued so far. */
    finish: () => {
      finished = issued;
    },
  };
}

/** Steps `prepare` on to its end: what it waited for, one wait a step, the GPU finishing its work every `frames` frames. */
function walk(gpu: ReturnType<typeof context>, steps = prepare(gpu.gl), frames = 3) {
  const waits: Wait[] = [];
  let unfinished = 0;
  for (let next = steps.next(); ; next = steps.next()) {
    if (next.done) return { waits, renderer: next.value };
    waits.push(next.value);
    if (next.value === "frame" && ++unfinished >= frames) {
      gpu.finish();
      unfinished = 0;
    }
    if (waits.length > 100) throw new Error("never ready");
  }
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("prepare", () => {
  it("without KHR_parallel_shader_compile, waits for an idle moment before compiling, then asks nothing the GPU hasn't done", () => {
    const gpu = context();
    const steps = prepare(gpu.gl);
    // The first render isn't held up: nothing's compiled before the page is idle.
    expect(steps.next()).toEqual({ done: false, value: "idle" });
    expect(gpu.log).not.toContain("compile");
    const { waits, renderer } = walk(gpu, steps);
    expect(renderer).not.toBeNull();
    // Never a question the GPU process would have had to finish its work to answer.
    expect(gpu.stalls).toBe(0);
    expect(waits.every((wait) => wait === "frame")).toBe(true);
    // Compiled and linked behind a fence, the link asked once the fence said so.
    const log = gpu.log.join(", ");
    expect(log).toMatch(/link, fence, flush, (signalled\?, )+linked\?, use/);
  });

  it("with KHR_parallel_shader_compile, compiles at once and asks each frame whether it's done", () => {
    const gpu = context({ parallel: true });
    const steps = prepare(gpu.gl);
    expect(steps.next()).toEqual({ done: false, value: "frame" });
    expect(gpu.log).toContain("link");
    const { waits, renderer } = walk(gpu, steps);
    expect(renderer).not.toBeNull();
    expect(gpu.stalls).toBe(0);
    expect(waits).not.toContain("idle");
    expect(gpu.log.join(", ")).toMatch(/link, flush, (completed\?, )+linked\?, use/);
  });

  it("draws once, on one pixel, and is ready only once that draw is done: the pipeline is made there", () => {
    for (const parallel of [false, true]) {
      const gpu = context({ parallel });
      const steps = prepare(gpu.gl);
      let next = steps.next();
      while (!next.done && !gpu.log.includes("draw")) {
        gpu.finish();
        next = steps.next();
      }
      expect(gpu.log.slice(-4)).toEqual(["viewport 1×1", "draw", "fence", "flush"]);
      // However many frames the draw takes, not ready until it's done.
      for (let frame = 0; frame < 5; frame++) expect(steps.next().done).toBe(false);
      gpu.finish();
      expect(steps.next().done).toBe(true);
      expect(gpu.stalls).toBe(0);
      expect(gpu.log.filter((call) => call === "draw")).toHaveLength(1);
    }
  });

  it("gives up on a shader that doesn't compile here, saying why", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const gpu = context({ compiles: false });
    expect(walk(gpu).renderer).toBeNull();
    expect(error).toHaveBeenCalledWith("ERROR: 0:1: nope");
    expect(gpu.log).not.toContain("draw");
    expect(gpu.stalls).toBe(0);
  });
});

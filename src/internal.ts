/**
 * What the site's Lab reaches into besides the package's own API: how big and quick each energy
 * moves (the Playground hops its figures by it), and the frame loop every live figure runs on, so
 * the Playground's own moves land on the same frame. Not in the published package's exports: its
 * shape may change.
 */

export { ENERGY } from "./figure.ts";
export { animate } from "./figure-loop.ts";

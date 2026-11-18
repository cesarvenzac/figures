# @cesarvenzac/figures

Small figures for the agents in your interface: a cube, a sphere, a pyramid, a block or a cloud,
really in 3D, with two eyes painted on its face.

They have no mouth, arms or hats. They say everything with their eyes and the way they move, as
Anki's Cozmo does: lids cut into the eyes for each expression, or the eyes become a shape (^ ^,
stars, hearts, × ×), the head turning and tipping with them. Each shape has acts of its own: the
cube solves itself like a Rubik's cube while it thinks, the block turns its dials like a cryptex,
the pyramid's capstone floats, the sphere has moons, the cloud rains while it works. Give one a
mood and it shows it, and reacts as it changes: it celebrates a finished run, loses its colour at
a failed one, yawns when it's switched off.

The docs are at [cesarvenzac.com/figures](https://cesarvenzac.com/figures), and the figures to
make, pet and watch in [the Lab](https://cesarvenzac.com/lab/figures).

```sh
npm install @cesarvenzac/figures
```

## Use

```tsx
import { figureFor } from "@cesarvenzac/figures";
import { AgentFigure } from "@cesarvenzac/figures/react";

const ada = figureFor("Ada"); // { shape: "sphere", energy: "calm", habit: "wave", palette: 6 }

<AgentFigure figure={ada} mood="thinking" size={48} />;
```

A figure is four choices, plain data you can store: its `shape` (`cube`, `sphere`, `pyramid`,
`block`, `cloud`), its `energy` (`calm`, `lively`, `bouncy`: how big and quick it moves), its
`habit` (what it does while it waits: `look`, `hum`, `nap`, `spin`, `wave`, `morph`) and its
`palette` (a colourway, 1 to 8). `figureFor(word)` makes one from any word, the same word the same
figure every time, so an agent's name is enough. `readFigure(value)` reads a stored one back,
filling in anything missing or unknown; `isFigure(value)` says whether a value is a whole figure.

## Moods

What the agent it stands for is doing. Each mood has its expression and its loop:

| Mood | Shows |
| --- | --- |
| `idle` | Waiting: breathing, blinking, doing its habit now and then |
| `thinking` | Setting up: looking up and aside, the cube scrambling and solving itself |
| `working` | At work: eyes narrowed and scanning, each shape busy its own way |
| `happy` | Done, something to look at: happy eyes, turning into a star now and then |
| `trouble` | In trouble: squeezed eyes, worrying, shaking now and then |
| `sleep` | Switched off: eyes shut, grey and dim, z's |

As the mood changes it reacts (`reactionTo(from, to)` says which): to `happy`, it celebrates (the
cube bursts and snaps back, the sphere splashes, the pyramid launches its capstone, the block
spins its dials like a slot machine, the cloud gets a rainbow); to `trouble`, it fails; into work,
it gets going; to `sleep`, it dozes off, and back, it wakes.

## `AgentFigure`

```tsx
<AgentFigure
  figure={ada}
  mood="working"
  size={48} // its box, in pixels; the canvas overhangs it for its halo, shadow and hops
  look // turns toward the pointer on a desktop (default true)
  react // smiles and bounces when the link or button it's in is hovered (default true)
  pet // clicked, it's petted, and the link it's in doesn't open (default true)
  grab={false} // dragged, it turns, springing home when let go
  still={false} // drawn once, never moving
  drain={0} // 0 to 1: greys it, for an agent running out of budget, say
/>
```

To set it outright rather than by mood: `expression` (one of `EXPRESSIONS`: `neutral`, `happy`,
`sad`, `tired`, `thinking`, `working`, `listening`, `speaking`, `sleeping`, `surprised`,
`trouble`, `love`, `excited`, `failed`) and `motion` (a loop to move in, one of `LOOPS`). `play`
makes a move now, again whenever its `at` changes:

```tsx
<AgentFigure figure={ada} play={{ motion: "spin", at: Date.now() }} />
```

The moves are `MOVES` (`hop`, `bounce`, `spin`, `turn`, `flip`, `nod`, `shake`, `wave`, `pop`,
`melt`, `love`) and the reactions `REACTIONS` (`pet`, `celebrate`, `fail`, `start`, `doze`,
`wake`). `aim` (`{ x, y }`, −1 to 1 each way, right and down) says where it looks, in place of the
pointer; `lift` (a function of the frame's time, 0 to 1) hops it off the ground as it walks, its
shadow staying put. Both are read every frame. `className` and `style` go on its box, after its own
styles.

Every figure on a page notices the others: when one is petted, finishes or fails, the rest turn
to look, and now and then one glances at whichever is busy. A hover on a link or button the
figure is in makes it smile; to react to another element's hover, mark it `data-figure-host`.

It's a drawing, hidden from assistive tech: put words beside it saying who it is and what it's
doing. It holds still under reduced motion and while it's off screen. Until its shader is ready
it's a flat drawing, from the server on, which the 3D one fades in over where it stands; where
there's no WebGL 2 it stays flat.

## Colours

Each colourway is three colours, `main`, `light` and `deep`, which its material flows through
(`COLOURWAYS`: blue, green, sun, pink, violet, teal, orange, red). Give one your own with
`colours`, and the eyes theirs with `ink` (`INK`, a near black, unless you do). Any CSS colour
works, and a custom property is read from the page's root, so your tokens stay the one place
they're said:

```tsx
<AgentFigure figure={ada} colours={{ main: "var(--brand)", light: "var(--brand-light)", deep: "var(--brand-deep)" }} ink="var(--ink)" />
```

`AgentDot` is a figure's colours alone, as a dot, where a whole figure wouldn't read (a table's
row): `<AgentDot figure={ada} size={8} />`, with `colours` too.

## A still

`svgOf(figure, expression?, colours?, size?, id?)` writes a figure as an SVG file, seen from the
front: for an email, a social card, anywhere a live figure can't go. It runs anywhere, Node
included.

```ts
import { figureFor, svgOf } from "@cesarvenzac/figures";

svgOf(figureFor("Ada"), "happy", {}, 128); // '<svg xmlns="http://www.w3.org/2000/svg" …'
```

## Cost

Every figure on a page is drawn by one WebGL 2 context, raymarching the shapes in a fragment
shader, and copied onto its own canvas; the canvas is at most 512 device pixels across, and a
figure is drawn every frame only while something happens, every other frame while it only
breathes, and not at all off screen. They all share one frame loop and one pointer listener.

The shader is big, and a slow or software driver takes seconds over it (headless Chromium's
SwiftShader spends two on its first draw), so it's made ready without holding up the page: compiled
with `KHR_parallel_shader_compile` where the browser has it, else once the page is idle, then drawn
once on a single pixel, each step waited for a frame at a time, never asked about before it's done.
The page answers throughout; the figures show their flat drawings meanwhile.

## Development

```sh
npm ci
npm test
npm run typecheck
npm run check # packed as npm publishes it, then installed and run as a user's would be
```

This repository is a copy. The package is developed inside the site it was made for, whose
repository is private, and every release copies it here and publishes it to npm from here, with
provenance. Issues are welcome; pull requests are read, and their changes made at the source.

## Licence

MIT. The material is the one the site's Aura experiment drew, on MaterialX's Perlin noise.

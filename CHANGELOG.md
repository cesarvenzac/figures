# Changelog

## 0.1.1

The first figure on a page no longer holds the page up while its shader compiles.

- The shader is made ready without blocking the main thread: compiled with `KHR_parallel_shader_compile` where the browser has it, else once the page is idle, then drawn once on a single pixel, each step waited for a frame at a time. On slow or software drivers (headless Chromium's SwiftShader spends two seconds on the first draw), the page used to freeze for seconds; it now answers throughout.
- Until the shader is ready, each figure is its flat drawing, rendered from the server on, and the 3D drawing fades in over it where it stands, nothing moving. Where there's no WebGL 2 it stays flat, as before.
- A lost WebGL context shows the flat drawings until it's back, then fades the figures in again.

## 0.1.0

The first version: the figures of the agents on cesarvenzac.com, as a library.

- Five solids (a cube, a sphere, a pyramid, a block, a cloud), drawn in 3D by one WebGL 2 shader for the whole page, in an iridescent material in eight colourways, or colours of your own.
- Fourteen expressions in the eyes alone, six moods (`idle`, `working`, `thinking`, `happy`, `trouble`, `sleep`) each with its own loop, and a reaction as the mood changes, each shape its own way.
- Moves to play on demand, a habit while it waits, the pointer followed on a desktop, the other figures on the page looked at when one has a moment, petted when clicked, turned by hand with `grab`.
- `figureFor` makes a figure from any word, `readFigure` reads a stored one back, `svgOf` writes a flat still.
- Still under reduced motion and off screen, and a flat drawing where there's no WebGL 2.

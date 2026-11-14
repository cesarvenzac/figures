# Changelog

## 0.1.0

The first version: the figures of the agents on cesarvenzac.com, as a library.

- Five solids (a cube, a sphere, a pyramid, a block, a cloud), drawn in 3D by one WebGL 2 shader for the whole page, in an iridescent material in eight colourways, or colours of your own.
- Fourteen expressions in the eyes alone, six moods (`idle`, `working`, `thinking`, `happy`, `trouble`, `sleep`) each with its own loop, and a reaction as the mood changes, each shape its own way.
- Moves to play on demand, a habit while it waits, the pointer followed on a desktop, the other figures on the page looked at when one has a moment, petted when clicked, turned by hand with `grab`.
- `figureFor` makes a figure from any word, `readFigure` reads a stored one back, `svgOf` writes a flat still.
- Still under reduced motion and off screen, and a flat drawing where there's no WebGL 2.

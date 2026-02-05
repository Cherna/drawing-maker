# Generative Art Roadmap

We are exploring and implementing various generative algorithms to expand the capabilities of Drawing Maker.

## Implemented
- [x] **Honeycomb** (Optimized)
- [x] **Noise Types** (Simplex vs Perlin)

## Queue (In Progress)
- [ ] **Flow Fields**: Using noise vectors to drive path rendering. Organic, hair-like textures. (Partially implemented, needs review)

## Backlog (Planned)
1. [x] **Superformula**
    - [x] Implement the math for the "Superformula" (a generalization of the superellipse).
    - [x] Controls: `m` (symmetry), `n1`, `n2`, `n3` (shape factors).
    - [x] Great for: Organic shapes, starfishes, abstract "blobs", flowers.).
2.  **Harmonograph** (Skipped)
3. [x] **Truchet Tiles**: Grid-based patterns using randomly rotated simple tiles (arcs, lines).
4. [x] **Circle Packing**: Non-overlapping circles filling a space.
5.  **Voronoi (Cellular)**: Voronoi diagram generation for cell/stone textures.

## Future Ideas
- **Curl Noise**: Divergence-free noise for fluid simulation.
- **Value Noise**: Blockier, digital-looking noise.

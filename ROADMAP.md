# Drawing Maker Roadmap

This document matches the ideas in `BRAINSTORMING.md` with actionable phases.

## Phase 1: Solid Areas & Filling
Focusing on generating solid shapes and varying tone/intensity.
- [ ] **Solid Area Generation**:
    - [ ] Update generators to produce closed loops (solid blocks) instead of just lines.
    - [ ] **Block Detection Algorithm**: Detect closed regions that require filling.
- [ ] **Procedural Hatching / Filling**:
    - [ ] Convert solid blocks into hatch lines (parallel, cross-hatching).
    - [ ] **Intensity Modulation**:
        - [ ] Vary hatch density to create gradients/shading.
        - [ ] Control "darkness" via line proximity.

## Phase 2: Hybrid Workflow (Manual Tools)
Bringing the "human touch" into the generative process.
- [ ] **Manual Masking Tool**:
    - [ ] Create a "Mask" layer type in the UI.
    - [ ] Implement a brush tool to paint black/white on the mask.
    - [ ] Integrate mask data into existing generators (e.g. use mask to control Warp amount).

## Phase 3: 3D to 2D Pipeline
Bridging the gap between Blender and Plotter.
- [ ] **3D Mesh Importer**:
    - [ ] Support loading OBJ/STL files.
    - [ ] Basic scene manipulation (rotate, scale, position).
- [ ] **Blender Integration Investigation**:
    - [ ] Research importing Camera/Light data (e.g. via GLTF or custom JSON export).
    - [ ] Compare full 3D vector pipeline vs. Image-based depth analysis.
- [ ] **Projection & Rendering**:
    - [ ] Implement 3D-to-2D projection logic.
    - [ ] **Hidden Line Removal (HLR)** implementation (Crucial for clean vector output).

## Phase 4: Enhancements & Polish
Refining the output quality.
- [ ] **Advanced Hatching**:
    - [ ] **Surface-Aware Hatching**: Use 3D normals/curvature to guide line direction (true "form" shading).
    - [ ] **Pencil Emulation**: 
        - [ ] Multi-pass density (layering strokes to darken).
        - [ ] "Pause for Sharpening" G-Code generation.
- [ ] **Path Optimization**:
    - [ ] Implement TSP / Path sorting (behind an OPT-IN toggle).

## Phase 5: Advanced Generators (Organic)
New toys for creating natural forms.
- [ ] **Differential Growth Generator**:
    - [ ] Implement node-based line expansion algorithm.
- [ ] **Reaction-Diffusion Generator**:
    - [ ] Grid-based simulation.
    - [ ] Contouring algorithm (Marching Squares) to vectorize results.

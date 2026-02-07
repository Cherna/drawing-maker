# Drawing Maker Roadmap

This document matches the ideas in `BRAINSTORMING.md` with actionable phases.

## Phase 1: Hybrid Workflow (Manual Tools)
Bringing the "human touch" into the generative process.
- [ ] **Manual Masking Tool**:
    - [ ] Create a "Mask" layer type in the UI.
    - [ ] Implement a brush tool to paint black/white on the mask.
    - [ ] Integrate mask data into existing generators (e.g. use mask to control Warp amount).

## Phase 2: 3D to 2D Pipeline
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

## Phase 3: Enhancements & Polish
Refining the output quality.
- [ ] **Advanced Hatching**:
    - [ ] **Surface-Aware Hatching**: Use 3D normals/curvature to guide line direction (true "form" shading).
    - [ ] **Pencil Emulation**: 
        - [ ] Multi-pass density (layering strokes to darken).
        - [ ] "Pause for Sharpening" G-Code generation.
- [ ] **Path Optimization**:
    - [ ] Implement TSP / Path sorting (behind an OPT-IN toggle).

## Phase 4: Advanced Generators (Organic)
New toys for creating natural forms.
- [ ] **Differential Growth Generator**:
    - [ ] Implement node-based line expansion algorithm.
- [ ] **Reaction-Diffusion Generator**:
    - [ ] Grid-based simulation.
    - [ ] Contouring algorithm (Marching Squares) to vectorize results.

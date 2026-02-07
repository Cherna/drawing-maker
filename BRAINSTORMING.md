# Brainstorming: Future Capabilities for Drawing Maker

This document outlines potential new features, algorithms, and enhancements for the Drawing Maker project, focusing on generative art techniques suitable for pen plotters.

## 1. New Generators & Algorithms

### A. Organic & Natural Simulation
*   **Differential Growth**: Simulate the growth of a continuous line that expands and buckles like finding space in a crowded room.
    *   *Effect*: Brain-coral patterns, meandering rivers, undulating organic forms.
*   **Reaction-Diffusion**: Simulate chemical concentrations (Gray-Scott model) to generate spots, stripes, and mazes.
    *   *Challenge*: This is pixel-based; requires a "Marching Squares" step to vectorise contours for plotting.
*   **Physarum (Slime Mold)**: Agent-based simulation where particles leave trails that attract other particles.
    *   *Effect*: Vein-like networks and transport systems.

### B. Geometric & Structural
*   **L-Systems (Lindenmayer Systems)**: Grammar-based generation for fractals and realistic plant structures.
*   **3D Projection & Blender Pipeline**:
    *   Import generic 3D meshes (OBJ/STL) or generate 3D primitives (cubes, spheres).
    *   **Hidden Line Removal (HLR)**: Crucial for plotting 3D wireframes without looking messy.
    *   *Goal*: seamless 3D-to-2D pipeline, potentially importing camera/scene data from Blender.

## 2. Manual Tools & Hybrid Workflow

*   **Manual Masking / Brushing**:
    *   Ability to create a mask layer and "paint" areas black or white using a brush tool.
    *   Use these manual masks to drive generative parameters (e.g., paint an area to apply "Warp" or "Noise" only to that specific region).
    *   *Goal*: Combine manual artistic control with generative complexity.

## 3. Drawing Enhancements & Modifiers

### A. Shading & Texture
*   **Advanced Hatching**:
    *   *Cross-Hatching*: Layers of lines at varying angles.
    *   *Volume Detection*: Use 3D normals or distance fields to guide hatching curve and density, effectively turning volume into shading.
    *   *Randomized/Sketchy Hatching*: Imperfect lines for a hand-drawn look.
*   **Stippling**:
    *   Convert grayscale values or solid shapes into distinct dots.
*   **Line Jitter / Distortion**:
    *   Add "hand-drawn" noise to perfect vectors to make them feel more organic.

### B. Path Optimization (Utility)
*   **Traveling Salesperson Problem (TSP)**: Reorder drawing paths to minimize pen-up travel time.
*   **Line Simplification**: Reduce node count (Ramer-Douglas-Peucker) for smoother plotting and smaller files.
*   **Loop Closing**: Automatically join endpoints that are very close to prevent "loose threads".
*   **⚠️ IMPORTANT**: All optimization tools must be **OPT-IN** (behind a toggle) to prevent unexpected changes to the generation logic.

## 4. UI/UX & Workflow Improvements

*   **Multi-Layer/Multi-Color Support**:
    *   Explicit UI for assigning layers to specific pens/colors.
    *   "Pause for pen change" commands in G-Code export.
*   **Simulation Preview**:
    *   Animate the drawing path on screen to visualize the exact order of operations.
*   **Background Image Tracing**:
    *   Upload an image to use as a reference for manual tracing or algorithmic processing.

## 5. Inspiration References
*   *Inconvergent* (Anders Hoff): Master of organic algorithms and differential growth.
*   *Tyler Hobbs*: Flow fields, textural density, and **use of color blocks** (not just lines) to create structure.
*   *Frieder Nake*: Precision and algorithmic aesthetics.
*   *Manolo Gamboa Naon*: Vibrant colors and geometric complexity.
*   *Dimitri Cherniak*: Automation and "Ringers" (wrapping aesthetic).

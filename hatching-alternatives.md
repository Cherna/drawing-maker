# Image Hatching Alternatives

This document outlines two alternative approaches to the current Image Hatching algorithm. These approaches represent completely different generating paradigms and can be explored if the standard mathematical approach (Approach A) proves insufficient or if different artistic styles are desired.

## Approach B: Classic Error Diffusion (1D Floyd-Steinberg Style)

**Best for:** Raster Hatching

Instead of pre-calculating a fractional score to distribute lines based on index, this approach physically traces along each scanline and accumulates "darkness" ink. This is a 1D analog to error diffusion dithering.

### Algorithm
1. Step along a scanline `y` with a small step size `stepX`.
2. Maintain an `inkAccumulator = 0`.
3. At each step `x`:
   ```javascript
   const darkness = getDarkness(x, y); // bounded [0, 1]
   inkAccumulator += darkness;
   if (inkAccumulator >= 1.0) {
       // We have accumulated enough darkness to justify dropping ink!
       emitStippleOrShortDash(x, y);
       inkAccumulator -= 1.0; // Keep the remainder (error) for the next steps
   }
   ```
4. This perfectly preserves ink volume matching the image brightness without any banding, naturally stippling and dashing lines mathematically. A randomized threshold or dithering noise can optionally be added to `inkAccumulator` to break up mechanical patterns.

## Approach C: Poisson-Disk Guided Strokes

**Best for:** Organic, Hand-drawn Looks (replaces Streamline/Raster lines entirely)

Instead of using long continuous mathematical scanlines or grid seeds, we populate the canvas with millions of short strokes placed organically.

### Algorithm
1. **Adaptive Poisson-Disk Sampling:** Generate points across the canvas. Normally Poisson-Disk spaces points evenly by radius `R`. We make `R` a function of the pixel density at that location:
   - Dark area: `R = 0.2mm` (tightly packed)
   - Light area: `R = 2.0mm` (sparse)
2. **Stroke Tracing:** At every generated point, we trace a short stroke, rather than a continuous screen-length line.
   - For standard hatching: We trace a straight line of length `L` along `baseAngle`.
   - For contour hatching: We trace a line of length `L` along the `Normal Map` tangent vector field.
3. This creates a very organic "pencil shading" or "impressionist" style, where shading is accomplished by layer upon layer of short overlapping strokes in dense areas, and isolated strokes in sparse areas.

# Agent Skills & Workflows

This document defines the standard operating procedures (Skills) for working in the Drawing Maker repository.

## Skill: Add New Generator

**Description**: Steps to implement a new generative art pattern.

**Workflow**:
1.  **Implementation**:
    -   Edit `src/lib/patterns.ts`.
    -   Add a static method to the `Patterns` class.
    -   Ensure it returns a `MakerJs.IModel`.
    -   Use `MakerJs` primitives (paths, models).
2.  **UI Definition**:
    -   Edit `src/web/lib/tool-definitions.ts`.
    -   Add a new entry to `TOOL_DEFINITIONS`.
    -   Define parameters (min, max, step, default).
3.  **Pipeline Registration**:
    -   Edit `src/core/pipeline.ts`.
    -   Add the new generator key to the `GENERATORS` map.
    -   Map UI parameters to the `Patterns` method arguments.
4.  **Verification**:
    -   Verify the tool appears in the UI.
    -   Verify parameters update the drawing.

## Skill: G-Code Optimization

**Description**: Guidelines for ensuring generated patterns are plotter-friendly.

**Guidelines**:
1.  **Continuous Paths**:
    -   Prefer single continuous poly-lines over many small segments.
    -   Use `MakerJs.chain` or `ConnectTheDots` to merge segments where possible.
2.  **Path Ordering**:
    -   If creating grid-based items, use "Serpentine" (Zig-Zag) ordering to minimize travel moves.
    -   Avoid random access ordering unless aesthetically required.
3.  **Efficiency**:
    -   Remove shared edges in tessellations (e.g., Honeycomb).
    -   Simplify paths if they contain excessive actionable points.

## Skill: TypeScript Best Practices

**Description**: Coding standards for this project.

**Standards**:
1.  **Strict Typing**: Avoid `any`. Define interfaces for options objects.
2.  **Math**: Use the `NoisePatterns` class for all random/noise generation to ensure seeded reproducibility.
3.  **MakerJS**: Use `MakerJs.IModel` for grouping geometry. Use `model.paths` for actual lines.

## Skill: Debugging

**Description**: Procedures for diagnosing and fixing issues.

**Workflow**:
1.  **Investigation**:
    -   Analyze error logs or unexpected behavior.
    -   Use `console.log` to trace variable states (e.g., `[DBG] Var: value`).
    -   Isolate the issue: Is it in generation (patterns.ts), UI (tool-definitions.ts), or pipeline (pipeline.ts)?
2.  **Fixing**:
    -   Create a reproduction case if possible.
    -   Apply fix.
    -   Verify fix visually or via logs.
3.  **Cleanup**:
    -   Remove all debug logs before marking task as complete.
    -   **CRITICAL**: Always delete any temporary scripts, scratchpads, or debug files (e.g. `test.js`, `new_code.ts`, `diff.txt`) generated during the session after finishing a feature.

## Skill: Refactoring

**Description**: Improving code structure without changing behavior.

**Guidelines**:
1.  **Incremental Changes**: Small, verifiable steps.
2.  **Safety**: Ensure functionality remains identical (Visual Verification).
3.  **Goal**: Improve readability, reduce duplication (DRY), and strict typing.

## Skill: Context Management

**Description**: Keeping the agent effective over long tasks.

**Workflow**:
1.  **Artifacts**: Use `task.md` and `implementation_plan.md` as external memory. Update them frequently.
2.  **Summarization**: When tasks complete, summarize findings in `walkthrough.md` or `task.md` to offload mental context.
3.  **Cleanup**: Delete temporary files or irrelevant artifacts to keep the workspace clean.

## Skill: Server Management

**Description**: Rules for handling the development server.

**Rules**:
1.  **User Managed**: The user typically runs `npm run dev` and `npm run api` in their own terminals.
2.  **Do Not Restart**: Do not attempt to start, stop, or restart the server process unless explicitly instructed.
3.  **Assume Running**: Assume the server is running and accessible at `http://localhost:3000` (API) and `http://localhost:5173` (Web).
4.  **Hot Reloading**: Changes to `src/gui/*.ts` and `src/core/*.ts` should be picked up automatically by `nodemon`. If not, ask the user to restart.


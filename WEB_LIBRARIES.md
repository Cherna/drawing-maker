# Web GUI Library Recommendations

The current GUI uses vanilla JavaScript, which works but can be harder to maintain. Here are recommended libraries to simplify and make the web GUI more reliable:

## Recommended Stack

### Option 1: React + Vite (Most Popular)

**Why**: Industry standard, huge ecosystem, TypeScript support, great tooling.

**Dependencies**:
```bash
npm install react react-dom
npm install -D @vitejs/plugin-react vite @types/react @types/react-dom
```

**Pros**:
- ✅ Huge ecosystem of libraries
- ✅ Excellent TypeScript support
- ✅ Great dev tools (React DevTools)
- ✅ Fast hot module replacement with Vite
- ✅ Easy to find help/documentation
- ✅ Component reusability

**Cons**:
- ❌ Larger bundle size (~40KB gzipped)
- ❌ Learning curve if unfamiliar with React

**Libraries to use with React**:
- **State Management**: [Zustand](https://zustand-demo.pmnd.rs/) - Minimal, no boilerplate
- **UI Components**: [shadcn/ui](https://ui.shadcn.com/) - Beautiful, copy-paste components (uses Radix UI)
- **API Calls**: [TanStack Query (React Query)](https://tanstack.com/query) - Handles caching, refetching
- **Forms**: [React Hook Form](https://react-hook-form.com/) - Performant form handling

### Option 2: Preact + Vite (Lighter React Alternative)

**Why**: Same API as React but 3KB instead of 40KB. Perfect for smaller apps.

**Dependencies**:
```bash
npm install preact preact/hooks
npm install -D @preact/preset-vite vite
```

**Pros**:
- ✅ Tiny bundle size (~3KB)
- ✅ Same API as React
- ✅ Fast
- ✅ Easy migration to React later if needed

**Cons**:
- ❌ Smaller ecosystem (but can use React libraries via aliasing)
- ❌ Less mainstream than React

### Option 3: Svelte + Vite (Simplest)

**Why**: No virtual DOM, compiles to vanilla JS, very simple syntax.

**Dependencies**:
```bash
npm install svelte
npm install -D @sveltejs/vite-plugin-svelte vite
```

**Pros**:
- ✅ Very simple, easy to learn
- ✅ Smallest bundle size (compiles away framework)
- ✅ No virtual DOM overhead
- ✅ Great performance
- ✅ Built-in state management

**Cons**:
- ❌ Smaller ecosystem than React
- ❌ Less familiar to many developers

**Libraries to use with Svelte**:
- **UI**: [Svelte Material UI](https://sveltematerialui.com/) or [Carbon Svelte](https://carbon-components-svelte.onrender.com/)
- **State**: Built-in stores (no library needed)
- **API**: Native fetch or [Svelte Query](https://svelte-query.vercel.app/)

### Option 4: Alpine.js + Tailwind (Lightweight)

**Why**: Minimal framework, declarative HTML attributes, no build step needed.

**Dependencies**:
```bash
npm install alpinejs
npm install -D tailwindcss postcss autoprefixer
```

**Pros**:
- ✅ Very lightweight (~15KB)
- ✅ Can be added incrementally
- ✅ No build step required
- ✅ Familiar to vanilla JS developers

**Cons**:
- ❌ Less structured than component frameworks
- ❌ Can get messy in large apps

## My Recommendation

For this project, I recommend **Option 1: React + Vite** because:

1. **Best Ecosystem**: Tons of libraries for every need
2. **TypeScript Support**: Excellent TypeScript integration
3. **Component Reusability**: Easy to create reusable UI components
4. **Great Dev Experience**: Vite provides instant hot reload
5. **Future-Proof**: Most popular choice, easier to find developers

### Recommended React Libraries

```bash
# Core
npm install react react-dom
npm install -D @vitejs/plugin-react vite @types/react @types/react-dom typescript

# State & API
npm install zustand @tanstack/react-query

# UI Components (shadcn/ui uses these)
npm install @radix-ui/react-slider @radix-ui/react-select @radix-ui/react-checkbox
npm install class-variance-authority clsx tailwind-merge lucide-react

# Styling
npm install -D tailwindcss postcss autoprefixer

# Forms
npm install react-hook-form @hookform/resolvers zod
```

**Why these libraries**:

- **Zustand**: Minimal state management (3 lines of code)
- **React Query**: Handles API calls, caching, loading states automatically
- **shadcn/ui**: Copy-paste components, no npm bloat, fully customizable
- **React Hook Form**: Best form library, minimal re-renders
- **Zod**: TypeScript-first schema validation

## Migration Path

### Step 1: Set up Vite + React
```bash
npm install -D vite @vitejs/plugin-react
```

Update `vite.config.ts`:
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:3001'
    }
  }
});
```

### Step 2: Convert to React Components

Create components:
- `App.tsx` - Main app
- `Sidebar.tsx` - Controls panel
- `Preview.tsx` - Preview area
- `StepEditor.tsx` - Pipeline step editor
- `CanvasControls.tsx` - Canvas settings

### Step 3: Add State Management

Use Zustand for global state:
```typescript
import { create } from 'zustand';

interface ConfigStore {
  config: AppConfig;
  updateConfig: (updates: Partial<AppConfig>) => void;
}

export const useConfigStore = create<ConfigStore>((set) => ({
  config: defaultConfig,
  updateConfig: (updates) => set((state) => ({
    config: { ...state.config, ...updates }
  }))
}));
```

### Step 4: Add React Query for API

```typescript
import { useQuery, useMutation } from '@tanstack/react-query';

function usePreview(config: AppConfig) {
  return useQuery({
    queryKey: ['preview', config],
    queryFn: () => fetch('/api/preview', {
      method: 'POST',
      body: JSON.stringify(config)
    }).then(r => r.json()),
    enabled: !!config
  });
}
```

## Alternative: Keep Vanilla but Use Libraries

If you want to stick with vanilla JS but add structure:

- **Lit**: Web components with simple syntax
- **Alpine.js**: Minimal reactivity without build step
- **htmx**: No JavaScript needed for many interactions
- **Stimulus**: Small framework for sprinkling JS behavior

## Comparison Table

| Framework | Bundle Size | Learning Curve | Ecosystem | TypeScript | Dev Experience |
|-----------|------------|----------------|-----------|------------|----------------|
| **React** | ~40KB | Medium | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Preact** | ~3KB | Medium | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Svelte** | ~0KB* | Easy | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Alpine** | ~15KB | Easy | ⭐⭐ | ⭐⭐ | ⭐⭐⭐ |
| **Vanilla** | 0KB | Easy | N/A | ⭐⭐⭐ | ⭐⭐ |

*Svelte compiles to vanilla JS, so no runtime framework

## Recommendation Summary

**For this project**: Go with **React + Vite + Zustand + React Query + shadcn/ui**

- **React**: Industry standard, great ecosystem
- **Vite**: Lightning fast dev server
- **Zustand**: Minimal state management
- **React Query**: Automatic API handling
- **shadcn/ui**: Beautiful, customizable components

This gives you a modern, maintainable stack without over-engineering.

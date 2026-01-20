# Drawing Maker - Web GUI

Modern React-based web interface for creating and previewing drawings in real-time.

## Features

- 🎨 **Real-time Preview**: See your drawing update as you change parameters (300ms debounce)
- ⚡ **Lightweight Preview Mode**: Fast preview with reduced resolution
- 🎛️ **Visual Controls**: Intuitive sliders, inputs, and dropdowns for all parameters
- 🔄 **Pipeline Builder**: Add, remove, and reorder pipeline steps with drag-and-drop
- 📦 **Layer System**: Support for duplicate/layer system for moire patterns
- 🌙 **Dark Mode**: Beautiful dark theme by default
- 📥 **Export**: Generate high-quality SVG and G-Code files
- 💾 **Load Configs**: Load and modify existing configuration files

## Tech Stack

- **React 18** - UI framework
- **Vite** - Fast build tool and dev server
- **TypeScript** - Type safety
- **Zustand** - Minimal state management
- **TanStack Query (React Query)** - API state management
- **shadcn/ui** - Beautiful, accessible UI components
- **Tailwind CSS** - Utility-first styling
- **Radix UI** - Accessible primitives

## Getting Started

### Installation

First, install all dependencies:

```bash
npm install
```

### Development

Start both the backend API server and the frontend dev server:

```bash
npm run web:dev
```

This will:
- Start the backend API server on `http://localhost:3000` (API endpoints only)
- Start the Vite dev server on `http://localhost:5173` (React app)
- **Access the app at `http://localhost:5173`** (Vite proxies API calls to port 3000)

Or run them separately:

```bash
# Terminal 1: Backend
npm run gui:dev

# Terminal 2: Frontend
npm run web
```

### Production Build

Build the React app for production:

```bash
npm run build
```

The built files will be in the `dist/` directory.

## Architecture

### Project Structure

```
src/web/
├── components/       # React components
│   ├── ui/          # shadcn/ui components
│   ├── Sidebar.tsx  # Control panel
│   ├── Preview.tsx  # Preview area
│   └── ...
├── hooks/           # Custom React hooks
├── lib/             # Utilities and tool definitions
├── store/           # Zustand stores
└── App.tsx          # Main app component
```

### State Management

**Zustand Store** (`src/web/store/config-store.ts`):
- Manages the drawing configuration
- Provides actions for updating config, steps, etc.

**React Query** (`src/web/hooks/use-api.ts`):
- Handles API calls to the backend
- Automatic caching and refetching
- Loading and error states

### API Endpoints

- `POST /api/preview` - Generate lightweight preview
- `POST /api/export` - Generate full-quality export
- `GET /api/configs` - List available config files

## Layer System

The web GUI fully supports the layer/duplicate system for creating moire patterns:

1. **Duplicate**: Creates a copy of the current state as a separate layer
2. **Layer**: Creates a duplicate and applies a sub-pipeline to it

To create a moire pattern:
1. Build base layer: Add `stripes` → `resample` → `noise`
2. Add `duplicate` or `layer` step
3. Add `rotate` or other transforms to the duplicated layer
4. Both layers are visible, creating interference patterns

Layers are visually indicated in the UI with a special border.

## Customization

### Adding New Tools

1. Add tool definition to `src/web/lib/tool-definitions.ts`
2. Tool will automatically appear in the UI

### Styling

The app uses Tailwind CSS with dark mode. Customize in:
- `src/web/index.css` - Global styles and CSS variables
- `tailwind.config.js` - Tailwind configuration

## Development Tips

- **Hot Reload**: Both frontend and backend support hot reload
- **Type Safety**: Full TypeScript support throughout
- **Component Reusability**: All UI components are reusable
- **Performance**: Preview uses debouncing to prevent excessive API calls

## Troubleshooting

**Port conflicts**: Change ports in `vite.config.ts` and `src/gui/server.ts`

**API connection errors**: Ensure backend is running on port 3000

**Build errors**: Make sure all dependencies are installed with `npm install`

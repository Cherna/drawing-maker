import { create } from 'zustand';
import { AppConfig } from '../../types';

const defaultConfig: AppConfig = {
  sketch: 'pipeline',
  outputBaseName: 'drawing',
  canvas: {
    height: 297,
    width: 420,
    margin: 60,
  },
  gcode: {
    feedRate: 2000,
    zUp: 5,
    zDown: 0,
    postProcessor: 'standard',
  },
  params: {
    seed: Math.floor(Math.random() * 10000),
    layers: [
      {
        id: 'base',
        name: 'Base Layer',
        steps: [
          { tool: 'stripes', params: { lines: 100 } },
          { tool: 'resample', params: { detail: 1.0 } },
          { tool: 'move', params: { x: 0, y: 0 } },
        ],
        visible: true,
        strokeWidth: 0.7,
        color: '#000000'
      }
    ],
    activeLayerId: 'base'
  },
};

interface ConfigStore {
  config: AppConfig;
  updateConfig: (updates: Partial<AppConfig>) => void;
  updateCanvas: (updates: Partial<AppConfig['canvas']>) => void;
  updateGCode: (updates: Partial<AppConfig['gcode']>) => void;
  updateParams: (updates: Partial<AppConfig['params']>) => void;

  setConfig: (config: AppConfig) => void;
  reset: () => void;
}

export const useConfigStore = create<ConfigStore>((set) => ({
  config: defaultConfig,
  updateConfig: (updates) =>
    set((state) => ({
      config: { ...state.config, ...updates },
    })),
  updateCanvas: (updates) =>
    set((state) => ({
      config: {
        ...state.config,
        canvas: { ...state.config.canvas, ...updates },
      },
    })),
  updateGCode: (updates) =>
    set((state) => ({
      config: {
        ...state.config,
        gcode: { ...state.config.gcode, ...updates },
      },
    })),
  updateParams: (updates) =>
    set((state) => ({
      config: {
        ...state.config,
        params: { ...state.config.params, ...updates },
      },
    })),
  setConfig: (config) => set({ config }),
  reset: () => set({ config: defaultConfig }),
}));

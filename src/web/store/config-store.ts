import { create } from 'zustand';
import { AppConfig, PipelineStep } from '../../types';

const defaultConfig: AppConfig = {
  sketch: 'pipeline',
  outputBaseName: 'drawing-maker',
  canvas: {
    height: 297,
    width: 420,
    margin: 60,
  },
  gcode: {
    feedRate: 2000,
    travelRate: 3500,
    zUp: 5,
    zDown: 0,
    postProcessor: 'standard',
    invertX: false,
    invertY: true,
    optimizePaths: true,
    joinTolerance: 0.1,
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
  updateStep: (index: number, updates: Partial<PipelineStep>) => void;

  setConfig: (config: AppConfig) => void;
  reset: () => void;
}

import { temporal } from 'zundo';

export const useConfigStore = create<ConfigStore>()(
  temporal(
    (set) => ({
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
      updateStep: (index, updates) =>
        set((state) => {
          const steps = state.config.params.steps ? [...state.config.params.steps] : [];
          if (steps[index]) {
            steps[index] = { ...steps[index], ...updates };
          }
          return {
            config: {
              ...state.config,
              params: { ...state.config.params, steps }
            }
          };
        }),
      setConfig: (config) => set({ config }),
      reset: () => set({ config: defaultConfig }),
    }),
    {
      limit: 20,
    }
  )
);

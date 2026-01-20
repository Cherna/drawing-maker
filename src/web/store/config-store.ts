import { create } from 'zustand';
import { AppConfig, PipelineStep } from '../../types';

const defaultConfig: AppConfig = {
  sketch: 'pipeline',
  outputBaseName: 'drawing',
  canvas: {
    width: 200,
    height: 300,
    margin: 20,
  },
  gcode: {
    feedRate: 2000,
    zUp: 5,
    zDown: 0,
  },
  params: {
    seed: Math.floor(Math.random() * 10000),
    steps: [
      { tool: 'stripes', params: { lines: 100 } },
      { tool: 'resample', params: { res: 1.0 } },
      { tool: 'noise', params: { scale: 0.05, magnitude: 5 } },
    ],
  },
};

interface ConfigStore {
  config: AppConfig;
  updateConfig: (updates: Partial<AppConfig>) => void;
  updateCanvas: (updates: Partial<AppConfig['canvas']>) => void;
  updateGCode: (updates: Partial<AppConfig['gcode']>) => void;
  updateParams: (updates: Partial<AppConfig['params']>) => void;
  addStep: (step: PipelineStep, index?: number) => void;
  updateStep: (index: number, updates: Partial<PipelineStep>) => void;
  removeStep: (index: number) => void;
  moveStep: (fromIndex: number, toIndex: number) => void;
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
  addStep: (step, index) =>
    set((state) => {
      const steps = [...(state.config.params.steps || [])];
      if (index !== undefined) {
        steps.splice(index, 0, step);
      } else {
        steps.push(step);
      }
      return {
        config: {
          ...state.config,
          params: { ...state.config.params, steps },
        },
      };
    }),
  updateStep: (index, updates) =>
    set((state) => {
      const steps = [...(state.config.params.steps || [])];
      steps[index] = { ...steps[index], ...updates };
      return {
        config: {
          ...state.config,
          params: { ...state.config.params, steps },
        },
      };
    }),
  removeStep: (index) =>
    set((state) => {
      const steps = [...(state.config.params.steps || [])];
      steps.splice(index, 1);
      return {
        config: {
          ...state.config,
          params: { ...state.config.params, steps },
        },
      };
    }),
  moveStep: (fromIndex, toIndex) =>
    set((state) => {
      const steps = [...(state.config.params.steps || [])];
      const [removed] = steps.splice(fromIndex, 1);
      steps.splice(toIndex, 0, removed);
      return {
        config: {
          ...state.config,
          params: { ...state.config.params, steps },
        },
      };
    }),
  setConfig: (config) => set({ config }),
  reset: () => set({ config: defaultConfig }),
}));

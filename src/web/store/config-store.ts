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
    feedRate: 2500,
    travelRate: 3500,
    zUp: 2,
    zDown: -0.5,
    zSafe: 40,
    postProcessor: 'linuxcnc',
    invertX: false,
    invertY: true,
    swapAxes: false,
    originX: 0,
    originY: 0,
    optimizePaths: true,
    joinTolerance: 0.1,
    dwellTime: 0,
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
  isDirty: boolean;
  showOriginSelector: boolean;
  setShowOriginSelector: (show: boolean) => void;
  updateConfig: (updates: Partial<AppConfig>) => void;
  updateCanvas: (updates: Partial<AppConfig['canvas']>) => void;
  updateGCode: (updates: Partial<AppConfig['gcode']>) => void;
  updateParams: (updates: Partial<AppConfig['params']>) => void;
  updateStep: (index: number, updates: Partial<PipelineStep>) => void;

  // Global steps actions
  addGlobalStep: (step: PipelineStep) => void;
  updateGlobalStep: (index: number, updates: Partial<PipelineStep>) => void;
  removeGlobalStep: (index: number) => void;

  setConfig: (config: AppConfig) => void;
  markClean: () => void;
  reset: () => void;
}

import { temporal } from 'zundo';

export const useConfigStore = create<ConfigStore>()(
  temporal(
    (set) => ({
      config: defaultConfig,
      isDirty: false,
      showOriginSelector: false,
      setShowOriginSelector: (show) => set({ showOriginSelector: show }),
      updateConfig: (updates) =>
        set((state) => ({
          config: { ...state.config, ...updates },
          isDirty: true,
        })),
      updateCanvas: (updates) =>
        set((state) => ({
          config: {
            ...state.config,
            canvas: { ...state.config.canvas, ...updates },
          },
          isDirty: true,
        })),
      updateGCode: (updates) =>
        set((state) => ({
          config: {
            ...state.config,
            gcode: { ...state.config.gcode, ...updates },
          },
          isDirty: true,
        })),
      updateParams: (updates) =>
        set((state) => ({
          config: {
            ...state.config,
            params: { ...state.config.params, ...updates },
          },
          isDirty: true,
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
            },
            isDirty: true,
          };
        }),

      addGlobalStep: (step) =>
        set((state) => {
          const globalSteps = state.config.params.globalSteps ? [...state.config.params.globalSteps] : [];
          globalSteps.push(step);
          return {
            config: {
              ...state.config,
              params: { ...state.config.params, globalSteps }
            },
            isDirty: true,
          };
        }),

      updateGlobalStep: (index, updates) =>
        set((state) => {
          const globalSteps = state.config.params.globalSteps ? [...state.config.params.globalSteps] : [];
          if (globalSteps[index]) {
            globalSteps[index] = { ...globalSteps[index], ...updates };
          }
          return {
            config: {
              ...state.config,
              params: { ...state.config.params, globalSteps }
            },
            isDirty: true,
          };
        }),

      removeGlobalStep: (index) =>
        set((state) => {
          const globalSteps = state.config.params.globalSteps ? [...state.config.params.globalSteps] : [];
          globalSteps.splice(index, 1);
          return {
            config: {
              ...state.config,
              params: { ...state.config.params, globalSteps }
            },
            isDirty: true,
          };
        }),
      setConfig: (config) => set({ config, isDirty: false }),
      markClean: () => set({ isDirty: false }),
      reset: () => set({ config: defaultConfig, isDirty: false }),
    }),
    {
      limit: 20,
    }
  )
);

import { Card, CardContent } from './ui/card';
import { Select, SelectTrigger, SelectContent, SelectItem } from './ui/select';
import { Slider } from './ui/slider';
import { useConfigStore } from '../store/config-store';
import { PipelineStep } from '../../types';
import { MODIFIERS, TOOL_DEFINITIONS } from '../lib/tool-definitions';

interface NestedStepsEditorProps {
  step: PipelineStep;
  stepIndex: number;
}

export default function NestedStepsEditor({ step, stepIndex }: NestedStepsEditorProps) {
  const updateStep = useConfigStore((state) => state.updateStep);
  const nestedSteps = (step.params?.steps as PipelineStep[]) || [];

  const handleAddNestedStep = (toolName: string) => {
    const toolDef = TOOL_DEFINITIONS[toolName];

    const newParams: any = {};
    if (toolDef) {
      toolDef.params.forEach((param) => {
        if (param.default !== undefined) {
          newParams[param.key] = param.default;
        }
      });
    }

    const newNestedStep: PipelineStep = {
      tool: toolName,
      params: newParams,
    };

    const updatedSteps = [...nestedSteps, newNestedStep];
    const newStepParams = { ...step.params, steps: updatedSteps };
    updateStep(stepIndex, { params: newStepParams });
  };

  const handleUpdateNestedStep = (nestedIndex: number, updatedStep: PipelineStep) => {
    const updatedSteps = [...nestedSteps];
    updatedSteps[nestedIndex] = updatedStep;
    const newStepParams = { ...step.params, steps: updatedSteps };
    updateStep(stepIndex, { params: newStepParams });
  };

  const handleRemoveNestedStep = (nestedIndex: number) => {
    const updatedSteps = nestedSteps.filter((_, i) => i !== nestedIndex);
    const newStepParams = { ...step.params, steps: updatedSteps };
    updateStep(stepIndex, { params: newStepParams });
  };

  const handleMoveNestedStep = (nestedIndex: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? nestedIndex - 1 : nestedIndex + 1;
    if (newIndex < 0 || newIndex >= nestedSteps.length) return;

    const updatedSteps = [...nestedSteps];
    [updatedSteps[nestedIndex], updatedSteps[newIndex]] = [updatedSteps[newIndex], updatedSteps[nestedIndex]];
    const newStepParams = { ...step.params, steps: updatedSteps };
    updateStep(stepIndex, { params: newStepParams });
  };

  const parentStep = useConfigStore((state) => state.config.params?.steps?.[stepIndex]);
  const isDuplicate = parentStep?.tool === 'duplicate';

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-muted-foreground">
        {isDuplicate ? 'Modifiers applied to duplicate:' : 'Sub-pipeline steps (applied to duplicate):'}
      </div>

      {nestedSteps.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {isDuplicate
            ? 'Add modifiers to transform the duplicated drawing (e.g., scale, rotate).'
            : 'No nested steps. Add modifiers to this layer.'}
        </p>
      ) : (
        <div className="space-y-2 pl-4 border-l-2 border-primary/30">
          {nestedSteps.map((nestedStep, nestedIndex) => (
            <NestedStepItem
              key={nestedIndex}
              step={nestedStep}
              stepIndex={stepIndex}
              nestedIndex={nestedIndex}
              onUpdate={handleUpdateNestedStep}
              onRemove={handleRemoveNestedStep}
              onMove={handleMoveNestedStep}
              canMoveUp={nestedIndex > 0}
              canMoveDown={nestedIndex < nestedSteps.length - 1}
            />
          ))}
        </div>
      )}

      <Select onValueChange={handleAddNestedStep}>
        <SelectTrigger className="w-full h-8 text-xs">
          <span className="text-muted-foreground">+ Add modifier...</span>
        </SelectTrigger>
        <SelectContent>
          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Modifiers</div>
          {MODIFIERS.filter(t =>
            t !== 'layer' &&
            t !== 'duplicate' &&
            t !== 'merge' &&
            t !== 'clone'
          ).map((tool) => (
            <SelectItem key={tool} value={tool}>
              {TOOL_DEFINITIONS[tool]?.label || tool}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

interface NestedStepItemProps {
  step: PipelineStep;
  stepIndex: number;
  nestedIndex: number;
  onUpdate: (index: number, step: PipelineStep) => void;
  onRemove: (index: number) => void;
  onMove: (index: number, direction: 'up' | 'down') => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

function NestedStepItem({ step, stepIndex, nestedIndex, onUpdate, onRemove, onMove, canMoveUp, canMoveDown }: NestedStepItemProps) {
  const updateStep = useConfigStore((state) => state.updateStep);
  const updateStepParam = useConfigStore((state) => state.updateStep);
  const parentStep = useConfigStore((state) => state.config.params?.steps?.[stepIndex]);
  const nestedSteps = (parentStep?.params?.steps as PipelineStep[]) || [];

  const handleNestedToolChange = (newTool: string) => {
    const toolDef = TOOL_DEFINITIONS[newTool];
    const newParams: any = {};

    if (toolDef) {
      toolDef.params.forEach((param) => {
        if (param.default !== undefined) {
          newParams[param.key] = param.default;
        }
      });
    }

    const updatedStep = { ...step, tool: newTool, params: newParams };
    const updatedSteps = [...nestedSteps];
    updatedSteps[nestedIndex] = updatedStep;
    const newStepParams = { ...parentStep.params, steps: updatedSteps };
    updateStep(stepIndex, { params: newStepParams });
  };

  const handleNestedParamUpdate = (key: string, value: any) => {
    // Feature: Sync Scale X/Y if Uniform is checked
    const newParams = { ...step.params, [key]: value };
    if (step.tool === 'scale' && newParams.uniform) {
      if (key === 'x') newParams.y = value;
      if (key === 'y') newParams.x = value;
      if (key === 'uniform' && value === true) {
        newParams.y = newParams.x;
      }
    }

    const updatedStep = { ...step, params: newParams };
    const updatedSteps = [...nestedSteps];
    updatedSteps[nestedIndex] = updatedStep;
    const newStepParams = { ...parentStep.params, steps: updatedSteps };
    updateStep(stepIndex, { params: newStepParams });
  };

  const toolDef = TOOL_DEFINITIONS[step.tool];

  return (
    <Card className="border-primary/20 bg-muted/30">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{nestedIndex + 1}.</span>
          <Select value={step.tool} onValueChange={handleNestedToolChange}>
            <SelectTrigger className="flex-1 h-7 text-xs">
              {toolDef?.label || step.tool}
            </SelectTrigger>
            <SelectContent>
              {MODIFIERS.filter(t =>
                t !== 'layer' &&
                t !== 'duplicate' &&
                t !== 'merge' &&
                t !== 'clone'
              ).map((tool) => (
                <SelectItem key={tool} value={tool}>
                  {TOOL_DEFINITIONS[tool]?.label || tool}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1">
            {canMoveUp && (
              <button
                onClick={() => onMove(nestedIndex, 'up')}
                className="text-xs text-muted-foreground hover:text-foreground"
                title="Move up"
              >
                ↑
              </button>
            )}
            {canMoveDown && (
              <button
                onClick={() => onMove(nestedIndex, 'down')}
                className="text-xs text-muted-foreground hover:text-foreground"
                title="Move down"
              >
                ↓
              </button>
            )}
            <button
              onClick={() => onRemove(nestedIndex)}
              className="text-xs text-destructive hover:text-destructive"
              title="Remove"
            >
              ×
            </button>
          </div>
        </div>

        {/* Nested step params */}
        {toolDef && toolDef.params.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-border/50">
            {toolDef.params.map((paramDef) => {
              const value = step.params[paramDef.key] !== undefined
                ? step.params[paramDef.key]
                : paramDef.default !== undefined
                  ? paramDef.default
                  : paramDef.type === 'number'
                    ? 0
                    : '';

              if (paramDef.type === 'number') {
                const hasRange = paramDef.min !== undefined && paramDef.max !== undefined;
                const useSlider = hasRange && paramDef.max! - paramDef.min! < 100;

                return (
                  <div key={paramDef.key} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-muted-foreground">{paramDef.label}</label>
                      {useSlider && (
                        <span className="text-xs text-muted-foreground">{Number(value || 0).toFixed(2)}</span>
                      )}
                    </div>
                    {useSlider ? (
                      <Slider
                        value={[Number(value || paramDef.default || 0)]}
                        min={paramDef.min}
                        max={paramDef.max}
                        step={paramDef.step || 1}
                        onValueChange={([val]) => handleNestedParamUpdate(paramDef.key, val)}
                        className="h-2"
                      />
                    ) : (
                      <input
                        type="number"
                        value={value || ''}
                        min={paramDef.min}
                        max={paramDef.max}
                        step={paramDef.step || 1}
                        onChange={(e) => handleNestedParamUpdate(paramDef.key, e.target.value === '' ? undefined : Number(e.target.value))}
                        className="w-full h-7 px-2 text-xs rounded-md border border-border bg-background"
                      />
                    )}
                  </div>
                );
              }

              if (paramDef.type === 'select') {
                const selectValue = value || paramDef.default || (paramDef.options?.[0] || '');
                return (
                  <div key={paramDef.key} className="space-y-1">
                    <label className="text-xs text-muted-foreground">{paramDef.label}</label>
                    <Select
                      value={String(selectValue)}
                      onValueChange={(val) => handleNestedParamUpdate(paramDef.key, val)}
                    >
                      <SelectTrigger className="h-7 text-xs">
                        {selectValue || 'Select...'}
                      </SelectTrigger>
                      <SelectContent>
                        {paramDef.options?.map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              }

              return (
                <div key={paramDef.key} className="space-y-1">
                  <label className="text-xs text-muted-foreground">{paramDef.label}</label>
                  <input
                    type="text"
                    value={String(value || '')}
                    onChange={(e) => handleNestedParamUpdate(paramDef.key, e.target.value)}
                    className="w-full h-7 px-2 text-xs rounded-md border border-border bg-background"
                  />
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

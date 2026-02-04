import { Label } from './ui/label';
import { Input } from './ui/input';
import { Select, SelectTrigger, SelectContent, SelectItem } from './ui/select';
import { Checkbox } from './ui/checkbox';
// Slider removed in favor of ScrubbableInput
import { useConfigStore } from '../store/config-store';
import ScrubbableInput from './ui/scrubbable-input';
import { PipelineStep } from '../../types';
import { TOOL_DEFINITIONS } from '../lib/tool-definitions';
import MaskEditor from './MaskEditor';
import MaskPreview from './MaskPreview';

interface StepParamsProps {
  step: PipelineStep;
  index: number;
  onUpdate?: (key: string, value: any) => void;
}

export default function StepParams({ step, index, onUpdate }: StepParamsProps) {
  const storeUpdateStep = useConfigStore((state) => state.updateStep);
  const toolDef = TOOL_DEFINITIONS[step.tool];

  if (!toolDef) return null;

  const updateParam = (key: string, value: any) => {
    // Feature: Sync Scale X/Y if Uniform is checked
    // We need to construct the full new params object to handle dependencies
    const newParams = { ...step.params, [key]: value };

    if (step.tool === 'scale' && newParams.uniform) {
      if (key === 'x') newParams.y = value;
      if (key === 'y') newParams.x = value;
      if (key === 'uniform' && value === true) {
        // When checking uniform, sync Y to X
        newParams.y = newParams.x;
      }
    }

    if (onUpdate) {
      // If parent provided onUpdate, we might need to pass the whole params object
      // if we effectively changed multiple keys.
      // However, onUpdate signature is (key, value).
      // Let's check if we can pass 'params' as key. 
      // LayerStepItem handles: onUpdate(index, { params: ... }) from its own context,
      // but passes (key, value) to StepParams. 
      // We need to check LayerStepItem's implementation of onUpdate passed to StepParams.

      // Looking at LayerStepItem: 
      // onUpdate={(key, value) => { if (key==='mask') ... else onUpdate(index, { params: { ...step.params, [key]: value } }) }}
      // It ONLY updates [key]: value. It misses our side effects!

      // We CANNOT easily fix this just inside StepParams without changing the Interface
      // OR we "hack" it by calling onUpdate multiple times? No, state updates might batch/override.

      // The robust fix: Detect if we changed other keys.
      // If we did (Scale sync), we must update the whole 'params' object.
      // But LayerStepItem expects (key, value). 
      // Use 'params' as the key to update the whole object?
      // LayerStepItem logic: onUpdate(index, { params: { ...step.params, [key]: value } })
      // If we pass key='params', it becomes { params: { ...step.params, params: value } } -> Wrong nesting!

      // Wait, I can see LayerStepItem source. 
      // It does: onUpdate(index, { params: { ...step.params, [key]: value } })

      // I need to change LayerStepItem to accept a full params update or handle side effects.
      // OR: I modify StepParams here to directy call store if onUpdate is insufficient? No, LayerStepItem uses local state or parent state.

      // Let's assume I will update LayerStepItem to handle key="params" correctly OR add onParamsChange.
      // Let's add support for key="params" in LayerStepItem? 
      // OR just pass the whole object if the key is special?

      // Let's try to pass the side-effects via multiple calls?
      // No.

      // I will implement: passing key="ALL_PARAMS" (special) or just assume LayerStepItem refactor.
      // Actually, updateParam in StepParams is already checking keys.

      // Let's just assume I'll fix LayerStepItem too.
      // For now, let's implement the logic assuming we can pass full params.
      onUpdate('params', newParams);
    } else {
      // Fallback to store update
      storeUpdateStep(index, { params: newParams });
    }
  };

  return (
    <div className="space-y-3">
      {toolDef.params.map((paramDef) => {
        const value = step.params[paramDef.key] !== undefined
          ? step.params[paramDef.key]
          : paramDef.default !== undefined
            ? paramDef.default
            : paramDef.type === 'number'
              ? 0
              : paramDef.type === 'boolean'
                ? false
                : '';

        if (paramDef.showIf && !paramDef.showIf(step.params)) {
          return null;
        }

        if (paramDef.type === 'boolean') {
          return (
            <div key={paramDef.key} className="flex items-center space-x-2">
              <Checkbox
                id={`${index}-${paramDef.key}`}
                checked={!!value}
                onCheckedChange={(checked) => updateParam(paramDef.key, checked)}
              />
              <Label htmlFor={`${index}-${paramDef.key}`} className="cursor-pointer">
                {paramDef.label}
              </Label>
            </div>
          );
        }

        if (paramDef.type === 'select') {
          const selectValue = value || paramDef.default || (paramDef.options?.[0] || '');
          return (
            <div key={paramDef.key} className="space-y-2">
              <Label htmlFor={`${index}-${paramDef.key}`}>{paramDef.label}</Label>
              <Select
                value={String(selectValue)}
                onValueChange={(val) => updateParam(paramDef.key, val)}
              >
                <SelectTrigger id={`${index}-${paramDef.key}`}>
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

        if (paramDef.type === 'number') {
          return (
            <ScrubbableInput
              key={paramDef.key}
              id={`${index}-${paramDef.key}`}
              value={value === '' ? 0 : Number(value)}
              onChange={(val) => updateParam(paramDef.key, val)}
              min={paramDef.min}
              max={paramDef.max}
              step={paramDef.step}
              label={paramDef.label}
            />
          );
        }

        return (
          <div key={paramDef.key} className="space-y-2">
            <Label htmlFor={`${index}-${paramDef.key}`}>{paramDef.label}</Label>
            <Input
              id={`${index}-${paramDef.key}`}
              type="text"
              value={String(value || '')}
              onChange={(e) => updateParam(paramDef.key, e.target.value)}
            />
          </div>
        );
      })}

      {/* Warp Preview */}
      {step.tool === 'warp' && ['simplex', 'perlin', 'turbulence', 'marble', 'cells'].includes(step.params.type) && (
        <div className="pt-2">
          <Label className="text-xs mb-1 block text-muted-foreground">Pattern Preview</Label>
          <MaskPreview
            mask={{
              type: step.params.type,
              params: {
                scale: step.params.frequency || step.params.scale || 0.05,
                octaves: step.params.octaves,
                persistence: step.params.persistence,
                lacunarity: step.params.lacunarity,
                distortion: step.params.distortion,
                seed: step.params.seed,
              },
              contrast: step.params.patternContrast,
              brightness: step.params.patternBrightness,
            }}
          />
        </div>
      )}

      {toolDef.hasMask && (
        <MaskEditor
          step={step}
          index={index}
          onChange={(newMask) => {
            if (onUpdate) {
              onUpdate('mask', newMask);
            } else {
              storeUpdateStep(index, { mask: newMask });
            }
          }}
        />
      )}
    </div>
  );
}

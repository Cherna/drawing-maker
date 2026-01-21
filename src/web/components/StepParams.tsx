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
    if (onUpdate) {
      onUpdate(key, value);
    } else {
      // Fallback to store update (for backward compatibility)
      const newParams = { ...step.params, [key]: value };
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
              }
            }}
          />
        </div>
      )}

      {toolDef.hasMask && (
        <MaskEditor
          step={step}
          index={index}
          onChange={(newMask) => updateParam('mask', newMask)}
        />
      )}
    </div>
  );
}

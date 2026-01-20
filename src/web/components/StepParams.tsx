import { Label } from './ui/label';
import { Input } from './ui/input';
import { Select, SelectTrigger, SelectContent, SelectItem } from './ui/select';
import { Checkbox } from './ui/checkbox';
import { Slider } from './ui/slider';
import { useConfigStore } from '../store/config-store';
import { PipelineStep } from '../../types';
import { TOOL_DEFINITIONS } from '../lib/tool-definitions';
import MaskEditor from './MaskEditor';

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
          const hasRange = paramDef.min !== undefined && paramDef.max !== undefined;
          const useSlider = hasRange && paramDef.max! - paramDef.min! < 100;

          return (
            <div key={paramDef.key} className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor={`${index}-${paramDef.key}`}>{paramDef.label}</Label>
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
                  onValueChange={([val]) => updateParam(paramDef.key, val)}
                />
              ) : (
                <Input
                  id={`${index}-${paramDef.key}`}
                  type="number"
                  value={value || ''}
                  min={paramDef.min}
                  max={paramDef.max}
                  step={paramDef.step || 1}
                  onChange={(e) => {
                    const val = e.target.value;
                    updateParam(paramDef.key, val === '' ? undefined : Number(val));
                  }}
                />
              )}
            </div>
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

      {toolDef.hasMask && (
        <MaskEditor step={step} index={index} />
      )}
    </div>
  );
}

import { Label } from './ui/label';
import { Select, SelectTrigger, SelectContent, SelectItem } from './ui/select';
import { Checkbox } from './ui/checkbox';
import { Slider } from './ui/slider';
import { PipelineStep, MaskConfig } from '../../types';
import MaskPreview from './MaskPreview';

const MASK_TYPES = [
  'radial',
  'linear',
  'border',
  'waves',
  'checker',
  'simplex',
  'perlin',
  'turbulence',
  'marble',
  'cells',
];

const PATTERN_TYPES = ['simplex', 'perlin', 'turbulence', 'marble', 'cells', 'noise'];

interface MaskEditorProps {
  step: PipelineStep;
  index: number;
  onChange: (mask: MaskConfig | undefined) => void;
}

export default function MaskEditor({ step, onChange }: MaskEditorProps) {
  const mask = step.mask as MaskConfig | undefined;
  const hasMask = !!mask && (typeof mask === 'object' && 'type' in mask);

  const handleMaskTypeChange = (type: string) => {
    if (type === 'none' || !type) {
      onChange(undefined);
    } else {
      // Set reasonable defaults based on type
      const defaultParams: any = { seed: Math.floor(Math.random() * 1000) };
      if (PATTERN_TYPES.includes(type)) {
        defaultParams.scale = 0.05;
        defaultParams.octaves = 1;
        defaultParams.persistence = 0.5;
        defaultParams.lacunarity = 2;
        if (type === 'marble') defaultParams.distortion = 10;
      } else if (type === 'radial') {
        defaultParams.radius = 0.5;
        defaultParams.center = [0.5, 0.5];
      } else if (type === 'border') {
        defaultParams.top = 0.1;
        defaultParams.right = 0.1;
        defaultParams.bottom = 0.1;
        defaultParams.left = 0.1;
      }

      onChange({
        type: type as MaskConfig['type'],
        params: defaultParams,
      });
    }
  };

  const updateMaskParam = (key: string, value: any) => {
    if (!hasMask) return;
    onChange({
      ...mask,
      params: { ...mask.params, [key]: value },
    });
  };

  const updateMaskOption = (key: keyof MaskConfig, value: any) => {
    if (!hasMask) return;
    onChange({
      ...mask,
      [key]: value,
    });
  };

  if (!hasMask) {
    return (
      <div className="space-y-2 pt-2 border-t border-border">
        <Label>Mask</Label>
        <Select value="none" onValueChange={handleMaskTypeChange}>
          <SelectTrigger>
            <span className="text-muted-foreground">None</span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {MASK_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  const isPattern = PATTERN_TYPES.includes(mask.type);

  return (
    <div className="space-y-3 pt-2 border-t border-border bg-muted/30 p-3 rounded-md">
      <div className="flex items-center justify-between mb-2">
        <Label className="text-xs font-semibold uppercase text-muted-foreground">Mask: {mask.type}</Label>
        <Select value={mask.type || 'none'} onValueChange={handleMaskTypeChange}>
          <SelectTrigger className="w-32 h-7 text-xs">
            {mask.type || 'None'}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {MASK_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-4">
        {/* Contrast & Brightness Control (Soft Transition) */}
        <div className="grid grid-cols-2 gap-4">
          {renderSlider("Contrast", mask.contrast ?? 1, 0, 5, 0.1, (v) => updateMaskOption('contrast', v))}
          {renderSlider("Brightness", mask.brightness ?? 0, -1, 1, 0.05, (v) => updateMaskOption('brightness', v))}
        </div>

        {/* Hard Cut Option */}
        <div className="space-y-2 pt-1 border-t border-border/50">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="hard-cut-toggle"
              checked={mask.threshold !== undefined}
              onCheckedChange={(checked) => {
                if (checked) updateMaskOption('threshold', 0.5);
                else updateMaskOption('threshold', undefined);
              }}
            />
            <Label htmlFor="hard-cut-toggle" className="text-xs cursor-pointer">Hard Cut (Remove Feathering)</Label>
          </div>
          {mask.threshold !== undefined && (
            renderSlider("Cutoff", mask.threshold, 0, 1, 0.01, (v) => updateMaskOption('threshold', v))
          )}
        </div>

        {isPattern && (
          <>
            <div className="border-t border-border/50 pt-2" />
            {renderSlider("Scale", mask.params.scale ?? 0.05, 0.001, 0.2, 0.001, (v) => updateMaskParam('scale', v))}

            {(mask.type === 'turbulence' || mask.type === 'marble') && (
              renderSlider("Octaves", mask.params.octaves ?? 1, 1, 8, 1, (v) => updateMaskParam('octaves', v))
            )}

            {mask.type === 'marble' && (
              renderSlider("Distortion", mask.params.distortion ?? 10, 0, 50, 1, (v) => updateMaskParam('distortion', v))
            )}

            {renderSlider("Seed", mask.params.seed ?? 0, 0, 9999, 1, (v) => updateMaskParam('seed', v))}
          </>
        )}

        {mask.type === 'radial' && (
          renderSlider("Radius", mask.params.radius ?? 0.5, 0, 1, 0.01, (v) => updateMaskParam('radius', v))
        )}

        {mask.type === 'border' && (
          <div className="grid grid-cols-2 gap-2">
            {renderSlider("Top", mask.params.top ?? 0.1, 0, 0.5, 0.01, (v) => updateMaskParam('top', v))}
            {renderSlider("Bottom", mask.params.bottom ?? 0.1, 0, 0.5, 0.01, (v) => updateMaskParam('bottom', v))}
            {renderSlider("Left", mask.params.left ?? 0.1, 0, 0.5, 0.01, (v) => updateMaskParam('left', v))}
            {renderSlider("Right", mask.params.right ?? 0.1, 0, 0.5, 0.01, (v) => updateMaskParam('right', v))}
          </div>
        )}

        <div className="flex items-center space-x-2 pt-1">
          <Checkbox
            checked={mask.invert || false}
            onCheckedChange={(checked) => updateMaskOption('invert', checked)}
          />
          <Label className="text-sm cursor-pointer">Invert</Label>
        </div>

        <div className="pt-2">
          <MaskPreview mask={mask} />
        </div>
      </div>
    </div>
  );
}

function renderSlider(label: string, value: number, min: number, max: number, step: number, onChange: (val: number) => void) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between">
        <Label className="text-xs">{label}</Label>
        <span className="text-xs text-muted-foreground w-12 text-right">{value.toFixed(step < 0.1 ? 3 : 1)}</span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(vals) => onChange(vals[0])}
      />
    </div>
  );
}

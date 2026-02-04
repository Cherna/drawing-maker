import { useRef, useEffect, useState } from 'react';
import { Label } from './ui/label';
import { Select, SelectTrigger, SelectContent, SelectItem } from './ui/select';
import { Checkbox } from './ui/checkbox';
import { Slider } from './ui/slider';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { RotateCcw } from 'lucide-react';
import { PipelineStep, MaskConfig } from '../../types';
import MaskPreview from './MaskPreview';
import ScrubbableInput from './ui/scrubbable-input';

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
          <SliderControl label="Contrast" value={mask.contrast ?? 1} min={0} max={5} step={0.1} onChange={(v) => updateMaskOption('contrast', v)} defaultValue={1} />
          <SliderControl label="Brightness" value={mask.brightness ?? 0} min={-1} max={1} step={0.05} onChange={(v) => updateMaskOption('brightness', v)} defaultValue={0} />
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
            <SliderControl label="Cutoff" value={mask.threshold} min={0} max={1} step={0.01} onChange={(v) => updateMaskOption('threshold', v)} defaultValue={0.5} />
          )}
        </div>

        {isPattern && (
          <>
            <div className="border-t border-border/50 pt-2" />
            <SliderControl label="Scale" value={mask.params.scale ?? 0.05} min={0.0001} max={0.2} step={0.0001} onChange={(v) => updateMaskParam('scale', v)} defaultValue={0.05} />

            <div className="grid grid-cols-2 gap-2">
              <SliderControl label="Offset X" value={mask.params.offsetX ?? 0} min={-5000} max={5000} step={1} onChange={(v) => updateMaskParam('offsetX', v)} defaultValue={0} />
              <SliderControl label="Offset Y" value={mask.params.offsetY ?? 0} min={-5000} max={5000} step={1} onChange={(v) => updateMaskParam('offsetY', v)} defaultValue={0} />
            </div>

            {/* Octaves - for noise types that support multi-octave FBM */}
            {['simplex', 'perlin', 'turbulence', 'marble', 'cells'].includes(mask.type) && (
              <SliderControl label="Octaves" value={mask.params.octaves ?? 1} min={1} max={8} step={1} onChange={(v) => updateMaskParam('octaves', v)} defaultValue={1} />
            )}

            {/* Persistence - amplitude decay for FBM */}
            {['simplex', 'perlin', 'turbulence', 'marble'].includes(mask.type) && (
              <SliderControl label="Persistence" value={mask.params.persistence ?? 0.5} min={0} max={1} step={0.05} onChange={(v) => updateMaskParam('persistence', v)} defaultValue={0.5} />
            )}

            {/* Lacunarity - frequency growth for FBM */}
            {['simplex', 'perlin', 'turbulence', 'marble'].includes(mask.type) && (
              <SliderControl label="Lacunarity" value={mask.params.lacunarity ?? 2} min={1} max={4} step={0.1} onChange={(v) => updateMaskParam('lacunarity', v)} defaultValue={2} />
            )}

            {/* Distortion - marble-specific parameter */}
            {mask.type === 'marble' && (
              <SliderControl label="Distortion" value={mask.params.distortion ?? 10} min={0} max={50} step={1} onChange={(v) => updateMaskParam('distortion', v)} defaultValue={10} />
            )}

            {/* Seed - for all pattern types */}
            <SliderControl label="Seed" value={mask.params.seed ?? 0} min={0} max={9999} step={1} onChange={(v) => updateMaskParam('seed', v)} defaultValue={0} />
          </>
        )}

        {mask.type === 'radial' && (
          <>
            <SliderControl label="Radius" value={mask.params.radius ?? 0.5} min={0} max={2} step={0.01} onChange={(v) => updateMaskParam('radius', v)} defaultValue={0.5} />
            <SliderControl label="Scale" value={mask.params.scale ?? 1} min={0.1} max={5} step={0.1} onChange={(v) => updateMaskParam('scale', v)} defaultValue={1} />
            <div className="grid grid-cols-2 gap-2">
              <SliderControl label="Offset X" value={mask.params.offsetX ?? 0} min={-500} max={500} step={1} onChange={(v) => updateMaskParam('offsetX', v)} defaultValue={0} />
              <SliderControl label="Offset Y" value={mask.params.offsetY ?? 0} min={-500} max={500} step={1} onChange={(v) => updateMaskParam('offsetY', v)} defaultValue={0} />
            </div>
          </>
        )}

        {mask.type === 'checker' && (
          <>
            <SliderControl label="Scale" value={mask.params.scale ?? 0.1} min={0.0001} max={1} step={0.0001} onChange={(v) => updateMaskParam('scale', v)} defaultValue={0.1} />
            <SliderControl label="Pattern Scale" value={mask.params.patternScale ?? 1} min={0.1} max={5} step={0.1} onChange={(v) => updateMaskParam('patternScale', v)} defaultValue={1} />
            <div className="grid grid-cols-2 gap-2">
              <SliderControl label="Offset X" value={mask.params.offsetX ?? 0} min={-500} max={500} step={1} onChange={(v) => updateMaskParam('offsetX', v)} defaultValue={0} />
              <SliderControl label="Offset Y" value={mask.params.offsetY ?? 0} min={-500} max={500} step={1} onChange={(v) => updateMaskParam('offsetY', v)} defaultValue={0} />
            </div>
            <SliderControl label="Softness" value={mask.params.softness ?? 0} min={0} max={1} step={0.01} onChange={(v) => updateMaskParam('softness', v)} defaultValue={0} />
          </>
        )}

        {mask.type === 'border' && (
          <div className="grid grid-cols-2 gap-2">
            <SliderControl label="Top" value={mask.params.top ?? 0.1} min={0} max={0.5} step={0.01} onChange={(v) => updateMaskParam('top', v)} defaultValue={0.1} />
            <SliderControl label="Bottom" value={mask.params.bottom ?? 0.1} min={0} max={0.5} step={0.01} onChange={(v) => updateMaskParam('bottom', v)} defaultValue={0.1} />
            <SliderControl label="Left" value={mask.params.left ?? 0.1} min={0} max={0.5} step={0.01} onChange={(v) => updateMaskParam('left', v)} defaultValue={0.1} />
            <SliderControl label="Right" value={mask.params.right ?? 0.1} min={0} max={0.5} step={0.01} onChange={(v) => updateMaskParam('right', v)} defaultValue={0.1} />
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
    </div >
  );
}

interface SliderControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (val: number) => void;
  defaultValue?: number;
}

function SliderControl({
  label,
  value,
  min,
  max,
  step,
  onChange,
  defaultValue
}: SliderControlProps) {
  const handleReset = () => {
    if (defaultValue !== undefined) {
      onChange(defaultValue);
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <ScrubbableInput
            label={label}
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={onChange}
          />
        </div>
        {defaultValue !== undefined && (
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 mb-[1px]" // Align with ScrubbableInput buttons
            onClick={handleReset}
            title={`Reset to ${defaultValue}`}
          >
            <RotateCcw className="h-3 w-3 text-muted-foreground" />
          </Button>
        )}
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

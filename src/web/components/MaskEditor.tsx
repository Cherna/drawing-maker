import { Label } from './ui/label';
import { Input } from './ui/input';
import { Select, SelectTrigger, SelectContent, SelectItem } from './ui/select';
import { Checkbox } from './ui/checkbox';
import { useConfigStore } from '../store/config-store';
import { PipelineStep, MaskConfig } from '../../types';
import MaskPreview from './MaskPreview';

const MASK_TYPES = [
  'radial',
  'linear',
  'border',
  'noise',
  'turbulence',
  'cells',
  'waves',
  'checker',
];

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
      onChange({
        type: type as MaskConfig['type'],
        params: {},
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

  return (
    <div className="space-y-3 pt-2 border-t border-border bg-muted/30 p-3 rounded-md">
      <div className="flex items-center justify-between">
        <Label>Mask: {mask.type}</Label>
        <Select value={mask.type} onValueChange={handleMaskTypeChange}>
          <SelectTrigger className="w-32 h-8">
            {mask.type}
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

      <div className="space-y-2">
        <Input
          placeholder="Scale"
          type="number"
          step="0.001"
          value={mask.params?.scale || ''}
          onChange={(e) => updateMaskParam('scale', parseFloat(e.target.value))}
        />
        <div className="flex items-center space-x-2">
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

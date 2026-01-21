import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Checkbox } from './ui/checkbox';
import { useConfigStore } from '../store/config-store';
import { ChevronDown, ChevronRight } from 'lucide-react';
import React from 'react';

export default function CanvasControls() {
  const canvas = useConfigStore((state) => state.config.canvas);
  const updateCanvas = useConfigStore((state) => state.updateCanvas);
  const outputName = useConfigStore((state) => state.config.outputBaseName);
  const updateConfig = useConfigStore((state) => state.updateConfig);

  const getMarginValue = (index: number) => {
    if (typeof canvas.margin === 'number') return canvas.margin;
    return canvas.margin[index] ?? 0;
  };

  const updateMargin = (index: number, value: string) => {
    const val = parseFloat(value) || 0;
    let newMargin: [number, number, number, number];

    if (typeof canvas.margin === 'number') {
      newMargin = [canvas.margin, canvas.margin, canvas.margin, canvas.margin];
    } else if (Array.isArray(canvas.margin)) {
      if (canvas.margin.length === 2) {
        newMargin = [canvas.margin[0], canvas.margin[1], canvas.margin[0], canvas.margin[1]];
      } else {
        newMargin = [...(canvas.margin as [number, number, number, number])];
      }
    } else {
      newMargin = [0, 0, 0, 0];
    }

    newMargin[index] = val;
    updateCanvas({ margin: newMargin });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Canvas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-4">
          {/* Presets and Orientation */}
          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="paper-preset" className="text-xs mb-1.5 block">Preset</Label>
              <select
                id="paper-preset"
                className="w-full h-8 text-sm rounded-md border border-input bg-background px-3 py-1 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                onChange={(e) => {
                  const [w, h] = e.target.value.split(',').map(Number);
                  if (w && h) updateCanvas({ width: w, height: h });
                }}
                defaultValue="297,420"
              >
                <option value="210,297">A4 (210 x 297)</option>
                <option value="297,420">A3 (297 x 420)</option>
                <option value="420,594">A2 (420 x 594)</option>
                <option value="594,841">A1 (594 x 841)</option>
                <option value="300,500">30 x 50 cm</option>
                <option value="500,700">50 x 70 cm</option>
              </select>
            </div>
            <div>
              <Label className="text-xs mb-1.5 block">Orientation</Label>
              <button
                className="h-8 px-3 text-sm rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground shadow-sm"
                onClick={() => updateCanvas({ width: canvas.height, height: canvas.width })}
                title="Swap Width and Height"
              >
                ⟲ Swap
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="canvas-width">Width (mm)</Label>
              <Input
                id="canvas-width"
                type="number"
                min="50"
                max="1000"
                value={canvas.width}
                onChange={(e) => updateCanvas({ width: parseFloat(e.target.value) || 300 })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="canvas-height">Height (mm)</Label>
              <Input
                id="canvas-height"
                type="number"
                min="50"
                max="1000"
                value={canvas.height}
                onChange={(e) => updateCanvas({ height: parseFloat(e.target.value) || 200 })}
              />
            </div>
            {/* Pen Width Removed - moved to Per-Layer Settings */}
          </div>
        </div>
        <div className="space-y-2">
          <Label>Margin (mm)</Label>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Top', index: 0 },
              { label: 'Right', index: 1 },
              { label: 'Bottom', index: 2 },
              { label: 'Left', index: 3 },
            ].map((m) => (
              <div key={m.label} className="space-y-1">
                <span className="text-[10px] text-muted-foreground block text-center leading-none">
                  {m.label}
                </span>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  className="h-8 px-2 text-center"
                  value={getMarginValue(m.index)}
                  onChange={(e) => updateMargin(m.index, e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="output-name">Output Name</Label>
          <Input
            id="output-name"
            value={outputName}
            onChange={(e) => updateConfig({ outputBaseName: e.target.value })}
          />
        </div>

        {/* G-Code Settings */}
        <div className="pt-2 border-t border-border">
          <GCodeSettings />
        </div>
      </CardContent>
    </Card >
  );
}

function GCodeSettings() {
  const gcode = useConfigStore((state) => state.config.gcode);
  const updateGCode = useConfigStore((state) => state.updateGCode);
  const [isOpen, setIsOpen] = React.useState(false);

  // Need to import ChevronDown/Right and React if not available
  // But wait, I can't easily add imports here without modifying the top of file.
  // I should do a separate Edit for imports, or include the whole file.
  // Let's rely on MultiReplace or do two edits.
  // Re-reading file content shows imports at top.
  // I will assume I can edit the return block here and then add imports separately.

  return (
    <div className="space-y-2">
      <button
        className="flex items-center gap-2 w-full text-left text-sm font-medium hover:text-primary transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        G-Code Settings
      </button>

      {isOpen && (
        <div className="grid grid-cols-2 gap-4 pl-6 animate-in slide-in-from-top-1 fade-in duration-200">
          <div className="col-span-2 space-y-2">
            <Label htmlFor="post-processor">Post-Processor</Label>
            <select
              id="post-processor"
              className="w-full h-10 text-sm rounded-md border border-input bg-background px-3 py-1 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={gcode.postProcessor || 'standard'}
              onChange={(e) => updateGCode({ postProcessor: e.target.value as any })}
            >
              <option value="standard">Standard (G0/G1)</option>
              <option value="linuxcnc">LinuxCNC</option>
              <option value="reprap">RepRap / Marlin</option>
            </select>
          </div>
          <div className="col-span-2 space-y-2">
            <Label htmlFor="feed-rate">Feed Rate (mm/min)</Label>
            <Input
              id="feed-rate"
              type="number"
              min="100"
              max="10000"
              step="100"
              value={gcode.feedRate}
              onChange={(e) => updateGCode({ feedRate: parseFloat(e.target.value) || 1000 })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="z-up">Z-Up (mm)</Label>
            <Input
              id="z-up"
              type="number"
              min="0"
              max="50"
              value={gcode.zUp}
              onChange={(e) => updateGCode({ zUp: parseFloat(e.target.value) || 5 })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="z-down">Z-Down (mm)</Label>
            <Input
              id="z-down"
              type="number"
              min="-10"
              max="10"
              value={gcode.zDown}
              onChange={(e) => updateGCode({ zDown: parseFloat(e.target.value) || 0 })}
            />
          </div>

          {/* Optimization Toggles */}
          <div className="col-span-2 space-y-3 pt-2 border-t border-border">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="use-arcs"
                checked={gcode.useArcs || false}
                onCheckedChange={(checked) => updateGCode({ useArcs: checked as boolean })}
              />
              <Label htmlFor="use-arcs" className="text-sm font-normal cursor-pointer">
                Use Arcs (G2/G3) for circular paths
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="optimize-paths"
                checked={gcode.optimizePaths || false}
                onCheckedChange={(checked) => updateGCode({ optimizePaths: checked as boolean })}
              />
              <Label htmlFor="optimize-paths" className="text-sm font-normal cursor-pointer">
                Optimize path order (reduces travel)
              </Label>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="dwell-time" className="text-sm">Dwell Time (ms)</Label>
                <span className="text-xs text-muted-foreground">Pause after pen down</span>
              </div>
              <Input
                id="dwell-time"
                type="number"
                min="0"
                max="1000"
                step="10"
                value={gcode.dwellTime || 0}
                onChange={(e) => updateGCode({ dwellTime: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

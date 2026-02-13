import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Checkbox } from './ui/checkbox';
import { useConfigStore } from '../store/config-store';
import { ChevronDown, ChevronRight } from 'lucide-react';
import React from 'react';

const CANVAS_PRESETS = [
  { name: 'A6', width: 105, height: 148 },
  { name: 'A5', width: 148, height: 210 },
  { name: 'A4', width: 210, height: 297 },
  { name: 'A3', width: 297, height: 420 },
  { name: 'A2', width: 420, height: 594 },
  { name: 'A1', width: 594, height: 841 },
  { name: '30x50 cm', width: 300, height: 500 },
  { name: '50x70 cm', width: 500, height: 700 },
];

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

  const getCurrentPresetValue = () => {
    const preset = CANVAS_PRESETS.find(p =>
      (p.width === canvas.width && p.height === canvas.height) ||
      (p.width === canvas.height && p.height === canvas.width)
    );
    return preset ? `${preset.width},${preset.height}` : 'custom';
  };

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        {/* Presets and Orientation */}
        <div className="flex gap-2">
          <div className="flex-1">
            <Label htmlFor="paper-preset" className="text-xs mb-1.5 block">Preset</Label>
            <select
              id="paper-preset"
              className="w-full h-8 text-sm rounded-md border border-input bg-background px-3 py-1 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={getCurrentPresetValue()}
              onChange={(e) => {
                if (e.target.value === 'custom') return;
                const [w, h] = e.target.value.split(',').map(Number);

                // Maintain orientation if already swapped
                const isSwapped = canvas.width > canvas.height !== w > h;
                if (isSwapped && w !== h) {
                  updateCanvas({ width: h, height: w });
                } else {
                  updateCanvas({ width: w, height: h });
                }
              }}
            >
              {CANVAS_PRESETS.map(p => (
                <option key={p.name} value={`${p.width},${p.height}`}>
                  {p.name} ({p.width} x {p.height})
                </option>
              ))}
              <option value="custom">Custom</option>
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
              onChange={(e) => updateCanvas({ width: parseFloat(e.target.value) || 0 })}
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
              onChange={(e) => updateCanvas({ height: parseFloat(e.target.value) || 0 })}
            />
          </div>
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

      <div className="flex items-center space-x-2 pt-1">
        <Checkbox
          id="show-axis"
          checked={canvas.showAxisIndicator !== false}
          onCheckedChange={(checked) => updateCanvas({ showAxisIndicator: checked as boolean })}
        />
        <Label htmlFor="show-axis" className="text-sm font-normal cursor-pointer">
          Show Axis Indicator
        </Label>
      </div>

      <div className="space-y-2 pt-2 border-t border-border/50">
        <Label htmlFor="output-name">Output Base Name</Label>
        <Input
          id="output-name"
          value={outputName}
          onChange={(e) => updateConfig({ outputBaseName: e.target.value })}
        />
      </div>
    </div>
  );
}

import ScrubbableInput from './ui/scrubbable-input';

export function GCodeSettings() {
  const gcode = useConfigStore((state) => state.config.gcode);
  const canvas = useConfigStore((state) => state.config.canvas);
  const updateGCode = useConfigStore((state) => state.updateGCode);
  const showOriginDot = useConfigStore((state) => state.showOriginDot);
  const setShowOriginDot = useConfigStore((state) => state.setShowOriginDot);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
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
        <div className="space-y-2">
          <Label htmlFor="feed-rate">Feed Rate (mm/min)</Label>
          <ScrubbableInput
            id="feed-rate"
            min={100}
            max={10000}
            step={100}
            value={gcode.feedRate}
            onChange={(val) => updateGCode({ feedRate: val || 1000 })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="travel-rate">Travel Rate (mm/min)</Label>
          <ScrubbableInput
            id="travel-rate"
            min={100}
            max={10000}
            step={100}
            value={gcode.travelRate}
            onChange={(val) => updateGCode({ travelRate: val || 3500 })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="z-up">Z-Up / Pen Up (mm)</Label>
          <ScrubbableInput
            id="z-up"
            min={0}
            max={50}
            value={gcode.zUp}
            onChange={(val) => updateGCode({ zUp: val || 5 })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="z-down">Z-Down / Pen Down (mm)</Label>
          <ScrubbableInput
            id="z-down"
            min={-10}
            max={10}
            value={gcode.zDown}
            onChange={(val) => updateGCode({ zDown: val !== undefined ? val : 0 })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="z-safe">Z-Safe / Clearance (mm)</Label>
          <ScrubbableInput
            id="z-safe"
            min={0}
            max={100}
            value={gcode.zSafe ?? 40}
            onChange={(val) => updateGCode({ zSafe: val ?? 40 })}
          />
        </div>

        {/* Solid Filling */}
        <div className="col-span-2 space-y-3 pt-4 border-t border-border">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="enable-filling"
              checked={gcode.enableFilling || false}
              onCheckedChange={(checked) => updateGCode({ enableFilling: checked as boolean })}
            />
            <Label htmlFor="enable-filling" className="text-sm font-semibold cursor-pointer">
              Enable Solid Filling
            </Label>
          </div>

          {gcode.enableFilling && (
            <div className="grid grid-cols-2 gap-4 pl-6">
              <div className="space-y-2">
                <Label htmlFor="fill-angle">Fill Angle (deg)</Label>
                <div className="flex items-center gap-2">
                  <ScrubbableInput
                    id="fill-angle"
                    min={0}
                    max={180}
                    step={1}
                    value={gcode.fillAngle ?? 0}
                    onChange={(val) => updateGCode({ fillAngle: val ?? 0 })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fill-spacing">Spacing (mm)</Label>
                <ScrubbableInput
                  id="fill-spacing"
                  min={0.1}
                  max={10}
                  step={0.1}
                  value={gcode.fillSpacing ?? 0.5}
                  onChange={(val) => updateGCode({ fillSpacing: val ?? 0.5 })}
                />
              </div>
            </div>
          )}
        </div>

        {/* Optimization Toggles */}
        <div className="col-span-2 space-y-3 pt-4 border-t border-border">
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

          {gcode.optimizePaths && (
            <div className="pl-6 space-y-1">
              <div className="flex justify-between items-center">
                <Label htmlFor="join-tolerance" className="text-xs text-muted-foreground">Join Tolerance (mm)</Label>
                <span className="text-[10px] text-muted-foreground">Max gap to bridge</span>
              </div>
              <Input
                id="join-tolerance"
                type="number"
                min="0"
                max="10"
                step="0.01"
                className="h-8"
                value={gcode.joinTolerance ?? 0.1}
                onChange={(e) => updateGCode({ joinTolerance: parseFloat(e.target.value) || 0 })}
              />
            </div>
          )}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="invert-x"
              checked={gcode.invertX || false}
              onCheckedChange={(checked) => updateGCode({ invertX: checked as boolean })}
            />
            <Label htmlFor="invert-x" className="text-sm font-normal cursor-pointer">
              Invert X Axis
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="invert-y"
              checked={gcode.invertY || false}
              onCheckedChange={(checked) => updateGCode({ invertY: checked as boolean })}
            />
            <Label htmlFor="invert-y" className="text-sm font-normal cursor-pointer">
              Invert Y Axis
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="swap-axes"
              checked={gcode.swapAxes || false}
              onCheckedChange={(checked) => updateGCode({ swapAxes: checked as boolean })}
            />
            <Label htmlFor="swap-axes" className="text-sm font-normal cursor-pointer">
              Swap X/Y Axes (rotate 90°)
            </Label>
          </div>

          {/* Origin Point Selection */}
          <div className="space-y-2 pt-2 border-t border-border/50">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Origin Point (0,0)</Label>
              <span className="text-[10px] text-muted-foreground">
                ({(gcode.originX || 0).toFixed(1)}, {(gcode.originY ?? canvas.height).toFixed(1)}) mm
              </span>
            </div>
            <button
              className="w-full h-9 px-3 text-sm rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground shadow-sm transition-colors"
              onClick={() => useConfigStore.getState().setShowOriginSelector(true)}
              title="Select origin point for GCode"
            >
              Set Origin Point
            </button>
            <div className="flex items-center space-x-2 pt-1">
              <Checkbox
                id="show-origin-dot"
                checked={showOriginDot}
                onCheckedChange={(checked) => setShowOriginDot(checked as boolean)}
              />
              <Label htmlFor="show-origin-dot" className="text-xs font-normal cursor-pointer">
                Show origin indicator on canvas
              </Label>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="dwell-time" className="text-sm">Dwell Time (ms)</Label>
              <span className="text-[10px] text-muted-foreground">Pause after pen down</span>
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
    </div>
  );
}

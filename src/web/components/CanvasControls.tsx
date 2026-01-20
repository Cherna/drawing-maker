import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { useConfigStore } from '../store/config-store';

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
      </CardContent>
    </Card>
  );
}

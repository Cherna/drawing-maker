import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { useConfigStore } from '../store/config-store';

export default function CanvasControls() {
  const canvas = useConfigStore((state) => state.config.canvas);
  const updateCanvas = useConfigStore((state) => state.updateCanvas);
  const outputName = useConfigStore((state) => state.config.outputBaseName);
  const updateConfig = useConfigStore((state) => state.updateConfig);

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
              onChange={(e) => updateCanvas({ width: parseFloat(e.target.value) || 200 })}
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
              onChange={(e) => updateCanvas({ height: parseFloat(e.target.value) || 300 })}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="canvas-margin">Margin (mm)</Label>
          <Input
            id="canvas-margin"
            type="number"
            min="0"
            max="100"
            value={Array.isArray(canvas.margin) ? canvas.margin[0] : canvas.margin}
            onChange={(e) => updateCanvas({ margin: parseFloat(e.target.value) || 20 })}
          />
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

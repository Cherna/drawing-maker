import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { useConfigStore } from '../store/config-store';
import { Shuffle } from 'lucide-react';

import GlobalStepsEditor from './GlobalStepsEditor';

export default function GlobalControls() {
  const seed = useConfigStore((state) => state.config.params?.seed || 0);
  const updateParams = useConfigStore((state) => state.updateParams);

  const randomizeSeed = () => {
    updateParams({ seed: Math.floor(Math.random() * 10000) });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Global Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="global-seed">Seed</Label>
            <div className="flex gap-2">
              <Input
                id="global-seed"
                type="number"
                min="0"
                max="99999"
                value={seed}
                onChange={(e) => updateParams({ seed: parseInt(e.target.value) || 0 })}
              />
              <Button variant="outline" size="icon" onClick={randomizeSeed} title="Randomize seed">
                <Shuffle className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <GlobalStepsEditor />
    </div>
  );
}

import { Separator } from './ui/separator';
import CanvasControls from './CanvasControls';
import GlobalControls from './GlobalControls';
import StepsEditor from './StepsEditor';

export default function Sidebar() {
  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="space-y-4 p-4">
        <CanvasControls />
        <Separator />
        <GlobalControls />
        <Separator />
        <StepsEditor />
      </div>
    </div>
  );
}

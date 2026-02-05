import CollapsibleSection from './ui/collapsible-section';
import CanvasControls, { GCodeSettings } from './CanvasControls';
import GlobalControls from './GlobalControls';
import LayersEditor from './LayersEditor';
import FileControls from './FileControls';
import PathStats from './PathStats';
import { useConfigStore } from '../store/config-store';

interface SidebarProps {
  stats?: { pathCount: number; totalLength: number } | null;
}

export default function Sidebar({ stats }: SidebarProps) {
  const feedRate = useConfigStore((state) => state.config.gcode?.feedRate || 1000);

  return (
    <div className="h-full w-full overflow-y-auto bg-card border-r">
      <CollapsibleSection title="Project" defaultExpanded={false}>
        <FileControls />
      </CollapsibleSection>

      <CollapsibleSection title="Canvas Settings" defaultExpanded={false}>
        <CanvasControls />
      </CollapsibleSection>

      <CollapsibleSection title="G-Code Settings" defaultExpanded={false}>
        <GCodeSettings />
      </CollapsibleSection>

      <CollapsibleSection title="Layers" defaultExpanded={true} className="border-b-0">
        <LayersEditor />
      </CollapsibleSection>

      <CollapsibleSection title="Global Modifiers & Settings" defaultExpanded={true}>
        <GlobalControls />
      </CollapsibleSection>

      {stats && (
        <div className="p-4 border-t border-border">
          <PathStats stats={stats} feedRate={feedRate} />
        </div>
      )}
    </div>
  );
}

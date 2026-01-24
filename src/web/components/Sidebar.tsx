import CollapsibleSection from './ui/collapsible-section';
import CanvasControls, { GCodeSettings } from './CanvasControls';
import GlobalControls from './GlobalControls';
import LayersEditor from './LayersEditor';
import FileControls from './FileControls';

export default function Sidebar() {
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
    </div>
  );
}

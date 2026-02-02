import { useEffect } from 'react';
import { useConfigStore } from './store/config-store';
import { usePreview } from './hooks/use-api';
import ResizableSidebar from './components/ResizableSidebar';
import Preview from './components/Preview';
import Header from './components/Header';
import { useDebounce } from './hooks/use-debounce';

function App() {
  const config = useConfigStore((state) => state.config);
  const debouncedConfig = useDebounce(config, 300);

  const { data: preview, isLoading, error, refetch } = usePreview(debouncedConfig);

  useEffect(() => {
    refetch();
  }, [debouncedConfig, refetch]);

  // Warn before closing/reloading if there are unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Only show warning if there's actual content (not just default/empty config)
      const hasContent = config.params?.layers?.some(layer => layer.steps.length > 0) ||
        config.params?.globalSteps?.length > 0;

      if (hasContent) {
        e.preventDefault();
        // Modern browsers ignore custom message, but setting returnValue is required
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [config]);

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <ResizableSidebar />
        <Preview svg={preview?.svg} isLoading={isLoading} error={error} />
      </div>
    </div>
  );
}

export default App;

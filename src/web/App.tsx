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

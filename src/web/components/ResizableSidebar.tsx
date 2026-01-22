import { useState, useRef, useEffect, useCallback } from 'react';
import Sidebar from './Sidebar';
import { cn } from '../lib/utils';

export default function ResizableSidebar() {
  const [width, setWidth] = useState(450); // Increased default width for better fit
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const newWidth = e.clientX;
      // Min width 250px, max width 800px
      const clampedWidth = Math.max(400, Math.min(800, newWidth));
      setWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  return (
    <div
      ref={sidebarRef}
      className="relative flex border-r border-border bg-card"
      style={{ width: `${width}px` }}
    >
      <div className="flex-1 overflow-hidden">
        <Sidebar />
      </div>

      {/* Resize Handle */}
      <div
        className={cn(
          'absolute right-0 top-0 h-full w-1 cursor-col-resize bg-border hover:bg-primary/50 transition-colors',
          isResizing && 'bg-primary'
        )}
        onMouseDown={handleMouseDown}
      />
    </div>
  );
}

import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Trash2, FileJson, Search, Loader2, RefreshCw, ZoomIn, ZoomOut } from 'lucide-react';
import { cn } from '../lib/utils';

import { SketchMetadata } from '../../types';

const API_BASE = import.meta.env.VITE_API_URL || '';

interface SketchBrowserProps {
    isOpen: boolean;
    onClose: () => void;
    sketches: SketchMetadata[];
    onLoad: (filename: string) => void;
    onDelete: (filename: string) => void;
    isLoading?: boolean;
    activeSketch?: string | null;
}

export function SketchBrowser({
    isOpen,
    onClose,
    sketches,
    onLoad,
    onDelete,
    isLoading = false,
    activeSketch
}: SketchBrowserProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedSketch, setSelectedSketch] = useState<string | null>(null);
    const [isRegenerating, setIsRegenerating] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(Date.now());
    const [gridCols, setGridCols] = useState(4);

    const filteredSketches = useMemo(() => {
        if (!searchQuery) return sketches;
        const query = searchQuery.toLowerCase();
        return sketches.filter(sketch =>
            sketch.filename.toLowerCase().includes(query)
        );
    }, [sketches, searchQuery]);

    const handleLoad = () => {
        if (selectedSketch) {
            onLoad(selectedSketch);
            onClose();
        }
    };

    const handleDelete = (e: React.MouseEvent, filename: string) => {
        e.stopPropagation();
        if (confirm(`Are you sure you want to delete "${filename}"?`)) {
            onDelete(filename);
            if (selectedSketch === filename) {
                setSelectedSketch(null);
            }
        }
    };

    const handleRegenerateThumbnails = async () => {
        setIsRegenerating(true);
        try {
            const res = await fetch(`${API_BASE}/api/regenerate-thumbnails`, {
                method: 'POST'
            });
            const data = await res.json();
            alert(`Regenerated ${data.count} thumbnails with ${data.errors} errors.`);

            // Force re-render of images
            setRefreshTrigger(Date.now());
        } catch (e) {
            console.error('Failed to regenerate thumbnails:', e);
            alert('Failed to regenerate thumbnails');
        } finally {
            setIsRegenerating(false);
        }
    };

    const handleZoomIn = () => setGridCols(prev => Math.max(2, prev - 1));
    const handleZoomOut = () => setGridCols(prev => Math.min(8, prev + 1));

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-[90vw] h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
                <DialogHeader className="p-6 pb-4 border-b flex flex-row items-center justify-between">
                    <div className="text-left">
                        <DialogTitle>Sketch Browser</DialogTitle>
                        <DialogDescription>
                            Browse and manage your saved generative sketches.
                        </DialogDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={handleZoomOut}
                            disabled={gridCols >= 8}
                            title="Zoom Out"
                        >
                            <ZoomOut className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={handleZoomIn}
                            disabled={gridCols <= 2}
                            title="Zoom In"
                        >
                            <ZoomIn className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleRegenerateThumbnails}
                            disabled={isRegenerating || isLoading}
                            title="Regenerate all missing thumbnails"
                        >
                            {isRegenerating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                            Regenerate Thumbnails
                        </Button>
                    </div>
                </DialogHeader>

                <div className="p-4 border-b bg-muted/20">
                    <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search sketches..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-8 bg-background"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-muted/10">
                    {filteredSketches.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                            <FileJson className="h-12 w-12 mb-4 opacity-20" />
                            <p>No sketches found</p>
                        </div>
                    ) : (
                        <div
                            className="grid gap-4"
                            style={{
                                gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`
                            }}
                        >
                            {filteredSketches.map((sketch) => {
                                const isSelected = selectedSketch === sketch.filename;
                                const isActive = activeSketch === sketch.filename.replace('.json', '');
                                const thumbnailSrc = `${API_BASE}/api/thumbnails/${sketch.filename.replace('.json', '.png')}?t=${refreshTrigger}`;

                                return (
                                    <div
                                        key={sketch.filename}
                                        className={cn(
                                            "group relative aspect-square rounded-lg border overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:border-primary/50",
                                            isSelected && "ring-2 ring-primary border-primary",
                                            isActive && !isSelected && "border-primary/50"
                                        )}
                                        onClick={() => setSelectedSketch(sketch.filename)}
                                        onDoubleClick={() => {
                                            setSelectedSketch(sketch.filename);
                                            onLoad(sketch.filename);
                                            onClose();
                                        }}
                                    >
                                        <div className="absolute inset-0 bg-white">
                                            {/* Thumbnail Image */}
                                            <img
                                                src={thumbnailSrc}
                                                alt={sketch.filename}
                                                className="w-full h-full object-contain p-2"
                                                onError={(e) => {
                                                    // Hide image and show placeholder on error
                                                    e.currentTarget.style.display = 'none';
                                                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                                }}
                                            />
                                            {/* Fallback Placeholder */}
                                            <div className="hidden absolute inset-0 flex items-center justify-center bg-muted/30">
                                                <FileJson className="h-12 w-12 text-muted-foreground/30" />
                                            </div>
                                        </div>

                                        {/* Overlay Title */}
                                        <div className="absolute inset-x-0 bottom-0 bg-black/60 backdrop-blur-[2px] p-2 transition-transform translate-y-full group-hover:translate-y-0 isSelected:translate-y-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex flex-col flex-1 min-w-0">
                                                    <span className="text-xs font-medium text-white truncate" title={sketch.filename}>
                                                        {sketch.filename.replace('.json', '')}
                                                    </span>
                                                    <span className="text-[10px] text-white/70">
                                                        {sketch.width} x {sketch.height} mm
                                                    </span>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 text-white/70 hover:text-red-400 hover:bg-white/10"
                                                    onClick={(e) => handleDelete(e, sketch.filename)}
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Always visible title if selected */}
                                        {isSelected && (
                                            <div className="absolute inset-x-0 bottom-0 bg-primary/90 p-2">
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="flex flex-col flex-1 min-w-0">
                                                        <span className="text-xs font-medium text-primary-foreground truncate" title={sketch.filename}>
                                                            {sketch.filename.replace('.json', '')}
                                                        </span>
                                                        <span className="text-[10px] text-primary-foreground/70">
                                                            {sketch.width} x {sketch.height} mm
                                                        </span>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 text-primary-foreground/70 hover:text-primary-foreground hover:bg-black/10"
                                                        onClick={(e) => handleDelete(e, sketch.filename)}
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </div>
                                        )}

                                        {isActive && (
                                            <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold uppercase shadow-sm z-10">
                                                Active
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="p-4 border-t flex justify-between items-center bg-background">
                    <div className="text-sm text-muted-foreground">
                        {filteredSketches.length} sketch{filteredSketches.length !== 1 && 'es'}
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleLoad}
                            disabled={!selectedSketch || isLoading}
                        >
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Load Sketch
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

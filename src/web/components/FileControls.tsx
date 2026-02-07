import { useState, useEffect, useCallback } from 'react';
import { useConfigStore } from '../store/config-store';
import { Button } from './ui/button';
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator
} from './ui/dropdown-menu';
import { Save, FolderOpen, FilePlus, RefreshCw, Trash2, ChevronDown } from 'lucide-react';

export default function FileControls() {
    const { config, setConfig, isDirty, markClean } = useConfigStore();
    const [activeFile, setActiveFile] = useState<string | null>(null);
    const [sketches, setSketches] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const refreshSketches = useCallback(async () => {
        try {
            const res = await fetch('http://localhost:3000/api/sketches');
            const data = await res.json();
            setSketches(data.files || []);
        } catch (e) {
            console.error('Failed to load sketches:', e);
        }
    }, []);

    useEffect(() => {
        refreshSketches();
    }, [refreshSketches]);

    const performSave = async (filename: string, overwrite: boolean = false) => {
        setIsLoading(true);
        try {
            // Sanitize filename: ASCII alphanumeric, dot, dash, underscore only
            let cleanName = filename.replace('.json', '');
            cleanName = cleanName.replace(/[^a-zA-Z0-9\-\_\.]/g, '_');

            if (!cleanName) {
                alert('Invalid filename');
                return false;
            }

            // Automatically update outputBaseName to match the filename
            const updatedConfig = {
                ...config,
                outputBaseName: cleanName
            };

            const res = await fetch('http://localhost:3000/api/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: cleanName, config: updatedConfig, overwrite }),
            });
            const data = await res.json();
            if (data.success) {
                setConfig(updatedConfig);
                setActiveFile(cleanName);

                if (data.filename) {
                    setActiveFile(data.filename.replace('.json', ''));
                }

                markClean();
                refreshSketches();
                return true;
            }
        } catch (e) {
            console.error('Failed to save sketch:', e);
            alert('Failed to save sketch');
        } finally {
            setIsLoading(false);
        }
        return false;
    };

    const handleSave = async () => {
        if (activeFile) {
            await performSave(activeFile, true);
        } else {
            handleSaveAs();
        }
    };

    const handleSaveAs = async () => {
        const name = prompt('Save as...', activeFile || 'my-drawing');
        if (name) {
            await performSave(name, false);
        }
    };

    const handleDelete = async () => {
        if (!activeFile) return;

        if (!confirm(`Are you sure you want to delete "${activeFile}"?`)) return;

        setIsLoading(true);
        try {
            const res = await fetch(`http://localhost:3000/api/sketches/${activeFile}.json`, {
                method: 'DELETE'
            });

            if (res.ok) {
                setActiveFile(null);
                refreshSketches();
            } else {
                throw new Error('Failed to delete');
            }
        } catch (e) {
            console.error('Failed to delete sketch:', e);
            alert('Failed to delete sketch');
        } finally {
            setIsLoading(false);
        }
    };

    const loadSketch = async (filename: string) => {
        if (isDirty) {
            if (!confirm(`Discard changes to "${activeFile || 'current sketch'}"?`)) return;
        }

        setIsLoading(true);
        try {
            const res = await fetch(`http://localhost:3000/api/sketches/${filename}`);
            if (!res.ok) throw new Error('Sketch not found');
            const newConfig = await res.json();
            setConfig(newConfig);

            // Clear undo history to start fresh
            const temporal = (useConfigStore as any).temporal;
            if (temporal) {
                temporal.getState().clear();
            }

            setActiveFile(filename.replace('.json', ''));
        } catch (e) {
            console.error('Failed to load sketch:', e);
            alert('Failed to load sketch');
        } finally {
            setIsLoading(false);
        }
    };

    // Keyboard shortcut for Save
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                handleSave();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [config, activeFile]);

    return (
        <div className="space-y-3">
            <div className="flex gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={handleSave}
                    disabled={isLoading}
                    title={activeFile ? `Save "${activeFile}" (Ctrl+S)` : "Save (Ctrl+S)"}
                >
                    <Save className="w-4 h-4 mr-2" />
                    {activeFile ? 'Save' : 'Save As...'}
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSaveAs}
                    disabled={isLoading}
                    title="Save As..."
                >
                    <FilePlus className="w-4 h-4" />
                </Button>
                {activeFile && (
                    <>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-foreground hover:bg-accent px-2"
                            onClick={async () => {
                                const newName = prompt('Rename to...', activeFile);
                                if (newName && newName !== activeFile) {
                                    const saved = await performSave(newName);
                                    if (saved) {
                                        setIsLoading(true);
                                        try {
                                            await fetch(`http://localhost:3000/api/sketches/${activeFile}.json`, {
                                                method: 'DELETE'
                                            });
                                            refreshSketches();
                                        } catch (e) {
                                            console.error('Failed to delete old file after rename');
                                        } finally {
                                            setIsLoading(false);
                                        }
                                    }
                                }
                            }}
                            disabled={isLoading}
                            title={`Rename "${activeFile}"`}
                        >
                            <span className="text-xs">Rename</span>
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10 px-2"
                            onClick={handleDelete}
                            disabled={isLoading}
                            title={`Delete "${activeFile}"`}
                        >
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    </>
                )}
            </div>

            <div className="flex gap-2">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="flex-1 h-8 justify-between text-sm px-3 font-normal">
                            <span className="truncate">{activeFile || 'Load sketch...'}</span>
                            <ChevronDown className="h-4 w-4 opacity-50 ml-2" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-80 max-h-[300px] overflow-y-auto">
                        <DropdownMenuLabel>Saved Sketches</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {sketches.length === 0 ? (
                            <div className="p-2 text-xs text-muted-foreground text-center">No sketches found</div>
                        ) : (
                            sketches.map((file) => (
                                <DropdownMenuItem key={file} onClick={() => loadSketch(file)}>
                                    {file.replace('.json', '')}
                                </DropdownMenuItem>
                            ))
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={refreshSketches}
                    title="Refresh List"
                >
                    <RefreshCw className="w-4 h-4" />
                </Button>
            </div>

            {/* Export Animated SVG */}
            <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={async () => {
                    setIsLoading(true);
                    try {
                        const res = await fetch('http://localhost:3000/api/export-animated', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(config),
                        });
                        if (!res.ok) throw new Error('Export failed');
                        const data = await res.json();

                        // Download animated SVG
                        const blob = new Blob([data.svg], { type: 'image/svg+xml' });
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = `${config.outputBaseName}_animated.svg`;
                        link.click();
                        URL.revokeObjectURL(url);
                    } catch (e) {
                        console.error('Failed to export animated SVG:', e);
                        alert('Failed to export animated SVG');
                    } finally {
                        setIsLoading(false);
                    }
                }}
                disabled={isLoading}
                title="Export as animated SVG (stroke-drawing animation)"
            >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    <circle cx="12" cy="12" r="2" fill="currentColor" opacity="0.3" />
                </svg>
                Export Animated SVG
            </Button>
        </div>
    );
}

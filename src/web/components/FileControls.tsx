import { useState, useEffect, useCallback } from 'react';
import { useConfigStore } from '../store/config-store';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Save, FolderOpen, FilePlus, RefreshCw, Trash2 } from 'lucide-react';

export default function FileControls() {
    const { config, setConfig } = useConfigStore();
    const [activeFile, setActiveFile] = useState<string | null>(null);
    const [sketches, setSketches] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Store the stringified version of the config when loaded/saved
    // This allows us to check if the current state is truly different (dirty)
    const [savedConfigStr, setSavedConfigStr] = useState<string>(JSON.stringify(config));

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
                // Use sanitized name for saving
                body: JSON.stringify({ filename: cleanName, config: updatedConfig, overwrite }),
            });
            const data = await res.json();
            if (data.success) {
                // Update local store with the new name
                setConfig(updatedConfig);
                setActiveFile(cleanName); // Sets active file to the SAVED name (which might include increment if overwrite=false)

                // If we attempted to save as "foo" but got "foo1", activeFile becomes "foo1". This is correct.
                if (data.filename) {
                    setActiveFile(data.filename.replace('.json', ''));
                }

                // Update saved state reference
                setSavedConfigStr(JSON.stringify(updatedConfig));
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
            // Implicit overwrite for "Save"
            await performSave(activeFile, true);
        } else {
            handleSaveAs();
        }
    };

    const handleSaveAs = async () => {
        const name = prompt('Save as...', activeFile || 'my-drawing');
        if (name) {
            // "Save As" behavior per request: check bounds/append number -> overwrite=false
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
                setActiveFile(null); // Clear active file as it's gone
                // We don't reset config here, user might want to save it as something else
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
        // Check if dirty
        const currentConfigStr = JSON.stringify(config);
        const isDirty = currentConfigStr !== savedConfigStr;

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

            // Filename from dropdown includes extension usually, but let's be safe
            setActiveFile(filename.replace('.json', ''));
            // Update saved state reference
            setSavedConfigStr(JSON.stringify(newConfig));
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
                                        // Delete the old file
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
                <Select
                    value={activeFile ? `${activeFile}.json` : ''}
                    onValueChange={(val) => loadSketch(val)}
                >
                    <SelectTrigger className="flex-1 h-8 text-sm">
                        <SelectValue placeholder="Load sketch..." />
                    </SelectTrigger>
                    <SelectContent>
                        {sketches.map((file) => (
                            <SelectItem key={file} value={file}>
                                {file.replace('.json', '')}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
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
        </div>
    );
}

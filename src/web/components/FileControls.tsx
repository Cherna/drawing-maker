import { useState, useEffect, useCallback } from 'react';
import { useConfigStore } from '../store/config-store';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Save, FolderOpen, FilePlus, RefreshCw } from 'lucide-react';

export default function FileControls() {
    const { config, setConfig } = useConfigStore();
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

    const performSave = async (filename: string) => {
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
                body: JSON.stringify({ filename: cleanName, config: updatedConfig }),
            });
            const data = await res.json();
            if (data.success) {
                // Update local store with the new name
                setConfig(updatedConfig);
                setActiveFile(cleanName);
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
            if (confirm(`Overwrite "${activeFile}"?`)) {
                await performSave(activeFile);
            }
        } else {
            handleSaveAs();
        }
    };

    const handleSaveAs = async () => {
        const name = prompt('Save as...', activeFile || 'my-drawing');
        if (name) {
            await performSave(name);
        }
    };

    const loadSketch = async (filename: string) => {
        if (activeFile) {
            if (!confirm(`Discard changes to "${activeFile}"?`)) return;
        }

        setIsLoading(true);
        try {
            const res = await fetch(`http://localhost:3000/api/sketches/${filename}`);
            if (!res.ok) throw new Error('Sketch not found');
            const newConfig = await res.json();
            setConfig(newConfig);
            // Filename from dropdown includes extension usually, but let's be safe
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

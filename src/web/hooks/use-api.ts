import { useMutation, useQuery } from '@tanstack/react-query';
import { AppConfig } from '../../types';

// Use relative URLs so Vite's proxy works from any network location
// Vite proxies /api/* to http://localhost:3000/api/*
const API_BASE = import.meta.env.VITE_API_URL || '';

export function usePreview(config: AppConfig) {
  return useQuery({
    queryKey: ['preview', config],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/api/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Preview failed');
      }
      return response.json();
    },
    enabled: !!config,
    staleTime: 0,
    gcTime: 0,
  });
}

export function useExport() {
  return useMutation({
    mutationFn: async (config: AppConfig) => {
      const response = await fetch(`${API_BASE}/api/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Export failed');
      }
      return response.json();
    },
    onSuccess: (data, config) => {
      // Download SVG
      const svgBlob = new Blob([data.svg], { type: 'image/svg+xml' });
      const svgUrl = URL.createObjectURL(svgBlob);
      const svgLink = document.createElement('a');
      svgLink.href = svgUrl;
      svgLink.download = `${config.outputBaseName}.svg`;
      svgLink.click();

      // Download G-Code
      const gcodeBlob = new Blob([data.gcode], { type: 'text/plain' });
      const gcodeUrl = URL.createObjectURL(gcodeBlob);
      const gcodeLink = document.createElement('a');
      gcodeLink.href = gcodeUrl;
      gcodeLink.download = `${config.outputBaseName}.gcode`;
      gcodeLink.click();

      URL.revokeObjectURL(svgUrl);
      URL.revokeObjectURL(gcodeUrl);
    },
  });
}

export function useConfigs() {
  return useQuery({
    queryKey: ['configs'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/api/sketches`);
      if (!response.ok) {
        throw new Error('Failed to load configs');
      }
      return response.json();
    },
  });
}

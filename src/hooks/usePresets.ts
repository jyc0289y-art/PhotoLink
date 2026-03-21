import { useState, useCallback, useEffect } from 'react';
import { Preset } from '../types/editor';
import { builtInPresets } from '../presets/builtIn';

const STORAGE_KEY = 'photolink-custom-presets';

export function usePresets() {
  const [customPresets, setCustomPresets] = useState<Preset[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customPresets));
  }, [customPresets]);

  const allPresets = [...builtInPresets, ...customPresets];

  const savePreset = useCallback((preset: Omit<Preset, 'id'>) => {
    const newPreset: Preset = {
      ...preset,
      id: `custom_${Date.now()}`,
    };
    setCustomPresets(prev => [...prev, newPreset]);
    return newPreset;
  }, []);

  const deletePreset = useCallback((id: string) => {
    setCustomPresets(prev => prev.filter(p => p.id !== id));
  }, []);

  const exportPresets = useCallback(() => {
    const json = JSON.stringify(customPresets, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'photolink-presets.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [customPresets]);

  const importPresets = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string) as Preset[];
        setCustomPresets(prev => [...prev, ...imported.map(p => ({ ...p, id: `custom_${Date.now()}_${Math.random()}` }))]);
      } catch {
        alert('유효하지 않은 프리셋 파일입니다.');
      }
    };
    reader.readAsText(file);
  }, []);

  return { allPresets, customPresets, savePreset, deletePreset, exportPresets, importPresets };
}

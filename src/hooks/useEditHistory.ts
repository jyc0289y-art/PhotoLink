import { useCallback, useRef, useState } from 'react';
import { EditParams, DEFAULT_PARAMS } from '../types/editor';

const MAX_HISTORY = 50;

export function useEditHistory() {
  const [params, setParamsState] = useState<EditParams>({ ...DEFAULT_PARAMS });
  const historyRef = useRef<EditParams[]>([{ ...DEFAULT_PARAMS }]);
  const indexRef = useRef(0);

  const setParams = useCallback((newParams: EditParams | ((prev: EditParams) => EditParams)) => {
    setParamsState(prev => {
      const next = typeof newParams === 'function' ? newParams(prev) : newParams;

      // Trim future history
      historyRef.current = historyRef.current.slice(0, indexRef.current + 1);
      historyRef.current.push(structuredClone(next));
      if (historyRef.current.length > MAX_HISTORY) {
        historyRef.current.shift();
      } else {
        indexRef.current++;
      }

      return next;
    });
  }, []);

  const undo = useCallback(() => {
    if (indexRef.current > 0) {
      indexRef.current--;
      const prev = structuredClone(historyRef.current[indexRef.current]);
      setParamsState(prev);
    }
  }, []);

  const redo = useCallback(() => {
    if (indexRef.current < historyRef.current.length - 1) {
      indexRef.current++;
      const next = structuredClone(historyRef.current[indexRef.current]);
      setParamsState(next);
    }
  }, []);

  const canUndo = indexRef.current > 0;
  const canRedo = indexRef.current < historyRef.current.length - 1;

  const reset = useCallback(() => {
    const def = { ...DEFAULT_PARAMS };
    historyRef.current = [structuredClone(def)];
    indexRef.current = 0;
    setParamsState(def);
  }, []);

  return { params, setParams, undo, redo, canUndo, canRedo, reset };
}

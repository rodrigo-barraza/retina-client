import { useState, useCallback, useEffect, useRef } from "react";
import StorageService from "../services/StorageService.js";

/**
 * useToolToggles — manages the disabled built-in tools state and toggle handlers.
 * Optionally persists the toggle state to localStorage under a page-scoped key.
 *
 * @param {Array} builtInTools — array of built-in tool schemas
 * @param {string} [storageKey] — if provided, persist toggle state to localStorage
 * @returns {{ disabledBuiltIns: Set, handleToggleBuiltIn: Function, handleToggleAllBuiltIn: Function }}
 */
export default function useToolToggles(builtInTools, storageKey) {
  // Load initial state from localStorage if a storage key is provided
  const [disabledBuiltIns, setDisabledBuiltIns] = useState(() => {
    if (storageKey) {
      const saved = StorageService.get(storageKey);
      if (saved?.disabledBuiltIns && Array.isArray(saved.disabledBuiltIns)) {
        return new Set(saved.disabledBuiltIns);
      }
    }
    return new Set();
  });

  // Persist to localStorage when the set changes
  const isInitialMount = useRef(true);
  useEffect(() => {
    // Skip initial mount to avoid writing back the just-loaded value
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (!storageKey) return;
    const current = StorageService.get(storageKey) || {};
    StorageService.set(storageKey, {
      ...current,
      disabledBuiltIns: [...disabledBuiltIns],
    });
  }, [disabledBuiltIns, storageKey]);

  const handleToggleBuiltIn = useCallback((toolName) => {
    setDisabledBuiltIns((prev) => {
      const next = new Set(prev);
      if (next.has(toolName)) next.delete(toolName);
      else next.add(toolName);
      return next;
    });
  }, []);

  const handleToggleAllBuiltIn = useCallback(
    (enableAll) => {
      setDisabledBuiltIns((prev) => {
        const next = new Set(prev);
        for (const tool of builtInTools) {
          if (enableAll) {
            next.delete(tool.name);
          } else {
            next.add(tool.name);
          }
        }
        return next;
      });
    },
    [builtInTools],
  );

  return { disabledBuiltIns, handleToggleBuiltIn, handleToggleAllBuiltIn };
}

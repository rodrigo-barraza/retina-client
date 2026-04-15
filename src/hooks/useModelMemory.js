import { useCallback, useRef } from "react";
import StorageService from "../services/StorageService.js";
import { LOCAL_PROVIDERS } from "../constants.js";

/**
 * useModelMemory — Persist and restore the last-used model per page context.
 *
 * Stores { provider, model, isLocal } in StorageService under the given key.
 * Only one model can be default — the last one picked wins (local or cloud).
 *
 * When config loads, call `restoreModel(config, setSettings)` to apply the
 * remembered model if it still exists in the config. Call it twice when
 * progressive loading is used (once for cloud, once for merged local) —
 * the hook automatically defers local model restoration until local models
 * are available.
 *
 * @param {string} storageKey — one of the SK_MODEL_MEMORY_* constants
 * @returns {{ saveModel, restoreModel }}
 */
export default function useModelMemory(storageKey) {
  // Track whether we've already restored so progressive config loads
  // don't keep overwriting user's live selection.
  const restoredRef = useRef(false);

  /**
   * Save the current model selection to localStorage.
   * Call this whenever the user picks a model.
   *
   * @param {string} provider
   * @param {string} model
   */
  const saveModel = useCallback(
    (provider, model) => {
      if (!provider || !model) return;
      StorageService.set(storageKey, {
        provider,
        model,
        isLocal: LOCAL_PROVIDERS.has(provider),
      });
    },
    [storageKey],
  );

  /**
   * Attempt to restore the remembered model from localStorage.
   * Safe to call multiple times (idempotent after first successful restore).
   *
   * @param {object} config — Prism config (may or may not include local models yet)
   * @param {Function} setSettings — React setState for the settings object
   * @param {object} [options]
   * @param {boolean} [options.fcOnly] — if true, only restore if the model supports Function Calling
   * @param {Function} [options.fallback] — called with (config) if no saved model found; lets the caller apply default selection
   */
  const restoreModel = useCallback(
    (config, setSettings, { fcOnly = false, fallback } = {}) => {
      if (!config) return;
      if (restoredRef.current) return;

      const saved = StorageService.get(storageKey);
      if (!saved?.provider || !saved?.model) {
        // No saved preference — let the caller apply its own default.
        if (fallback) fallback(config);
        restoredRef.current = true;
        return;
      }

      // If the saved model is local but local models aren't merged yet, wait.
      if (saved.isLocal) {
        const localModels = config.textToText?.models?.[saved.provider] || [];
        if (localModels.length === 0) {
          // Local models haven't arrived yet — don't mark as restored,
          // so the next call (after onLocalMerge) can try again.
          return;
        }
      }

      // Check the model exists in current config
      const providerModels = config.textToText?.models?.[saved.provider] || [];
      const modelDef = providerModels.find((m) => m.name === saved.model);

      if (!modelDef) {
        // Model no longer available — fall back to default
        if (fallback) fallback(config);
        restoredRef.current = true;
        return;
      }

      // FC-only gate
      if (fcOnly && !modelDef.tools?.includes("Function Calling")) {
        if (fallback) fallback(config);
        restoredRef.current = true;
        return;
      }

      const temp = modelDef.defaultTemperature ?? 1.0;
      setSettings((s) => ({
        ...s,
        provider: saved.provider,
        model: saved.model,
        temperature: temp,
      }));
      restoredRef.current = true;
    },
    [storageKey],
  );

  /**
   * Reset the restored flag — call when the user explicitly starts a new chat
   * so subsequent config loads can re-apply the memory.
   */
  const resetRestoreFlag = useCallback(() => {
    restoredRef.current = false;
  }, []);

  return { saveModel, restoreModel, resetRestoreFlag };
}

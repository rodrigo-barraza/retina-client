"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Loader2, Power, PowerOff, RefreshCw } from "lucide-react";
import IrisService from "../services/IrisService";
import PrismService from "../services/PrismService";
import ModelsTableComponent from "./ModelsTableComponent";
import ModelLoadConfigPanel from "./ModelLoadConfigPanel";
import PageHeaderComponent from "./PageHeaderComponent";
import { ErrorMessage } from "./StateMessageComponent";
import { useToast } from "./ToastComponent";
import styles from "./ModelsPageComponent.module.css";

/**
 * Flatten all model groups from the config into a single array,
 * tagging each model with its provider.
 */
function flattenConfigModels(config) {
  if (!config) return [];

  const modelsMap = new Map();

  const MODEL_SECTIONS = [
    "textToText",
    "textToImage",
    "textToSpeech",
    "imageToText",
    "audioToText",
    "embedding",
  ];

  for (const section of MODEL_SECTIONS) {
    const providers = config[section]?.models || {};
    for (const [provider, models] of Object.entries(providers)) {
      for (const m of models) {
        const key = `${provider}:${m.name}`;
        if (!modelsMap.has(key)) {
          modelsMap.set(key, { ...m, provider });
        } else {
          const existing = modelsMap.get(key);
          modelsMap.set(key, {
            ...existing,
            arena: { ...(existing.arena || {}), ...(m.arena || {}) },
          });
        }
      }
    }
  }

  return [...modelsMap.values()];
}

export default function ModelsPageComponent({ mode = "user", onCountChange }) {
  const isAdmin = mode === "admin";
  const [allModels, setAllModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionInProgress, setActionInProgress] = useState(null);
  const [toastElement, showToast] = useToast(4000);
  const [favoriteKeys, setFavoriteKeys] = useState([]);
  const [loadConfigModel, setLoadConfigModel] = useState(null);
  const hasLoadedRef = useRef(false);

  // Helper: merge config + LM data + stats into the allModels array
  const buildMergedModels = useCallback((config, lmData, modelStats) => {
    const flat = flattenConfigModels(config);
    const lmApiModels = (lmData?.models || []).filter((m) => m.type === "llm");
    const lmApiMap = new Map(lmApiModels.map((m) => [m.key, m]));

    // Build usage map: "provider:model" → stats object
    const usageMap = new Map();
    let grandTotal = 0;
    for (const s of modelStats) {
      const key = `${s.provider}:${s.model}`;
      const existing = usageMap.get(key);
      if (existing) {
        existing.totalRequests += s.totalRequests;
        existing.totalInputTokens += s.totalInputTokens || 0;
        existing.totalOutputTokens += s.totalOutputTokens || 0;
      } else {
        usageMap.set(key, {
          totalRequests: s.totalRequests,
          totalInputTokens: s.totalInputTokens || 0,
          totalOutputTokens: s.totalOutputTokens || 0,
        });
      }
      grandTotal += s.totalRequests;
    }

    return flat.map((m) => {
      const usageKey = `${m.provider}:${m.name}`;
      const stats = usageMap.get(usageKey) || { totalRequests: 0, totalInputTokens: 0, totalOutputTokens: 0 };
      const usageCount = stats.totalRequests;
      let result = {
        ...m,
        usageCount,
        usageTotal: grandTotal,
        totalInputTokens: stats.totalInputTokens,
        totalOutputTokens: stats.totalOutputTokens,
      };

      if (m.provider === "lm-studio") {
        const apiModel = lmApiMap.get(m.name);
        if (apiModel) {
          result = {
            ...result,
            loaded_instances: apiModel.loaded_instances,
            loaded: apiModel.loaded_instances?.length > 0,
            key: apiModel.key,
            // Preserve raw API fields for ModelLoadConfigPanel
            max_context_length: apiModel.max_context_length,
            size_bytes: apiModel.size_bytes,
            params_string: apiModel.params_string,
            architecture: apiModel.architecture,
            archParams: apiModel.archParams,
            display_name: apiModel.display_name || result.display_name,
          };
        }
      }
      return result;
    });
  }, []);

  const fetchModels = useCallback(async () => {
    try {
      setError(null);
      const configService = isAdmin ? IrisService : PrismService;
      const statsService = isAdmin ? IrisService : PrismService;

      // Phase 1: cloud config + stats — resolves instantly
      const [config, modelStats] = await Promise.all([
        configService.getConfig().catch(() => null),
        statsService.getModelStats().catch(() => []),
      ]);

      // Show cloud models immediately — only on first load to avoid flash
      // on subsequent interval refreshes
      if (!hasLoadedRef.current) {
        const cloudModels = buildMergedModels(config, { models: [] }, modelStats);
        setAllModels(cloudModels);
        setLoading(false);
      }

      // Phase 2: progressive — merge local provider models + LM Studio API data
      const localService = isAdmin ? IrisService : PrismService;
      const lmService = isAdmin ? IrisService : PrismService;

      // Fire both in parallel, each with their own error handling
      const [localResult, lmData] = await Promise.all([
        config?.localProviders?.length > 0
          ? localService.getLocalConfig().catch(() => ({ models: {} }))
          : { models: {} },
        lmService.getLmStudioModels().catch(() => ({ models: [] })),
      ]);

      // Merge local models into config using shared utility
      const mergedConfig = PrismService.mergeLocalModels(config, localResult?.models);

      // Rebuild with local models + LM Studio API data
      const fullModels = buildMergedModels(mergedConfig, lmData, modelStats);
      setAllModels(fullModels);
      hasLoadedRef.current = true;
    } catch (err) {
      setError(err.message);
      setAllModels([]);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, buildMergedModels]);

  useEffect(() => {
    fetchModels();
    PrismService.getFavorites("model")
      .then((favs) => setFavoriteKeys(favs.map((f) => f.key)))
      .catch(() => {});
    const interval = setInterval(fetchModels, 15000);
    return () => clearInterval(interval);
  }, [fetchModels]);

  // Report count to parent
  useEffect(() => {
    onCountChange?.(allModels.length);
  }, [onCountChange, allModels.length]);

  const handleToggleFavorite = async (key) => {
    if (favoriteKeys.includes(key)) {
      setFavoriteKeys((prev) => prev.filter((k) => k !== key));
      PrismService.removeFavorite("model", key).catch(() => {});
    } else {
      setFavoriteKeys((prev) => [...prev, key]);
      const [provider, ...rest] = key.split(":");
      PrismService.addFavorite("model", key, {
        provider,
        name: rest.join(":"),
      }).catch(() => {});
    }
  };

  // Open the config panel instead of loading immediately
  const handleLoad = (modelKey) => {
    // Find the raw LM Studio API model data for this key
    const rawModel = allModels.find(
      (m) => m.provider === "lm-studio" && (m.key === modelKey || m.name === modelKey),
    );
    if (rawModel) {
      setLoadConfigModel(rawModel);
    }
  };

  // Called from the config panel with load options
  const handleConfigLoad = async (modelKey, options) => {
    setActionInProgress({ id: modelKey, type: "load" });
    setLoadConfigModel(null);
    try {
      const lmService = isAdmin ? IrisService : PrismService;
      await lmService.loadLmStudioModel(modelKey, options);
      showToast(`Loaded ${modelKey}`, "success");
      await fetchModels();
    } catch (err) {
      showToast(`Failed to load: ${err.message}`, "error");
    } finally {
      setActionInProgress(null);
    }
  };

  const handleUnload = async (instanceId) => {
    setActionInProgress({ id: instanceId, type: "unload" });
    try {
      const lmService = isAdmin ? IrisService : PrismService;
      await lmService.unloadLmStudioModel(instanceId);
      showToast(`Unloaded ${instanceId}`, "success");
      await fetchModels();
    } catch (err) {
      showToast(`Failed to unload: ${err.message}`, "error");
    } finally {
      setActionInProgress(null);
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    await fetchModels();
  };

  const providerSet = new Set(allModels.map((m) => m.provider));

  const renderActions = isAdmin
    ? (model) => {
        if (model.provider !== "lm-studio") return null;

        const isLoaded = model.loaded_instances?.length > 0;
        const instance = model.loaded_instances?.[0];
        const modelKey = model.key || model.name;
        const isActioning =
          actionInProgress &&
          (actionInProgress.id === modelKey ||
            actionInProgress.id === instance?.id);
        const actionType = isActioning ? actionInProgress.type : null;

        if (isActioning) {
          return (
            <button
              className={`${styles.actionBtn} ${actionType === "unload" ? styles.unloadBtn : styles.loadingBtn}`}
              disabled
            >
              <Loader2 size={10} className={styles.spinning} />
              {actionType === "load" ? "Loading\u2026" : "Unloading\u2026"}
            </button>
          );
        }

        if (isLoaded) {
          return (
            <button
              className={`${styles.actionBtn} ${styles.unloadBtn}`}
              onClick={(e) => {
                e.stopPropagation();
                handleUnload(instance.id);
              }}
              title="Unload model"
              disabled={!!actionInProgress}
            >
              <PowerOff size={10} />
              Unload
            </button>
          );
        }

        return (
          <button
            className={`${styles.actionBtn} ${styles.loadBtn}`}
            onClick={(e) => {
              e.stopPropagation();
              handleLoad(modelKey);
            }}
            title="Load model"
            disabled={!!actionInProgress}
          >
            <Power size={10} />
            Load
          </button>
        );
      }
    : undefined;

  return (
    <>
      {!isAdmin ? (
        <PageHeaderComponent
          title="Models"
          subtitle={`${allModels.length} models across ${providerSet.size} providers`}
        >
          <button
            className={styles.refreshBtn}
            onClick={handleRefresh}
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? styles.spinning : ""} />
            Refresh
          </button>
        </PageHeaderComponent>
      ) : (
        <div className={styles.adminActions}>
          <button
            className={styles.refreshBtn}
            onClick={handleRefresh}
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? styles.spinning : ""} />
            Refresh
          </button>
        </div>
      )}
      <div className={isAdmin ? styles.adminContent : styles.content}>
        <ErrorMessage message={error} />

        {toastElement}

        {loading && allModels.length === 0 ? (
          <div className={styles.loadingState}>
            <Loader2 size={24} className={styles.spinning} />
            <span>Loading models...</span>
          </div>
        ) : (
          <ModelsTableComponent
            models={allModels}
            renderActions={renderActions}
            favorites={favoriteKeys}
            onToggleFavorite={handleToggleFavorite}
          />
        )}
      </div>

      {loadConfigModel && (
        <ModelLoadConfigPanel
          model={loadConfigModel}
          onLoad={handleConfigLoad}
          onClose={() => setLoadConfigModel(null)}
          service={isAdmin ? IrisService : PrismService}
          loading={!!actionInProgress}
        />
      )}
    </>
  );
}

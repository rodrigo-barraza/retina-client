"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Server,
  Loader2,
  Power,
  PowerOff,
  RefreshCw,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import IrisService from "../services/IrisService";
import PrismService from "../services/PrismService";
import ModelGrid from "./ModelGrid";
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

export default function ModelsPageComponent({ mode = "user" }) {
  const isAdmin = mode === "admin";
  const [allModels, setAllModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionInProgress, setActionInProgress] = useState(null);
  const [toast, setToast] = useState(null);
  const [favoriteKeys, setFavoriteKeys] = useState([]);

  const fetchModels = useCallback(async () => {
    try {
      setError(null);
      const lmService = isAdmin ? IrisService : PrismService;
      const configService = isAdmin ? IrisService : PrismService;
      const [config, lmData] = await Promise.all([
        configService.getConfig().catch(() => null),
        lmService.getLmStudioModels().catch(() => ({ models: [] })),
      ]);

      const flat = flattenConfigModels(config);

      const lmApiModels = (lmData.models || []).filter((m) => m.type === "llm");
      const lmApiMap = new Map(lmApiModels.map((m) => [m.key, m]));

      const merged = flat.map((m) => {
        if (m.provider === "lm-studio") {
          const apiModel = lmApiMap.get(m.name);
          if (apiModel) {
            return {
              ...m,
              loaded_instances: apiModel.loaded_instances,
              loaded: apiModel.loaded_instances?.length > 0,
              key: apiModel.key,
            };
          }
        }
        return m;
      });

      setAllModels(merged);
    } catch (err) {
      setError(err.message);
      setAllModels([]);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchModels();
    PrismService.getFavorites("model")
      .then((favs) => setFavoriteKeys(favs.map((f) => f.key)))
      .catch(() => {});
    const interval = setInterval(fetchModels, 15000);
    return () => clearInterval(interval);
  }, [fetchModels]);

  const handleToggleFavorite = async (key) => {
    if (favoriteKeys.includes(key)) {
      setFavoriteKeys((prev) => prev.filter((k) => k !== key));
      PrismService.removeFavorite("model", key).catch(() => {});
    } else {
      setFavoriteKeys((prev) => [...prev, key]);
      const [provider, ...rest] = key.split(":");
      PrismService.addFavorite("model", key, { provider, name: rest.join(":") }).catch(() => {});
    }
  };

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleLoad = async (modelKey) => {
    setActionInProgress({ id: modelKey, type: "load" });
    try {
      const lmService = isAdmin ? IrisService : PrismService;
      await lmService.loadLmStudioModel(modelKey);
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
    <div className={styles.content}>
      <div className={styles.pageHeader}>
        <div className={styles.titleRow}>
          <h1 className={styles.pageTitle}>
            <Server size={24} /> Models
          </h1>
          <button
            className={styles.refreshBtn}
            onClick={handleRefresh}
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? styles.spinning : ""} />
            Refresh
          </button>
        </div>
        <p className={styles.pageSubtitle}>
          {allModels.length} models across {providerSet.size} providers
        </p>
      </div>

      {error && (
        <div className={styles.errorBanner}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {toast && (
        <div className={`${styles.toast} ${styles[toast.type]}`}>
          {toast.type === "success" ? (
            <CheckCircle size={16} />
          ) : (
            <AlertCircle size={16} />
          )}
          {toast.message}
        </div>
      )}

      {loading && allModels.length === 0 ? (
        <div className={styles.loadingState}>
          <Loader2 size={24} className={styles.spinning} />
          <span>Loading models...</span>
        </div>
      ) : (
        <ModelGrid
          models={allModels}
          renderActions={renderActions}
          favorites={favoriteKeys}
          onToggleFavorite={handleToggleFavorite}
        />
      )}
    </div>
  );
}

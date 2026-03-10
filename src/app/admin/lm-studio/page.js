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
import { IrisService } from "../../../services/IrisService";
import { PrismService } from "../../../services/PrismService";
import ModelGrid from "../../../components/ModelGrid";
import styles from "./page.module.css";

export default function LmStudioPage() {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionInProgress, setActionInProgress] = useState(null);
  const [toast, setToast] = useState(null);

  const fetchModels = useCallback(async () => {
    try {
      setError(null);
      const [apiData, config] = await Promise.all([
        IrisService.getLmStudioModels(),
        PrismService.getConfig().catch(() => null),
      ]);

      // Build a lookup of config data for lm-studio models (has arena, pricing, etc.)
      const configModels = {};
      const configList = config?.textToText?.models?.["lm-studio"] || [];
      for (const m of configList) {
        configModels[m.name] = m;
      }

      // Merge config data (arena, pricing, contextLength, size) into the raw API models
      const merged = (apiData.models || []).map((m) => {
        const cfg = configModels[m.key];
        if (cfg) {
          return {
            ...m,
            arena: cfg.arena || m.arena,
            pricing: cfg.pricing || m.pricing,
            contextLength: cfg.contextLength || m.contextLength,
          };
        }
        return m;
      });

      setModels(merged);
    } catch (err) {
      setError(err.message);
      setModels([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModels();
    const interval = setInterval(fetchModels, 15000);
    return () => clearInterval(interval);
  }, [fetchModels]);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleLoad = async (modelKey) => {
    setActionInProgress({ id: modelKey, type: "load" });
    try {
      await IrisService.loadLmStudioModel(modelKey);
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
      await IrisService.unloadLmStudioModel(instanceId);
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

  const llmModels = models
    .filter((m) => m.type === "llm")
    .map((m) => ({ ...m, provider: "lm-studio" }));
  const loadedCount = llmModels.filter(
    (m) => m.loaded_instances?.length > 0,
  ).length;

  const renderActions = (model) => {
    const isLoaded = model.loaded_instances?.length > 0;
    const instance = model.loaded_instances?.[0];
    const isActioning =
      actionInProgress &&
      (actionInProgress.id === model.key ||
        actionInProgress.id === instance?.id);
    const actionType = isActioning ? actionInProgress.type : null;

    if (isActioning) {
      return (
        <button
          className={`${styles.actionBtn} ${actionType === "unload" ? styles.unloadBtn : styles.loadingBtn}`}
          disabled
        >
          <Loader2 size={10} className={styles.spinning} />
          {actionType === "load" ? "Loading…" : "Unloading…"}
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
          handleLoad(model.key);
        }}
        title="Load model"
        disabled={!!actionInProgress}
      >
        <Power size={10} />
        Load
      </button>
    );
  };

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.titleRow}>
          <h1 className={styles.pageTitle}>
            <Server size={24} /> LM Studio
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
          Manage local models — {loadedCount} loaded, {llmModels.length}{" "}
          available
        </p>
      </div>

      {error && (
        <div className={styles.errorBanner}>
          <AlertCircle size={18} />
          <span>{error}</span>
          <span className={styles.errorHint}>
            Make sure LM Studio is running on localhost:1234
          </span>
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

      {loading && models.length === 0 ? (
        <div className={styles.loadingState}>
          <Loader2 size={24} className={styles.spinning} />
          <span>Connecting to LM Studio...</span>
        </div>
      ) : (
        <ModelGrid models={llmModels} renderActions={renderActions} />
      )}
    </div>
  );
}

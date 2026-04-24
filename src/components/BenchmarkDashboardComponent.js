"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, Bot, CheckCircle2, Coins, Cpu, Loader2, XCircle } from "lucide-react";
import PrismService from "../services/PrismService";
import ThreePanelLayout from "./ThreePanelLayout";
import SummaryBarComponent from "./SummaryBarComponent";
import ModelsTableComponent from "./ModelsTableComponent";
import EmptyStateComponent from "./EmptyStateComponent";
import ButtonComponent from "./ButtonComponent";
import { formatCost } from "../utils/utilities";
import styles from "./BenchmarkDashboardComponent.module.css";

/**
 * Build a Map<"provider:model", configModelObject> from the config.
 * Used to enrich benchmark stat rows with proper display_name, modalities,
 * model type, etc. that the stats endpoint doesn't carry.
 */
function buildConfigLookup(config) {
  if (!config) return new Map();
  const map = new Map();
  const MODEL_SECTIONS = [
    "textToText", "textToImage", "textToSpeech",
    "imageToText", "audioToText", "embedding",
  ];
  for (const section of MODEL_SECTIONS) {
    const providers = config[section]?.models || {};
    for (const [provider, models] of Object.entries(providers)) {
      for (const m of models) {
        const key = `${provider}:${m.name}`;
        if (!map.has(key)) {
          map.set(key, { ...m, provider });
        }
      }
    }
  }
  return map;
}

/**
 * Derive a clean display name from a raw model path/key when no
 * display_name exists in the config. Handles common patterns:
 *   "qwen/qwen3.5-9b"                      → "Qwen3.5 9B"
 *   "deepseek-r1-distill-qwen-32b@q4_1"    → "DeepSeek R1 Distill Qwen 32B"
 *   "mistralai/devstral-small-2507"         → "Devstral Small 2507"
 */
function humanizeModelPath(raw) {
  if (!raw) return raw;
  // Strip publisher/org prefix: "qwen/qwen3.5-9b" → "qwen3.5-9b"
  let name = raw.includes("/") ? raw.split("/").pop() : raw;
  // Strip @quant suffix: "qwen3-32b@q8_0" → "qwen3-32b"
  name = name.replace(/@[\w.]+$/, "");
  // Replace hyphens/underscores with spaces
  name = name.replace(/[-_]/g, " ");
  // Capitalize each word, preserving existing uppercase and numbers
  name = name.replace(/\b([a-z])/g, (_, c) => c.toUpperCase());
  // Uppercase common size suffixes: "32b" → "32B", "0.6b" → "0.6B"
  name = name.replace(/(\d+(?:\.\d+)?)\s*b\b/gi, (_, n) => `${n}B`);
  return name.trim();
}

const TABS = [
  { key: "all",    label: "All",    icon: null },
  { key: "models", label: "Models", icon: Cpu },
  { key: "agents", label: "Agents", icon: Bot },
];

export default function BenchmarkDashboardComponent({ navSidebar, rightSidebar }) {
  const router = useRouter();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedModel, setSelectedModel] = useState(null);
  const [configLookup, setConfigLookup] = useState(new Map());
  const [favoriteKeys, setFavoriteKeys] = useState([]);
  const [activeTab, setActiveTab] = useState("all");
  const hasLoadedRef = useRef(false);

  // ── Load stats + config + favorites ───────────────────────
  const loadData = useCallback(async () => {
    try {
      const [data, config] = await Promise.all([
        PrismService.getBenchmarkStats(),
        PrismService.getConfig().catch(() => null),
      ]);
      setStats(data);

      // Merge local models (LM Studio, Ollama, etc.) into config
      // so we get display_name for local models too
      let mergedConfig = config;
      if (config?.localProviders?.length > 0) {
        try {
          const localResult = await PrismService.getLocalConfig();
          mergedConfig = PrismService.mergeLocalModels(config, localResult?.models);
        } catch { /* local config unavailable, use base config */ }
      }

      setConfigLookup(buildConfigLookup(mergedConfig));
      hasLoadedRef.current = true;
    } catch (err) {
      console.error("Failed to load benchmark stats:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    PrismService.getFavorites("model")
      .then((favs) => setFavoriteKeys(favs.map((f) => f.key)))
      .catch(() => {});
  }, [loadData]);

  // ── Favorites ──────────────────────────────────────────────
  const handleToggleFavorite = useCallback(async (key) => {
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
  }, [favoriteKeys]);

  // ── Aggregate totals ──────────────────────────────────────
  const totals = useMemo(() => {
    if (!stats?.models) return null;
    return stats.models.reduce(
      (acc, m) => ({
        total: acc.total + m.total,
        passed: acc.passed + m.passed,
        failed: acc.failed + m.failed,
        errored: acc.errored + m.errored,
        cost: acc.cost + m.totalCost,
      }),
      { total: 0, passed: 0, failed: 0, errored: 0, cost: 0 },
    );
  }, [stats]);

  // ── Transform stat rows → ModelsTableComponent-compatible shape ──
  // Enriches each stat row with config data (display_name, modalities,
  // model type, etc.) so normalizeModel() produces clean names.
  const allModelRows = useMemo(() => {
    if (!stats?.models) return [];
    return stats.models.map((s) => {
      const configKey = `${s.provider}:${s.model}`;
      const configModel = configLookup.get(configKey);
      return {
        // Config fields first (provides display_name, modalities, tools, etc.)
        ...(configModel || {}),
        // Override with stat-specific identity fields
        name: s.model,
        key: s.model,
        provider: s.provider,
        // Use config display_name if available, otherwise humanize the raw path
        display_name: configModel?.display_name || humanizeModelPath(s.label || s.model),
        // Benchmark config flags (thinking / tools / agent)
        _benchThinkingEnabled: s.thinkingEnabled || false,
        _benchToolsEnabled: s.toolsEnabled || false,
        _benchAgent: s.agent || null,
        // Benchmark-specific data (read by benchmark columns via _raw)
        _benchTotal: s.total,
        _benchPassed: s.passed,
        _benchFailed: s.failed,
        _benchErrored: s.errored,
        _benchPassRate: s.passRate,
        _benchAvgLatency: s.avgLatency,
        _benchTotalCost: s.totalCost,
        // Preserve the original stat object for row click / sidebar
        _benchStat: s,
      };
    });
  }, [stats, configLookup]);

  // ── Tab filtering ──────────────────────────────────
  const modelRows = useMemo(() => {
    if (activeTab === "models") return allModelRows.filter((r) => !r._benchAgent);
    if (activeTab === "agents") return allModelRows.filter((r) => !!r._benchAgent);
    return allModelRows;
  }, [allModelRows, activeTab]);

  // ── Tab counts ─────────────────────────────────────
  const tabCounts = useMemo(() => ({
    all: allModelRows.length,
    models: allModelRows.filter((r) => !r._benchAgent).length,
    agents: allModelRows.filter((r) => !!r._benchAgent).length,
  }), [allModelRows]);

  // ── Composite stat identity (model + config flags) ─────────
  const statId = (s) =>
    `${s?.provider}:${s?.model}:${s?.thinkingEnabled || false}:${s?.toolsEnabled || false}:${s?.agent || ""}`;

  // ── Row click → select model for sidebar detail ───────────
  const handleRowClick = useCallback((stat) => {
    setSelectedModel((prev) =>
      statId(prev) === statId(stat) ? null : stat,
    );
  }, []);

  // ── Row class for selected highlight ──────────────────────
  const getRowClassName = useCallback(
    (stat) => {
      if (selectedModel && statId(stat) === statId(selectedModel)) {
        return styles.selectedRow;
      }
      return "";
    },
    [selectedModel],
  );

  // ── Detail cards for selected model (left sidebar) ────────
  const sidebarDetail = useMemo(() => {
    if (!selectedModel?.benchmarks?.length) return null;
    return (
      <div className={styles.sidebarDetailGrid}>
        {selectedModel.benchmarks.map((b, i) => {
          const bRate =
            b.total > 0 ? Math.round((b.passed / b.total) * 100) : 0;
          return (
            <div
              key={i}
              className={`${styles.detailCard} ${
                b.latestPassed
                  ? styles.detailCardPassed
                  : b.latestErrored
                    ? styles.detailCardErrored
                    : styles.detailCardFailed
              }`}
            >
              <div className={styles.detailHeader}>
                <div className={styles.detailName}>{b.name}</div>
                <span
                  className={`${styles.detailStatus} ${
                    b.latestPassed
                      ? styles.detailStatusPassed
                      : styles.detailStatusFailed
                  }`}
                >
                  {b.latestPassed
                    ? "✓ Latest"
                    : b.latestErrored
                      ? "⚠ Error"
                      : "✗ Latest"}
                </span>
              </div>
              <div className={styles.detailStats}>
                <span className={styles.detailRuns}>
                  {b.total} run{b.total !== 1 ? "s" : ""}
                </span>
                <span className={styles.detailPassed}>
                  <CheckCircle2 size={10} /> {b.passed}
                </span>
                <span className={styles.detailFailed}>
                  <XCircle size={10} /> {b.failed + b.errored}
                </span>
                <span
                  className={styles.detailRate}
                  style={{
                    color:
                      bRate >= 80
                        ? "var(--success)"
                        : bRate >= 50
                          ? "var(--warning)"
                          : "var(--danger)",
                  }}
                >
                  {bRate}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    );
  }, [selectedModel]);

  // ── Render ────────────────────────────────────────────────
  return (
    <ThreePanelLayout
      navSidebar={navSidebar}
      leftPanel={sidebarDetail}
      leftTitle={selectedModel?.model || ""}
      rightPanel={rightSidebar}
      rightTitle="Benchmarks"
      headerTitle="Benchmarks"
      headerControls={
        <ButtonComponent
          variant="primary"
          size="sm"
          onClick={() => router.push("/benchmarks/new")}
        >
          New Benchmark
        </ButtonComponent>
      }
    >
      <div className={styles.container}>
        {loading ? (
          <div className={styles.loadingState}>
            <Loader2 size={20} className={styles.spinIcon} />
            <span>Loading benchmark stats…</span>
          </div>
        ) : !stats || stats.models.length === 0 ? (
          <EmptyStateComponent
            icon={<BarChart3 size={36} />}
            title="No Benchmark Data Yet"
            subtitle="Run benchmarks against your models to see performance stats here."
          >
            <ButtonComponent
              variant="primary"
              size="sm"
              onClick={() => router.push("/benchmarks/new")}
            >
              Create Benchmark
            </ButtonComponent>
          </EmptyStateComponent>
        ) : (
          <>
            {/* ── Summary Bar (sticky) ───────────── */}
            <div className={styles.stickyBar}>
              <SummaryBarComponent
                items={[
                  { value: stats.totalModels, label: "Configs Tested" },
                  { value: stats.totalBenchmarks, label: "Benchmarks" },
                  { value: totals.total, label: "Total Tests" },
                  { value: totals.passed, label: "Passed", color: "var(--success)" },
                  { value: totals.failed + totals.errored, label: "Failed", color: "var(--danger)" },
                  {
                    bar: totals.total > 0 ? (totals.passed / totals.total) * 100 : 0,
                    barPassed: totals.passed,
                    barTotal: totals.total,
                    label: totals.total > 0 ? `${Math.round((totals.passed / totals.total) * 100)}%` : "—",
                  },
                  ...(totals.cost > 0
                    ? [{
                        value: formatCost(totals.cost),
                        label: "Total Cost",
                        color: "var(--success)",
                        icon: <Coins size={14} />,
                      }]
                    : []),
                ]}
              />
            </div>

            {/* ── Segmented Control (Models / Agents) ── */}
            <div className={styles.segmented}>
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.key;
                const count = tabCounts[tab.key];
                return (
                  <button
                    key={tab.key}
                    className={`${styles.segmentedBtn} ${isActive ? styles.segmentedBtnActive : ""}`}
                    onClick={() => setActiveTab(tab.key)}
                  >
                    {Icon && <Icon size={13} />}
                    {tab.label}
                    <span className={styles.segmentedCount}>{count}</span>
                  </button>
                );
              })}
            </div>

            {/* ── Performance Table ──────────── */}
            <ModelsTableComponent
              models={modelRows}
              mode="benchmark"
              onSelect={handleRowClick}
              showSearch={true}
              showProviderFilter={true}
              favorites={favoriteKeys}
              onToggleFavorite={handleToggleFavorite}
              getRowClassName={getRowClassName}
              emptyText={
                activeTab === "agents"
                  ? "No agent benchmark data yet"
                  : activeTab === "models"
                    ? "No model benchmark data yet"
                    : "No benchmark data"
              }
            />
          </>
        )}
      </div>
    </ThreePanelLayout>
  );
}

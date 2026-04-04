"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Play,
  Pencil,
  CheckCircle2,
  ChevronLeft,
  History,
  X,
  Check,
  DollarSign,
  Cpu,
  Coins,
  Loader2,
  XCircle,
  AlertCircle,
  Square,
} from "lucide-react";
import PrismService from "../services/PrismService";
import PageHeaderComponent from "./PageHeaderComponent";
import ButtonComponent from "./ButtonComponent";
import BadgeComponent from "./BadgeComponent";
import FormGroupComponent from "./FormGroupComponent";
import ModalOverlayComponent from "./ModalOverlayComponent";
import ModelPickerPopoverComponent from "./ModelPickerPopoverComponent";
import BenchmarksTableComponent from "./BenchmarksTableComponent";
import ProviderLogo, { PROVIDER_LABELS } from "./ProviderLogos";
import { formatContextTokens, formatCost } from "../utils/utilities";
import styles from "./BenchmarkPageComponent.module.css";

const MATCH_MODES = [
  { value: "contains", label: "Contains" },
  { value: "exact", label: "Exact" },
  { value: "startsWith", label: "Starts With" },
  { value: "regex", label: "Regex" },
];

/**
 * Flatten config into a flat array for deriving selectedModels and modelConfigMap.
 */
function flattenAllModels(config) {
  if (!config) return [];
  const seen = new Map();
  const sections = ["textToText", "textToImage", "audioToText", "textToSpeech"];
  for (const key of sections) {
    const modelsMap = config[key]?.models || {};
    for (const [provider, models] of Object.entries(modelsMap)) {
      for (const m of models) {
        const id = `${provider}:${m.name}`;
        if (!seen.has(id)) seen.set(id, { ...m, provider });
      }
    }
  }
  return [...seen.values()];
}

export default function BenchmarkDetailPageComponent({ benchmarkId, onRunningChange }) {
  const router = useRouter();
  // ── State ──────────────────────────────────────────────────
  const [benchmark, setBenchmark] = useState(null);
  const [loading, setLoading] = useState(true);
  const [latestRun, setLatestRun] = useState(null);
  const [runHistory, setRunHistory] = useState([]);
  const [activeRunId, setActiveRunId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    name: "",
    prompt: "",
    systemPrompt: "",
    expectedValue: "",
    matchMode: "contains",
    temperature: 0,
    maxTokens: 256,
    tags: "",
  });
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);

  // Propagate running state to parent for sidebar animation
  useEffect(() => {
    onRunningChange?.(running);
  }, [running, onRunningChange]);

  // Model selection
  const [prismConfig, setPrismConfig] = useState(null);
  const [selectedModelKeys, setSelectedModelKeys] = useState(new Set());

  // Streaming progress
  const [streamingResults, setStreamingResults] = useState([]);
  const [activeModel, setActiveModel] = useState(null);
  const [activeProgress, setActiveProgress] = useState(0);
  const [activePhase, setActivePhase] = useState("");
  const abortRef = useRef(null);
  const progressRef = useRef(null);

  // Cleanup progress interval on unmount
  useEffect(() => {
    return () => {
      if (progressRef.current) clearInterval(progressRef.current);
    };
  }, []);

  // ── Load benchmark detail ──────────────────────────────────
  const loadBenchmark = useCallback(async () => {
    setLoading(true);
    try {
      const detail = await PrismService.getBenchmark(benchmarkId);
      setBenchmark(detail);
      if (detail.latestRun) {
        setLatestRun(detail.latestRun);
        setActiveRunId(detail.latestRun.id);
      }
    } catch (err) {
      console.error("Failed to load benchmark detail:", err);
    } finally {
      setLoading(false);
    }

    try {
      const { runs } = await PrismService.getBenchmarkRuns(benchmarkId);
      setRunHistory(runs || []);
    } catch (err) {
      console.error("Failed to load run history:", err);
    }
  }, [benchmarkId]);

  useEffect(() => {
    loadBenchmark();
  }, [loadBenchmark]);

  // ── Load Prism config (drives model picker + size column) ──
  useEffect(() => {
    (async () => {
      try {
        const config = await PrismService.getConfig();
        setPrismConfig(config);

        if (config?.localProviders?.length > 0) {
          PrismService.getLocalConfig()
            .then(({ models: localModels }) => {
              setPrismConfig((prev) =>
                PrismService.mergeLocalModels(prev, localModels),
              );
            })
            .catch(() => {});
        }
      } catch (err) {
        console.error("Failed to load config:", err);
      }
    })();
  }, []);

  // All models flattened (for selected model derivation + size lookup)
  const allModels = useMemo(
    () => flattenAllModels(prismConfig),
    [prismConfig],
  );

  // ── Selected model objects (derived) ───────────────────────
  const selectedModels = useMemo(
    () =>
      allModels.filter((m) =>
        selectedModelKeys.has(`${m.provider}:${m.name}`),
      ),
    [allModels, selectedModelKeys],
  );

  // Build provider:name → config lookup for size column
  const modelConfigMap = useMemo(() => {
    const map = {};
    for (const m of allModels) {
      map[`${m.provider}:${m.name}`] = m;
    }
    return map;
  }, [allModels]);

  // ── Edit ───────────────────────────────────────────────────
  const openEdit = useCallback(() => {
    if (!benchmark) return;
    setForm({
      name: benchmark.name,
      prompt: benchmark.prompt,
      systemPrompt: benchmark.systemPrompt || "",
      expectedValue: benchmark.expectedValue,
      matchMode: benchmark.matchMode || "contains",
      temperature: benchmark.temperature ?? 0,
      maxTokens: benchmark.maxTokens ?? 256,
      tags: (benchmark.tags || []).join(", "),
    });
    setShowModal(true);
  }, [benchmark]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        temperature: parseFloat(form.temperature) || 0,
        maxTokens: parseInt(form.maxTokens, 10) || 256,
        tags: form.tags
          ? form.tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
          : [],
      };

      await PrismService.updateBenchmark(benchmarkId, payload);
      setShowModal(false);
      await loadBenchmark();
    } catch (err) {
      console.error("Failed to save benchmark:", err);
    } finally {
      setSaving(false);
    }
  }, [form, benchmarkId, loadBenchmark]);

  // ── Run benchmark ──────────────────────────────────────────
  const handleRun = useCallback(async () => {
    if (!benchmark) return;
    setRunning(true);
    setStreamingResults([]);
    setActiveModel(null);
    setLatestRun(null);

    const models =
      selectedModels.length > 0
        ? selectedModels.map((m) => ({ provider: m.provider, model: m.name }))
        : undefined;

    abortRef.current = PrismService.streamBenchmarkRun(benchmarkId, models, {
      onModelStart: (data) => {
        setActiveModel(data);
        setActiveProgress(0);
        setActivePhase(data.isLocal ? "Loading model" : "Connecting");

        // Clear any previous interval
        if (progressRef.current) clearInterval(progressRef.current);

        const startTime = Date.now();
        const isLocal = !!data.isLocal;

        // Local: 3-phase (load 0–30%, process 30–60%, generate 60–95%)
        //   Phase 1: ~5s expected load time → fills to 30%
        //   Phase 2: ~2s expected TTFT  → fills 30–60%
        //   Phase 3: ~8s expected gen   → fills 60–95%
        // Cloud: 2-phase (process 0–40%, generate 40–95%)
        //   Phase 1: ~3s expected TTFT  → fills to 40%
        //   Phase 2: ~5s expected gen   → fills 40–95%
        const phases = isLocal
          ? [
              { end: 0.30, duration: 5000,  label: "Loading model" },
              { end: 0.60, duration: 2000,  label: "Processing prompt" },
              { end: 0.95, duration: 8000,  label: "Generating" },
            ]
          : [
              { end: 0.40, duration: 3000,  label: "Processing" },
              { end: 0.95, duration: 5000,  label: "Generating" },
            ];

        let phaseIndex = 0;
        let phaseStart = startTime;

        progressRef.current = setInterval(() => {
          const now = Date.now();
          const phase = phases[phaseIndex];
          const prevEnd = phaseIndex > 0 ? phases[phaseIndex - 1].end : 0;
          const phaseRange = phase.end - prevEnd;
          const elapsed = now - phaseStart;
          // Asymptotic: elapsed / (elapsed + expected) → approaches 1
          const phaseProgress = elapsed / (elapsed + phase.duration);
          const totalProgress = prevEnd + phaseRange * phaseProgress;

          setActiveProgress(totalProgress);
          setActivePhase(phase.label);

          // Advance to next phase when we're >90% through current
          if (phaseProgress > 0.9 && phaseIndex < phases.length - 1) {
            phaseIndex++;
            phaseStart = now;
          }
        }, 60);
      },
      onModelComplete: (result) => {
        if (progressRef.current) {
          clearInterval(progressRef.current);
          progressRef.current = null;
        }
        setActiveProgress(0);
        setActivePhase("");
        setStreamingResults((prev) => [...prev, result]);
        setActiveModel(null);
      },
      onRunComplete: async (run) => {
        if (progressRef.current) {
          clearInterval(progressRef.current);
          progressRef.current = null;
        }
        setActiveProgress(0);
        setActivePhase("");
        setLatestRun(run);
        setActiveRunId(run.id);
        setRunning(false);
        setStreamingResults([]);
        setActiveModel(null);
        abortRef.current = null;

        try {
          const { runs } = await PrismService.getBenchmarkRuns(benchmarkId);
          setRunHistory(runs || []);
        } catch { /* noop */ }
      },
      onError: (err) => {
        // AbortError means user clicked Stop — handleStop already handled cleanup
        if (err?.name === "AbortError" || err?.message?.includes("abort")) {
          return;
        }
        if (progressRef.current) {
          clearInterval(progressRef.current);
          progressRef.current = null;
        }
        setActiveProgress(0);
        setActivePhase("");
        console.error("Benchmark run error:", err);
        setRunning(false);
        setActiveModel(null);
        abortRef.current = null;
      },
    });
  }, [benchmark, selectedModels, benchmarkId]);

  // ── Stop benchmark ─────────────────────────────────────────
  const handleStop = useCallback(async () => {
    // Abort the SSE fetch connection
    if (abortRef.current) {
      abortRef.current();
      abortRef.current = null;
    }

    // Clean up progress state
    if (progressRef.current) {
      clearInterval(progressRef.current);
      progressRef.current = null;
    }
    setActiveProgress(0);
    setActivePhase("");
    setRunning(false);
    setActiveModel(null);

    // Synthesize a partial run from whatever streaming results we have
    if (streamingResults.length > 0) {
      const passed = streamingResults.filter((r) => r.passed).length;
      const failed = streamingResults.filter((r) => !r.passed && !r.error).length;
      const errored = streamingResults.filter((r) => r.error).length;
      const totalCost = streamingResults.reduce((s, r) => s + (r.estimatedCost || 0), 0);
      setLatestRun({
        id: "partial-" + Date.now(),
        aborted: true,
        models: streamingResults,
        completedAt: new Date().toISOString(),
        summary: { total: streamingResults.length, passed, failed, errored, totalCost },
      });
      setStreamingResults([]);
    }

    // Refresh run history (server persists partial runs)
    try {
      const { runs } = await PrismService.getBenchmarkRuns(benchmarkId);
      setRunHistory(runs || []);
    } catch { /* noop */ }
  }, [streamingResults, benchmarkId]);

  // ── View a past run ────────────────────────────────────────
  const viewRun = useCallback((run) => {
    setLatestRun(run);
    setActiveRunId(run.id);
  }, []);

  // ── Toggle model in selection ──────────────────────────────
  const handleModelSelect = useCallback((rawModel) => {
    const key = `${rawModel.provider}:${rawModel.name}`;
    setSelectedModelKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const removeModel = useCallback((key) => {
    setSelectedModelKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const clearModelSelection = useCallback(() => {
    setSelectedModelKeys(new Set());
  }, []);

  // ── Selected model card ────────────────────────────────────
  function SelectedModelCard({ model }) {
    const key = `${model.provider}:${model.name}`;
    const label = model.display_name || model.label || model.name;
    const ctx = model.contextLength || model.max_context_length;
    const hasInput = model.pricing?.inputPerMillion != null;
    const hasOutput = model.pricing?.outputPerMillion != null;

    return (
      <div className={styles.selectedCard}>
        <div className={styles.selectedCardHeader}>
          <ProviderLogo provider={model.provider} size={16} />
          <span className={styles.selectedCardName}>{label}</span>
          <button
            className={styles.selectedCardRemove}
            onClick={() => removeModel(key)}
            title="Remove"
          >
            <X size={12} />
          </button>
        </div>
        <div className={styles.selectedCardMeta}>
          <span className={styles.selectedCardProvider}>
            {PROVIDER_LABELS[model.provider] || model.provider}
          </span>
          {ctx && (
            <span className={styles.selectedCardStat}>
              <Cpu size={10} />
              {formatContextTokens(ctx)}
            </span>
          )}
          {hasInput && (
            <span className={styles.selectedCardStat}>
              <DollarSign size={10} />
              ${model.pricing.inputPerMillion}/{hasOutput ? model.pricing.outputPerMillion : "—"}
            </span>
          )}
          {model.tools?.length > 0 && (
            <span className={styles.selectedCardStat}>
              {model.tools.length} tools
            </span>
          )}
        </div>
      </div>
    );
  }

  // ── Loading state ──────────────────────────────────────────
  if (loading) {
    return (
      <div className={styles.container}>
        <PageHeaderComponent
          title="Benchmarks"
          subtitle="Loading…"
          backHref="/benchmarks"
        />
        <div className={styles.content}>
          <div className={styles.runProgress}>
            <div className={styles.progressSpinner} />
            <div className={styles.progressText}>Loading benchmark…</div>
          </div>
        </div>
      </div>
    );
  }

  if (!benchmark) {
    return (
      <div className={styles.container}>
        <PageHeaderComponent
          title="Benchmarks"
          subtitle="Not found"
          backHref="/benchmarks"
        />
        <div className={styles.content}>
          <div className={styles.runProgress}>
            <div className={styles.progressText}>Benchmark not found.</div>
          </div>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className={styles.container}>
      <PageHeaderComponent
        title="Benchmarks"
        subtitle={benchmark.name}
        backHref="/benchmarks"
      >
        <ButtonComponent
          variant="ghost"
          size="sm"
          icon={ChevronLeft}
          onClick={() => router.push("/benchmarks")}
        >
          Back
        </ButtonComponent>
      </PageHeaderComponent>

      <div className={styles.content}>
        <div className={styles.detailPanel}>
          {/* ── Benchmark Info ── */}
          <div className={styles.detailHeader}>
            <div className={styles.detailTitle}>
              {benchmark.name}
            </div>
            <div className={styles.detailMeta}>
              <BadgeComponent variant="accent">
                {benchmark.matchMode || "contains"}
              </BadgeComponent>
              <span className={styles.expectedValue}>
                Expected: {benchmark.expectedValue}
              </span>
              {benchmark.tags?.map((tag) => (
                <span key={tag} className={styles.tag}>
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div className={styles.detailPrompt}>
            {benchmark.prompt}
          </div>

          {/* ── Actions ── */}
          <div className={styles.detailActions}>
            <ButtonComponent
              variant="primary"
              size="sm"
              icon={Play}
              onClick={handleRun}
              loading={running}
              disabled={running}
            >
              {selectedModels.length > 0
                ? `Run (${selectedModels.length} models)`
                : "Run All Models"}
            </ButtonComponent>
            <ModelPickerPopoverComponent
              config={prismConfig}
              multiSelect
              selectedKeys={selectedModelKeys}
              onSelectModel={handleModelSelect}
              renderActions={(rawModel) => {
                const key = `${rawModel.provider}:${rawModel.name}`;
                const isSelected = selectedModelKeys.has(key);
                return (
                  <button
                    className={`${styles.selectBtn} ${isSelected ? styles.selectBtnActive : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleModelSelect(rawModel);
                    }}
                  >
                    {isSelected ? (
                      <>
                        <CheckCircle2 size={12} /> Selected
                      </>
                    ) : (
                      <>
                        <Plus size={12} /> Select
                      </>
                    )}
                  </button>
                );
              }}
            />
            {selectedModels.length > 0 && (
              <ButtonComponent
                variant="ghost"
                size="xs"
                onClick={clearModelSelection}
              >
                Clear Selection
              </ButtonComponent>
            )}
            <ButtonComponent
              variant="ghost"
              size="sm"
              icon={Pencil}
              onClick={openEdit}
            >
              Edit
            </ButtonComponent>
          </div>

          {/* ── Selected Model Cards ── */}
          {selectedModels.length > 0 && (
            <div className={styles.selectedModelsSection}>
              <div className={styles.selectedModelsLabel}>
                <Check size={14} />
                {selectedModels.length} model{selectedModels.length !== 1 ? "s" : ""} selected
              </div>
              <div className={styles.selectedModelsGrid}>
                {selectedModels.map((m) => (
                  <SelectedModelCard
                    key={`${m.provider}:${m.name}`}
                    model={m}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── Running Progress ── */}
          {running && (() => {
            const totalExpected = selectedModels.length > 0 ? selectedModels.length : allModels.length;
            const completed = streamingResults.length;
            const passed = streamingResults.filter((r) => r.passed).length;
            const failed = streamingResults.filter((r) => !r.passed && !r.error).length;
            const errored = streamingResults.filter((r) => r.error).length;
            const runningCount = activeModel ? 1 : 0;
            const totalCost = streamingResults.reduce((s, r) => s + (r.estimatedCost || 0), 0);
            const passRate = completed > 0 ? (passed / completed) * 100 : 0;

            return (
            <div className={styles.runProgress}>
              <div className={styles.progressHeader}>
                <div className={styles.progressSpinner} />
                <div className={styles.progressText}>
                  Running benchmark against{" "}
                  {selectedModels.length > 0
                    ? `${selectedModels.length} models`
                    : "all models"}
                  …
                  {completed > 0 && (
                    <span className={styles.progressCount}>
                      {" "}— {completed} completed
                    </span>
                  )}
                </div>
                <ButtonComponent
                  variant="danger"
                  size="xs"
                  icon={Square}
                  onClick={handleStop}
                  className={styles.stopBtn}
                >
                  Stop
                </ButtonComponent>
              </div>

              {/* ── Live Summary Bar ── */}
              <div className={`${styles.summaryBar} ${styles.summaryBarLive}`}>
                <div className={styles.summaryItem}>
                  <span
                    className={styles.summaryValue}
                    style={{ color: "var(--text-primary)" }}
                  >
                    {completed}/{totalExpected}
                  </span>
                  <span className={styles.summaryLabel}>Completed</span>
                </div>
                <div className={styles.summaryDivider} />
                {runningCount > 0 && (
                  <>
                    <div className={styles.summaryItem}>
                      <Loader2 size={14} className={styles.spinIcon} style={{ color: "var(--accent-color)" }} />
                      <span
                        className={styles.summaryValue}
                        style={{ color: "var(--accent-color)" }}
                      >
                        {runningCount}
                      </span>
                      <span className={styles.summaryLabel}>Running</span>
                    </div>
                    <div className={styles.summaryDivider} />
                  </>
                )}
                <div className={styles.summaryItem}>
                  <span
                    className={styles.summaryValue}
                    style={{ color: "var(--success)" }}
                  >
                    {passed}
                  </span>
                  <span className={styles.summaryLabel}>Passed</span>
                </div>
                <div className={styles.summaryDivider} />
                <div className={styles.summaryItem}>
                  <span
                    className={styles.summaryValue}
                    style={{ color: "var(--danger)" }}
                  >
                    {failed}
                  </span>
                  <span className={styles.summaryLabel}>Failed</span>
                </div>
                {errored > 0 && (
                  <>
                    <div className={styles.summaryDivider} />
                    <div className={styles.summaryItem}>
                      <span
                        className={styles.summaryValue}
                        style={{ color: "var(--warning)" }}
                      >
                        {errored}
                      </span>
                      <span className={styles.summaryLabel}>Errors</span>
                    </div>
                  </>
                )}
                <div className={styles.summaryDivider} />
                <div className={styles.summaryItem}>
                  <div className={styles.passBar}>
                    <div
                      className={styles.passBarFill}
                      style={{ width: `${passRate}%` }}
                    />
                  </div>
                  <span className={styles.summaryLabel}>
                    {completed > 0 ? `${Math.round(passRate)}%` : "—"}
                  </span>
                </div>
                {totalCost > 0 && (
                  <>
                    <div className={styles.summaryDivider} />
                    <div className={styles.summaryItem}>
                      <Coins size={14} className={styles.costIcon} />
                      <span
                        className={styles.summaryValue}
                        style={{ color: "var(--success)" }}
                      >
                        {formatCost(totalCost)}
                      </span>
                      <span className={styles.summaryLabel}>Cost</span>
                    </div>
                  </>
                )}
              </div>

              {/* Live model feed */}
              <div className={styles.streamingFeed}>
                {streamingResults.map((r, i) => (
                  <div
                    key={`${r.provider}:${r.model}:${i}`}
                    className={`${styles.streamingItem} ${r.passed ? styles.streamingPassed : styles.streamingFailed}`}
                  >
                    <span className={styles.streamingIcon}>
                      {r.error ? (
                        <AlertCircle size={13} />
                      ) : r.passed ? (
                        <CheckCircle2 size={13} />
                      ) : (
                        <XCircle size={13} />
                      )}
                    </span>
                    <ProviderLogo provider={r.provider} size={14} />
                    <span className={styles.streamingLabel}>
                      {r.label || r.model}
                    </span>
                    <span className={styles.streamingLatency}>
                      {r.latency?.toFixed(1)}s
                    </span>
                    {r.estimatedCost > 0 && (
                      <span className={styles.streamingCost}>
                        {formatCost(r.estimatedCost)}
                      </span>
                    )}
                    {r.error && (
                      <span className={styles.streamingError}>
                        {r.error.slice(0, 60)}
                      </span>
                    )}
                  </div>
                ))}

                {/* Currently running model */}
                {activeModel && (
                  <div className={`${styles.streamingItem} ${styles.streamingActive}`}>
                    <div
                      className={styles.streamingProgressBar}
                      style={{ width: `${activeProgress * 100}%` }}
                    />
                    <span className={styles.streamingIcon}>
                      <Loader2 size={13} className={styles.spinIcon} />
                    </span>
                    <ProviderLogo provider={activeModel.provider} size={14} />
                    <span className={styles.streamingLabel}>
                      {activeModel.label || activeModel.model}
                    </span>
                    <span className={styles.streamingPhase}>
                      {activePhase}
                    </span>
                    <span className={styles.streamingPct}>
                      {Math.round(activeProgress * 100)}%
                    </span>
                  </div>
                )}
              </div>

              {/* Progressive results table */}
              {streamingResults.length > 0 && (
                <div className={styles.streamingTableWrapper}>
                  <BenchmarksTableComponent
                    results={streamingResults}
                    expectedValue={benchmark.expectedValue}
                    modelConfigMap={modelConfigMap}
                    mini
                  />
                </div>
              )}
            </div>
            );
          })()}

          {/* ── Results ── */}
          {latestRun && !running && (
            <div className={styles.resultsSection}>
              <div className={styles.resultsSectionHeader}>
                <div className={styles.resultsSectionTitle}>
                  Results
                  {latestRun.aborted && (
                    <BadgeComponent variant="warning" style={{ marginLeft: 8 }}>
                      Stopped
                    </BadgeComponent>
                  )}
                </div>
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--text-tertiary)",
                  }}
                >
                  {new Date(latestRun.completedAt).toLocaleString()}
                </span>
              </div>

              {/* Summary Bar */}
              <div className={styles.summaryBar}>
                <div className={styles.summaryItem}>
                  <span
                    className={styles.summaryValue}
                    style={{ color: "var(--text-primary)" }}
                  >
                    {latestRun.summary.total}
                  </span>
                  <span className={styles.summaryLabel}>Total</span>
                </div>
                <div className={styles.summaryDivider} />
                <div className={styles.summaryItem}>
                  <span
                    className={styles.summaryValue}
                    style={{ color: "var(--success)" }}
                  >
                    {latestRun.summary.passed}
                  </span>
                  <span className={styles.summaryLabel}>Passed</span>
                </div>
                <div className={styles.summaryDivider} />
                <div className={styles.summaryItem}>
                  <span
                    className={styles.summaryValue}
                    style={{ color: "var(--danger)" }}
                  >
                    {latestRun.summary.failed}
                  </span>
                  <span className={styles.summaryLabel}>Failed</span>
                </div>
                {latestRun.summary.errored > 0 && (
                  <>
                    <div className={styles.summaryDivider} />
                    <div className={styles.summaryItem}>
                      <span
                        className={styles.summaryValue}
                        style={{ color: "var(--warning)" }}
                      >
                        {latestRun.summary.errored}
                      </span>
                      <span className={styles.summaryLabel}>Errors</span>
                    </div>
                  </>
                )}
                <div className={styles.summaryDivider} />
                <div className={styles.summaryItem}>
                  <div className={styles.passBar}>
                    <div
                      className={styles.passBarFill}
                      style={{
                        width: `${(latestRun.summary.passed / latestRun.summary.total) * 100}%`,
                      }}
                    />
                  </div>
                  <span className={styles.summaryLabel}>
                    {Math.round(
                      (latestRun.summary.passed / latestRun.summary.total) *
                        100,
                    )}
                    %
                  </span>
                </div>
                {(latestRun.summary.totalCost > 0 || latestRun.models?.some(r => r.estimatedCost > 0)) && (
                  <>
                    <div className={styles.summaryDivider} />
                    <div className={styles.summaryItem}>
                      <Coins size={14} className={styles.costIcon} />
                      <span
                        className={styles.summaryValue}
                        style={{ color: "var(--success)" }}
                      >
                        {formatCost(
                          latestRun.summary.totalCost ??
                          latestRun.models.reduce((s, r) => s + (r.estimatedCost || 0), 0)
                        )}
                      </span>
                      <span className={styles.summaryLabel}>Cost</span>
                    </div>
                  </>
                )}
              </div>

              {/* Results Table */}
              <BenchmarksTableComponent results={latestRun.models} expectedValue={benchmark.expectedValue} modelConfigMap={modelConfigMap} />
            </div>
          )}

          {/* ── Run History ── */}
          {runHistory.length > 0 && (
            <div className={styles.resultsSection}>
              <div className={styles.resultsSectionTitle}>
                <History size={14} style={{ marginRight: 6 }} />
                Run History ({runHistory.length})
              </div>
              <div className={styles.runHistoryList}>
                {runHistory.map((run) => (
                  <div
                    key={run.id}
                    className={`${styles.runHistoryItem} ${activeRunId === run.id ? styles.activeRun : ""}`}
                    onClick={() => viewRun(run)}
                  >
                    <div className={styles.runHistoryMeta}>
                      <span className={styles.runHistoryDate}>
                        {new Date(run.completedAt).toLocaleString()}
                      </span>
                    </div>
                    <div className={styles.runHistoryStats}>
                      <span className={styles.passCount}>
                        {run.summary.passed} ✓
                      </span>
                      <span className={styles.failCount}>
                        {run.summary.failed + (run.summary.errored || 0)} ✗
                      </span>
                      {(run.summary.totalCost > 0 || run.models?.some(r => r.estimatedCost > 0)) && (
                        <span className={styles.runCost}>
                          <Coins size={10} />
                          {formatCost(
                            run.summary.totalCost ??
                            run.models.reduce((s, r) => s + (r.estimatedCost || 0), 0)
                          )}
                        </span>
                      )}
                      <div className={styles.passBar}>
                        <div
                          className={styles.passBarFill}
                          style={{
                            width: `${(run.summary.passed / run.summary.total) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Edit Modal ── */}
      {showModal && (
        <ModalOverlayComponent onClose={() => setShowModal(false)} portal>
          <div className={styles.modalPanel}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>Edit Benchmark</span>
              <button
                className={styles.cardActionBtn}
                onClick={() => setShowModal(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div className={styles.modalBody}>
              <FormGroupComponent label="Name">
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="e.g. Capital of France"
                />
              </FormGroupComponent>

              <FormGroupComponent label="Prompt">
                <textarea
                  value={form.prompt}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, prompt: e.target.value }))
                  }
                  placeholder="What is the capital of France? Reply with just the city name."
                  rows={3}
                />
              </FormGroupComponent>

              <FormGroupComponent label="System Prompt (optional)">
                <textarea
                  value={form.systemPrompt}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, systemPrompt: e.target.value }))
                  }
                  placeholder="You are a geography expert. Answer concisely."
                  rows={2}
                />
              </FormGroupComponent>

              <div className={styles.formRow}>
                <FormGroupComponent label="Expected Value">
                  <input
                    type="text"
                    value={form.expectedValue}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        expectedValue: e.target.value,
                      }))
                    }
                    placeholder="Paris"
                  />
                </FormGroupComponent>

                <FormGroupComponent label="Match Mode">
                  <select
                    value={form.matchMode}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, matchMode: e.target.value }))
                    }
                  >
                    {MATCH_MODES.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </FormGroupComponent>
              </div>

              <div className={styles.formRow}>
                <FormGroupComponent label="Temperature">
                  <input
                    type="number"
                    value={form.temperature}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        temperature: e.target.value,
                      }))
                    }
                    min={0}
                    max={2}
                    step={0.1}
                  />
                </FormGroupComponent>

                <FormGroupComponent label="Max Tokens">
                  <input
                    type="number"
                    value={form.maxTokens}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        maxTokens: e.target.value,
                      }))
                    }
                    min={1}
                    max={4096}
                  />
                </FormGroupComponent>
              </div>

              <FormGroupComponent label="Tags (comma-separated)">
                <input
                  type="text"
                  value={form.tags}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, tags: e.target.value }))
                  }
                  placeholder="geography, factual"
                />
              </FormGroupComponent>
            </div>

            <div className={styles.modalFooter}>
              <ButtonComponent
                variant="secondary"
                size="sm"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </ButtonComponent>
              <ButtonComponent
                variant="primary"
                size="sm"
                onClick={handleSave}
                loading={saving}
                disabled={!form.name || !form.prompt || !form.expectedValue}
              >
                Save Changes
              </ButtonComponent>
            </div>
          </div>
        </ModalOverlayComponent>
      )}
    </div>
  );
}

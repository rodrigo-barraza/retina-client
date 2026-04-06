"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Play,
  Copy,
  CheckCircle2,
  Coins,
  Loader2,
  XCircle,
  AlertCircle,
  Square,
  Trash2,
} from "lucide-react";
import PrismService from "../services/PrismService";
import ThreePanelLayout from "./ThreePanelLayout";
import RunHistorySidebarComponent from "./RunHistorySidebarComponent";
import ButtonComponent from "./ButtonComponent";
import BadgeComponent from "./BadgeComponent";
import ModalDialogComponent from "./ModalDialogComponent";
import BenchmarkFormComponent from "./BenchmarkFormComponent";
import SummaryBarComponent from "./SummaryBarComponent";
import ModelPickerPopoverComponent from "./ModelPickerPopoverComponent";
import BenchmarksTableComponent from "./BenchmarksTableComponent";
import ChatPreviewComponent from "./ChatPreviewComponent";
import ProviderLogo from "./ProviderLogos";
import { formatCost } from "../utils/utilities";
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

export default function BenchmarkDetailPageComponent({ benchmarkId, onRunningChange, navSidebar, rightSidebar }) {
  const router = useRouter();
  // ── State ──────────────────────────────────────────────────
  const [benchmark, setBenchmark] = useState(null);
  const [loading, setLoading] = useState(true);
  const [latestRun, setLatestRun] = useState(null);
  const [runHistory, setRunHistory] = useState([]);
  const [activeRunId, setActiveRunId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    prompt: "",
    systemPrompt: "",
    assertions: [{ expectedValue: "", matchMode: "contains" }],
    assertionOperator: "AND",
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

  // Selected result (for chat preview)
  const [selectedResult, setSelectedResult] = useState(null);

  // Compute the active row key for table highlight
  const getActiveKey = useCallback((results) => {
    if (!selectedResult) return undefined;
    const idx = results.indexOf(selectedResult);
    if (idx === -1) return undefined;
    return `${selectedResult.provider}:${selectedResult.label}:${idx}`;
  }, [selectedResult]);

  // Streaming progress
  const [streamingResults, setStreamingResults] = useState([]);
  const [streamingTotal, setStreamingTotal] = useState(0);
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

  // ── Reconnect to an in-progress run on mount ──────────────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const status = await PrismService.getBenchmarkActive(benchmarkId);
        if (cancelled || !status?.active) return;

        // Don't pre-populate streamingResults or activeModel here —
        // the follow SSE replays all completed results and sends the
        // active model_start event, keeping a single source of truth.
        setRunning(true);
        setLatestRun(null);

        // Connect to the follow SSE for live updates
        abortRef.current = PrismService.followBenchmarkRun(benchmarkId, {
          onRunInfo: (data) => {
            setStreamingTotal(data.totalModels || 0);
          },
          onModelStart: (data) => {
            setActiveModel(data);
            setActiveProgress(0);
            setActivePhase(data.isLocal ? "Loading model" : "Connecting");

            if (progressRef.current) clearInterval(progressRef.current);

            const startTime = Date.now();
            const isLocal = !!data.isLocal;
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
              const phaseProgress = elapsed / (elapsed + phase.duration);
              const totalProgress = prevEnd + phaseRange * phaseProgress;

              setActiveProgress(totalProgress);
              setActivePhase(phase.label);

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
            setStreamingTotal(0);
            abortRef.current = null;

            try {
              const { runs } = await PrismService.getBenchmarkRuns(benchmarkId);
              setRunHistory(runs || []);
            } catch { /* noop */ }
          },
          onError: (err) => {
            if (err?.name === "AbortError" || err?.message?.includes("abort")) return;
            if (progressRef.current) {
              clearInterval(progressRef.current);
              progressRef.current = null;
            }
            setActiveProgress(0);
            setActivePhase("");
            setRunning(false);
            setActiveModel(null);
            abortRef.current = null;
          },
        });
      } catch {
        // No active run or server unreachable — ignore
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [benchmarkId]);

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

  // ── Clone ──────────────────────────────────────────────────
  const openClone = useCallback(() => {
    if (!benchmark) return;
    const assertions = benchmark.assertions?.length > 0
      ? benchmark.assertions
      : [{ expectedValue: benchmark.expectedValue || "", matchMode: benchmark.matchMode || "contains" }];
    setForm({
      name: `${benchmark.name} (copy)`,
      prompt: benchmark.prompt,
      systemPrompt: benchmark.systemPrompt || "",
      assertions,
      assertionOperator: benchmark.assertionOperator || "AND",
    });
    setShowModal(true);
  }, [benchmark]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const { assertions, assertionOperator, ...rest } = form;
      const payload = {
        ...rest,
        expectedValue: assertions[0]?.expectedValue || "",
        matchMode: assertions[0]?.matchMode || "contains",
        assertions,
        assertionOperator,
      };
      const created = await PrismService.createBenchmark(payload);
      setShowModal(false);
      if (created?.id) {
        router.push(`/benchmarks/${created.id}`);
      }
    } catch (err) {
      console.error("Failed to clone benchmark:", err);
    } finally {
      setSaving(false);
    }
  }, [form, router]);

  // ── Run benchmark ──────────────────────────────────────────
  const handleRun = useCallback(async () => {
    if (!benchmark) return;
    setRunning(true);
    setStreamingResults([]);
    setActiveModel(null);
    setLatestRun(null);

    if (selectedModels.length === 0) return;
    const models = selectedModels.map((m) => ({ provider: m.provider, model: m.name, display_name: m.display_name || m.label || m.name }));

    abortRef.current = PrismService.streamBenchmarkRun(benchmarkId, models, {
      onRunInfo: (data) => {
        setStreamingTotal(data.totalModels || 0);
      },
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
        setStreamingTotal(0);
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
    // 1. Explicitly tell the server to abort (reliable — dedicated HTTP POST)
    try {
      await PrismService.abortBenchmarkRun(benchmarkId);
    } catch { /* server might already be done */ }

    // 2. Also abort the client-side SSE fetch connection (secondary cleanup)
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
    setStreamingTotal(0);

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
    setSelectedResult(null);
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

  // ── Delete benchmark ──────────────────────────────────────
  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      await PrismService.deleteBenchmark(benchmarkId);
      router.push("/benchmarks");
    } catch (err) {
      console.error("Failed to delete benchmark:", err);
      setDeleting(false);
    }
  }, [benchmarkId, router]);



  // ── Loading state ──────────────────────────────────────────
  if (loading) {
    return (
      <ThreePanelLayout
        navSidebar={navSidebar}
        leftPanel={null}
        leftTitle="Run History"
        rightPanel={rightSidebar}
        rightTitle="Benchmarks"
        headerTitle="Loading…"
      >
        <div className={styles.contentMain}>
          <div className={styles.runProgress}>
            <div className={styles.progressSpinner} />
            <div className={styles.progressText}>Loading benchmark…</div>
          </div>
        </div>
      </ThreePanelLayout>
    );
  }

  if (!benchmark) {
    return (
      <ThreePanelLayout
        navSidebar={navSidebar}
        leftPanel={null}
        leftTitle="Run History"
        rightPanel={rightSidebar}
        rightTitle="Benchmarks"
        headerTitle="Not found"
      >
        <div className={styles.contentMain}>
          <div className={styles.runProgress}>
            <div className={styles.progressText}>Benchmark not found.</div>
          </div>
        </div>
      </ThreePanelLayout>
    );
  }

  // ── Render ─────────────────────────────────────────────────
  return (
    <ThreePanelLayout
      navSidebar={navSidebar}
      leftPanel={
        <RunHistorySidebarComponent
          benchmark={benchmark}
          runHistory={runHistory}
          activeRunId={activeRunId}
          onViewRun={viewRun}
          running={running}
          streamingCompleted={streamingResults.length}
          selectedModels={selectedModels}
          onRemoveModel={removeModel}
          onClearSelection={clearModelSelection}
        />
      }
      leftTitle="Run History"
      rightPanel={rightSidebar}
      rightTitle="Benchmarks"
      headerTitle={benchmark.name}
      headerCenter={
        <ModelPickerPopoverComponent
          config={prismConfig}
          multiSelect
          selectedKeys={selectedModelKeys}
          onSelectModel={handleModelSelect}
        />
      }
      headerControls={
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <ButtonComponent
            variant="ghost"
            size="sm"
            icon={Trash2}
            onClick={() => setShowDeleteModal(true)}
          >
            Delete
          </ButtonComponent>
          <ButtonComponent
            variant="ghost"
            size="sm"
            icon={Copy}
            onClick={openClone}
          >
            Clone
          </ButtonComponent>
          <ButtonComponent
            variant="primary"
            size="sm"
            icon={running ? Square : Play}
            onClick={running ? handleStop : handleRun}
            loading={running}
            disabled={!running && selectedModels.length === 0}
          >
            {running
              ? "Stop"
              : selectedModels.length > 0
                ? `Run ${selectedModels.length} Model${selectedModels.length > 1 ? "s" : ""}`
                : "Select Models"}
          </ButtonComponent>
        </div>
      }
    >
      <div className={styles.contentMain}>

          <div className={styles.detailPanel}>
          {/* ── Benchmark Info ── */}
          <div className={styles.detailHeader}>
            <div className={styles.detailTitle}>
              {benchmark.name}
            </div>
            <div className={styles.detailMeta}>
              {(() => {
                const assertions = benchmark.assertions?.length > 0
                  ? benchmark.assertions
                  : [{ expectedValue: benchmark.expectedValue, matchMode: benchmark.matchMode || "contains" }];
                const operator = benchmark.assertionOperator || "AND";
                return assertions.map((a, i) => (
                  <span key={i} style={{ display: "contents" }}>
                    {i > 0 && (
                      <BadgeComponent variant={operator === "OR" ? "warning" : "info"}>{operator}</BadgeComponent>
                    )}
                    <BadgeComponent variant="accent">
                      {a.matchMode || "contains"}
                    </BadgeComponent>
                    <span className={styles.expectedValue}>
                      Expected: {a.expectedValue}
                    </span>
                  </span>
                ));
              })()}
              {benchmark.tags?.map((tag) => (
                <span key={tag} className={styles.tag}>
                  {tag}
                </span>
              ))}
            </div>
          </div>



          {/* ── Running Progress ── */}
          {running && (() => {
            const totalExpected = streamingTotal || selectedModels.length;
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
                  {streamingTotal > 0 && streamingTotal !== allModels.length
                    ? `${streamingTotal} models`
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
              <SummaryBarComponent
                live
                items={[
                  { value: `${completed}/${totalExpected}`, label: "Completed" },
                  ...(runningCount > 0 ? [{
                    value: runningCount,
                    label: "Running",
                    color: "var(--accent-color)",
                    icon: <Loader2 size={14} className={styles.spinIcon} />,
                  }] : []),
                  { value: passed, label: "Passed", color: "var(--success)" },
                  { value: failed, label: "Failed", color: "var(--danger)" },
                  ...(errored > 0 ? [{ value: errored, label: "Errors", color: "var(--warning)" }] : []),
                  { bar: passRate, label: completed > 0 ? `${Math.round(passRate)}%` : "\u2014" },
                  ...(totalCost > 0 ? [{
                    value: formatCost(totalCost),
                    label: "Cost",
                    color: "var(--success)",
                    icon: <Coins size={14} className={styles.costIcon} />,
                  }] : []),
                ]}
              />

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
                    onRowClick={setSelectedResult}
                    activeRowKey={getActiveKey(streamingResults)}

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
              <SummaryBarComponent
                items={[
                  { value: latestRun.summary.total, label: "Total" },
                  { value: latestRun.summary.passed, label: "Passed", color: "var(--success)" },
                  { value: latestRun.summary.failed, label: "Failed", color: "var(--danger)" },
                  ...(latestRun.summary.errored > 0 ? [{ value: latestRun.summary.errored, label: "Errors", color: "var(--warning)" }] : []),
                  { bar: (latestRun.summary.passed / latestRun.summary.total) * 100, label: `${Math.round((latestRun.summary.passed / latestRun.summary.total) * 100)}%` },
                  ...((latestRun.summary.totalCost > 0 || latestRun.models?.some(r => r.estimatedCost > 0)) ? [{
                    value: formatCost(latestRun.summary.totalCost ?? latestRun.models.reduce((s, r) => s + (r.estimatedCost || 0), 0)),
                    label: "Cost",
                    color: "var(--success)",
                    icon: <Coins size={14} className={styles.costIcon} />,
                  }] : []),
                ]}
              />

              {/* Results Table */}
              <BenchmarksTableComponent
                results={latestRun.models}
                expectedValue={benchmark.expectedValue}
                modelConfigMap={modelConfigMap}
                onRowClick={setSelectedResult}
                activeRowKey={getActiveKey(latestRun.models)}
              />
            </div>
          )}

          <ChatPreviewComponent
            systemPrompt={benchmark.systemPrompt}
            messages={[
              { role: "user", content: benchmark.prompt },
              ...(selectedResult?.response ? [{
                role: "assistant",
                content: selectedResult.response,
                model: selectedResult.label || selectedResult.model,
                provider: selectedResult.provider,
              }] : []),
            ]}
          />

        </div>
        </div>

      {/* ── Clone Modal ── */}
      {showModal && (
        <ModalDialogComponent
          title="Clone Benchmark"
          size="xl"
          onClose={() => setShowModal(false)}
          footer={
            <>
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
                disabled={!form.name || !form.prompt || !form.assertions?.some(a => a.expectedValue)}
              >
                Create Clone
              </ButtonComponent>
            </>
          }
        >
          <BenchmarkFormComponent
            form={form}
            onChange={setForm}
            matchModes={MATCH_MODES}
          />
        </ModalDialogComponent>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {showDeleteModal && (
        <ModalDialogComponent
          title="Delete Benchmark"
          size="sm"
          onClose={() => setShowDeleteModal(false)}
          footer={
            <>
              <ButtonComponent
                variant="secondary"
                size="sm"
                onClick={() => setShowDeleteModal(false)}
              >
                Cancel
              </ButtonComponent>
              <ButtonComponent
                variant="danger"
                size="sm"
                icon={Trash2}
                onClick={handleDelete}
                loading={deleting}
              >
                Delete Benchmark
              </ButtonComponent>
            </>
          }
        >
          <p style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.5, margin: 0 }}>
            Are you sure you want to delete <strong style={{ color: "var(--text-primary)" }}>{benchmark.name}</strong>?
            This will permanently remove the benchmark and all {runHistory.length > 0 ? `${runHistory.length} ` : ""}associated test run{runHistory.length !== 1 ? "s" : ""}.
          </p>
        </ModalDialogComponent>
      )}
    </ThreePanelLayout>
  );
}

"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Play,
  Copy,
  Coins,
  Loader2,
  Square,
  Trash2,
  Hash,
  CircleCheck,
  CircleX,
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
import AgentPickerPopoverComponent from "./AgentPickerPopoverComponent";
import BenchmarksTableComponent from "./BenchmarksTableComponent";
import ChatPreviewComponent from "./ChatPreviewComponent";
import DateTimeBadgeComponent from "./DateTimeBadgeComponent";
import StopwatchBadgeComponent from "./StopwatchBadgeComponent";

import StorageService from "../services/StorageService";
import { SK_MODEL_MEMORY_BENCHMARKS } from "../constants";
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


/**
 * Resolve the model key for incoming content events during concurrent execution.
 * If the event carries a `_sourceModel` tag (provider + model), use that directly.
 * Otherwise fall back to the last active key in the live data map.
 */
function resolveModelKeyForContent(liveDataMap, sourceModel) {
  // Prefer explicit source tag (set by backend for concurrent benchmark runs)
  if (sourceModel?.provider && sourceModel?.model) {
    const key = `${sourceModel.provider}:${sourceModel.model}`;
    if (liveDataMap.has(key)) return key;
  }
  // Fallback: last key in the map (most recently started model)
  let lastKey = null;
  for (const key of liveDataMap.keys()) lastKey = key;
  return lastKey;
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

  // Model selection — instance-based: each entry has a unique instanceId
  // so the same model can be selected multiple times with different settings.
  const [prismConfig, setPrismConfig] = useState(null);
  const [selectedInstances, setSelectedInstances] = useState(() => {
    const saved = StorageService.get(SK_MODEL_MEMORY_BENCHMARKS);
    // Migration: if saved data uses the old Set-based selectedKeys format,
    // convert each key into an instance object.
    if (saved?.selectedKeys && Array.isArray(saved.selectedKeys)) {
      return saved.selectedKeys.map((key) => {
        const [provider, ...rest] = key.split(":");
        return { instanceId: crypto.randomUUID(), provider, name: rest.join(":") };
      });
    }
    // New format: array of instance objects
    if (saved?.instances && Array.isArray(saved.instances)) {
      return saved.instances;
    }
    return [];
  });
  const [favoriteKeys, setFavoriteKeys] = useState([]);

  // Selected result (for chat preview)
  const [selectedResult, setSelectedResult] = useState(null);

  // Per-model thinking toggle: Map<instanceId, boolean>
  const [thinkingMap, setThinkingMap] = useState(() => {
    const saved = StorageService.get(SK_MODEL_MEMORY_BENCHMARKS);
    return saved?.thinkingMap && typeof saved.thinkingMap === "object" ? saved.thinkingMap : {};
  });
  const [toolsMap, setToolsMap] = useState(() => {
    const saved = StorageService.get(SK_MODEL_MEMORY_BENCHMARKS);
    return saved?.toolsMap && typeof saved.toolsMap === "object" ? saved.toolsMap : {};
  });

  // Agent instances — same instance-based pattern as models
  const [agentInstances, setAgentInstances] = useState(() => {
    const saved = StorageService.get(SK_MODEL_MEMORY_BENCHMARKS);
    if (saved?.agents && Array.isArray(saved.agents)) {
      return saved.agents;
    }
    return [];
  });

  // Compute the active row key for table highlight
  const getActiveKey = useCallback((results) => {
    if (!selectedResult) return undefined;
    const idx = results.indexOf(selectedResult);
    if (idx === -1) return undefined;
    return `${selectedResult.provider}:${selectedResult.label}:${idx}`;
  }, [selectedResult]);

  // Smart row click: running rows switch the live preview, completed rows set selectedResult
  const handleStreamingRowClick = useCallback((row) => {
    if (row._running) {
      // Switch live preview to this model
      const key = `${row.provider}:${row.model}`;
      setViewedModelKey(key);
      setSelectedResult(null);
      // Immediately flush this model's accumulated data so the preview updates instantly
      const d = liveDataRef.current.get(key);
      if (d) {
        setLiveSnapshot({ text: d.text, thinking: d.thinking, toolCalls: [...d.toolCalls] });
      }
    } else if (row._pending) {
      // Ignore clicks on queued rows
      return;
    } else {
      // Completed result — show in chat preview
      setSelectedResult(row);
    }
  }, []);

  // Streaming progress — supports concurrent model execution across provider buckets
  const [streamingResults, setStreamingResults] = useState([]);
  const [streamingTotal, setStreamingTotal] = useState(0);
  // Map<modelKey, { model, progress, phase }> for all concurrently-running models
  const [activeModels, setActiveModels] = useState(new Map());
  const [pendingTargets, setPendingTargets] = useState([]);
  const abortRef = useRef(null);
  // Per-model progress intervals: Map<modelKey, intervalId>
  const progressIntervalsRef = useRef(new Map());

  // The model key the user is currently viewing in live preview (sticky — doesn't auto-switch)
  const [viewedModelKey, setViewedModelKey] = useState(null);

  // Live streaming text for the currently-viewed model
  // Map<modelKey, { text, thinking, toolCalls }> — accumulates per model
  const liveDataRef = useRef(new Map());
  const liveFlushRef = useRef(null);
  const [liveSnapshot, setLiveSnapshot] = useState({ text: "", thinking: "", toolCalls: [] });

  // Cleanup intervals on unmount
  useEffect(() => {
    const intervals = progressIntervalsRef.current;
    return () => {
      for (const id of intervals.values()) clearInterval(id);
      intervals.clear();
      if (liveFlushRef.current) clearInterval(liveFlushRef.current);
    };
  }, []);

  // Derive the "viewed" active model from the Map (for chat preview)
  const viewedActiveModel = useMemo(() => {
    if (activeModels.size === 0) return null;
    if (viewedModelKey && activeModels.has(viewedModelKey)) {
      return activeModels.get(viewedModelKey).model;
    }
    // Fallback: first active model
    return activeModels.values().next().value?.model || null;
  }, [activeModels, viewedModelKey]);

  // For backward compat: expose a single activeModel for summary counts
  const activeModelCount = activeModels.size;

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

  // ── Shared live-state helpers (single source of truth) ─────

  /** Reset all live streaming refs and state. Called on run complete, error, and stop. */
  const resetLiveState = useCallback(() => {
    for (const id of progressIntervalsRef.current.values()) clearInterval(id);
    progressIntervalsRef.current.clear();
    if (liveFlushRef.current) { clearInterval(liveFlushRef.current); liveFlushRef.current = null; }
    setActiveModels(new Map());
    setViewedModelKey(null);
    liveDataRef.current = new Map();
    setLiveSnapshot({ text: "", thinking: "", toolCalls: [] });
  }, []);

  /** Reset live state for a single model on completion. */
  const resetModelLiveState = useCallback((modelKey) => {
    const intervalId = progressIntervalsRef.current.get(modelKey);
    if (intervalId) { clearInterval(intervalId); progressIntervalsRef.current.delete(modelKey); }
    liveDataRef.current.delete(modelKey);
  }, []);

  /**
   * Build the unified SSE callbacks object shared by both `streamBenchmarkRun`
   * and `followBenchmarkRun`. Identical event handling — no duplication.
   *
   * @param {object} overrides - Extra callbacks merged on top (e.g. onRunComplete, onError)
   */
  const buildBenchmarkSSECallbacks = useCallback((overrides = {}) => ({
    onRunInfo: (data) => {
      setStreamingTotal(data.totalModels || 0);
    },

    // ── Model lifecycle — supports concurrent models across providers ──
    onModelStart: (data) => {
      const modelKey = `${data.provider}:${data.model}`;

      // Initialize live data refs for this model
      liveDataRef.current.set(modelKey, { text: "", thinking: "", toolCalls: [] });

      // Set this as the viewed model only if nothing is currently being viewed
      setViewedModelKey((prev) => {
        if (prev) return prev; // Don't auto-switch
        return modelKey;
      });

      // Start periodic flush of the VIEWED model's refs → React state
      if (!liveFlushRef.current) {
        liveFlushRef.current = setInterval(() => {
          setViewedModelKey((currentKey) => {
            if (!currentKey) return currentKey;
            const d = liveDataRef.current.get(currentKey);
            if (d) {
              setLiveSnapshot({ text: d.text, thinking: d.thinking, toolCalls: [...d.toolCalls] });
            }
            return currentKey;
          });
        }, 100);
      }

      // Add to active models map
      const initialPhase = data.isLocal ? "Loading model" : "Connecting";
      setActiveModels((prev) => {
        const next = new Map(prev);
        next.set(modelKey, { model: data, progress: 0, phase: initialPhase });
        return next;
      });

      // Asymptotic progress simulation — per model
      const oldInterval = progressIntervalsRef.current.get(modelKey);
      if (oldInterval) clearInterval(oldInterval);

      const startTime = Date.now();
      const phases = data.isLocal
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

      const intervalId = setInterval(() => {
        const now = Date.now();
        const phase = phases[phaseIndex];
        const prevEnd = phaseIndex > 0 ? phases[phaseIndex - 1].end : 0;
        const elapsed = now - phaseStart;
        const phaseProgress = elapsed / (elapsed + phase.duration);
        const totalProgress = prevEnd + (phase.end - prevEnd) * phaseProgress;
        setActiveModels((prev) => {
          const next = new Map(prev);
          const entry = next.get(modelKey);
          if (entry) {
            next.set(modelKey, { ...entry, progress: totalProgress, phase: phase.label });
          }
          return next;
        });
        if (phaseProgress > 0.9 && phaseIndex < phases.length - 1) {
          phaseIndex++;
          phaseStart = now;
        }
      }, 60);
      progressIntervalsRef.current.set(modelKey, intervalId);
    },

    onModelComplete: (result) => {
      const modelKey = `${result.provider}:${result.model}`;
      resetModelLiveState(modelKey);

      // Remove from active models
      setActiveModels((prev) => {
        const next = new Map(prev);
        next.delete(modelKey);
        return next;
      });

      // If the completed model was the viewed one, move view to next active
      setViewedModelKey((prev) => {
        if (prev === modelKey) return null; // Will auto-pick next active via useMemo
        return prev;
      });

      setStreamingResults((prev) => [...prev, result]);

      // Stop live flush if no active models remain
      setActiveModels((latest) => {
        if (latest.size === 0 && liveFlushRef.current) {
          clearInterval(liveFlushRef.current);
          liveFlushRef.current = null;
          setLiveSnapshot({ text: "", thinking: "", toolCalls: [] });
        }
        return latest;
      });
    },

    // ── Live content events — route to the correct model via _sourceModel tag ──
    onChunk: (content, sourceModel) => {
      const key = resolveModelKeyForContent(liveDataRef.current, sourceModel);
      if (key) {
        const d = liveDataRef.current.get(key);
        if (d) d.text += content;
      }
    },
    onThinking: (content, sourceModel) => {
      const key = resolveModelKeyForContent(liveDataRef.current, sourceModel);
      if (key) {
        const d = liveDataRef.current.get(key);
        if (d) d.thinking += content;
      }
    },

    // ── Tool call events (same pattern as /coding-agent) ───
    onToolCall: (tc) => {
      const key = resolveModelKeyForContent(liveDataRef.current, tc._sourceModel);
      if (!key) return;
      const d = liveDataRef.current.get(key);
      if (!d) return;
      if (tc.status === "calling") {
        d.toolCalls = [...d.toolCalls, { id: tc.id, name: tc.name, args: tc.args, status: "calling" }];
      } else {
        d.toolCalls = d.toolCalls.map((t) =>
          t.id === tc.id ? { ...t, status: tc.status, result: tc.result, ...(tc.args && { args: tc.args }) } : t
        );
      }
    },
    onToolExecution: (data) => {
      const key = resolveModelKeyForContent(liveDataRef.current, data._sourceModel);
      if (!key) return;
      const d = liveDataRef.current.get(key);
      if (!d) return;
      const tool = data.tool || {};
      if (data.status === "calling") {
        d.toolCalls = [...d.toolCalls, { id: tool.id, name: tool.name, args: tool.args, status: "calling" }];
      } else {
        d.toolCalls = d.toolCalls.map((t) =>
          t.id === tool.id ? { ...t, status: data.status, result: tool.result, ...(tool.args && { args: tool.args }) } : t
        );
      }
    },

    // Merge caller-specific overrides (onRunComplete, onError)
    ...overrides,
  }), [resetModelLiveState]);

  // ── Reconnect to an in-progress run on mount ──────────────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const status = await PrismService.getBenchmarkActive(benchmarkId);
        if (cancelled || !status?.active) return;

        // Don't pre-populate streamingResults or activeModels here —
        // the follow SSE replays all completed results and sends the
        // active model_start events, keeping a single source of truth.
        setRunning(true);
        setLatestRun(null);

        // Connect to the follow SSE for live updates
        abortRef.current = PrismService.followBenchmarkRun(benchmarkId, buildBenchmarkSSECallbacks({
          onRunComplete: async (run) => {
            resetLiveState();
            setLatestRun(run);
            setActiveRunId(run.id);
            setRunning(false);
            setStreamingResults([]);
            setActiveModels(new Map());
            setViewedModelKey(null);
            setStreamingTotal(0);
            abortRef.current = null;
            try {
              const { runs } = await PrismService.getBenchmarkRuns(benchmarkId);
              setRunHistory(runs || []);
            } catch { /* noop */ }
          },
          onError: (err) => {
            if (err?.name === "AbortError" || err?.message?.includes("abort")) return;
            resetLiveState();
            setRunning(false);
            setActiveModels(new Map());
            setViewedModelKey(null);
            abortRef.current = null;
          },
        }));
      } catch {
        // No active run or server unreachable — ignore
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [benchmarkId, buildBenchmarkSSECallbacks, resetLiveState]);

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

    // Load favorites
    PrismService.getFavorites("model")
      .then((favs) => setFavoriteKeys(favs.map((f) => f.key)))
      .catch(() => {});
  }, []);

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

  // All models flattened (for selected model derivation + size lookup)
  const allModels = useMemo(
    () => flattenAllModels(prismConfig),
    [prismConfig],
  );

  // ── Selected model objects (derived) ───────────────────────
  // Each instance is enriched with full model config data.
  const selectedModels = useMemo(() => {
    const configMap = new Map();
    for (const m of allModels) configMap.set(`${m.provider}:${m.name}`, m);
    return selectedInstances.map((inst) => {
      const cfg = configMap.get(`${inst.provider}:${inst.name}`) || {};
      return { ...cfg, ...inst };
    });
  }, [allModels, selectedInstances]);



  // Derive a selectedKeys Set for the model picker checkmarks
  const selectedModelKeys = useMemo(
    () => new Set(selectedInstances.map((i) => `${i.provider}:${i.name}`)),
    [selectedInstances],
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
    setActiveModels(new Map());
    setViewedModelKey(null);
    setLatestRun(null);

    if (selectedModels.length === 0 && agentInstances.length === 0) return;

    // Build model targets from selected model instances
    const modelTargets = selectedModels.map((m) => ({
      provider: m.provider,
      model: m.name,
      display_name: m.display_name || m.label || m.name,
      thinkingEnabled: !!thinkingMap[m.instanceId],
      toolsEnabled: !!toolsMap[m.instanceId],
    }));

    // Append agent instances — each agent uses its own backing model
    const agentTargets = agentInstances
      .filter((a) => a.provider && a.modelName)  // skip agents without a backing model
      .map((a) => {
        const modelDef = allModels.find((m) => m.provider === a.provider && m.name === a.modelName);
        return {
          provider: a.provider,
          model: a.modelName,
          display_name: `🤖 ${a.name} (${modelDef?.label || modelDef?.display_name || a.modelName})`,
          thinkingEnabled: !!thinkingMap[a.instanceId],
          toolsEnabled: true,
          agent: a.agentId,
        };
      });

    const models = [...modelTargets, ...agentTargets];

    // Pre-populate pending targets so the table shows all rows immediately
    setPendingTargets(models);

    // Notify sidebar to begin polling for active state
    window.dispatchEvent(new Event("benchmark-run-started"));

    abortRef.current = PrismService.streamBenchmarkRun(benchmarkId, models, buildBenchmarkSSECallbacks({
      onRunComplete: async (run) => {
        resetLiveState();
        setLatestRun(run);
        setActiveRunId(run.id);
        setRunning(false);
        setStreamingResults([]);
        setActiveModels(new Map());
        setViewedModelKey(null);
        setStreamingTotal(0);
        setPendingTargets([]);
        abortRef.current = null;
        try {
          const { runs } = await PrismService.getBenchmarkRuns(benchmarkId);
          setRunHistory(runs || []);
        } catch { /* noop */ }
      },
      onError: (err) => {
        // AbortError means user clicked Stop — handleStop already handled cleanup
        if (err?.name === "AbortError" || err?.message?.includes("abort")) return;
        resetLiveState();
        console.error("Benchmark run error:", err);
        setRunning(false);
        setActiveModels(new Map());
        setViewedModelKey(null);
        setPendingTargets([]);
        abortRef.current = null;
      },
    }));
  }, [benchmark, selectedModels, agentInstances, allModels, benchmarkId, thinkingMap, toolsMap, buildBenchmarkSSECallbacks, resetLiveState]);

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
    resetLiveState();
    setRunning(false);
    setActiveModels(new Map());
    setViewedModelKey(null);
    setPendingTargets([]);
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
  }, [streamingResults, benchmarkId, resetLiveState]);

  // ── View a past run ────────────────────────────────────────
  const viewRun = useCallback((run) => {
    setLatestRun(run);
    setActiveRunId(run.id);
    setSelectedResult(null);

    // Hydrate model/agent selection from this run's results
    if (run.models?.length > 0) {
      const configMap = new Map();
      for (const m of allModels) configMap.set(`${m.provider}:${m.name}`, m);

      const nextInstances = [];
      const nextAgents = [];
      const nextThinking = {};
      const nextTools = {};

      for (const result of run.models) {
        const key = `${result.provider}:${result.model}`;
        const available = configMap.has(key);
        if (!available) continue;

        if (result.agent) {
          // Agent entry — restore as agent instance
          const inst = {
            instanceId: crypto.randomUUID(),
            agentId: result.agent,
            name: result.label?.replace(/^🤖\s*/, "").replace(/\s*\(.*\)$/, "") || result.agent,
            description: "",
            provider: result.provider,
            modelName: result.model,
          };
          nextAgents.push(inst);
          if (result.thinkingEnabled) nextThinking[inst.instanceId] = true;
        } else {
          // Regular model entry
          const inst = {
            instanceId: crypto.randomUUID(),
            provider: result.provider,
            name: result.model,
          };
          nextInstances.push(inst);
          if (result.thinkingEnabled) nextThinking[inst.instanceId] = true;
          if (result.toolsEnabled) nextTools[inst.instanceId] = true;
        }
      }

      setSelectedInstances(nextInstances);
      setAgentInstances(nextAgents);
      setThinkingMap(nextThinking);
      setToolsMap(nextTools);
      StorageService.set(SK_MODEL_MEMORY_BENCHMARKS, {
        instances: nextInstances,
        agents: nextAgents,
        thinkingMap: nextThinking,
        toolsMap: nextTools,
      });
    }
  }, [allModels]);

  const handleAddAgent = useCallback((agentDef) => {
    const instance = {
      instanceId: crypto.randomUUID(),
      agentId: agentDef.id,
      name: agentDef.name,
      description: agentDef.description,
    };
    setAgentInstances((prev) => {
      const next = [...prev, instance];
      // Persist both model + agent instances together
      StorageService.set(SK_MODEL_MEMORY_BENCHMARKS, {
        instances: selectedInstances,
        agents: next,
        thinkingMap,
        toolsMap,
      });
      return next;
    });
  }, [selectedInstances, thinkingMap, toolsMap]);

  const removeAgent = useCallback((instanceId) => {
    setAgentInstances((prev) => {
      const next = prev.filter((i) => i.instanceId !== instanceId);
      StorageService.set(SK_MODEL_MEMORY_BENCHMARKS, {
        instances: selectedInstances,
        agents: next,
        thinkingMap,
        toolsMap,
      });
      return next;
    });
    setThinkingMap((prev) => { const n = { ...prev }; delete n[instanceId]; return n; });
  }, [selectedInstances, thinkingMap, toolsMap]);

  const handleChangeAgentModel = useCallback((instanceId, provider, modelName) => {
    setAgentInstances((prev) => {
      const next = prev.map((a) =>
        a.instanceId === instanceId ? { ...a, provider, modelName } : a
      );
      StorageService.set(SK_MODEL_MEMORY_BENCHMARKS, {
        instances: selectedInstances,
        agents: next,
        thinkingMap,
        toolsMap,
      });
      return next;
    });
  }, [selectedInstances, thinkingMap, toolsMap]);

  // ── Add model instance to selection (always adds, never toggles) ────
  const handleModelSelect = useCallback((rawModel) => {
    const instance = {
      instanceId: crypto.randomUUID(),
      provider: rawModel.provider,
      name: rawModel.name,
    };
    setSelectedInstances((prev) => {
      const next = [...prev, instance];
      StorageService.set(SK_MODEL_MEMORY_BENCHMARKS, {
        instances: next,
        agents: agentInstances,
        thinkingMap,
        toolsMap,
      });
      return next;
    });
  }, [agentInstances, thinkingMap, toolsMap]);

  const removeModel = useCallback((instanceId) => {
    setSelectedInstances((prev) => {
      const next = prev.filter((i) => i.instanceId !== instanceId);
      StorageService.set(SK_MODEL_MEMORY_BENCHMARKS, {
        instances: next,
        agents: agentInstances,
        thinkingMap,
        toolsMap,
      });
      return next;
    });
    // Clean up thinking/tools state for removed instance
    setThinkingMap((prev) => { const n = { ...prev }; delete n[instanceId]; return n; });
    setToolsMap((prev) => { const n = { ...prev }; delete n[instanceId]; return n; });
  }, [agentInstances, thinkingMap, toolsMap]);

  const handleChangeModel = useCallback((instanceId, provider, modelName) => {
    setSelectedInstances((prev) => {
      const next = prev.map((i) =>
        i.instanceId === instanceId ? { ...i, provider, name: modelName } : i
      );
      StorageService.set(SK_MODEL_MEMORY_BENCHMARKS, {
        instances: next,
        agents: agentInstances,
        thinkingMap,
        toolsMap,
      });
      return next;
    });
  }, [agentInstances, thinkingMap, toolsMap]);

  const clearModelSelection = useCallback(() => {
    setSelectedInstances([]);
    setAgentInstances([]);
    setThinkingMap({});
    setToolsMap({});
    StorageService.set(SK_MODEL_MEMORY_BENCHMARKS, { instances: [], agents: [], thinkingMap: {}, toolsMap: {} });
  }, []);

  // ── Toggle thinking per instance ──────────────────────────
  const handleToggleThinking = useCallback((instanceId) => {
    setThinkingMap((prev) => {
      const next = { ...prev, [instanceId]: !prev[instanceId] };
      // Persist updated toggle state
      const saved = StorageService.get(SK_MODEL_MEMORY_BENCHMARKS) || {};
      StorageService.set(SK_MODEL_MEMORY_BENCHMARKS, { ...saved, thinkingMap: next });
      return next;
    });
  }, []);

  // ── Toggle tools per instance ─────────────────────────────
  const handleToggleTools = useCallback((instanceId) => {
    setToolsMap((prev) => {
      const next = { ...prev, [instanceId]: !prev[instanceId] };
      // Persist updated toggle state
      const saved = StorageService.get(SK_MODEL_MEMORY_BENCHMARKS) || {};
      StorageService.set(SK_MODEL_MEMORY_BENCHMARKS, { ...saved, toolsMap: next });
      return next;
    });
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
      leftTitle={null}
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
          onChangeModel={handleChangeModel}
          onClearSelection={clearModelSelection}
          thinkingMap={thinkingMap}
          onToggleThinking={handleToggleThinking}
          toolsMap={toolsMap}
          onToggleTools={handleToggleTools}
          agentInstances={agentInstances}
          onRemoveAgent={removeAgent}
          onChangeAgentModel={handleChangeAgentModel}
          allModels={allModels}
          config={prismConfig}
        />
      }
      rightPanel={rightSidebar}
      rightTitle="Benchmarks"
      headerTitle={benchmark.name}
      headerCenter={
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <ModelPickerPopoverComponent
            config={prismConfig}
            multiSelect
            selectedKeys={selectedModelKeys}
            onSelectModel={handleModelSelect}
            favorites={favoriteKeys}
            onToggleFavorite={handleToggleFavorite}
            triggerLabel={
              selectedInstances.length === 0
                ? "Select Models"
                : selectedInstances.length === 1
                  ? "1 Model Selected"
                  : `${selectedInstances.length} Models Selected`
            }
          />
          <AgentPickerPopoverComponent
            agentCount={agentInstances.length}
            onAddAgent={handleAddAgent}
          />
        </div>
      }
    >
      <div className={styles.contentMain}>
        <div className={styles.contentMainHeader}>
          <ButtonComponent
            variant="disabled"
            size="sm"
            icon={Trash2}
            onClick={() => setShowDeleteModal(true)}
          >
            Delete
          </ButtonComponent>
          <ButtonComponent
            variant="disabled"
            size="sm"
            icon={Copy}
            onClick={openClone}
          >
            Clone
          </ButtonComponent>
          <ButtonComponent
            variant="primary"
            icon={running ? Square : Play}
            onClick={running ? handleStop : handleRun}
            loading={running}
            disabled={!running && selectedModels.length === 0 && agentInstances.length === 0}
          >
            {running
              ? "Stop"
              : (selectedModels.length + agentInstances.length) > 0
                ? "Run Benchmark"
                : "Select Models"}
          </ButtonComponent>
        </div>

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
            const runningCount = activeModelCount;
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
                  variant="destructive"
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
                  { value: `${completed}/${totalExpected}`, label: "Completed", icon: <Hash size={14} /> },
                  {
                    value: runningCount,
                    label: "Running",
                    color: "var(--accent-color)",
                    icon: <Loader2 size={14} className={styles.spinIcon} />,
                  },
                  { value: passed, label: "Passed", color: "var(--success)", icon: <CircleCheck size={14} /> },
                  { value: failed, label: "Failed", color: "var(--danger)", icon: <CircleX size={14} /> },
                  ...(errored > 0 ? [{ value: errored, label: "Errors", color: "var(--warning)" }] : []),
                  { bar: passRate, barPassed: passed, barTotal: completed, label: completed > 0 ? `${Math.round(passRate)}%` : "\u2014" },
                  ...(totalCost > 0 ? [{
                    value: formatCost(totalCost),
                    label: "Cost",
                    color: "var(--success)",
                    icon: <Coins size={14} className={styles.costIcon} />,
                  }] : []),
                ]}
              />

              {/* Progressive results table (includes active model row) */}
              <div className={styles.streamingTableWrapper}>
                <BenchmarksTableComponent
                  results={streamingResults}
                  expectedValue={benchmark.expectedValue}
                  modelConfigMap={modelConfigMap}
                  onRowClick={handleStreamingRowClick}
                  activeRowKey={getActiveKey(streamingResults)}
                  activeModels={activeModels}
                  pendingTargets={pendingTargets}
                />
              </div>
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
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {(() => {
                    const totalDuration = (latestRun.models || []).reduce((sum, r) => sum + (r.latency || 0), 0);
                    return totalDuration > 0 ? <StopwatchBadgeComponent seconds={totalDuration} /> : null;
                  })()}
                  <DateTimeBadgeComponent date={latestRun.completedAt} />
                </div>
              </div>

              {/* Summary Bar */}
              <SummaryBarComponent
                items={[
                  { value: latestRun.summary.total, label: "Total", icon: <Hash size={14} /> },
                  { value: latestRun.summary.passed, label: "Passed", color: "var(--success)", icon: <CircleCheck size={14} /> },
                  { value: latestRun.summary.failed, label: "Failed", color: "var(--danger)", icon: <CircleX size={14} /> },
                  ...(latestRun.summary.errored > 0 ? [{ value: latestRun.summary.errored, label: "Errors", color: "var(--warning)" }] : []),
                  { bar: (latestRun.summary.passed / latestRun.summary.total) * 100, barPassed: latestRun.summary.passed, barTotal: latestRun.summary.total, label: `${Math.round((latestRun.summary.passed / latestRun.summary.total) * 100)}%` },
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

          {/* ── Chat Preview: selected result or live streaming ── */}
          {(selectedResult || viewedActiveModel) ? (
            <ChatPreviewComponent
              systemPrompt={benchmark.systemPrompt}
              messages={[
                { role: "user", content: benchmark.prompt },
                ...(selectedResult?.response ? [{
                  role: "assistant",
                  content: selectedResult.response,
                  thinking: selectedResult.thinking || undefined,
                  toolCalls: selectedResult.toolCalls || undefined,
                  model: selectedResult.label || selectedResult.model,
                  provider: selectedResult.provider,
                }] : []),
                ...(!selectedResult && viewedActiveModel ? [{
                  role: "assistant",
                  content: liveSnapshot.text || "",
                  thinking: liveSnapshot.thinking || undefined,
                  toolCalls: liveSnapshot.toolCalls?.length > 0 ? liveSnapshot.toolCalls : undefined,
                  model: viewedActiveModel.label || viewedActiveModel.model,
                  provider: viewedActiveModel.provider,
                  _liveStreaming: true,
                }] : []),
              ]}
            />
          ) : null}

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
                variant="destructive"
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

"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Monitor,
  Cpu,
  Zap,
  BarChart3,
  TrendingUp,
  HardDrive,
  RefreshCw,
  Layers,
  Clock,
  Target,
  Gauge,
  Crosshair,
  MessageSquare,
  ArrowDownToLine,
  Crown,
  Rocket,
  BrainCircuit,
  Grid3x3,
  ThumbsDown,
  AlertTriangle,
} from "lucide-react";
import Chart from "chart.js/auto";
import PrismService from "../services/PrismService";
import PageHeaderComponent from "./PageHeaderComponent";
import StatsCard from "./StatsCard";
import TabBarComponent from "./TabBarComponent";
import {
  FilterBarComponent,
  FilterSelectComponent,
} from "./FilterBarComponent";
import { LoadingMessage, ErrorMessage } from "./StateMessageComponent";
import styles from "./VramBenchmarkComponent.module.css";

// ── Color palette ────────────────────────────────────────────

const QUANT_COLORS = {
  Q4_0: { bg: "rgba(34,211,238,0.55)", border: "#22d3ee" },
  Q4_K_M: { bg: "rgba(99,102,241,0.55)", border: "#6366f1" },
  Q4_K_S: { bg: "rgba(139,92,246,0.55)", border: "#8b5cf6" },
  Q4_1: { bg: "rgba(59,130,246,0.55)", border: "#3b82f6" },
  Q5_K_S: { bg: "rgba(16,185,129,0.55)", border: "#10b981" },
  Q5_K_M: { bg: "rgba(20,184,166,0.55)", border: "#14b8a6" },
  Q6_K: { bg: "rgba(234,179,8,0.55)", border: "#eab308" },
  Q6_K_L: { bg: "rgba(245,158,11,0.55)", border: "#f59e0b" },
  Q8_0: { bg: "rgba(244,63,94,0.55)", border: "#f43f5e" },
  Q3_K_L: { bg: "rgba(249,115,22,0.55)", border: "#f97316" },
  FP16: { bg: "rgba(236,72,153,0.55)", border: "#ec4899" },
  F16: { bg: "rgba(236,72,153,0.55)", border: "#ec4899" },
  BF16: { bg: "rgba(217,70,239,0.55)", border: "#d946ef" },
};

const GPU_COLORS = {
  "NVIDIA GeForce RTX 4090": {
    bg: "rgba(99,102,241,0.6)",
    border: "#6366f1",
  },
  "NVIDIA GeForce RTX 5070 Ti": {
    bg: "rgba(16,185,129,0.6)",
    border: "#10b981",
  },
};

// Fallback rainbow for unknown quant/GPU
const PALETTE = [
  { bg: "rgba(99,102,241,0.55)", border: "#6366f1" },
  { bg: "rgba(16,185,129,0.55)", border: "#10b981" },
  { bg: "rgba(245,158,11,0.55)", border: "#f59e0b" },
  { bg: "rgba(244,63,94,0.55)", border: "#f43f5e" },
  { bg: "rgba(59,130,246,0.55)", border: "#3b82f6" },
  { bg: "rgba(139,92,246,0.55)", border: "#8b5cf6" },
  { bg: "rgba(236,72,153,0.55)", border: "#ec4899" },
  { bg: "rgba(34,211,238,0.55)", border: "#22d3ee" },
];

let colorIdx = 0;
function getQuantColor(q) {
  if (QUANT_COLORS[q]) return QUANT_COLORS[q];
  const c = PALETTE[colorIdx % PALETTE.length];
  colorIdx++;
  return c;
}

function getGPUColor(gpuName) {
  return (
    GPU_COLORS[gpuName] || { bg: "rgba(107,114,128,0.5)", border: "#6b7280" }
  );
}

function shortGPU(name) {
  return (name || "Unknown")
    .replace("NVIDIA GeForce ", "")
    .replace("NVIDIA ", "");
}

function shortModelName(name, max = 18) {
  if (!name) return "";
  // Strip common prefixes for brevity
  let short = name
    .replace(/^(lmstudio-community|lmstudio-ai|bartowski|unsloth)\//, "")
    .replace(/-GGUF$/i, "")
    .replace(/-[A-Z]\d+.*$/, ""); // strip quant suffix like -Q4_K_M
  if (short.length > max) short = short.slice(0, max - 1) + "…";
  return short;
}

// ── Chart defaults ───────────────────────────────────────────

const CHART_FONT = "'Inter', sans-serif";

const TOOLTIP_STYLE = {
  backgroundColor: "rgba(10, 10, 15, 0.92)",
  titleColor: "#f8f8f8",
  bodyColor: "#8e95ae",
  borderColor: "rgba(99, 102, 241, 0.25)",
  borderWidth: 1,
  padding: 14,
  cornerRadius: 2,
  titleFont: { family: CHART_FONT, weight: "600", size: 13 },
  bodyFont: { family: CHART_FONT, size: 12 },
  displayColors: true,
  boxPadding: 4,
};

const GRID_STYLE = {
  color: "rgba(255,255,255,0.04)",
  drawBorder: false,
};

const TICK_STYLE = {
  font: { family: CHART_FONT, size: 11, weight: "500" },
  color: "#6b728e",
  padding: 6,
};

const AXIS_TITLE_STYLE = {
  display: true,
  font: { family: CHART_FONT, weight: "600", size: 12 },
  color: "#8e95ae",
  padding: { top: 8 },
};

const LEGEND_STYLE = {
  position: "top",
  labels: {
    usePointStyle: true,
    pointStyle: "circle",
    padding: 16,
    font: { family: CHART_FONT, size: 11, weight: "500" },
    color: "#8e95ae",
    boxWidth: 8,
    boxHeight: 8,
  },
};

// ── Custom inline datalabels plugin ──────────────────────────
// Draws model name labels directly on chart data points.
// Works per-chart without global registration issues.

function makeDatalabelsPlugin({ getLabel, anchor = "end", align = "top", offset = 4, filterFn, maxLabels = 60 }) {
  return {
    id: "customDatalabels",
    afterDatasetsDraw(chart) {
      const { ctx } = chart;
      ctx.save();
      ctx.font = `500 9px ${CHART_FONT}`;
      ctx.fillStyle = "rgba(142, 149, 174, 0.85)";
      ctx.textBaseline = align === "top" ? "bottom" : "middle";

      let labelCount = 0;
      for (let di = 0; di < chart.data.datasets.length; di++) {
        if (filterFn && !filterFn(di)) continue;
        const meta = chart.getDatasetMeta(di);
        if (!meta.visible) continue;
        for (let i = 0; i < meta.data.length; i++) {
          if (labelCount >= maxLabels) break;
          const el = meta.data[i];
          const raw = chart.data.datasets[di].data[i];
          const label = getLabel(raw, i, di);
          if (!label) continue;

          let x = el.x;
          let y = el.y;

          if (anchor === "end" && align === "top") {
            y = y - (el.height || el.options?.radius || 6) - offset;
            ctx.textAlign = "center";
          } else if (anchor === "end" && align === "right") {
            x = x + offset;
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
          }

          ctx.fillText(label, x, y);
          labelCount++;
        }
      }
      ctx.restore();
    },
  };
}

// ── View tabs ────────────────────────────────────────────────

const VIEW_TABS = [
  { key: "scatter", label: "VRAM vs Speed", icon: <TrendingUp size={12} /> },
  { key: "bar", label: "VRAM Usage", icon: <BarChart3 size={12} /> },
  { key: "efficiency", label: "Tokens per Second", icon: <Zap size={12} /> },
  { key: "quantDist", label: "Quantization", icon: <Layers size={12} /> },
  { key: "context", label: "Context Scaling", icon: <HardDrive size={12} /> },
];

// ═════════════════════════════════════════════════════════════
// Component
// ═════════════════════════════════════════════════════════════

export default function VramBenchmarkComponent() {
  const [rawData, setRawData] = useState([]);
  const [machines, setMachines] = useState([]);
  const [settingsLabels, setSettingsLabels] = useState([]);
  const [contextLengths, setContextLengths] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [machineFilter, setMachineFilter] = useState("all");
  const [providerFilter, setProviderFilter] = useState("all");
  const [settingsFilter, setSettingsFilter] = useState("default");
  const [ctxFilter, setCtxFilter] = useState("all");
  const [sortBy, setSortBy] = useState("vram");
  const [activeView, setActiveView] = useState("scatter");

  // Canvas refs — one per chart type
  const chartRefs = {
    scatter: useRef(null),
    bar: useRef(null),
    efficiency: useRef(null),
    quantDist: useRef(null),
    context: useRef(null),
  };
  const chartInstances = useRef({});

  // ── Fetch data ───────────────────────────────────────────

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [benchRes, machinesRes, settingsRes, contextsRes] = await Promise.all([
        PrismService.getVramBenchmarks({
          ...(settingsFilter !== "all" ? { settings: settingsFilter } : {}),
        }),
        PrismService.getVramBenchmarkMachines(),
        PrismService.getVramBenchmarkSettings(),
        PrismService.getVramBenchmarkContexts(),
      ]);
      setRawData(benchRes.data || []);
      setMachines(machinesRes || []);
      setSettingsLabels(settingsRes || []);
      setContextLengths(contextsRes || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [settingsFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Distinct providers from data ────────────────────────

  const providerOptions = useMemo(() => {
    const set = new Set(rawData.map((d) => d.provider).filter(Boolean));
    return [...set].sort();
  }, [rawData]);

  // ── Process data ─────────────────────────────────────────

  const models = useMemo(() => {
    let filtered = rawData.filter(
      (d) => d.modelVramGiB > 0,
    );

    if (machineFilter !== "all") {
      filtered = filtered.filter(
        (d) => (d.system?.hostname || "unknown") === machineFilter,
      );
    }

    if (providerFilter !== "all") {
      filtered = filtered.filter((d) => d.provider === providerFilter);
    }

    if (ctxFilter !== "all") {
      filtered = filtered.filter(
        (d) => d.contextLength === parseInt(ctxFilter),
      );
    }

    // Deduplicate: one per model+context combo (prefer latest run)
    const byKey = {};
    for (const d of filtered) {
      const key = `${d.displayName}__${d.contextLength}`;
      if (!byKey[key] || d.createdAt > byKey[key].createdAt) {
        byKey[key] = d;
      }
    }

    // Further deduplicate to one per model for chart views (prefer default context)
    const byModel = {};
    for (const d of Object.values(byKey)) {
      const mKey = d.displayName;
      if (!byModel[mKey] || d.contextLength > byModel[mKey].contextLength) {
        byModel[mKey] = d;
      }
    }

    const result = Object.values(byModel);

    switch (sortBy) {
      case "tps":
        result.sort((a, b) => b.tokensPerSecond - a.tokensPerSecond);
        break;
      case "efficiency":
        result.sort(
          (a, b) =>
            b.tokensPerSecond / b.modelVramGiB -
            a.tokensPerSecond / a.modelVramGiB,
        );
        break;
      case "filesize":
        result.sort((a, b) => a.fileSizeGB - b.fileSizeGB);
        break;
      case "ttft":
        result.sort((a, b) => (a.ttft?.ms || Infinity) - (b.ttft?.ms || Infinity));
        break;
      case "loadTime":
        result.sort((a, b) => (a.loadTimeMs || Infinity) - (b.loadTimeMs || Infinity));
        break;
      default:
        result.sort((a, b) => a.modelVramGiB - b.modelVramGiB);
    }

    return result;
  }, [rawData, machineFilter, providerFilter, ctxFilter, sortBy]);

  // ── All filtered data (including all context per model for context chart) ─

  const allFilteredData = useMemo(() => {
    let filtered = rawData.filter(
      (d) => d.modelVramGiB > 0,
    );
    if (machineFilter !== "all") {
      filtered = filtered.filter(
        (d) => (d.system?.hostname || "unknown") === machineFilter,
      );
    }
    if (providerFilter !== "all") {
      filtered = filtered.filter((d) => d.provider === providerFilter,
      );
    }
    return filtered;
  }, [rawData, machineFilter, providerFilter]);

  // ── Stats ────────────────────────────────────────────────

  const stats = useMemo(() => {
    if (models.length === 0) return null;
    const n = models.length;

    // VRAM range — min→max across profiled models
    const vramValues = models.map((m) => m.modelVramGiB);
    const minVram = Math.min(...vramValues).toFixed(1);
    const maxVram = Math.max(...vramValues).toFixed(1);

    // Best throughput — fastest model by raw TPS
    const fastest = models.reduce((best, m) =>
      m.tokensPerSecond > best.tokensPerSecond ? m : best,
    );


    // Median TTFT — more meaningful than average (resistant to outliers)
    const ttftModels = models.filter((m) => m.ttft?.ms > 0);
    let medianTtft = null;
    if (ttftModels.length > 0) {
      const sorted = ttftModels.map((m) => m.ttft.ms).sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      medianTtft = sorted.length % 2 !== 0
        ? sorted[mid].toFixed(0)
        : ((sorted[mid - 1] + sorted[mid]) / 2).toFixed(0);
    }

    // Estimation accuracy — mean absolute error between measured and estimated VRAM
    const avgDelta = (
      models.reduce(
        (s, m) => s + Math.abs(m.modelVramGiB - m.estimatedGiB),
        0,
      ) / n
    ).toFixed(2);

    // Count how many don't fit in GPU VRAM
    const oomCount = models.filter((m) => m.fitsInVram === false).length;

    // Scope stats — distinct quant formats & providers
    const quantCount = new Set(models.map((m) => m.quantization).filter(Boolean)).size;
    const providerCount = new Set(models.map((m) => m.provider).filter(Boolean)).size;

    // ── Best Model cards for practical LLM usage ──

    // 1. Fastest Response — lowest TTFT (critical for interactive chat)
    const fastestResponse = ttftModels.length > 0
      ? ttftModels.reduce((best, m) =>
          m.ttft.ms < best.ttft.ms ? m : best,
        )
      : null;

    // 2. Best for Chat — largest model (by VRAM) that still runs ≥30 TPS
    const CHAT_TPS_THRESHOLD = 30;
    const chatCandidates = models.filter(
      (m) => m.tokensPerSecond >= CHAT_TPS_THRESHOLD && m.fitsInVram !== false,
    );
    const bestForChat = chatCandidates.length > 0
      ? chatCandidates.reduce((best, m) =>
          m.modelVramGiB > best.modelVramGiB ? m : best,
        )
      : null;

    // 3. Largest Runnable — biggest model by VRAM that fits in GPU
    const fittingModels = models.filter((m) => m.fitsInVram !== false);
    const largestRunnable = fittingModels.length > 0
      ? fittingModels.reduce((best, m) =>
          m.modelVramGiB > best.modelVramGiB ? m : best,
        )
      : null;

    // 4. Lowest Footprint — smallest VRAM model (multi-model serving / sidecar)
    const lowestFootprint = models.reduce((best, m) =>
      m.modelVramGiB < best.modelVramGiB ? m : best,
    );

    // 5. Best Prefill — highest prefill tokens/sec (prompt processing for RAG)
    const prefillModels = models.filter((m) => m.ttft?.prefillTokPerSec > 0);
    const bestPrefill = prefillModels.length > 0
      ? prefillModels.reduce((best, m) =>
          m.ttft.prefillTokPerSec > best.ttft.prefillTokPerSec ? m : best,
        )
      : null;

    // 6. Best Large Model — highest TPS among models ≥8 GiB VRAM
    const LARGE_VRAM_THRESHOLD = 8;
    const largeModels = models.filter(
      (m) => m.modelVramGiB >= LARGE_VRAM_THRESHOLD && m.fitsInVram !== false,
    );
    const bestLargeModel = largeModels.length > 0
      ? largeModels.reduce((best, m) =>
          m.tokensPerSecond > best.tokensPerSecond ? m : best,
        )
      : null;

    // ── Worst Model cards (counterparts) ──

    // W1. Slowest Throughput — lowest TPS
    const slowest = models.reduce((worst, m) =>
      m.tokensPerSecond < worst.tokensPerSecond ? m : worst,
    );

    // W2. Slowest Response — highest TTFT
    const slowestResponse = ttftModels.length > 0
      ? ttftModels.reduce((worst, m) =>
          m.ttft.ms > worst.ttft.ms ? m : worst,
        )
      : null;

    // W3. Worst for Chat — smallest model that still meets ≥30 TPS threshold
    const worstForChat = chatCandidates.length > 0
      ? chatCandidates.reduce((worst, m) =>
          m.modelVramGiB < worst.modelVramGiB ? m : worst,
        )
      : null;

    // W4. Smallest Runnable — smallest fitting model (lowest capability that runs)
    const smallestRunnable = fittingModels.length > 0
      ? fittingModels.reduce((worst, m) =>
          m.modelVramGiB < worst.modelVramGiB ? m : worst,
        )
      : null;

    // W5. Heaviest Footprint — largest VRAM consumer
    const heaviestFootprint = models.reduce((worst, m) =>
      m.modelVramGiB > worst.modelVramGiB ? m : worst,
    );

    // W6. Worst Large Model — slowest TPS among models ≥8 GiB
    const worstLargeModel = largeModels.length > 0
      ? largeModels.reduce((worst, m) =>
          m.tokensPerSecond < worst.tokensPerSecond ? m : worst,
        )
      : null;

    return {
      n, minVram, maxVram,
      fastest, medianTtft, avgDelta, oomCount,
      quantCount, providerCount,
      fastestResponse, bestForChat, largestRunnable, lowestFootprint,
      bestPrefill, bestLargeModel,
      // worst counterparts
      slowest, slowestResponse, worstForChat,
      smallestRunnable, heaviestFootprint, worstLargeModel,
    };
  }, [models]);

  // ── HW label ─────────────────────────────────────────────

  const hwLabel = useMemo(() => {
    if (machineFilter === "all") {
      return machines
        .map((m) => `${shortGPU(m.gpu)} ${m.gpuVramGB} GB`)
        .join(" · ");
    }
    const m = machines.find((x) => x.hostname === machineFilter);
    return m ? `${shortGPU(m.gpu)} ${m.gpuVramGB} GB` : "Unknown";
  }, [machines, machineFilter]);

  // ── Chart render helpers ─────────────────────────────────

  function destroyChart(key) {
    if (chartInstances.current[key]) {
      chartInstances.current[key].destroy();
      chartInstances.current[key] = null;
    }
  }

  // ── Scatter (VRAM vs Speed) ──────────────────────────────

  const renderScatter = useCallback(() => {
    const canvas = chartRefs.scatter.current;
    if (!canvas || models.length === 0) return;
    destroyChart("scatter");

    const ctx = canvas.getContext("2d");
    let datasets;

    if (machineFilter === "all") {
      const gpuGroups = {};
      for (const m of models) {
        const gpu = m.system?.gpu?.name || "Unknown";
        if (!gpuGroups[gpu]) gpuGroups[gpu] = [];
        gpuGroups[gpu].push(m);
      }
      datasets = Object.entries(gpuGroups).map(([gpu, items]) => {
        const color = getGPUColor(gpu);
        return {
          label: shortGPU(gpu),
          data: items.map((m) => ({
            x: m.modelVramGiB,
            y: m.tokensPerSecond,
            r: Math.max(5, Math.min(20, Math.sqrt(m.fileSizeGB) * 4.5)),
            model: m,
          })),
          backgroundColor: color.bg,
          borderColor: color.border,
          borderWidth: 1.5,
          hoverBorderWidth: 2.5,
          hoverBorderColor: "#f8f8f8",
        };
      });
    } else {
      const quantGroups = {};
      for (const m of models) {
        const q = m.quantization || "unknown";
        if (!quantGroups[q]) quantGroups[q] = [];
        quantGroups[q].push(m);
      }
      datasets = Object.entries(quantGroups).map(([q, items]) => {
        const color = getQuantColor(q);
        return {
          label: q,
          data: items.map((m) => ({
            x: m.modelVramGiB,
            y: m.tokensPerSecond,
            r: Math.max(5, Math.min(20, Math.sqrt(m.fileSizeGB) * 4.5)),
            model: m,
          })),
          backgroundColor: color.bg,
          borderColor: color.border,
          borderWidth: 1.5,
          hoverBorderWidth: 2.5,
          hoverBorderColor: "#f8f8f8",
        };
      });
    }

    chartInstances.current.scatter = new Chart(ctx, {
      type: "bubble",
      data: { datasets },
      plugins: [
        makeDatalabelsPlugin({
          getLabel: (raw) => shortModelName(raw?.model?.displayName, 16),
          anchor: "end",
          align: "top",
          offset: 4,
        }),
      ],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 500, easing: "easeOutQuart" },
        interaction: { mode: "nearest", intersect: true },
        scales: {
          x: {
            title: { ...AXIS_TITLE_STYLE, text: "VRAM Usage (GiB)" },
            grid: GRID_STYLE,
            ticks: TICK_STYLE,
            min: 0,
          },
          y: {
            title: { ...AXIS_TITLE_STYLE, text: "Tokens / sec" },
            grid: GRID_STYLE,
            ticks: TICK_STYLE,
            min: 0,
          },
        },
        plugins: {
          legend: LEGEND_STYLE,
          tooltip: {
            ...TOOLTIP_STYLE,
            callbacks: {
              title: (items) => items[0]?.raw?.model?.displayName || "",
              label: (item) => {
                const m = item.raw.model;
                const lines = [
                  `GPU: ${shortGPU(m.system?.gpu?.name)}`,
                  `VRAM: ${m.modelVramGiB.toFixed(2)} GiB (est: ${m.estimatedGiB.toFixed(2)})`,
                  `Speed: ${m.tokensPerSecond?.toFixed(1) || '0'} tok/s`,
                  `File: ${m.fileSizeGB.toFixed(1)} GB · ${m.quantization} (${m.bitsPerWeight || '?'} bpw)`,
                  `Context: ${(m.contextLength / 1024).toFixed(0)}K`,
                  `Efficiency: ${(m.tokensPerSecond / m.modelVramGiB).toFixed(1)} TPS/GiB`,
                ];
                if (m.vramDuringGen?.peakGiB) lines.push(`Peak VRAM (gen): ${m.vramDuringGen.peakGiB.toFixed(2)} GiB`);
                if (m.ttft?.ms) {
                  let ttftLine = `TTFT: ${m.ttft.ms.toFixed(0)} ms`;
                  if (m.ttft.prefillTokPerSec) ttftLine += ` (prefill: ${m.ttft.prefillTokPerSec.toFixed(0)} t/s)`;
                  lines.push(ttftLine);
                }
                if (m.loadTimeMs) lines.push(`Load: ${(m.loadTimeMs / 1000).toFixed(1)}s`);
                if (m.gpu?.temp) lines.push(`GPU: ${m.gpu.temp}°C · ${m.gpu.power || '?'}W · ${m.gpu.utilization || '?'}%`);
                if (m.fitsInVram === false) lines.push(`⚠ Does NOT fit in VRAM`);
                if (m.settings?.label && m.settings.label !== "default") {
                  lines.push(`Settings: ${m.settings.label}`);
                }
                return lines;
              },
            },
          },
        },
      },
    });
  }, [models, machineFilter]);

  // ── Shared range data for bar charts ──────────────────────

  const { vramRanges, tpsRanges } = useMemo(() => {
    const vram = {};
    const tps = {};
    const source = allFilteredData.length > 0 ? allFilteredData : rawData.filter((d) => d.modelVramGiB > 0);
    for (const d of source) {
      const name = d.displayName;
      const v = d.modelVramGiB;
      const t = d.tokensPerSecond || 0;
      // VRAM ranges (store full entries for per-dot tooltips)
      if (!vram[name]) {
        vram[name] = { min: v, max: v, count: 1, values: [v], entries: [d] };
      } else {
        vram[name].min = Math.min(vram[name].min, v);
        vram[name].max = Math.max(vram[name].max, v);
        vram[name].count++;
        vram[name].values.push(v);
        vram[name].entries.push(d);
      }
      // TPS ranges (store full entries for per-dot tooltips)
      if (t > 0) {
        if (!tps[name]) {
          tps[name] = { min: t, max: t, count: 1, values: [t], entries: [d] };
        } else {
          tps[name].min = Math.min(tps[name].min, t);
          tps[name].max = Math.max(tps[name].max, t);
          tps[name].count++;
          tps[name].values.push(t);
          tps[name].entries.push(d);
        }
      }
    }
    return { vramRanges: vram, tpsRanges: tps };
  }, [allFilteredData, rawData]);

  const renderBar = useCallback(() => {
    const canvas = chartRefs.bar.current;
    if (!canvas || models.length === 0) return;
    destroyChart("bar");

    const ctx = canvas.getContext("2d");

    const labels = models.map((m) => {
      const name = m.displayName;
      return name.length > 30 ? name.slice(0, 28) + "…" : name;
    });

    // Dynamic height
    canvas.parentElement.style.height =
      Math.max(400, models.length * 24 + 80) + "px";

    // Build floating bar data: [min, max] tuples per model
    const rangeData = models.map((m) => {
      const range = vramRanges[m.displayName];
      if (range && range.count > 1) {
        return [range.min, range.max];
      }
      // Single entry — show a thin bar (give it ±0.05 so it's still visible)
      return [Math.max(0, m.modelVramGiB - 0.05), m.modelVramGiB + 0.05];
    });

    // Cohesive gradient: map VRAM magnitude to a cyan→indigo→rose scale
    const allVram = models.map((m) => m.modelVramGiB);
    const vMin = Math.min(...allVram);
    const vMax = Math.max(...allVram);
    const vSpan = vMax - vMin || 1;

    function vramColor(gib, alpha = 0.55) {
      const t = (gib - vMin) / vSpan; // 0 → 1
      // HSL sweep: 190 (cyan) → 250 (indigo) → 330 (rose)
      const hue = 190 + t * 140;
      const sat = 70 + t * 10;
      const lgt = 55 - t * 10;
      return {
        bg: `hsla(${hue}, ${sat}%, ${lgt}%, ${alpha})`,
        border: `hsl(${hue}, ${sat}%, ${lgt}%)`,
      };
    }

    // Build scatter overlay: individual entries as interactive dots
    const scatterData = [];
    for (let i = 0; i < models.length; i++) {
      const m = models[i];
      const range = vramRanges[m.displayName];
      if (!range || range.count <= 1) continue;
      for (const entry of range.entries) {
        scatterData.push({ x: entry.modelVramGiB, y: i, entry });
      }
    }

    chartInstances.current.bar = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "VRAM Range (GiB)",
            data: rangeData,
            backgroundColor: models.map((m) => vramColor(m.modelVramGiB, 0.45).bg),
            borderColor: models.map((m) =>
              m.fitsInVram === false ? "#f43f5e" : vramColor(m.modelVramGiB, 1).border,
            ),
            borderWidth: 1.5,
            borderSkipped: false,
            borderRadius: 2,
            hoverBorderWidth: 2.5,
            hoverBorderColor: "#f8f8f8",
            order: 2,
          },
          {
            type: "scatter",
            label: "Individual Runs",
            data: scatterData,
            backgroundColor: "rgba(255, 255, 255, 0.7)",
            borderColor: "rgba(255, 255, 255, 0.3)",
            borderWidth: 0.5,
            pointRadius: 3.5,
            pointHoverRadius: 6,
            pointHoverBackgroundColor: "#fff",
            pointHoverBorderColor: "#6366f1",
            pointHoverBorderWidth: 2,
            order: 1,
          },
        ],
      },
      plugins: [
        makeDatalabelsPlugin({
          getLabel: (_raw, i) => {
            const m = models[i];
            if (!m) return "";
            const range = vramRanges[m.displayName];
            if (range && range.count > 1) {
              return `${range.min.toFixed(1)}–${range.max.toFixed(1)}G`;
            }
            return `${m.modelVramGiB.toFixed(1)}G`;
          },
          anchor: "end",
          align: "right",
          offset: 6,
          filterFn: (di) => di === 0,
        }),
      ],
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 600, easing: "easeOutQuart" },
        interaction: { mode: "point", intersect: true },
        scales: {
          x: {
            title: { ...AXIS_TITLE_STYLE, text: "VRAM (GiB)" },
            grid: GRID_STYLE,
            ticks: TICK_STYLE,
          },
          y: {
            grid: { color: "rgba(255,255,255,0.04)", drawBorder: false },
            ticks: { ...TICK_STYLE, padding: 8 },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            ...TOOLTIP_STYLE,
            callbacks: {
              title: (items) => {
                const item = items[0];
                if (!item) return "";
                // Scatter dot — show entry-specific title
                if (item.datasetIndex === 1) {
                  return item.raw?.entry?.displayName || "";
                }
                return models[item.dataIndex]?.displayName || "";
              },
              afterTitle: (items) => {
                const item = items[0];
                if (!item) return "";
                if (item.datasetIndex === 1) {
                  const e = item.raw?.entry;
                  if (!e) return "";
                  return `${e.quantization} · ${e.architecture} · ${(e.contextLength / 1024).toFixed(0)}K ctx · ${shortGPU(e.system?.gpu?.name)}`;
                }
                const m = models[item.dataIndex];
                if (!m) return "";
                return `${m.quantization} · ${m.architecture} · ${(m.contextLength / 1024).toFixed(0)}K ctx · ${shortGPU(m.system?.gpu?.name)}`;
              },
              label: (item) => {
                // Scatter dot — entry-specific data
                if (item.datasetIndex === 1) {
                  const e = item.raw?.entry;
                  if (!e) return "";
                  return ` VRAM: ${e.modelVramGiB.toFixed(2)} GiB`;
                }
                const m = models[item.dataIndex];
                const range = vramRanges[m.displayName];
                if (range && range.count > 1) {
                  return ` VRAM: ${range.min.toFixed(2)}–${range.max.toFixed(2)} GiB (${range.count} runs)`;
                }
                return ` Measured: ${m.modelVramGiB.toFixed(2)} GiB`;
              },
              afterBody: (items) => {
                const item = items[0];
                if (!item) return "";
                // Use entry-specific data for scatter dots
                const m = item.datasetIndex === 1
                  ? item.raw?.entry
                  : models[item.dataIndex];
                if (!m) return "";
                const lines = [
                  "",
                  `Speed: ${m.tokensPerSecond?.toFixed(1) || '0'} tok/s`,
                  `File: ${m.fileSizeGB.toFixed(1)} GB · ${m.bitsPerWeight || '?'} bpw`,
                  `Efficiency: ${(m.tokensPerSecond / m.modelVramGiB).toFixed(1)} TPS/GiB`,
                ];
                if (m.vramDuringGen?.peakGiB) lines.push(`Peak VRAM (gen): ${m.vramDuringGen.peakGiB.toFixed(2)} GiB`);
                if (m.ttft?.ms) {
                  let ttftLine = `TTFT: ${m.ttft.ms.toFixed(0)} ms`;
                  if (m.ttft.prefillTokPerSec) ttftLine += ` (prefill: ${m.ttft.prefillTokPerSec.toFixed(0)} t/s)`;
                  lines.push(ttftLine);
                }
                if (m.loadTimeMs) lines.push(`Load: ${(m.loadTimeMs / 1000).toFixed(1)}s`);
                if (m.cpuRam?.deltaMiB) lines.push(`CPU RAM Δ: ${(m.cpuRam.deltaMiB / 1024).toFixed(2)} GiB`);
                if (m.gpu?.temp) lines.push(`GPU: ${m.gpu.temp}°C · ${m.gpu.power || '?'}W`);
                if (m.hysteresis?.leakedMiB > 0) lines.push(`⚠ VRAM leak: ${m.hysteresis.leakedMiB} MiB`);
                if (m.fitsInVram === false) lines.push(`⚠ Does NOT fit in VRAM`);
                if (m.generation?.outputTokens) lines.push(`Gen: ${m.generation.outputTokens} tokens in ${(m.generation.totalTimeMs / 1000).toFixed(1)}s`);
                if (m.settings?.label && m.settings.label !== "default") lines.push(`Settings: ${m.settings.label}`);
                return lines;
              },
            },
          },
        },
      },
    });
  }, [models, vramRanges]);

  // ── Tokens per Second (floating range bars) ──────────────

  const renderEfficiency = useCallback(() => {
    const canvas = chartRefs.efficiency.current;
    if (!canvas || models.length === 0) return;
    destroyChart("efficiency");

    const ctx = canvas.getContext("2d");

    // Sort by peak TPS descending
    const sorted = [...models].sort(
      (a, b) => b.tokensPerSecond - a.tokensPerSecond,
    );

    const labels = sorted.map((m) => {
      const name = m.displayName;
      return name.length > 30 ? name.slice(0, 28) + "…" : name;
    });

    // Dynamic height
    canvas.parentElement.style.height =
      Math.max(400, sorted.length * 24 + 80) + "px";

    // Build floating bar data: [min, max] TPS tuples per model
    const rangeData = sorted.map((m) => {
      const range = tpsRanges[m.displayName];
      if (range && range.count > 1) {
        return [range.min, range.max];
      }
      const t = m.tokensPerSecond || 0;
      return [Math.max(0, t - 0.5), t + 0.5];
    });

    // Cohesive gradient: map TPS magnitude to green→cyan→indigo
    const allTps = sorted.map((m) => m.tokensPerSecond || 0);
    const tMin = Math.min(...allTps);
    const tMax = Math.max(...allTps);
    const tSpan = tMax - tMin || 1;

    function tpsColor(tps, alpha = 0.55) {
      const t = (tps - tMin) / tSpan; // 0 → 1
      // HSL sweep: 340 (rose/slow) → 260 (indigo) → 160 (green/fast)
      const hue = 340 - t * 180;
      const sat = 65 + t * 15;
      const lgt = 50 - t * 5;
      return {
        bg: `hsla(${hue}, ${sat}%, ${lgt}%, ${alpha})`,
        border: `hsl(${hue}, ${sat}%, ${lgt}%)`,
      };
    }

    // Strip-plot plugin: draw individual TPS data points inside each bar
    const tpsStripPlotPlugin = {
      id: "tpsStripPlot",
      afterDatasetsDraw(chart) {
        const { ctx: c } = chart;
        const meta = chart.getDatasetMeta(0);
        if (!meta.visible) return;
        c.save();

        for (let i = 0; i < meta.data.length; i++) {
          const el = meta.data[i];
          const m = sorted[i];
          if (!m) continue;
          const range = tpsRanges[m.displayName];
          if (!range || range.count <= 1) continue;

          const xScale = chart.scales.x;
          const barY = el.y;
          const barH = el.height || 14;
          const dotR = Math.min(3.5, barH * 0.2);

          for (const val of range.values) {
            const dotX = xScale.getPixelForValue(val);
            c.beginPath();
            c.arc(dotX, barY, dotR, 0, Math.PI * 2);
            c.fillStyle = "rgba(255, 255, 255, 0.6)";
            c.fill();
            c.strokeStyle = "rgba(255, 255, 255, 0.25)";
            c.lineWidth = 0.5;
            c.stroke();
          }
        }
        c.restore();
      },
    };

    chartInstances.current.efficiency = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Tokens/sec Range",
            data: rangeData,
            backgroundColor: sorted.map((m) => tpsColor(m.tokensPerSecond, 0.45).bg),
            borderColor: sorted.map((m) => tpsColor(m.tokensPerSecond, 1).border),
            borderWidth: 1.5,
            borderSkipped: false,
            borderRadius: 2,
            hoverBorderWidth: 2.5,
            hoverBorderColor: "#f8f8f8",
          },
        ],
      },
      plugins: [
        tpsStripPlotPlugin,
        makeDatalabelsPlugin({
          getLabel: (_raw, i) => {
            const m = sorted[i];
            if (!m) return "";
            const range = tpsRanges[m.displayName];
            if (range && range.count > 1) {
              return `${range.min.toFixed(0)}–${range.max.toFixed(0)} t/s`;
            }
            return `${(m.tokensPerSecond || 0).toFixed(0)} t/s`;
          },
          anchor: "end",
          align: "right",
          offset: 6,
        }),
      ],
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 600, easing: "easeOutQuart" },
        scales: {
          x: {
            title: { ...AXIS_TITLE_STYLE, text: "Tokens / sec" },
            grid: GRID_STYLE,
            ticks: TICK_STYLE,
          },
          y: {
            grid: { color: "rgba(255,255,255,0.04)", drawBorder: false },
            ticks: { ...TICK_STYLE, padding: 8 },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            ...TOOLTIP_STYLE,
            callbacks: {
              title: (items) => sorted[items[0]?.dataIndex]?.displayName || "",
              label: (item) => {
                const m = sorted[item.dataIndex];
                const range = tpsRanges[m.displayName];
                if (range && range.count > 1) {
                  return ` Speed: ${range.min.toFixed(1)}–${range.max.toFixed(1)} tok/s (${range.count} runs)`;
                }
                return ` Speed: ${m.tokensPerSecond?.toFixed(1) || '0'} tok/s`;
              },
              afterBody: (items) => {
                const m = sorted[items[0]?.dataIndex];
                if (!m) return "";
                const lines = [
                  "",
                  ` VRAM: ${m.modelVramGiB.toFixed(2)} GiB`,
                  ` Efficiency: ${(m.tokensPerSecond / m.modelVramGiB).toFixed(1)} TPS/GiB`,
                  ` Quant: ${m.quantization} (${m.bitsPerWeight || '?'} bpw)`,
                  ` Context: ${(m.contextLength / 1024).toFixed(0)}K`,
                ];
                if (m.ttft?.ms) lines.push(` TTFT: ${m.ttft.ms.toFixed(0)} ms`);
                if (m.loadTimeMs) lines.push(` Load: ${(m.loadTimeMs / 1000).toFixed(1)}s`);
                if (m.gpu?.temp) lines.push(` GPU: ${m.gpu.temp}°C · ${m.gpu.power || '?'}W`);
                return lines;
              },
            },
          },
        },
      },
    });
  }, [models, tpsRanges]);

  // ── Quantization Distribution ────────────────────────────

  const renderQuantDist = useCallback(() => {
    const canvas = chartRefs.quantDist.current;
    if (!canvas || models.length === 0) return;
    destroyChart("quantDist");

    const ctx = canvas.getContext("2d");

    // Group by quantization
    const quantGroups = {};
    for (const m of models) {
      const q = m.quantization || "unknown";
      if (!quantGroups[q]) quantGroups[q] = { count: 0, avgVram: 0, avgTps: 0, totalVram: 0, totalTps: 0, totalBpw: 0 };
      quantGroups[q].count++;
      quantGroups[q].totalVram += m.modelVramGiB;
      quantGroups[q].totalTps += m.tokensPerSecond || 0;
      quantGroups[q].totalBpw += m.bitsPerWeight || 0;
    }

    // Sort quant labels by bits-per-weight rank (lowest → highest)
    const QUANT_RANK = {
      IQ1_S: 1, IQ1_M: 2, IQ2_XXS: 3, IQ2_XS: 4, IQ2_S: 5, IQ2_M: 6,
      Q2_K: 7, Q2_K_S: 8,
      IQ3_XXS: 9, IQ3_XS: 10, IQ3_S: 11, IQ3_M: 12,
      Q3_K_S: 13, Q3_K_M: 14, Q3_K_L: 15,
      IQ4_XS: 16, IQ4_NL: 17,
      Q4_0: 18, Q4_1: 19, Q4_K_S: 20, Q4_K_M: 21,
      Q5_0: 22, Q5_1: 23, Q5_K_S: 24, Q5_K_M: 25,
      Q6_K: 26, Q6_K_L: 27,
      Q8_0: 28, Q8_1: 29,
      F16: 90, FP16: 91, BF16: 92, F32: 99, FP32: 100,
      unknown: 999,
    };
    const quantLabels = Object.keys(quantGroups).sort((a, b) => {
      const ra = QUANT_RANK[a] ?? (50 + (quantGroups[a].avgBpw || 50));
      const rb = QUANT_RANK[b] ?? (50 + (quantGroups[b].avgBpw || 50));
      return ra - rb || a.localeCompare(b);
    });
    for (const q of quantLabels) {
      quantGroups[q].avgVram = quantGroups[q].totalVram / quantGroups[q].count;
      quantGroups[q].avgTps = quantGroups[q].totalTps / quantGroups[q].count;
      quantGroups[q].avgBpw = quantGroups[q].totalBpw / quantGroups[q].count;
    }

    chartInstances.current.quantDist = new Chart(ctx, {
      type: "bar",
      data: {
        labels: quantLabels,
        datasets: [
          {
            label: "Avg VRAM (GiB)",
            data: quantLabels.map((q) => quantGroups[q].avgVram),
            backgroundColor: quantLabels.map((q) => getQuantColor(q).bg),
            borderColor: quantLabels.map((q) => getQuantColor(q).border),
            borderWidth: 1.5,
            borderRadius: 2,
            yAxisID: "y",
          },
          {
            label: "Avg TPS",
            data: quantLabels.map((q) => quantGroups[q].avgTps),
            backgroundColor: "rgba(255,255,255,0.06)",
            borderColor: "rgba(255,255,255,0.25)",
            borderWidth: 1.5,
            borderRadius: 2,
            yAxisID: "y1",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 600, easing: "easeOutQuart" },
        interaction: { mode: "index", intersect: false },
        scales: {
          x: {
            grid: { display: false },
            ticks: { ...TICK_STYLE, padding: 8 },
          },
          y: {
            position: "left",
            title: { ...AXIS_TITLE_STYLE, text: "Avg VRAM (GiB)" },
            grid: GRID_STYLE,
            ticks: TICK_STYLE,
          },
          y1: {
            position: "right",
            title: { ...AXIS_TITLE_STYLE, text: "Avg TPS" },
            grid: { display: false },
            ticks: TICK_STYLE,
          },
        },
        plugins: {
          legend: LEGEND_STYLE,
          tooltip: {
            ...TOOLTIP_STYLE,
            callbacks: {
              title: (items) => `${quantLabels[items[0]?.dataIndex]} Quantization`,
              afterTitle: (items) => {
                const q = quantLabels[items[0]?.dataIndex];
                return `${quantGroups[q].count} model${quantGroups[q].count > 1 ? "s" : ""}`;
              },
              label: (item) => {
                const q = quantLabels[item.dataIndex];
                const g = quantGroups[q];
                if (item.datasetIndex === 0) {
                  return ` Avg VRAM: ${g.avgVram.toFixed(2)} GiB`;
                }
                return ` Avg Speed: ${g.avgTps.toFixed(1)} tok/s`;
              },
              afterBody: (items) => {
                const q = quantLabels[items[0]?.dataIndex];
                if (!q) return "";
                const g = quantGroups[q];
                const lines = [];
                if (g.avgBpw > 0) lines.push(`Avg bits/weight: ${g.avgBpw.toFixed(1)} bpw`);
                if (g.avgTps > 0 && g.avgVram > 0) {
                  lines.push(`Avg efficiency: ${(g.avgTps / g.avgVram).toFixed(1)} TPS/GiB`);
                }
                return lines;
              },
            },
          },
        },
      },
    });
  }, [models]);

  // ── Context Length Scaling ────────────────────────────────

  const renderContext = useCallback(() => {
    const canvas = chartRefs.context.current;
    if (!canvas || allFilteredData.length === 0) return;
    destroyChart("context");

    const ctx = canvas.getContext("2d");

    // Group by model name — deduplicate per context (prefer latest)
    const modelGroups = {};
    for (const d of allFilteredData) {
      const name = d.displayName;
      if (!modelGroups[name]) modelGroups[name] = {};
      const ctxKey = d.contextLength;
      if (!modelGroups[name][ctxKey] || d.createdAt > modelGroups[name][ctxKey].createdAt) {
        modelGroups[name][ctxKey] = d;
      }
    }

    // Sort: models with most context lengths first, then by VRAM
    const sortedModels = Object.entries(modelGroups)
      .map(([name, ctxMap]) => ({
        name,
        items: Object.values(ctxMap).sort((a, b) => a.contextLength - b.contextLength),
        ctxCount: Object.keys(ctxMap).length,
      }))
      .sort((a, b) => b.ctxCount - a.ctxCount || a.items[0].modelVramGiB - b.items[0].modelVramGiB)
      .slice(0, 15);

    if (sortedModels.length === 0) return;

    const datasets = sortedModels.map(({ name, items }, i) => {
      const color = PALETTE[i % PALETTE.length];
      return {
        label: name.length > 25 ? name.slice(0, 23) + "\u2026" : name,
        data: items.map((d) => ({
          x: d.contextLength / 1024,
          y: d.modelVramGiB,
          ctx: d,
        })),
        borderColor: color.border,
        backgroundColor: color.bg,
        borderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointBorderWidth: 1.5,
        pointBorderColor: color.border,
        tension: 0.3,
        fill: false,
        showLine: items.length > 1,
      };
    });

    chartInstances.current.context = new Chart(ctx, {
      type: "scatter",
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 500, easing: "easeOutQuart" },
        scales: {
          x: {
            type: "logarithmic",
            title: { ...AXIS_TITLE_STYLE, text: "Context Length (K tokens)" },
            grid: GRID_STYLE,
            afterBuildTicks: (axis) => {
              // Force ticks at powers of 2 instead of decade multiples
              const pow2 = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024];
              axis.ticks = pow2
                .filter((v) => v >= axis.min && v <= axis.max)
                .map((v) => ({ value: v }));
            },
            ticks: {
              ...TICK_STYLE,
              callback: (v) => `${v}K`,
            },
          },
          y: {
            title: { ...AXIS_TITLE_STYLE, text: "VRAM (GiB)" },
            grid: GRID_STYLE,
            ticks: TICK_STYLE,
          },
        },
        plugins: {
          legend: LEGEND_STYLE,
          tooltip: {
            ...TOOLTIP_STYLE,
            callbacks: {
              title: (items) => items[0]?.dataset?.label || "",
              label: (item) => {
                const d = item.raw.ctx;
                const lines = [
                  ` Context: ${item.raw.x}K`,
                  ` VRAM: ${item.raw.y.toFixed(2)} GiB`,
                ];
                if (d?.tokensPerSecond) lines.push(` Speed: ${d.tokensPerSecond.toFixed(1)} tok/s`);
                if (d?.quantization) lines.push(` Quant: ${d.quantization} (${d.bitsPerWeight || "?"} bpw)`);
                if (d?.ttft?.ms) lines.push(` TTFT: ${d.ttft.ms.toFixed(0)} ms`);
                if (d?.fitsInVram === false) lines.push(` ⚠ Does NOT fit in VRAM`);
                return lines;
              },
            },
          },
        },
      },
    });
  }, [allFilteredData]);

  // ── Render active chart on data/view change ─────────────

  useEffect(() => {
    if (loading || error) return;

    // Chart.js global defaults
    Chart.defaults.color = "#6b728e";
    Chart.defaults.borderColor = "rgba(255,255,255,0.04)";
    Chart.defaults.font.family = CHART_FONT;

    // Render the active view
    const renderMap = {
      scatter: renderScatter,
      bar: renderBar,
      efficiency: renderEfficiency,
      quantDist: renderQuantDist,
      context: renderContext,
    };
    renderMap[activeView]?.();

    return () => destroyChart(activeView);
  }, [
    loading,
    error,
    activeView,
    renderScatter,
    renderBar,
    renderEfficiency,
    renderQuantDist,
    renderContext,
  ]);

  // ── Subtitle for header ──────────────────────────────────

   const subtitle = useMemo(() => {
    const parts = [
      `${rawData.length} benchmarks`,
      `${machines.length} machine${machines.length !== 1 ? "s" : ""}`,
    ];
    if (settingsFilter !== "all") parts.push(`⚙ ${settingsFilter}`);
    if (hwLabel) parts.push(hwLabel);
    return parts.join(" · ");
  }, [rawData.length, machines.length, settingsFilter, hwLabel]);

  // ── Chart descriptions per view ──────────────────────────

  const settingsDesc = settingsFilter !== "all" && settingsFilter !== "default"
    ? ` (${settingsFilter} settings)`
    : "";

  const chartDescriptions = {
    scatter: `Each bubble represents a model — size indicates file weight, position reveals the VRAM/throughput trade-off${settingsDesc}.`,
    bar: `Each bar spans the min→max measured VRAM across all benchmark runs${settingsDesc || " — default settings"}.`,
    efficiency: `Each bar spans the min→max tokens/sec across all benchmark runs${settingsDesc || " — default settings"}. Sorted by peak throughput.`,
    quantDist: `Average VRAM and speed grouped by quantization format${settingsDesc}.`,
    context: "How VRAM consumption scales as context window size increases per model.",
  };

  // ── Loading / Error ──────────────────────────────────────

  if (loading) {
    return (
      <>
        <PageHeaderComponent title="VRAM Benchmark" subtitle="Loading…" />
        <div className={styles.content}>
          <LoadingMessage message="Fetching VRAM benchmarks…" />
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageHeaderComponent title="VRAM Benchmark" subtitle="Error" />
        <div className={styles.content}>
          <ErrorMessage message={error} />
        </div>
      </>
    );
  }

  // ── Render ───────────────────────────────────────────────

  return (
    <>
      <PageHeaderComponent
        title="VRAM Benchmark"
        subtitle={subtitle}
        centerContent={
          <div className={styles.hwBadge}>
            <Monitor size={12} />
            {hwLabel || "Loading…"}
          </div>
        }
      >
        <button
          className={styles.refreshBtn}
          onClick={() => {
            setLoading(true);
            fetchData();
          }}
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </PageHeaderComponent>

      <div className={styles.content}>
        {/* Stats cards */}
        {stats && (
          <div className={styles.statsGrid}>
            {/* ── Summary stats (single-width) ── */}
            <StatsCard
              label="Models Profiled"
              value={stats.n}
              icon={Cpu}
              variant="accent"
            />
            <StatsCard
              label="VRAM Range"
              value={`${stats.minVram}—${stats.maxVram}`}
              subtitle="GiB (min → max)"
              icon={Gauge}
              variant="info"
            />
            {stats.medianTtft && (
              <StatsCard
                label="Median TTFT"
                value={`${stats.medianTtft} ms`}
                subtitle="Time to First Token"
                icon={Clock}
                variant="info"
              />
            )}
            <StatsCard
              label="Est. Accuracy"
              value={`±${stats.avgDelta} GiB`}
              subtitle="Avg prediction error"
              icon={Crosshair}
              variant="danger"
            />
            {stats.oomCount > 0 && (
              <StatsCard
                label="OOM Models"
                value={stats.oomCount}
                subtitle="Exceeded GPU VRAM"
                icon={Target}
                variant="danger"
              />
            )}
            <StatsCard
              label="Quantizations"
              value={stats.quantCount}
              subtitle="Distinct formats"
              icon={Grid3x3}
              variant="accent"
            />

            {/* ── Best Model cards (wide, 2-col span) ── */}
            <StatsCard
              className={styles.statWide}
              label="🏆 Best Throughput"
              value={`${stats.fastest.tokensPerSecond.toFixed(0)} t/s`}
              subtitle={`${shortModelName(stats.fastest.displayName, 30)} · ${stats.fastest.quantization} · ${stats.fastest.modelVramGiB.toFixed(1)}G`}
              icon={Zap}
              variant="success"
            />
            {stats.fastestResponse && (
              <StatsCard
                className={styles.statWide}
                label="⚡ Fastest Response"
                value={`${stats.fastestResponse.ttft.ms.toFixed(0)} ms TTFT`}
                subtitle={`${shortModelName(stats.fastestResponse.displayName, 30)} · ${stats.fastestResponse.tokensPerSecond.toFixed(0)} t/s · ${stats.fastestResponse.modelVramGiB.toFixed(1)}G`}
                icon={Crown}
                variant="success"
              />
            )}
            {stats.bestForChat && (
              <StatsCard
                className={styles.statWide}
                label="💬 Best for Chat"
                value={shortModelName(stats.bestForChat.displayName, 28)}
                subtitle={`${stats.bestForChat.tokensPerSecond.toFixed(0)} t/s · ${stats.bestForChat.modelVramGiB.toFixed(1)}G · largest ≥30 t/s`}
                icon={MessageSquare}
                variant="accent"
              />
            )}
            {stats.largestRunnable && (
              <StatsCard
                className={styles.statWide}
                label="🐘 Largest Runnable"
                value={shortModelName(stats.largestRunnable.displayName, 28)}
                subtitle={`${stats.largestRunnable.modelVramGiB.toFixed(1)}G VRAM · ${stats.largestRunnable.tokensPerSecond.toFixed(0)} t/s · ${stats.largestRunnable.quantization}`}
                icon={ArrowDownToLine}
                variant="info"
              />
            )}
            <StatsCard
              className={styles.statWide}
              label="🪶 Lowest Footprint"
              value={shortModelName(stats.lowestFootprint.displayName, 28)}
              subtitle={`${stats.lowestFootprint.modelVramGiB.toFixed(1)}G VRAM · ${stats.lowestFootprint.tokensPerSecond.toFixed(0)} t/s · ${stats.lowestFootprint.quantization}`}
              icon={HardDrive}
              variant="success"
            />
            {stats.bestPrefill && (
              <StatsCard
                className={styles.statWide}
                label="🚀 Best Prefill"
                value={`${stats.bestPrefill.ttft.prefillTokPerSec.toFixed(0)} tok/s`}
                subtitle={`${shortModelName(stats.bestPrefill.displayName, 30)} · prompt ingestion · ${stats.bestPrefill.modelVramGiB.toFixed(1)}G`}
                icon={Rocket}
                variant="success"
              />
            )}
            {stats.bestLargeModel && (
              <StatsCard
                className={styles.statWide}
                label="🧠 Best Large Model"
                value={`${stats.bestLargeModel.tokensPerSecond.toFixed(0)} t/s`}
                subtitle={`${shortModelName(stats.bestLargeModel.displayName, 30)} · fastest ≥8G · ${stats.bestLargeModel.modelVramGiB.toFixed(1)}G`}
                icon={BrainCircuit}
                variant="accent"
              />
            )}

            {/* ── Worst Model cards (wide, 2-col span) ── */}
            <StatsCard
              className={styles.statWide}
              label="🐌 Slowest Throughput"
              value={`${stats.slowest.tokensPerSecond.toFixed(0)} t/s`}
              subtitle={`${shortModelName(stats.slowest.displayName, 30)} · ${stats.slowest.quantization} · ${stats.slowest.modelVramGiB.toFixed(1)}G`}
              icon={ThumbsDown}
              variant="danger"
            />
            {stats.slowestResponse && (
              <StatsCard
                className={styles.statWide}
                label="🐢 Slowest Response"
                value={`${stats.slowestResponse.ttft.ms.toFixed(0)} ms TTFT`}
                subtitle={`${shortModelName(stats.slowestResponse.displayName, 30)} · ${stats.slowestResponse.tokensPerSecond.toFixed(0)} t/s · ${stats.slowestResponse.modelVramGiB.toFixed(1)}G`}
                icon={AlertTriangle}
                variant="danger"
              />
            )}
            {stats.worstForChat && (
              <StatsCard
                className={styles.statWide}
                label="💬 Worst for Chat"
                value={shortModelName(stats.worstForChat.displayName, 28)}
                subtitle={`${stats.worstForChat.tokensPerSecond.toFixed(0)} t/s · ${stats.worstForChat.modelVramGiB.toFixed(1)}G · smallest ≥30 t/s`}
                icon={ThumbsDown}
                variant="danger"
              />
            )}
            {stats.smallestRunnable && (
              <StatsCard
                className={styles.statWide}
                label="🔬 Smallest Runnable"
                value={shortModelName(stats.smallestRunnable.displayName, 28)}
                subtitle={`${stats.smallestRunnable.modelVramGiB.toFixed(1)}G VRAM · ${stats.smallestRunnable.tokensPerSecond.toFixed(0)} t/s · ${stats.smallestRunnable.quantization}`}
                icon={AlertTriangle}
                variant="warning"
              />
            )}
            <StatsCard
              className={styles.statWide}
              label="🏋️ Heaviest Footprint"
              value={shortModelName(stats.heaviestFootprint.displayName, 28)}
              subtitle={`${stats.heaviestFootprint.modelVramGiB.toFixed(1)}G VRAM · ${stats.heaviestFootprint.tokensPerSecond.toFixed(0)} t/s · ${stats.heaviestFootprint.quantization}`}
              icon={ThumbsDown}
              variant="danger"
            />
            {stats.worstLargeModel && (
              <StatsCard
                className={styles.statWide}
                label="🧠 Worst Large Model"
                value={`${stats.worstLargeModel.tokensPerSecond.toFixed(0)} t/s`}
                subtitle={`${shortModelName(stats.worstLargeModel.displayName, 30)} · slowest ≥8G · ${stats.worstLargeModel.modelVramGiB.toFixed(1)}G`}
                icon={AlertTriangle}
                variant="danger"
              />
            )}
          </div>
        )}

        {/* Global filters — apply to all tabs */}
        <FilterBarComponent>
          <FilterSelectComponent
            value={machineFilter}
            onChange={setMachineFilter}
            options={[
              { value: "all", label: "All Machines" },
              ...machines.map((m) => ({
                value: m.hostname,
                label: `${m.hostname} · ${shortGPU(m.gpu)} (${m.benchmarkCount})`,
              })),
            ]}
          />
          <FilterSelectComponent
            value={providerFilter}
            onChange={setProviderFilter}
            options={[
              { value: "all", label: "All Providers" },
              ...providerOptions.map((p) => ({
                value: p,
                label: p,
              })),
            ]}
          />
        </FilterBarComponent>

        {/* Tab bar for chart type */}
        <TabBarComponent
          tabs={VIEW_TABS}
          activeTab={activeView}
          onChange={setActiveView}
          className={styles.tabBar}
        />

        {/* Chart area */}
        <div className={styles.chartCard}>
          {/* Per-tab filters */}
          <FilterBarComponent>
            <FilterSelectComponent
              value={settingsFilter}
              onChange={(val) => {
                setSettingsFilter(val);
                setLoading(true);
              }}
              options={[
                { value: "all", label: "All Settings" },
                ...settingsLabels.map((s) => ({
                  value: s,
                  label: `⚙ ${s}`,
                })),
              ]}
            />
            {activeView !== "context" && (
              <FilterSelectComponent
                value={ctxFilter}
                onChange={setCtxFilter}
                options={[
                  { value: "all", label: "All Contexts" },
                  ...contextLengths.map((c) => ({
                    value: String(c),
                    label: c >= 1024 ? `${(c / 1024).toFixed(0)}K Context` : `${c} Context`,
                  })),
                ]}
              />
            )}
            {!["context", "quantDist"].includes(activeView) && (
              <FilterSelectComponent
                value={sortBy}
                onChange={setSortBy}
                options={[
                  { value: "vram", label: "Sort: VRAM Usage" },
                  { value: "tps", label: "Sort: Tokens/sec" },
                  { value: "efficiency", label: "Sort: Efficiency" },
                  { value: "filesize", label: "Sort: File Size" },
                  { value: "ttft", label: "Sort: TTFT" },
                  { value: "loadTime", label: "Sort: Load Time" },
                ]}
              />
            )}
          </FilterBarComponent>

          <p className={styles.chartDescription}>
            {chartDescriptions[activeView]}
          </p>
          <div className={styles.chartPanels}>
            {VIEW_TABS.map((tab) => (
              <div
                key={tab.key}
                className={styles.chartWrapper}
                style={{
                  display: activeView === tab.key ? "block" : "none",
                  height: tab.key === "bar" || tab.key === "efficiency"
                    ? undefined
                    : 460,
                }}
              >
                <canvas ref={chartRefs[tab.key]} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

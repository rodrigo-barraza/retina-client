"use client";

import { useState, useEffect, useRef, useCallback, useMemo, Fragment } from "react";

import {
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
  Ruler,
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
import SelectDropdown from "./SelectDropdown";
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
        if (filterFn && !filterFn(di, chart)) continue;
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

// ── Connector highlight plugin ───────────────────────────────
// When hovering a bubble, highlights its connector line and sibling
// bubbles across GPUs with a glow ring + solid bold line.

function makeConnectorHighlightPlugin() {
  return {
    id: "connectorHighlight",
    afterEvent(chart, args) {
      const event = args.event;
      const elements = chart.getElementsAtEventForMode(
        event, "nearest", { intersect: true }, false,
      );
      let hoveredModel = null;

      if (elements.length > 0) {
        const el = elements[0];
        const ds = chart.data.datasets[el.datasetIndex];
        // Only trigger on bubble datasets, not connector lines
        if (ds.type !== "line") {
          const raw = ds.data[el.index];
          hoveredModel = raw?.model?.displayName || null;
        }
      }

      const prev = chart._hoveredConnectorModel;
      chart._hoveredConnectorModel = hoveredModel;
      if (prev !== hoveredModel) args.changed = true;
    },
    afterDraw(chart) {
      const hoveredModel = chart._hoveredConnectorModel;
      if (!hoveredModel) return;

      const { ctx } = chart;
      ctx.save();

      // Collect pixel positions for all bubbles matching this model
      const bubblePoints = [];

      for (let di = 0; di < chart.data.datasets.length; di++) {
        const ds = chart.data.datasets[di];
        if (ds.type === "line") continue;
        const meta = chart.getDatasetMeta(di);
        if (!meta.visible) continue;

        for (let i = 0; i < ds.data.length; i++) {
          const raw = ds.data[i];
          if (raw?.model?.displayName !== hoveredModel) continue;
          const el = meta.data[i];
          if (!el) continue;
          bubblePoints.push({
            x: el.x,
            y: el.y,
            r: el.options?.radius || raw.r || 5,
            borderColor: ds.borderColor,
          });
        }
      }

      if (bubblePoints.length < 2) {
        ctx.restore();
        return;
      }

      // Sort by x for consistent line direction
      bubblePoints.sort((a, b) => a.x - b.x);

      // Draw bold solid connector line
      ctx.beginPath();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
      ctx.lineWidth = 2.5;
      ctx.setLineDash([]);
      ctx.moveTo(bubblePoints[0].x, bubblePoints[0].y);
      for (let i = 1; i < bubblePoints.length; i++) {
        ctx.lineTo(bubblePoints[i].x, bubblePoints[i].y);
      }
      ctx.stroke();

      // Draw glow rings around sibling bubbles
      for (const p of bubblePoints) {
        // Outer glow
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r + 5, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
        ctx.lineWidth = 4;
        ctx.stroke();

        // Inner ring
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r + 2, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      ctx.restore();
    },
  };
}

// ── Settings info for tooltips ──────────────────────────────

const SETTINGS_INFO = {
  "no-flash-attn": {
    flash: false, kv: "GPU", batch: 512, parallel: 4,
    purpose: "Worst-case VRAM. FP32 KV cache (~2× size) + 4 concurrent slots. Stress test ceiling.",
  },
  "max-quality": {
    flash: false, kv: "GPU", batch: 512, parallel: 1,
    purpose: "Maximum precision, single user. FP32 KV cache, all VRAM for one request.",
  },
  "default": {
    flash: true, kv: "GPU", batch: 512, parallel: 4,
    purpose: "Standard config. Flash attention (Q8 KV, ~50% savings). What most people use.",
  },
  "small-batch": {
    flash: true, kv: "GPU", batch: 128, parallel: 4,
    purpose: "Lower peak VRAM during prefill. Slightly slower TTFT but gentler on memory spikes.",
  },
  "single-slot": {
    flash: true, kv: "GPU", batch: 512, parallel: 1,
    purpose: "Default quality, single user. Shows per-slot KV cache overhead.",
  },
  "kv-on-cpu": {
    flash: true, kv: "CPU", batch: 512, parallel: 4,
    purpose: "KV cache in system RAM. Massive VRAM savings but attention crosses PCIe — hurts latency.",
  },
  "min-vram": {
    flash: true, kv: "CPU", batch: 128, parallel: 1,
    purpose: "Everything minimized. Absolute floor for running a model — \"can it even load?\" testing.",
  },
};

function SettingsTooltipContent({ settingsKey }) {
  const info = SETTINGS_INFO[settingsKey];
  if (!info) return settingsKey;
  return (
    <span style={{ display: "block", whiteSpace: "normal", maxWidth: 320, lineHeight: 1.5 }}>
      <span style={{ fontWeight: 700, fontSize: 12, marginBottom: 4, display: "block" }}>
        {settingsKey}
      </span>
      <span style={{ display: "block", fontSize: 11, opacity: 0.7, marginBottom: 6 }}>
        {info.purpose}
      </span>
      <span style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 12px", fontSize: 10.5, opacity: 0.55 }}>
        <span>Flash Attn: {info.flash ? "✓" : "✗"}</span>
        <span>KV Cache: {info.kv}</span>
        <span>Batch: {info.batch}</span>
        <span>Parallel: {info.parallel}</span>
      </span>
    </span>
  );
}

const SETTINGS_EMOJI = {
  "no-flash-attn": "🔥",
  "max-quality": "💎",
  "default": "⚡",
  "small-batch": "📦",
  "single-slot": "🎯",
  "kv-on-cpu": "🧊",
  "min-vram": "🪶",
};

function SettingsMatrixTooltip() {
  const rows = Object.entries(SETTINGS_INFO);
  return (
    <span style={{ display: "block", whiteSpace: "normal", maxWidth: 420, lineHeight: 1.6 }}>
      <span style={{ fontWeight: 700, fontSize: 12, marginBottom: 6, display: "block" }}>
        Settings Configuration Matrix
      </span>
      <span style={{ display: "grid", gridTemplateColumns: "auto auto auto auto auto", gap: "2px 10px", fontSize: 10, opacity: 0.8 }}>
        <span style={{ fontWeight: 700, opacity: 0.5 }}>Setting</span>
        <span style={{ fontWeight: 700, opacity: 0.5 }}>Flash</span>
        <span style={{ fontWeight: 700, opacity: 0.5 }}>KV</span>
        <span style={{ fontWeight: 700, opacity: 0.5 }}>Batch</span>
        <span style={{ fontWeight: 700, opacity: 0.5 }}>Parallel</span>
        {rows.map(([key, info]) => (
          <Fragment key={key}>
            <span>{SETTINGS_EMOJI[key] || "⚙️"} {key}</span>
            <span>{info.flash ? "✓" : "✗"}</span>
            <span>{info.kv}</span>
            <span>{info.batch}</span>
            <span>{info.parallel}</span>
          </Fragment>
        ))}
      </span>
    </span>
  );
}

// ── Scatter axis modes ───────────────────────────────────────
// Each mode maps different data dimensions to the X/Y axes of the
// bubble chart, turning the sort dropdown into a dimension explorer.

const SCATTER_MODES = [
  {
    key: "vram_vs_speed",
    label: "VRAM vs Speed",
    desc: "Position reveals the VRAM/throughput trade-off.",
    getX: (m) => m.modelVramGiB,
    getY: (m) => m.tokensPerSecond,
    xLabel: "VRAM Usage (GiB)",
    yLabel: "Tokens / sec",
    xMin: 0,
    yMin: -30,
  },
  {
    key: "vram_vs_efficiency",
    label: "VRAM vs Efficiency",
    desc: "How many tokens each GiB of VRAM produces — higher is better.",
    getX: (m) => m.modelVramGiB,
    getY: (m) => m.modelVramGiB > 0 ? m.tokensPerSecond / m.modelVramGiB : 0,
    xLabel: "VRAM Usage (GiB)",
    yLabel: "Efficiency (TPS / GiB)",
    xMin: 0,
    yMin: -2,
  },
  {
    key: "vram_vs_ttft",
    label: "VRAM vs TTFT",
    desc: "Time to First Token — critical for interactive chat responsiveness.",
    getX: (m) => m.modelVramGiB,
    getY: (m) => m.ttft?.ms,
    xLabel: "VRAM Usage (GiB)",
    yLabel: "Time to First Token (ms)",
    xMin: 0,
    yMin: -50,
    filter: (m) => m.ttft?.ms > 0,
  },
  {
    key: "filesize_vs_speed",
    label: "File Size vs Speed",
    desc: "Disk footprint against inference speed — find the sweet spot for your storage.",
    getX: (m) => m.fileSizeGB,
    getY: (m) => m.tokensPerSecond,
    xLabel: "File Size (GB)",
    yLabel: "Tokens / sec",
    xMin: 0,
    yMin: -30,
  },
  {
    key: "vram_vs_loadtime",
    label: "VRAM vs Load Time",
    desc: "Model load time — important for cold-start and multi-model switching.",
    getX: (m) => m.modelVramGiB,
    getY: (m) => m.loadTimeMs ? m.loadTimeMs / 1000 : null,
    xLabel: "VRAM Usage (GiB)",
    yLabel: "Load Time (sec)",
    xMin: 0,
    yMin: -1,
    filter: (m) => m.loadTimeMs > 0,
  },
  {
    key: "bpw_vs_speed",
    label: "Quantization vs Speed",
    desc: "Bits per weight against throughput — see how quantization affects performance.",
    getX: (m) => m.bitsPerWeight,
    getY: (m) => m.tokensPerSecond,
    xLabel: "Bits per Weight",
    yLabel: "Tokens / sec",
    xMin: 0,
    yMin: -30,
    filter: (m) => m.bitsPerWeight > 0,
  },
];

// ── View tabs ────────────────────────────────────────────────
// Scatter label is dynamic — replaced in a memo inside the component.

const VIEW_TABS = [
  { key: "scatter", label: "VRAM vs Speed", icon: <TrendingUp size={12} /> },
  { key: "bar", label: "VRAM Usage", icon: <BarChart3 size={12} /> },
  { key: "efficiency", label: "Tokens per Second", icon: <Zap size={12} /> },
  { key: "quantDist", label: "Quantization", icon: <Layers size={12} /> },
  { key: "ctxLeaderboard", label: "Context Length", icon: <Ruler size={12} /> },
  { key: "context", label: "Context Scaling", icon: <HardDrive size={12} /> },
];

// ═════════════════════════════════════════════════════════════
// Component
// ═════════════════════════════════════════════════════════════

export default function VramBenchmarkComponent() {
  const [rawData, setRawData] = useState([]);
  const [machines, setMachines] = useState([]);
  const [settingsLabels, setSettingsLabels] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [machineFilter, setMachineFilter] = useState("all");
  const [providerFilter, setProviderFilter] = useState("all");
  const [settingsFilter, setSettingsFilter] = useState("all");
  const [parallelFilter, setParallelFilter] = useState("all");
  const [batchFilter, setBatchFilter] = useState("all");
  const [ctxMin, setCtxMin] = useState("");
  const [ctxMax, setCtxMax] = useState("");
  const [sortBy, setSortBy] = useState("vram");
  const [scatterMode, setScatterMode] = useState("vram_vs_speed");
  const [vramClipMin, setVramClipMin] = useState("");
  const [vramClipMax, setVramClipMax] = useState("");
  const [tpsClipMin, setTpsClipMin] = useState("");
  const [tpsClipMax, setTpsClipMax] = useState("");
  const [scatterClipXMin, setScatterClipXMin] = useState("");
  const [scatterClipXMax, setScatterClipXMax] = useState("");
  const [activeView, setActiveView] = useState("scatter");

  // Parsed clip values — undefined means "auto" (Chart.js default)
  const clipMin = useMemo(() => {
    const v = parseFloat(vramClipMin);
    return isNaN(v) || v < 0 ? undefined : v;
  }, [vramClipMin]);
  const clipMax = useMemo(() => {
    const v = parseFloat(vramClipMax);
    return isNaN(v) || v <= 0 ? undefined : v;
  }, [vramClipMax]);
  const tpsClipMinVal = useMemo(() => {
    const v = parseFloat(tpsClipMin);
    return isNaN(v) || v < 0 ? undefined : v;
  }, [tpsClipMin]);
  const tpsClipMaxVal = useMemo(() => {
    const v = parseFloat(tpsClipMax);
    return isNaN(v) || v <= 0 ? undefined : v;
  }, [tpsClipMax]);
  const scatterClipXMinVal = useMemo(() => {
    const v = parseFloat(scatterClipXMin);
    return isNaN(v) || v < 0 ? undefined : v;
  }, [scatterClipXMin]);
  const scatterClipXMaxVal = useMemo(() => {
    const v = parseFloat(scatterClipXMax);
    return isNaN(v) || v <= 0 ? undefined : v;
  }, [scatterClipXMax]);

  // Parsed context range values (in thousands → multiply by 1024 for actual ctx)
  const ctxMinVal = useMemo(() => {
    const v = parseFloat(ctxMin);
    return isNaN(v) || v < 0 ? undefined : v * 1024;
  }, [ctxMin]);
  const ctxMaxVal = useMemo(() => {
    const v = parseFloat(ctxMax);
    return isNaN(v) || v <= 0 ? undefined : v * 1024;
  }, [ctxMax]);

  // Distinct parallel and batch options from SETTINGS_INFO
  const parallelOptions = useMemo(() => {
    const set = new Set(Object.values(SETTINGS_INFO).map((s) => s.parallel));
    return [...set].sort((a, b) => a - b);
  }, []);
  const batchOptions = useMemo(() => {
    const set = new Set(Object.values(SETTINGS_INFO).map((s) => s.batch));
    return [...set].sort((a, b) => a - b);
  }, []);

  // Active scatter mode config
  const activeScatterMode = useMemo(
    () => SCATTER_MODES.find((m) => m.key === scatterMode) || SCATTER_MODES[0],
    [scatterMode],
  );

  // Dynamic tab labels — scatter tab reflects current axis mode
  const viewTabs = useMemo(
    () => VIEW_TABS.map((tab) =>
      tab.key === "scatter" ? { ...tab, label: activeScatterMode.label } : tab,
    ),
    [activeScatterMode],
  );

  // Canvas refs — one per chart type
  const chartRefs = {
    scatter: useRef(null),
    bar: useRef(null),
    efficiency: useRef(null),
    quantDist: useRef(null),
    ctxLeaderboard: useRef(null),
    context: useRef(null),
  };
  const chartInstances = useRef({});

  // ── Fetch data ───────────────────────────────────────────

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [benchRes, machinesRes, settingsRes] = await Promise.all([
        PrismService.getVramBenchmarks({
          ...(settingsFilter !== "all" ? { settings: settingsFilter } : {}),
        }),
        PrismService.getVramBenchmarkMachines(),
        PrismService.getVramBenchmarkSettings(),
      ]);
      setRawData(benchRes.data || []);
      setMachines(machinesRes || []);
      setSettingsLabels(settingsRes || []);
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

    // Context range filter (min-max in actual context length units)
    if (ctxMinVal !== undefined) {
      filtered = filtered.filter((d) => d.contextLength >= ctxMinVal);
    }
    if (ctxMaxVal !== undefined) {
      filtered = filtered.filter((d) => d.contextLength <= ctxMaxVal);
    }

    // Parallel filter — match via SETTINGS_INFO lookup
    if (parallelFilter !== "all") {
      const pVal = parseInt(parallelFilter);
      filtered = filtered.filter((d) => {
        const info = SETTINGS_INFO[d.settings?.label];
        return info?.parallel === pVal;
      });
    }

    // Batch filter — match via SETTINGS_INFO lookup
    if (batchFilter !== "all") {
      const bVal = parseInt(batchFilter);
      filtered = filtered.filter((d) => {
        const info = SETTINGS_INFO[d.settings?.label];
        return info?.batch === bVal;
      });
    }

    // Deduplicate: one per model+context combo
    // When "All Settings" is loaded, prefer "default" setting as representative
    const byKey = {};
    for (const d of filtered) {
      const key = `${d.displayName}__${d.contextLength}`;
      const existing = byKey[key];
      if (!existing) {
        byKey[key] = d;
      } else {
        // Prefer "default" setting over others, then latest run
        const dIsDefault = d.settings?.label === "default";
        const existingIsDefault = existing.settings?.label === "default";
        if (dIsDefault && !existingIsDefault) {
          byKey[key] = d;
        } else if (!dIsDefault && existingIsDefault) {
          // keep existing
        } else if (d.createdAt > existing.createdAt) {
          byKey[key] = d;
        }
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
  }, [rawData, machineFilter, providerFilter, ctxMinVal, ctxMaxVal, parallelFilter, batchFilter, sortBy]);

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
    // Context range filter
    if (ctxMinVal !== undefined) {
      filtered = filtered.filter((d) => d.contextLength >= ctxMinVal);
    }
    if (ctxMaxVal !== undefined) {
      filtered = filtered.filter((d) => d.contextLength <= ctxMaxVal);
    }
    // Parallel filter
    if (parallelFilter !== "all") {
      const pVal = parseInt(parallelFilter);
      filtered = filtered.filter((d) => {
        const info = SETTINGS_INFO[d.settings?.label];
        return info?.parallel === pVal;
      });
    }
    // Batch filter
    if (batchFilter !== "all") {
      const bVal = parseInt(batchFilter);
      filtered = filtered.filter((d) => {
        const info = SETTINGS_INFO[d.settings?.label];
        return info?.batch === bVal;
      });
    }
    return filtered;
  }, [rawData, machineFilter, providerFilter, ctxMinVal, ctxMaxVal, parallelFilter, batchFilter]);

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

    // ── Build sorted card arrays by model name ──

    // Helper — short settings tag for card subtitles
    const stag = (m) => m.settings?.label ? ` · ⚙ ${m.settings.label}` : "";
    // Helper — context length tag for card subtitles
    const ctag = (m) => m.contextLength ? ` · ${(m.contextLength / 1024).toFixed(0)}K ctx` : "";

    const bestCards = [
      fastest && {
        key: "best-throughput",
        label: "🏆 Best Throughput",
        value: shortModelName(fastest.displayName, 28),
        subtitle: `${fastest.tokensPerSecond.toFixed(0)} t/s · ${fastest.quantization} · ${fastest.modelVramGiB.toFixed(1)}G${ctag(fastest)}${stag(fastest)}`,
        icon: Zap,
        variant: "success",
        sortName: fastest.displayName,
      },
      fastestResponse && {
        key: "fastest-response",
        label: "⚡ Fastest Response",
        value: shortModelName(fastestResponse.displayName, 28),
        subtitle: `${fastestResponse.ttft.ms.toFixed(0)} ms TTFT · ${fastestResponse.tokensPerSecond.toFixed(0)} t/s · ${fastestResponse.modelVramGiB.toFixed(1)}G${ctag(fastestResponse)}${stag(fastestResponse)}`,
        icon: Crown,
        variant: "success",
        sortName: fastestResponse.displayName,
      },
      bestForChat && {
        key: "best-chat",
        label: "💬 Best for Chat",
        value: shortModelName(bestForChat.displayName, 28),
        subtitle: `${bestForChat.tokensPerSecond.toFixed(0)} t/s · ${bestForChat.modelVramGiB.toFixed(1)}G · largest ≥30 t/s${ctag(bestForChat)}${stag(bestForChat)}`,
        icon: MessageSquare,
        variant: "accent",
        sortName: bestForChat.displayName,
      },
      largestRunnable && {
        key: "largest-runnable",
        label: "🐘 Largest Runnable",
        value: shortModelName(largestRunnable.displayName, 28),
        subtitle: `${largestRunnable.modelVramGiB.toFixed(1)}G VRAM · ${largestRunnable.tokensPerSecond.toFixed(0)} t/s · ${largestRunnable.quantization}${ctag(largestRunnable)}${stag(largestRunnable)}`,
        icon: ArrowDownToLine,
        variant: "info",
        sortName: largestRunnable.displayName,
      },
      lowestFootprint && {
        key: "lowest-footprint",
        label: "🪶 Lowest Footprint",
        value: shortModelName(lowestFootprint.displayName, 28),
        subtitle: `${lowestFootprint.modelVramGiB.toFixed(1)}G VRAM · ${lowestFootprint.tokensPerSecond.toFixed(0)} t/s · ${lowestFootprint.quantization}${ctag(lowestFootprint)}${stag(lowestFootprint)}`,
        icon: HardDrive,
        variant: "success",
        sortName: lowestFootprint.displayName,
      },
      bestPrefill && {
        key: "best-prefill",
        label: "🚀 Best Prefill",
        value: shortModelName(bestPrefill.displayName, 28),
        subtitle: `${bestPrefill.ttft.prefillTokPerSec.toFixed(0)} tok/s prefill · ${bestPrefill.modelVramGiB.toFixed(1)}G${ctag(bestPrefill)}${stag(bestPrefill)}`,
        icon: Rocket,
        variant: "success",
        sortName: bestPrefill.displayName,
      },
      bestLargeModel && {
        key: "best-large",
        label: "🧠 Best Large Model",
        value: shortModelName(bestLargeModel.displayName, 28),
        subtitle: `${bestLargeModel.tokensPerSecond.toFixed(0)} t/s · fastest ≥8G · ${bestLargeModel.modelVramGiB.toFixed(1)}G${ctag(bestLargeModel)}${stag(bestLargeModel)}`,
        icon: BrainCircuit,
        variant: "accent",
        sortName: bestLargeModel.displayName,
      },
    ].filter(Boolean);

    const worstCards = [
      slowest && {
        key: "slowest-throughput",
        label: "🐌 Slowest Throughput",
        value: shortModelName(slowest.displayName, 28),
        subtitle: `${slowest.tokensPerSecond.toFixed(0)} t/s · ${slowest.quantization} · ${slowest.modelVramGiB.toFixed(1)}G${ctag(slowest)}${stag(slowest)}`,
        icon: ThumbsDown,
        variant: "danger",
        sortName: slowest.displayName,
      },
      slowestResponse && {
        key: "slowest-response",
        label: "🐢 Slowest Response",
        value: shortModelName(slowestResponse.displayName, 28),
        subtitle: `${slowestResponse.ttft.ms.toFixed(0)} ms TTFT · ${slowestResponse.tokensPerSecond.toFixed(0)} t/s · ${slowestResponse.modelVramGiB.toFixed(1)}G${ctag(slowestResponse)}${stag(slowestResponse)}`,
        icon: AlertTriangle,
        variant: "danger",
        sortName: slowestResponse.displayName,
      },
      worstForChat && {
        key: "worst-chat",
        label: "💬 Worst for Chat",
        value: shortModelName(worstForChat.displayName, 28),
        subtitle: `${worstForChat.tokensPerSecond.toFixed(0)} t/s · ${worstForChat.modelVramGiB.toFixed(1)}G · smallest ≥30 t/s${ctag(worstForChat)}${stag(worstForChat)}`,
        icon: ThumbsDown,
        variant: "danger",
        sortName: worstForChat.displayName,
      },
      smallestRunnable && {
        key: "smallest-runnable",
        label: "🔬 Smallest Runnable",
        value: shortModelName(smallestRunnable.displayName, 28),
        subtitle: `${smallestRunnable.modelVramGiB.toFixed(1)}G VRAM · ${smallestRunnable.tokensPerSecond.toFixed(0)} t/s · ${smallestRunnable.quantization}${ctag(smallestRunnable)}${stag(smallestRunnable)}`,
        icon: AlertTriangle,
        variant: "warning",
        sortName: smallestRunnable.displayName,
      },
      heaviestFootprint && {
        key: "heaviest-footprint",
        label: "🏋️ Heaviest Footprint",
        value: shortModelName(heaviestFootprint.displayName, 28),
        subtitle: `${heaviestFootprint.modelVramGiB.toFixed(1)}G VRAM · ${heaviestFootprint.tokensPerSecond.toFixed(0)} t/s · ${heaviestFootprint.quantization}${ctag(heaviestFootprint)}${stag(heaviestFootprint)}`,
        icon: ThumbsDown,
        variant: "danger",
        sortName: heaviestFootprint.displayName,
      },
      worstLargeModel && {
        key: "worst-large",
        label: "🧠 Worst Large Model",
        value: shortModelName(worstLargeModel.displayName, 28),
        subtitle: `${worstLargeModel.tokensPerSecond.toFixed(0)} t/s · slowest ≥8G · ${worstLargeModel.modelVramGiB.toFixed(1)}G${ctag(worstLargeModel)}${stag(worstLargeModel)}`,
        icon: AlertTriangle,
        variant: "danger",
        sortName: worstLargeModel.displayName,
      },
    ].filter(Boolean);

    // Merge best + worst and sort all 12 cards together by model name
    const modelCards = [...bestCards, ...worstCards]
      .sort((a, b) => a.sortName.localeCompare(b.sortName));

    return {
      n, minVram, maxVram,
      fastest, medianTtft, avgDelta, oomCount,
      quantCount, providerCount,
      modelCards,
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

  // ── Programmatic chart highlight on card hover ──────────
  // Uses Chart.js's setActiveElements API to emulate a hover
  // on the data point(s) that match `displayName`.

  const highlightModelInChart = useCallback((displayName) => {
    const chart = chartInstances.current[activeView];
    if (!chart) return;

    if (!displayName) {
      // Clear highlight
      chart.setActiveElements([]);
      chart.tooltip?.setActiveElements([], { x: 0, y: 0 });
      chart.update("none");
      return;
    }

    const activeEls = [];

    for (let di = 0; di < chart.data.datasets.length; di++) {
      const ds = chart.data.datasets[di];
      const data = ds.data;

      for (let idx = 0; idx < data.length; idx++) {
        let match = false;

        // Scatter / bubble: raw has .model.displayName
        if (data[idx]?.model?.displayName === displayName) {
          match = true;
        }

        // Scatter overlay entries on bar/efficiency charts: raw has .entry.displayName
        if (data[idx]?.entry?.displayName === displayName) {
          match = true;
        }

        // Context scaling: raw has .ctx.displayName
        if (data[idx]?.ctx?.displayName === displayName) {
          match = true;
        }

        // Index-axis bar charts (bar, efficiency, ctxLeaderboard):
        // match against chart labels — check if displayName starts with (or equals) the label
        if (!match && chart.data.labels?.[idx]) {
          const label = chart.data.labels[idx];
          if (
            displayName === label ||
            displayName.startsWith(label.replace("…", ""))
          ) {
            match = true;
          }
        }

        // Context scaling: dataset label contains model name
        if (!match && activeView === "context" && ds.label) {
          const dsLabel = ds.label.replace("…", "").split(" · ")[0];
          if (displayName.startsWith(dsLabel) || dsLabel.startsWith(displayName.slice(0, 20))) {
            match = true;
          }
        }

        if (match) {
          activeEls.push({ datasetIndex: di, index: idx });
        }
      }
    }

    if (activeEls.length > 0) {
      chart.setActiveElements(activeEls);
      // Position tooltip near the first highlighted element
      const meta = chart.getDatasetMeta(activeEls[0].datasetIndex);
      const el = meta.data[activeEls[0].index];
      if (el) {
        chart.tooltip?.setActiveElements(activeEls, {
          x: el.x,
          y: el.y,
        });
      }
    } else {
      chart.setActiveElements([]);
      chart.tooltip?.setActiveElements([], { x: 0, y: 0 });
    }
    chart.update("none");
  }, [activeView]);

  // ── Scatter (dynamic axes) ───────────────────────────────

  const renderScatter = useCallback(() => {
    const canvas = chartRefs.scatter.current;
    if (!canvas || models.length === 0) return;

    // If the canvas element changed (e.g. remount after loading), destroy stale instance
    const existing = chartInstances.current.scatter;
    if (existing && existing.canvas !== canvas) {
      existing.destroy();
      chartInstances.current.scatter = null;
    }

    const ctx = canvas.getContext("2d");
    const mode = activeScatterMode;
    // With range-based context filter, check if multiple distinct contexts exist
    const distinctCtx = new Set(allFilteredData.map((d) => d.contextLength));
    const showAllCtx = distinctCtx.size > 1;
    let datasets;

    // Helper to build bubble data point from a model entry
    const toPoint = (m) => {
      const x = mode.getX(m);
      const y = mode.getY(m);
      if (x == null || y == null || isNaN(x) || isNaN(y)) return null;
      return {
        x,
        y,
        r: Math.max(5, Math.min(20, Math.sqrt(m.fileSizeGB) * 4.5)),
        model: m,
      };
    };

    // Helper to fade an rgba() color
    const fadeBg = (rgba) => rgba.replace(/[\d.]+\)$/, "0.12)");
    // Helper to fade a #hex border color
    const fadeBorder = (hex) => {
      const h = hex.replace("#", "");
      const r = parseInt(h.substring(0, 2), 16);
      const g = parseInt(h.substring(2, 4), 16);
      const b = parseInt(h.substring(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, 0.22)`;
    };

    // Compute bestKeys: for "all contexts", find the highest-TPS entry per group
    const computeBestKeys = (entries, groupKeyFn) => {
      if (!showAllCtx) return null;
      const bestByGroup = {};
      for (const m of entries) {
        const gk = groupKeyFn(m);
        if (!bestByGroup[gk] || m.tokensPerSecond > bestByGroup[gk].tokensPerSecond) {
          bestByGroup[gk] = m;
        }
      }
      const set = new Set();
      for (const m of Object.values(bestByGroup)) {
        set.add(`${m.displayName}__${m.system?.gpu?.name || "Unknown"}__${m.contextLength}`);
      }
      return set;
    };

    const entryKey = (m) =>
      `${m.displayName}__${m.system?.gpu?.name || "Unknown"}__${m.contextLength}`;

    if (machineFilter === "all") {
      let source = allFilteredData;
      if (mode.filter) {
        source = source.filter(mode.filter);
      }

      // Dedup: one per model+GPU (+context when showing all)
      const byKey = {};
      for (const d of source) {
        const gpu = d.system?.gpu?.name || "Unknown";
        const key = showAllCtx
          ? `${d.displayName}__${gpu}__${d.contextLength}`
          : `${d.displayName}__${gpu}`;
        if (!byKey[key] || d.createdAt > byKey[key].createdAt) {
          byKey[key] = d;
        }
      }
      const scatterModels = Object.values(byKey);

      const bestKeys = computeBestKeys(
        scatterModels,
        (m) => `${m.displayName}__${m.system?.gpu?.name || "Unknown"}`,
      );

      // Group by GPU for bubble coloring
      const gpuGroups = {};
      for (const m of scatterModels) {
        const gpu = m.system?.gpu?.name || "Unknown";
        if (!gpuGroups[gpu]) gpuGroups[gpu] = [];
        gpuGroups[gpu].push(m);
      }

      datasets = Object.entries(gpuGroups).map(([gpu, items]) => {
        const color = getGPUColor(gpu);
        const points = items.map(toPoint).filter(Boolean);

        // Per-point opacity when showing all contexts
        if (bestKeys) {
          return {
            type: "bubble",
            label: shortGPU(gpu),
            data: points,
            backgroundColor: points.map((p) =>
              bestKeys.has(entryKey(p.model)) ? color.bg : fadeBg(color.bg),
            ),
            borderColor: points.map((p) =>
              bestKeys.has(entryKey(p.model)) ? color.border : fadeBorder(color.border),
            ),
            borderWidth: points.map((p) =>
              bestKeys.has(entryKey(p.model)) ? 1.5 : 0.5,
            ),
            hoverBorderWidth: 2.5,
            hoverBorderColor: "#f8f8f8",
            order: 2,
          };
        }

        return {
          type: "bubble",
          label: shortGPU(gpu),
          data: points,
          backgroundColor: color.bg,
          borderColor: color.border,
          borderWidth: 1.5,
          hoverBorderWidth: 2.5,
          hoverBorderColor: "#f8f8f8",
          order: 2,
        };
      });

      // Connector lines — only link "best" bubbles across GPUs
      const modelToPoints = {};
      for (const m of scatterModels) {
        if (bestKeys && !bestKeys.has(entryKey(m))) continue;
        const pt = toPoint(m);
        if (!pt) continue;
        if (!modelToPoints[m.displayName]) modelToPoints[m.displayName] = [];
        modelToPoints[m.displayName].push(pt);
      }

      for (const [, points] of Object.entries(modelToPoints)) {
        if (points.length < 2) continue;
        points.sort((a, b) => a.x - b.x);
        datasets.push({
          type: "line",
          label: "_connector",
          data: points.map((p) => ({ x: p.x, y: p.y, model: p.model })),
          borderColor: "rgba(255, 255, 255, 0.18)",
          borderWidth: 1.5,
          borderDash: [6, 3],
          pointRadius: 0,
          pointHitRadius: 0,
          pointHoverRadius: 0,
          fill: false,
          tension: 0,
          order: 3,
        });
      }
    } else {
      // Single machine — use allFilteredData when showing all contexts
      let source;
      if (showAllCtx) {
        source = allFilteredData.filter(
          (d) => (d.system?.hostname || "unknown") === machineFilter,
        );
      } else {
        source = models.map((m) => m); // clone so filter doesn't mutate
      }
      if (mode.filter) source = source.filter(mode.filter);

      // Dedup per model (+context when showing all)
      const byKey = {};
      for (const d of source) {
        const key = showAllCtx
          ? `${d.displayName}__${d.contextLength}`
          : d.displayName;
        if (!byKey[key] || d.createdAt > byKey[key].createdAt) {
          byKey[key] = d;
        }
      }
      const scatterData = Object.values(byKey);

      const bestKeys = computeBestKeys(
        scatterData,
        (m) => m.displayName,
      );

      const quantGroups = {};
      for (const m of scatterData) {
        const q = m.quantization || "unknown";
        if (!quantGroups[q]) quantGroups[q] = [];
        quantGroups[q].push(m);
      }
      datasets = Object.entries(quantGroups).map(([q, items]) => {
        const color = getQuantColor(q);
        const points = items.map(toPoint).filter(Boolean);

        if (bestKeys) {
          return {
            label: q,
            data: points,
            backgroundColor: points.map((p) =>
              bestKeys.has(entryKey(p.model)) ? color.bg : fadeBg(color.bg),
            ),
            borderColor: points.map((p) =>
              bestKeys.has(entryKey(p.model)) ? color.border : fadeBorder(color.border),
            ),
            borderWidth: points.map((p) =>
              bestKeys.has(entryKey(p.model)) ? 1.5 : 0.5,
            ),
            hoverBorderWidth: 2.5,
            hoverBorderColor: "#f8f8f8",
          };
        }

        return {
          label: q,
          data: points,
          backgroundColor: color.bg,
          borderColor: color.border,
          borderWidth: 1.5,
          hoverBorderWidth: 2.5,
          hoverBorderColor: "#f8f8f8",
        };
      });
    }

    // ── Reuse or create chart ──
    const currentChart = chartInstances.current.scatter;
    if (currentChart) {
      // Update data — instant swap, no misleading slide-from-bottom
      currentChart.data.datasets = datasets;
      currentChart.options.scales.x.title.text = mode.xLabel;
      currentChart.options.scales.y.title.text = mode.yLabel;
      currentChart.options.scales.x.min = scatterClipXMinVal ?? (mode.xMin ?? 0);
      currentChart.options.scales.y.min = mode.yMin ?? 0;
      if (scatterClipXMaxVal !== undefined) { currentChart.options.scales.x.max = scatterClipXMaxVal; } else { delete currentChart.options.scales.x.max; }
      currentChart.update("none");
    } else {
      chartInstances.current.scatter = new Chart(ctx, {
        type: "bubble",
        data: { datasets },
        plugins: [
          makeDatalabelsPlugin({
            getLabel: (raw) => shortModelName(raw?.model?.displayName, 16),
            anchor: "end",
            align: "top",
            offset: 4,
            filterFn: (di, chart) => chart.data.datasets[di]?.type !== "line",
          }),
          makeConnectorHighlightPlugin(),
        ],
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 600, easing: "easeInOutQuart" },
          transitions: {
            active: { animation: { duration: 200 } },
            zoom: { animation: { duration: 500, easing: "easeInOutCubic" } },
          },
          interaction: { mode: "nearest", intersect: true },
          scales: {
            x: {
              title: { ...AXIS_TITLE_STYLE, text: mode.xLabel },
              grid: GRID_STYLE,
              ticks: TICK_STYLE,
              min: scatterClipXMinVal ?? (mode.xMin ?? 0),
              ...(scatterClipXMaxVal !== undefined ? { max: scatterClipXMaxVal } : {}),
            },
            y: {
              title: { ...AXIS_TITLE_STYLE, text: mode.yLabel },
              grid: GRID_STYLE,
              ticks: { ...TICK_STYLE, callback: (v) => v < 0 ? "" : v },
              min: mode.yMin ?? 0,
            },
          },
          plugins: {
            legend: {
              ...LEGEND_STYLE,
              labels: {
                ...LEGEND_STYLE.labels,
                filter: (item) => item.text !== "_connector",
              },
            },
            tooltip: {
              ...TOOLTIP_STYLE,
              filter: (item) => item.dataset.type !== "line",
              callbacks: {
                title: (items) => items[0]?.raw?.model?.displayName || "",
                label: (item) => {
                  const m = item.raw.model;
                  const sInfo = SETTINGS_INFO[m.settings?.label];
                  const lines = [
                    `GPU: ${shortGPU(m.system?.gpu?.name)}`,
                    `VRAM: ${m.modelVramGiB.toFixed(2)} GiB (est: ${m.estimatedGiB.toFixed(2)})`,
                    `Parallel: ${sInfo?.parallel ?? '?'}`,
                    `Batch: ${sInfo?.batch ?? '?'}`,
                    `Context: ${(m.contextLength / 1024).toFixed(0)}K`,
                    `Speed: ${m.tokensPerSecond?.toFixed(1) || '0'} tok/s`,
                    `File: ${m.fileSizeGB.toFixed(1)} GB · ${m.quantization} (${m.bitsPerWeight || '?'} bpw)`,
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
    }
  }, [models, machineFilter, allFilteredData, activeScatterMode]);

  // ── Shared range data for bar charts ──────────────────────

  const { vramRanges, tpsRanges, ctxRanges } = useMemo(() => {
    const vram = {};
    const tps = {};
    const ctxR = {};
    const source = allFilteredData.length > 0 ? allFilteredData : rawData.filter((d) => d.modelVramGiB > 0);
    for (const d of source) {
      const name = d.displayName;
      const v = d.modelVramGiB;
      const t = d.tokensPerSecond || 0;
      const c = d.contextLength || 0;
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
      // Context length ranges (store full entries for per-dot tooltips)
      if (c > 0) {
        const cK = c / 1024;
        if (!ctxR[name]) {
          ctxR[name] = { min: cK, max: cK, count: 1, values: [cK], entries: [d] };
        } else {
          ctxR[name].min = Math.min(ctxR[name].min, cK);
          ctxR[name].max = Math.max(ctxR[name].max, cK);
          ctxR[name].count++;
          ctxR[name].values.push(cK);
          ctxR[name].entries.push(d);
        }
      }
    }
    return { vramRanges: vram, tpsRanges: tps, ctxRanges: ctxR };
  }, [allFilteredData, rawData]);

  // ── Zoom-update effects: animate x-axis range when clip values change ──
  useEffect(() => {
    const chart = chartInstances.current.scatter;
    if (!chart) return;
    const xScale = chart.options.scales.x;
    const mode = activeScatterMode;
    xScale.min = scatterClipXMinVal ?? (mode.xMin ?? 0);
    if (scatterClipXMaxVal !== undefined) { xScale.max = scatterClipXMaxVal; } else { delete xScale.max; }
    chart.update("zoom");
  }, [scatterClipXMinVal, scatterClipXMaxVal, activeScatterMode]);

  useEffect(() => {
    const chart = chartInstances.current.bar;
    if (!chart) return;
    const xScale = chart.options.scales.x;
    // Apply or clear min/max
    if (clipMin !== undefined) { xScale.min = clipMin; } else { delete xScale.min; }
    if (clipMax !== undefined) { xScale.max = clipMax; } else { delete xScale.max; }
    chart.update("zoom");
  }, [clipMin, clipMax]);

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
        scatterData.push({ x: entry.modelVramGiB, y: labels[i], entry });
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
            ...(clipMin != null ? { min: clipMin } : {}),
            ...(clipMax != null ? { max: clipMax } : {}),
          },
          y: {
            grid: { color: "rgba(255,255,255,0.04)", drawBorder: false },
            ticks: { ...TICK_STYLE, padding: 8 },
          },
        },
        transitions: {
          zoom: {
            animation: { duration: 500, easing: "easeInOutCubic" },
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
                const sInfo = SETTINGS_INFO[m.settings?.label];
                const lines = [
                  "",
                  `Parallel: ${sInfo?.parallel ?? '?'}`,
                  `Batch: ${sInfo?.batch ?? '?'}`,
                  `Context: ${(m.contextLength / 1024).toFixed(0)}K`,
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

    // Build scatter overlay: individual TPS entries as interactive dots
    const scatterData = [];
    for (let i = 0; i < sorted.length; i++) {
      const m = sorted[i];
      const range = tpsRanges[m.displayName];
      if (!range || range.count <= 1) continue;
      for (const entry of range.entries) {
        scatterData.push({ x: entry.tokensPerSecond || 0, y: labels[i], entry });
      }
    }

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
            title: { ...AXIS_TITLE_STYLE, text: "Tokens / sec" },
            grid: GRID_STYLE,
            ticks: TICK_STYLE,
            ...(tpsClipMinVal !== undefined ? { min: tpsClipMinVal } : {}),
            ...(tpsClipMaxVal !== undefined ? { max: tpsClipMaxVal } : {}),
          },
          y: {
            grid: { color: "rgba(255,255,255,0.04)", drawBorder: false },
            ticks: { ...TICK_STYLE, padding: 8 },
          },
        },
        transitions: {
          zoom: {
            animation: { duration: 500, easing: "easeInOutCubic" },
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
                if (item.datasetIndex === 1) {
                  return item.raw?.entry?.displayName || "";
                }
                return sorted[item.dataIndex]?.displayName || "";
              },
              afterTitle: (items) => {
                const item = items[0];
                if (!item) return "";
                if (item.datasetIndex === 1) {
                  const e = item.raw?.entry;
                  if (!e) return "";
                  return `${e.quantization} · ${e.architecture} · ${(e.contextLength / 1024).toFixed(0)}K ctx · ${shortGPU(e.system?.gpu?.name)}`;
                }
                const m = sorted[item.dataIndex];
                if (!m) return "";
                return `${m.quantization} · ${m.architecture} · ${(m.contextLength / 1024).toFixed(0)}K ctx`;
              },
              label: (item) => {
                if (item.datasetIndex === 1) {
                  const e = item.raw?.entry;
                  if (!e) return "";
                  return ` Speed: ${(e.tokensPerSecond || 0).toFixed(1)} tok/s`;
                }
                const m = sorted[item.dataIndex];
                const range = tpsRanges[m.displayName];
                if (range && range.count > 1) {
                  return ` Speed: ${range.min.toFixed(1)}–${range.max.toFixed(1)} tok/s (${range.count} runs)`;
                }
                return ` Speed: ${m.tokensPerSecond?.toFixed(1) || '0'} tok/s`;
              },
              afterBody: (items) => {
                const item = items[0];
                if (!item) return "";
                const m = item.datasetIndex === 1
                  ? item.raw?.entry
                  : sorted[item.dataIndex];
                if (!m) return "";
                const sInfo = SETTINGS_INFO[m.settings?.label];
                const lines = [
                  "",
                  ` VRAM: ${m.modelVramGiB.toFixed(2)} GiB`,
                  ` Parallel: ${sInfo?.parallel ?? '?'}`,
                  ` Batch: ${sInfo?.batch ?? '?'}`,
                  ` Context: ${(m.contextLength / 1024).toFixed(0)}K`,
                  ` Efficiency: ${(m.tokensPerSecond / m.modelVramGiB).toFixed(1)} TPS/GiB`,
                  ` Quant: ${m.quantization} (${m.bitsPerWeight || '?'} bpw)`,
                ];
                if (m.ttft?.ms) lines.push(` TTFT: ${m.ttft.ms.toFixed(0)} ms`);
                if (m.loadTimeMs) lines.push(` Load: ${(m.loadTimeMs / 1000).toFixed(1)}s`);
                if (m.gpu?.temp) lines.push(` GPU: ${m.gpu.temp}°C · ${m.gpu.power || '?'}W`);
                if (m.settings?.label && m.settings.label !== "default") lines.push(` Settings: ${m.settings.label}`);
                return lines;
              },
            },
          },
        },
      },
    });
  }, [models, tpsRanges]);

  // ── TPS zoom-update effect ──
  useEffect(() => {
    const chart = chartInstances.current.efficiency;
    if (!chart) return;
    const xScale = chart.options.scales.x;
    if (tpsClipMinVal !== undefined) { xScale.min = tpsClipMinVal; } else { delete xScale.min; }
    if (tpsClipMaxVal !== undefined) { xScale.max = tpsClipMaxVal; } else { delete xScale.max; }
    chart.update("zoom");
  }, [tpsClipMinVal, tpsClipMaxVal]);

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
      if (!quantGroups[q]) {
        quantGroups[q] = {
          count: 0, totalVram: 0, totalTps: 0, totalBpw: 0,
          minVram: Infinity, maxVram: -Infinity,
          minTps: Infinity, maxTps: -Infinity,
        };
      }
      const tps = m.tokensPerSecond || 0;
      quantGroups[q].count++;
      quantGroups[q].totalVram += m.modelVramGiB;
      quantGroups[q].totalTps += tps;
      quantGroups[q].totalBpw += m.bitsPerWeight || 0;
      if (m.modelVramGiB < quantGroups[q].minVram) quantGroups[q].minVram = m.modelVramGiB;
      if (m.modelVramGiB > quantGroups[q].maxVram) quantGroups[q].maxVram = m.modelVramGiB;
      if (tps < quantGroups[q].minTps) quantGroups[q].minTps = tps;
      if (tps > quantGroups[q].maxTps) quantGroups[q].maxTps = tps;
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
      const g = quantGroups[q];
      g.avgVram = g.totalVram / g.count;
      g.avgTps = g.totalTps / g.count;
      g.avgBpw = g.totalBpw / g.count;
      // For single-model quants, add a small visual range so the bar is visible
      if (g.minVram === g.maxVram) {
        g.minVram = g.avgVram * 0.97;
        g.maxVram = g.avgVram * 1.03;
      }
      if (g.minTps === g.maxTps) {
        g.minTps = g.avgTps * 0.97;
        g.maxTps = g.avgTps * 1.03;
      }
    }

    // Custom plugin: draw average tick marks on both VRAM and TPS bars
    const avgLinePlugin = {
      id: "quantAvgLine",
      afterDatasetsDraw(chart) {
        const { ctx: c } = chart;
        c.save();

        const drawAvgTick = (datasetIdx, scaleId, getAvg) => {
          const meta = chart.getDatasetMeta(datasetIdx);
          if (!meta.visible) return;
          const scale = chart.scales[scaleId];

          for (let i = 0; i < meta.data.length; i++) {
            const bar = meta.data[i];
            const q = quantLabels[i];
            const avg = getAvg(quantGroups[q]);
            const yPx = scale.getPixelForValue(avg);
            const halfW = bar.width / 2;
            const barBorder = bar.options?.borderColor || "#6366f1";

            // Tick line
            c.beginPath();
            c.strokeStyle = barBorder;
            c.lineWidth = 2.5;
            c.moveTo(bar.x - halfW + 2, yPx);
            c.lineTo(bar.x + halfW - 2, yPx);
            c.stroke();

            // Label with outline for readability
            const text = avg.toFixed(1);
            c.font = `600 9px ${CHART_FONT}`;
            c.textAlign = "center";
            c.textBaseline = "bottom";
            // Outline
            c.strokeStyle = "rgba(0,0,0,0.6)";
            c.lineWidth = 3;
            c.lineJoin = "round";
            c.strokeText(text, bar.x, yPx - 4);
            // Fill
            c.fillStyle = "#fff";
            c.fillText(text, bar.x, yPx - 4);
          }
        };

        drawAvgTick(0, "y", (g) => g.avgVram);   // VRAM bars
        drawAvgTick(1, "y1", (g) => g.avgTps);    // TPS bars

        c.restore();
      },
    };

    chartInstances.current.quantDist = new Chart(ctx, {
      type: "bar",
      data: {
        labels: quantLabels,
        datasets: [
          {
            label: "VRAM Range (GiB)",
            data: quantLabels.map((q) => [quantGroups[q].minVram, quantGroups[q].maxVram]),
            backgroundColor: quantLabels.map((q) => getQuantColor(q).bg),
            borderColor: quantLabels.map((q) => getQuantColor(q).border),
            borderWidth: 1.5,
            borderRadius: 2,
            borderSkipped: false,
            yAxisID: "y",
          },
          {
            label: "TPS Range",
            data: quantLabels.map((q) => [quantGroups[q].minTps, quantGroups[q].maxTps]),
            backgroundColor: "rgba(128,128,128,0.15)",
            borderColor: "rgba(100,100,100,0.5)",
            borderWidth: 1.5,
            borderRadius: 2,
            borderSkipped: false,
            yAxisID: "y1",
          },
        ],
      },
      plugins: [avgLinePlugin],
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
            title: { ...AXIS_TITLE_STYLE, text: "VRAM (GiB)" },
            grid: GRID_STYLE,
            ticks: TICK_STYLE,
          },
          y1: {
            position: "right",
            title: { ...AXIS_TITLE_STYLE, text: "TPS" },
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
                  return [
                    ` Avg VRAM: ${g.avgVram.toFixed(2)} GiB`,
                    ` Range: ${(g.count > 1 ? g.minVram : g.avgVram).toFixed(2)} → ${(g.count > 1 ? g.maxVram : g.avgVram).toFixed(2)} GiB`,
                  ];
                }
                return [
                  ` Avg Speed: ${g.avgTps.toFixed(1)} tok/s`,
                  ` Range: ${(g.count > 1 ? g.minTps : g.avgTps).toFixed(1)} → ${(g.count > 1 ? g.maxTps : g.avgTps).toFixed(1)} tok/s`,
                ];
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

  // ── Context Length Leaderboard ────────────────────────────
  // Dual-axis horizontal floating range bars — matches VRAM/TPS chart pattern.
  // Primary x: context length range (K), Secondary x: TPS range.

  const renderCtxLeaderboard = useCallback(() => {
    const canvas = chartRefs.ctxLeaderboard.current;
    if (!canvas || models.length === 0) return;
    destroyChart("ctxLeaderboard");

    const ctx = canvas.getContext("2d");

    // Sort by max context descending, then TPS within same tier
    const sorted = [...models].sort((a, b) => {
      const cA = ctxRanges[a.displayName]?.max || a.contextLength / 1024 || 0;
      const cB = ctxRanges[b.displayName]?.max || b.contextLength / 1024 || 0;
      return cB - cA || b.tokensPerSecond - a.tokensPerSecond;
    });

    const labels = sorted.map((m) => {
      const name = m.displayName;
      return name.length > 30 ? name.slice(0, 28) + "…" : name;
    });

    // Dynamic height
    canvas.parentElement.style.height =
      Math.max(400, sorted.length * 24 + 80) + "px";

    // Build floating bar data: [min, max] context (K) tuples per model
    const ctxRangeData = sorted.map((m) => {
      const range = ctxRanges[m.displayName];
      if (range && range.count > 1) {
        return [range.min, range.max];
      }
      const k = (m.contextLength || 0) / 1024;
      return [Math.max(0, k - 0.5), k + 0.5];
    });

    // Build floating bar data: [min, max] TPS tuples per model
    const tpsRangeData = sorted.map((m) => {
      const range = tpsRanges[m.displayName];
      if (range && range.count > 1) {
        return [range.min, range.max];
      }
      const t = m.tokensPerSecond || 0;
      return [Math.max(0, t - 0.5), t + 0.5];
    });

    // Color gradient for context bars: cyan → emerald → teal by context magnitude
    const allCtx = sorted.map((m) => ctxRanges[m.displayName]?.max || (m.contextLength || 0) / 1024);
    const cMin = Math.min(...allCtx);
    const cMax = Math.max(...allCtx);
    const cSpan = cMax - cMin || 1;

    function ctxColor(k, alpha = 0.55) {
      const t = (k - cMin) / cSpan; // 0 → 1
      // HSL sweep: 190 (cyan/small) → 160 (emerald/medium) → 140 (teal/large)
      const hue = 190 - t * 50;
      const sat = 60 + t * 20;
      const lgt = 55 - t * 10;
      return {
        bg: `hsla(${hue}, ${sat}%, ${lgt}%, ${alpha})`,
        border: `hsl(${hue}, ${sat}%, ${lgt}%)`,
      };
    }

    // Build scatter overlay: individual context entries as interactive dots
    const ctxScatterData = [];
    for (let i = 0; i < sorted.length; i++) {
      const m = sorted[i];
      const range = ctxRanges[m.displayName];
      if (!range || range.count <= 1) continue;
      for (const entry of range.entries) {
        ctxScatterData.push({
          x: (entry.contextLength || 0) / 1024,
          y: labels[i],
          entry,
        });
      }
    }

    // Build scatter overlay: individual TPS entries as interactive dots
    const tpsScatterData = [];
    for (let i = 0; i < sorted.length; i++) {
      const m = sorted[i];
      const range = tpsRanges[m.displayName];
      if (!range || range.count <= 1) continue;
      for (const entry of range.entries) {
        tpsScatterData.push({
          x: entry.tokensPerSecond || 0,
          y: labels[i],
          entry,
        });
      }
    }



    chartInstances.current.ctxLeaderboard = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Context Range (K)",
            data: ctxRangeData,
            backgroundColor: sorted.map((m) =>
              ctxColor(ctxRanges[m.displayName]?.max || (m.contextLength || 0) / 1024, 0.45).bg,
            ),
            borderColor: sorted.map((m) =>
              m.fitsInVram === false
                ? "#f43f5e"
                : ctxColor(ctxRanges[m.displayName]?.max || (m.contextLength || 0) / 1024, 1).border,
            ),
            borderWidth: 1.5,
            borderSkipped: false,
            borderRadius: 2,
            hoverBorderWidth: 2.5,
            hoverBorderColor: "#f8f8f8",
            xAxisID: "x",
            order: 4,
          },
          {
            label: "TPS Range",
            data: tpsRangeData,
            backgroundColor: "rgba(128,128,128,0.15)",
            borderColor: "rgba(100,100,100,0.5)",
            borderWidth: 1.5,
            borderSkipped: false,
            borderRadius: 2,
            hoverBorderWidth: 2.5,
            hoverBorderColor: "#f8f8f8",
            xAxisID: "x1",
            order: 3,
          },
          {
            type: "scatter",
            label: "Context Runs",
            data: ctxScatterData,
            backgroundColor: "rgba(255, 255, 255, 0.7)",
            borderColor: "rgba(255, 255, 255, 0.3)",
            borderWidth: 0.5,
            pointRadius: 3.5,
            pointHoverRadius: 6,
            pointHoverBackgroundColor: "#fff",
            pointHoverBorderColor: "#14b8a6",
            pointHoverBorderWidth: 2,
            xAxisID: "x",
            order: 1,
          },
          {
            type: "scatter",
            label: "TPS Runs",
            data: tpsScatterData,
            backgroundColor: "rgba(255, 255, 255, 0.5)",
            borderColor: "rgba(255, 255, 255, 0.2)",
            borderWidth: 0.5,
            pointRadius: 3,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: "#fff",
            pointHoverBorderColor: "#6366f1",
            pointHoverBorderWidth: 2,
            xAxisID: "x1",
            order: 2,
          },
        ],
      },
      plugins: [
        makeDatalabelsPlugin({
          getLabel: (_raw, i) => {
            const m = sorted[i];
            if (!m) return "";
            // Context range label
            const cRange = ctxRanges[m.displayName];
            let ctxLabel;
            if (cRange && cRange.count > 1) {
              const minL = cRange.min >= 1024 ? `${(cRange.min / 1024).toFixed(0)}M` : `${cRange.min.toFixed(0)}K`;
              const maxL = cRange.max >= 1024 ? `${(cRange.max / 1024).toFixed(0)}M` : `${cRange.max.toFixed(0)}K`;
              ctxLabel = `${minL}–${maxL}`;
            } else {
              const k = (m.contextLength || 0) / 1024;
              ctxLabel = k >= 1024 ? `${(k / 1024).toFixed(0)}M` : `${k.toFixed(0)}K`;
            }
            // TPS label
            const tRange = tpsRanges[m.displayName];
            let tpsLabel;
            if (tRange && tRange.count > 1) {
              tpsLabel = `${tRange.min.toFixed(0)}–${tRange.max.toFixed(0)} t/s`;
            } else {
              tpsLabel = `${(m.tokensPerSecond || 0).toFixed(0)} t/s`;
            }
            return `${ctxLabel} · ${tpsLabel}`;
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
            position: "bottom",
            title: { ...AXIS_TITLE_STYLE, text: "Context Length (K tokens)" },
            grid: GRID_STYLE,
            ticks: {
              ...TICK_STYLE,
              callback: (v) => v >= 1024 ? `${(v / 1024).toFixed(0)}M` : `${v}K`,
            },
          },
          x1: {
            position: "top",
            title: { ...AXIS_TITLE_STYLE, text: "Tokens / sec" },
            grid: { display: false },
            ticks: TICK_STYLE,
          },
          y: {
            grid: { color: "rgba(255,255,255,0.04)", drawBorder: false },
            ticks: { ...TICK_STYLE, padding: 8 },
          },
        },
        plugins: {
          legend: LEGEND_STYLE,
          tooltip: {
            ...TOOLTIP_STYLE,
            callbacks: {
              title: (items) => {
                const item = items[0];
                if (!item) return "";
                // Scatter dots
                if (item.datasetIndex >= 2) {
                  return item.raw?.entry?.displayName || "";
                }
                return sorted[item.dataIndex]?.displayName || "";
              },
              afterTitle: (items) => {
                const item = items[0];
                if (!item) return "";
                if (item.datasetIndex >= 2) {
                  const e = item.raw?.entry;
                  if (!e) return "";
                  return `${e.quantization} · ${e.architecture} · ${(e.contextLength / 1024).toFixed(0)}K ctx · ${shortGPU(e.system?.gpu?.name)}`;
                }
                const m = sorted[item.dataIndex];
                if (!m) return "";
                return `${m.quantization} · ${m.architecture} · ${(m.contextLength / 1024).toFixed(0)}K ctx · ${shortGPU(m.system?.gpu?.name)}`;
              },
              label: (item) => {
                // Scatter dots — entry-specific
                if (item.datasetIndex === 2) {
                  const e = item.raw?.entry;
                  if (!e) return "";
                  return ` Context: ${((e.contextLength || 0) / 1024).toFixed(0)}K`;
                }
                if (item.datasetIndex === 3) {
                  const e = item.raw?.entry;
                  if (!e) return "";
                  return ` Speed: ${(e.tokensPerSecond || 0).toFixed(1)} tok/s`;
                }
                const m = sorted[item.dataIndex];
                if (!m) return "";
                if (item.datasetIndex === 0) {
                  const range = ctxRanges[m.displayName];
                  if (range && range.count > 1) {
                    const minL = range.min >= 1024 ? `${(range.min / 1024).toFixed(0)}M` : `${range.min.toFixed(0)}K`;
                    const maxL = range.max >= 1024 ? `${(range.max / 1024).toFixed(0)}M` : `${range.max.toFixed(0)}K`;
                    return ` Context: ${minL}–${maxL} (${range.count} runs)`;
                  }
                  return ` Context: ${((m.contextLength || 0) / 1024).toFixed(0)}K`;
                }
                // TPS bar
                const tRange = tpsRanges[m.displayName];
                if (tRange && tRange.count > 1) {
                  return ` Speed: ${tRange.min.toFixed(1)}–${tRange.max.toFixed(1)} tok/s (${tRange.count} runs)`;
                }
                return ` Speed: ${m.tokensPerSecond?.toFixed(1) || "0"} tok/s`;
              },
              afterBody: (items) => {
                const item = items[0];
                if (!item) return "";
                const m = item.datasetIndex >= 2
                  ? item.raw?.entry
                  : sorted[item.dataIndex];
                if (!m) return "";
                const sInfo = SETTINGS_INFO[m.settings?.label];
                const lines = [
                  "",
                  `VRAM: ${m.modelVramGiB.toFixed(2)} GiB`,
                  `Parallel: ${sInfo?.parallel ?? '?'}`,
                  `Batch: ${sInfo?.batch ?? '?'}`,
                  `Context: ${(m.contextLength / 1024).toFixed(0)}K`,
                  `Efficiency: ${(m.tokensPerSecond / m.modelVramGiB).toFixed(1)} TPS/GiB`,
                  `Quant: ${m.quantization} (${m.bitsPerWeight || "?"} bpw)`,
                ];
                if (m.ttft?.ms) lines.push(`TTFT: ${m.ttft.ms.toFixed(0)} ms`);
                if (m.loadTimeMs) lines.push(`Load: ${(m.loadTimeMs / 1000).toFixed(1)}s`);
                if (m.gpu?.temp) lines.push(`GPU: ${m.gpu.temp}°C · ${m.gpu.power || "?"}W`);
                if (m.fitsInVram === false) lines.push(`⚠ Does NOT fit in VRAM`);
                if (m.settings?.label && m.settings.label !== "default") lines.push(`Settings: ${m.settings.label}`);
                return lines;
              },
            },
          },
        },
      },
    });
  }, [models, ctxRanges, tpsRanges]);

  // ── Context Length Scaling ────────────────────────────────

  const renderContext = useCallback(() => {
    const canvas = chartRefs.context.current;
    if (!canvas || allFilteredData.length === 0) return;
    destroyChart("context");

    const ctx = canvas.getContext("2d");
    const showAllMachines = machineFilter === "all";

    // ── Group data ──
    // When all machines: group by model+hostname so each GPU gets its own line
    // When single machine: group by model only (original behavior)
    const groups = {};
    for (const d of allFilteredData) {
      const modelName = d.displayName;
      const hostname = d.system?.hostname || "unknown";
      const groupKey = showAllMachines
        ? `${modelName}__${hostname}`
        : modelName;

      if (!groups[groupKey]) {
        groups[groupKey] = { modelName, hostname, ctxMap: {} };
      }
      const ctxKey = d.contextLength;
      if (!groups[groupKey].ctxMap[ctxKey] || d.createdAt > groups[groupKey].ctxMap[ctxKey].createdAt) {
        groups[groupKey].ctxMap[ctxKey] = d;
      }
    }

    // Build sorted entries — most context lengths first, then by VRAM
    const sortedGroups = Object.entries(groups)
      .map(([key, { modelName, hostname, ctxMap }]) => ({
        key,
        modelName,
        hostname,
        items: Object.values(ctxMap).sort((a, b) => a.contextLength - b.contextLength),
        ctxCount: Object.keys(ctxMap).length,
      }))
      .sort((a, b) => b.ctxCount - a.ctxCount || a.items[0].modelVramGiB - b.items[0].modelVramGiB)
      .slice(0, 20);

    if (sortedGroups.length === 0) return;

    // ── Assign stable color per model name ──
    const uniqueModels = [...new Set(sortedGroups.map((g) => g.modelName))];
    const modelColorMap = {};
    uniqueModels.forEach((name, i) => {
      modelColorMap[name] = PALETTE[i % PALETTE.length];
    });

    // Track how many lines per model (for dash style differentiation)
    const modelLineCount = {};

    const datasets = sortedGroups.map(({ modelName, items }) => {
      const color = modelColorMap[modelName];
      const lineIdx = modelLineCount[modelName] || 0;
      modelLineCount[modelName] = lineIdx + 1;

      // Solid for first machine, dashed for second, dotted for third, etc.
      const dashPatterns = [[], [6, 3], [2, 3], [8, 4, 2, 4]];
      const borderDash = dashPatterns[lineIdx % dashPatterns.length];

      const gpuLabel = showAllMachines
        ? shortGPU(items[0]?.system?.gpu?.name)
        : "";
      const label = showAllMachines
        ? `${modelName.length > 22 ? modelName.slice(0, 20) + "…" : modelName} · ${gpuLabel}`
        : modelName.length > 25 ? modelName.slice(0, 23) + "…" : modelName;

      return {
        label,
        data: items.map((d) => ({
          x: d.contextLength / 1024,
          y: d.modelVramGiB,
          ctx: d,
        })),
        borderColor: color.border,
        backgroundColor: color.bg,
        borderWidth: 2,
        borderDash,
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
                const sInfo = SETTINGS_INFO[d?.settings?.label];
                const lines = [
                  ` VRAM: ${item.raw.y.toFixed(2)} GiB`,
                  ` Parallel: ${sInfo?.parallel ?? '?'}`,
                  ` Batch: ${sInfo?.batch ?? '?'}`,
                  ` Context: ${item.raw.x}K`,
                ];
                if (d?.system?.gpu?.name) lines.push(` GPU: ${shortGPU(d.system.gpu.name)}`);
                if (d?.tokensPerSecond) lines.push(` Speed: ${d.tokensPerSecond.toFixed(1)} tok/s`);
                if (d?.quantization) lines.push(` Quant: ${d.quantization} (${d.bitsPerWeight || "?"} bpw)`);
                if (d?.ttft?.ms) lines.push(` TTFT: ${d.ttft.ms.toFixed(0)} ms`);
                if (d?.settings?.label) lines.push(` Settings: ${d.settings.label}`);
                if (d?.fitsInVram === false) lines.push(` ⚠ Does NOT fit in VRAM`);
                return lines;
              },
            },
          },
        },
      },
    });
  }, [allFilteredData, machineFilter]);

  // ── Destroy chart when switching tabs ──
  const prevViewRef = useRef(activeView);
  useEffect(() => {
    const prev = prevViewRef.current;
    if (prev !== activeView) {
      destroyChart(prev);
      prevViewRef.current = activeView;
    }
    return () => destroyChart(activeView);
  }, [activeView]);

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
      ctxLeaderboard: renderCtxLeaderboard,
      context: renderContext,
    };
    renderMap[activeView]?.();
  }, [
    loading,
    error,
    activeView,
    renderScatter,
    renderBar,
    renderEfficiency,
    renderQuantDist,
    renderCtxLeaderboard,
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
    scatter: `Each bubble represents a model — size indicates file weight. ${activeScatterMode.desc}${settingsDesc}`,
    bar: `Each bar spans the min→max measured VRAM across all benchmark runs${settingsDesc || " — default settings"}.`,
    efficiency: `Each bar spans the min→max tokens/sec across all benchmark runs${settingsDesc || " — default settings"}. Sorted by peak throughput.`,
    quantDist: `Average VRAM and speed grouped by quantization format${settingsDesc}.`,
    ctxLeaderboard: `Each model shows two bars: context length range (bottom axis, colored by max context) and TPS range (top axis, gray). Scatter dots show individual runs${settingsDesc || " — default settings"}.`,
    context: "How VRAM consumption scales as context window size increases per model.",
  };

  // ── Loading / Error ──────────────────────────────────────

  if (loading && rawData.length === 0) {
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

            {/* ── Model cards (wide, 2-col span, sorted by model name) ── */}
            {stats.modelCards.map((card) => (
              <StatsCard
                key={card.key}
                className={styles.statWide}
                label={card.label}
                value={card.value}
                subtitle={card.subtitle}
                icon={card.icon}
                variant={card.variant}
                onMouseEnter={() => highlightModelInChart(card.sortName)}
                onMouseLeave={() => highlightModelInChart(null)}
              />
            ))}
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
          tabs={viewTabs}
          activeTab={activeView}
          onChange={setActiveView}
          className={styles.tabBar}
        />

        {/* Chart area */}
        <div className={styles.chartCard}>
          {/* Per-tab filters */}
          <FilterBarComponent>
            <SelectDropdown
              value={settingsFilter}
              onChange={(val) => {
                setSettingsFilter(val);
                setLoading(true);
              }}
              triggerTooltip={<SettingsMatrixTooltip />}
              options={[
                { value: "all", label: "All Settings", icon: <span>📊</span> },
                ...settingsLabels.map((s) => ({
                  value: s,
                  label: s,
                  icon: <span>{SETTINGS_EMOJI[s] || "⚙️"}</span>,
                  tooltip: <SettingsTooltipContent settingsKey={s} />,
                })),
              ]}
            />
            {activeView !== "context" && (
              <div className={styles.vramClipGroup}>
                <label className={styles.vramClipLabel}>Context Range</label>
                <div className={styles.vramClipInputs}>
                  <input
                    type="number"
                    className={styles.vramClipInput}
                    placeholder="Min"
                    value={ctxMin}
                    onChange={(e) => setCtxMin(e.target.value)}
                    min="0"
                    step="1"
                  />
                  <span className={styles.vramClipSeparator}>–</span>
                  <input
                    type="number"
                    className={styles.vramClipInput}
                    placeholder="Max"
                    value={ctxMax}
                    onChange={(e) => setCtxMax(e.target.value)}
                    min="0"
                    step="1"
                  />
                  <span className={styles.vramClipUnit}>K</span>
                </div>
              </div>
            )}
            <FilterSelectComponent
              value={parallelFilter}
              onChange={setParallelFilter}
              options={[
                { value: "all", label: "All Parallel" },
                ...parallelOptions.map((p) => ({
                  value: String(p),
                  label: `Parallel: ${p}`,
                })),
              ]}
            />
            <FilterSelectComponent
              value={batchFilter}
              onChange={setBatchFilter}
              options={[
                { value: "all", label: "All Batch" },
                ...batchOptions.map((b) => ({
                  value: String(b),
                  label: `Batch: ${b}`,
                })),
              ]}
            />
            {activeView === "scatter" && (
              <FilterSelectComponent
                value={scatterMode}
                onChange={setScatterMode}
                options={SCATTER_MODES.map((m) => ({
                  value: m.key,
                  label: `Axes: ${m.label}`,
                }))}
              />
            )}
            {activeView === "scatter" && (
              <div className={styles.vramClipGroup}>
                <label className={styles.vramClipLabel}>{activeScatterMode.xLabel.split(' (')[0]} Range</label>
                <div className={styles.vramClipInputs}>
                  <input
                    type="number"
                    className={styles.vramClipInput}
                    placeholder="Min"
                    value={scatterClipXMin}
                    onChange={(e) => setScatterClipXMin(e.target.value)}
                    min="0"
                    step="0.5"
                  />
                  <span className={styles.vramClipSeparator}>–</span>
                  <input
                    type="number"
                    className={styles.vramClipInput}
                    placeholder="Max"
                    value={scatterClipXMax}
                    onChange={(e) => setScatterClipXMax(e.target.value)}
                    min="0"
                    step="0.5"
                  />
                  <span className={styles.vramClipUnit}>{activeScatterMode.xLabel.match(/\(([^)]+)\)/)?.[1] || ''}</span>
                </div>
              </div>
            )}
            {activeView === "bar" && (
              <div className={styles.vramClipGroup}>
                <label className={styles.vramClipLabel}>VRAM Range</label>
                <div className={styles.vramClipInputs}>
                  <input
                    type="number"
                    className={styles.vramClipInput}
                    placeholder="Min"
                    value={vramClipMin}
                    onChange={(e) => setVramClipMin(e.target.value)}
                    min="0"
                    step="0.5"
                  />
                  <span className={styles.vramClipSeparator}>–</span>
                  <input
                    type="number"
                    className={styles.vramClipInput}
                    placeholder="Max"
                    value={vramClipMax}
                    onChange={(e) => setVramClipMax(e.target.value)}
                    min="0"
                    step="0.5"
                  />
                  <span className={styles.vramClipUnit}>GiB</span>
                </div>
              </div>
            )}
            {activeView === "efficiency" && (
              <div className={styles.vramClipGroup}>
                <label className={styles.vramClipLabel}>TPS Range</label>
                <div className={styles.vramClipInputs}>
                  <input
                    type="number"
                    className={styles.vramClipInput}
                    placeholder="Min"
                    value={tpsClipMin}
                    onChange={(e) => setTpsClipMin(e.target.value)}
                    min="0"
                    step="5"
                  />
                  <span className={styles.vramClipSeparator}>–</span>
                  <input
                    type="number"
                    className={styles.vramClipInput}
                    placeholder="Max"
                    value={tpsClipMax}
                    onChange={(e) => setTpsClipMax(e.target.value)}
                    min="0"
                    step="5"
                  />
                  <span className={styles.vramClipUnit}>t/s</span>
                </div>
              </div>
            )}
            {["bar", "efficiency"].includes(activeView) && (
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
            {viewTabs.map((tab) => (
              <div
                key={tab.key}
                className={styles.chartWrapper}
                style={{
                  display: activeView === tab.key ? "block" : "none",
                  height: tab.key === "bar" || tab.key === "efficiency" || tab.key === "ctxLeaderboard"
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

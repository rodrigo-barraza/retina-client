"use client";

import { useState, useMemo } from "react";
import {
  Star,
  ArrowRight,
  Brain,
  Parentheses,
  Globe,
  Terminal,
  Monitor,
  FileSearch,
  Link,
  ImagePlus,
  Loader2,
} from "lucide-react";
import ProviderLogo, { PROVIDER_LABELS } from "./ProviderLogos";
import {
  MODALITY_ICONS,
  MODALITY_COLORS,
  TOOL_COLORS,
} from "./WorkflowNodeConstants";
import SortableTableComponent from "./SortableTableComponent";
import ToolIconComponent from "./ToolIconComponent";
import TooltipComponent from "./TooltipComponent";
import SearchInputComponent from "./SearchInputComponent";
import FilterDropdownComponent from "./FilterDropdownComponent";
import { FilterBarComponent } from "./FilterBarComponent";
import ProportionBarComponent from "./ProportionBarComponent";
import { formatFileSize, formatContextTokens, formatNumber, formatTokenCount } from "../utils/utilities";
import styles from "./ModelGrid.module.css";


/**
 * Parse a size display string like "7.5 GB", "500 MB", "120 KB" back to bytes.
 */
function parseSize(str) {
  if (!str) return 0;
  const match = str.match(/([\d.]+)\s*(GB|MB|KB)/i);
  if (!match) return 0;
  const val = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  if (unit === "GB") return val * 1_073_741_824;
  if (unit === "MB") return val * 1_048_576;
  if (unit === "KB") return val * 1024;
  return 0;
}


const ARENA_COLUMNS = [
  { key: "arena_text", dataKey: "text", label: "Text" },
  { key: "arena_code", dataKey: "code", label: "Code" },
  { key: "arena_vision", dataKey: "vision", label: "Vision" },
  { key: "arena_document", dataKey: "document", label: "Document" },
  { key: "arena_image", dataKey: "image", label: "Image" },
  { key: "arena_imageEdit", dataKey: "imageEdit", label: "Image Edit" },
  { key: "arena_search", dataKey: "search", label: "Search" },
];

const TOOL_ICONS = {
  Thinking: Brain,
  "Function Calling": Parentheses,
  "Web Search": Globe,
  "Google Search": Globe,
  "Code Execution": Terminal,
  "Computer Use": Monitor,
  "File Search": FileSearch,
  "URL Context": Link,
  "Image Generation": ImagePlus,
};

function ModalityCell({ inputTypes, outputTypes }) {
  if (!inputTypes?.length && !outputTypes?.length) return "—";
  return (
    <span className={styles.modalities}>
      {(inputTypes || []).map((t) => {
        const m = MODALITY_ICONS[t];
        if (!m) return null;
        const Icon = m.icon;
        return (
          <TooltipComponent key={`in-${t}`} label={m.label} position="top">
            <Icon size={12} style={{ color: MODALITY_COLORS[t] }} />
          </TooltipComponent>
        );
      })}
      {inputTypes?.length > 0 && outputTypes?.length > 0 && (
        <ArrowRight size={10} className={styles.modalityArrow} />
      )}
      {(outputTypes || []).map((t) => {
        const m = MODALITY_ICONS[t];
        if (!m) return null;
        const Icon = m.icon;
        return (
          <TooltipComponent key={`out-${t}`} label={m.label} position="top">
            <Icon size={12} style={{ color: MODALITY_COLORS[t] }} />
          </TooltipComponent>
        );
      })}
    </span>
  );
}

function normalizeModel(model) {
  const rawName = model.display_name || model.label || model.key || model.name;
  const explicitQuant =
    (typeof model.quantization === "object"
      ? model.quantization?.name
      : model.quantization) || null;
  const quantization = explicitQuant || extractQuantization(rawName) || null;
  const name = quantization ? stripQuantSuffix(rawName) : rawName;
  return {
    key: model.key || model.name,
    name,
    provider: model.provider || "lm-studio",
    size: model.size || formatFileSize(model.size_bytes) || null,
    params: model.params || model.params_string || null,
    contextLength: model.contextLength || model.max_context_length || null,
    quantization,
    bitsPerWeight: model.bitsPerWeight ?? null,
    architecture: model.architecture || null,
    publisher: model.publisher || null,
    isLoaded: model.loaded || model.loaded_instances?.length > 0 || false,
    pricing: model.pricing || null,
    arena: model.arena || null,
    year: model.year || null,
  };
}

/**
 * Extract a quantization tag from the end of a label, e.g. "(Q8_0)", "(Q4_K_M)", "(IQ3_XXS)".
 */
function extractQuantization(str) {
  if (!str) return null;
  const match = str.match(/\(([A-Za-z][\dA-Za-z_]+)\)\s*$/);
  if (!match) return null;
  // Must start with a known quant prefix
  if (/^[QqIiFf][\d_A-Za-z]+$/.test(match[1])) return match[1];
  return null;
}

/**
 * Strip a trailing quantization suffix from a label string.
 */
function stripQuantSuffix(str) {
  if (!str) return str;
  return str.replace(/\s*\([A-Za-z][\dA-Za-z_]+\)\s*$/, "").trim();
}

/**
 * Parse a params string like "27B", "1.7B", "30B-A3B", "0.6B" into a number (in billions).
 */
function parseParams(str) {
  if (!str) return 0;
  const match = str.match(/([\d.]+)\s*[Bb]/);
  return match ? parseFloat(match[1]) : parseFloat(str) || 0;
}

/**
 * Build a flat row object from a raw model, with sortable values as direct properties.
 * SortableTableComponent can sort on these keys natively.
 */
function buildRow(rawModel, favorites = []) {
  const model = normalizeModel(rawModel);
  const favKey = `${model.provider}:${model.key}`;
  const row = {
    _raw: rawModel,
    _model: model,
    _favKey: favKey,
    model: model.name.toLowerCase(),
    year: rawModel.year || 0,
    context:
      rawModel.max_context_length ||
      rawModel.contextLength ||
      model.contextLength ||
      0,
    size: rawModel.size_bytes || parseSize(rawModel.size || model.size) || 0,
    params: parseParams(model.params),
    quant: (model.quantization || "").toLowerCase(),
    bpw: model.bitsPerWeight ?? 0,
    arch: (model.architecture || "").toLowerCase(),
    publisher: (model.publisher || "").toLowerCase(),
    input: rawModel.pricing?.inputPerMillion ?? Infinity,
    output: rawModel.pricing?.outputPerMillion ?? Infinity,
    favorite: favorites.includes(favKey) ? 1 : 0,
    tools: rawModel.tools?.length || 0,
    requests: rawModel.usageCount || 0,
    totalInputTokens: rawModel.totalInputTokens || 0,
    totalOutputTokens: rawModel.totalOutputTokens || 0,
  };
  // Arena columns
  for (const col of ARENA_COLUMNS) {
    row[col.key] = rawModel.arena?.[col.dataKey] ?? 0;
  }
  return row;
}

/**
 * ModelGrid — reusable, sortable model table displaying size, params,
 * context length, pricing, arena scores, and loaded status.
 * Uses SortableTableComponent for consistent table rendering and sorting.
 */
export default function ModelGrid({
  models = [],
  onSelect,
  renderActions,
  showSearch = true,
  showProviderFilter = true,
  favorites = [],
  onToggleFavorite,
  activeRowKey,
  highlightedRowKey,
  highlightedRowRef,
  loadingModelKey,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeProvider, setActiveProvider] = useState(null);
  const [activeModality, setActiveModality] = useState(null);
  const [activeTool, setActiveTool] = useState(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // Discover all providers from models (ordered by PROVIDER_LABELS definition)
  const allProviders = useMemo(() => {
    const set = new Set();
    for (const m of models) {
      const p = normalizeModel(m).provider;
      if (p) set.add(p);
    }
    const labelOrder = Object.keys(PROVIDER_LABELS);
    return [...set].sort((a, b) => {
      const ai = labelOrder.indexOf(a);
      const bi = labelOrder.indexOf(b);
      return (ai === -1 ? Infinity : ai) - (bi === -1 ? Infinity : bi);
    });
  }, [models]);

  // Discover all unique modalities from models (ordered by MODALITY_ICONS definition)
  const allModalities = useMemo(() => {
    const set = new Set();
    for (const m of models) {
      for (const t of m.inputTypes || []) set.add(t);
      for (const t of m.outputTypes || []) set.add(t);
    }
    const iconOrder = Object.keys(MODALITY_ICONS);
    return [...set].sort((a, b) => {
      const ai = iconOrder.indexOf(a);
      const bi = iconOrder.indexOf(b);
      return (ai === -1 ? Infinity : ai) - (bi === -1 ? Infinity : bi);
    });
  }, [models]);

  // Discover all unique tools from models (ordered by TOOL_ICONS definition)
  const allTools = useMemo(() => {
    const set = new Set();
    for (const m of models) {
      for (const t of m.tools || []) set.add(t);
    }
    const iconOrder = Object.keys(TOOL_ICONS);
    return [...set].sort((a, b) => {
      const ai = iconOrder.indexOf(a);
      const bi = iconOrder.indexOf(b);
      return (ai === -1 ? Infinity : ai) - (bi === -1 ? Infinity : bi);
    });
  }, [models]);

  // Apply favorites filter → modality filter → tool filter → provider filter → search
  const favFiltered = showFavoritesOnly
    ? models.filter((m) => {
        const key = `${normalizeModel(m).provider}:${normalizeModel(m).key}`;
        return favorites.includes(key);
      })
    : models;

  const modalityFiltered = activeModality
    ? favFiltered.filter(
        (m) =>
          (m.inputTypes || []).includes(activeModality) ||
          (m.outputTypes || []).includes(activeModality),
      )
    : favFiltered;

  const toolFiltered = activeTool
    ? modalityFiltered.filter((m) => (m.tools || []).includes(activeTool))
    : modalityFiltered;

  const providerFiltered = activeProvider
    ? toolFiltered.filter((m) => normalizeModel(m).provider === activeProvider)
    : toolFiltered;

  const filtered = searchQuery.trim()
    ? providerFiltered.filter((m) => {
        const q = searchQuery.trim().toLowerCase();
        const norm = normalizeModel(m);
        return (
          norm.key.toLowerCase().includes(q) ||
          norm.name.toLowerCase().includes(q) ||
          (norm.params || "").toLowerCase().includes(q) ||
          (PROVIDER_LABELS[norm.provider] || norm.provider)
            .toLowerCase()
            .includes(q)
        );
      })
    : providerFiltered;

  // Build flat row objects for SortableTableComponent
  const tableData = useMemo(
    () => filtered.map((m) => buildRow(m, favorites)),
    [filtered, favorites],
  );

  // Detect which optional columns have data
  const hasYear = filtered.some((m) => m.year);
  const hasSize = filtered.some((m) => normalizeModel(m).size);
  const hasParams = filtered.some((m) => normalizeModel(m).params);
  const hasContext = filtered.some((m) => normalizeModel(m).contextLength);
  const hasQuant = filtered.some((m) => normalizeModel(m).quantization);
  const hasBpw = filtered.some((m) => normalizeModel(m).bitsPerWeight != null);
  const hasArch = filtered.some((m) => normalizeModel(m).architecture);
  const hasPublisher = filtered.some((m) => normalizeModel(m).publisher);
  const hasInputPrice = filtered.some(
    (m) => m.pricing?.inputPerMillion != null,
  );
  const hasOutputPrice = filtered.some(
    (m) => m.pricing?.outputPerMillion != null,
  );
  const hasModalities = filtered.some(
    (m) => m.inputTypes?.length > 0 || m.outputTypes?.length > 0,
  );
  const hasTools = filtered.some((m) => m.tools?.length > 0);
  const hasUsage = filtered.some((m) => m.usageCount > 0);
  const hasTokens = filtered.some((m) => (m.totalInputTokens || 0) + (m.totalOutputTokens || 0) > 0);
  const hasActions = !!renderActions;

  const arenaCols = ARENA_COLUMNS.filter((col) =>
    filtered.some((m) => m.arena && m.arena[col.dataKey] != null),
  );

  // Build dynamic columns array for SortableTableComponent
  const columns = useMemo(() => {
    const cols = [];

    cols.push({
      key: "model",
      label: "Model",
      align: "left",
      render: (row) => {
        const model = row._model;
        const rawModel = row._raw;
        const isFav = favorites.includes(row._favKey);
        return (
          <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {onToggleFavorite && (
              <span
                className={styles.favWrap}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite(row._favKey);
                }}
              >
                <Star
                  size={14}
                  className={`${styles.favStar} ${isFav ? styles.favStarActive : ""}`}
                  fill={isFav ? "currentColor" : "none"}
                />
              </span>
            )}
            <ProviderLogo provider={model.provider} size={18} />
            <span className={styles.nameStack}>
              <span className={styles.nameRow}>
                <span className={styles.modelName}>{model.name}</span>
                {model.provider === "lm-studio" && model.isLoaded && (
                  <span className={styles.loadedBadge}>
                    <span className={`${styles.statusDot} ${styles.active}`} />
                    Loaded
                  </span>
                )}
                {model.provider === "lm-studio" && !model.isLoaded && loadingModelKey === model.key && (
                  <span className={styles.loadingBadge}>
                    <Loader2 size={9} className={styles.loadingSpin} />
                    Loading
                  </span>
                )}
                {hasActions && (
                  <span
                    className={styles.inlineActions}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {renderActions(rawModel)}
                  </span>
                )}
              </span>
              <span className={styles.modelKey}>{model.key}</span>
              <span className={styles.modelProvider}>
                {PROVIDER_LABELS[model.provider] || model.provider}
              </span>
            </span>
          </span>
        );
      },
    });

    if (hasYear) {
      cols.push({
        key: "year",
        label: "Year",
        align: "right",
        render: (row) => row._raw.year || "—",
      });
    }

    if (hasUsage) {
      const usageTotal = filtered.reduce((s, m) => s + (m.usageCount || 0), 0) || 1;
      cols.push({
        key: "requests",
        label: "Requests",
        align: "right",
        sortValue: (row) => row._raw.usageCount || 0,
        render: (row) => {
          const count = row._raw.usageCount || 0;
          return count > 0 ? formatNumber(count) : "—";
        },
      });
      cols.push({
        key: "usagePct",
        label: "Usage %",
        sortValue: (row) => row._raw.usageCount || 0,
        render: (row) => (
          <ProportionBarComponent
            value={row._raw.usageCount || 0}
            total={usageTotal}
          />
        ),
      });
    }

    if (hasTokens) {
      cols.push({
        key: "totalInputTokens",
        label: "Tokens In",
        align: "right",
        render: (row) => {
          const v = row._raw.totalInputTokens || 0;
          return v > 0 ? formatTokenCount(v) : "—";
        },
      });
      cols.push({
        key: "totalOutputTokens",
        label: "Tokens Out",
        align: "right",
        render: (row) => {
          const v = row._raw.totalOutputTokens || 0;
          return v > 0 ? formatTokenCount(v) : "—";
        },
      });
      cols.push({
        key: "totalTokens",
        label: "Tokens",
        align: "right",
        sortValue: (row) => (row._raw.totalInputTokens || 0) + (row._raw.totalOutputTokens || 0),
        render: (row) => {
          const total = (row._raw.totalInputTokens || 0) + (row._raw.totalOutputTokens || 0);
          return total > 0 ? formatTokenCount(total) : "—";
        },
      });
    }

    if (hasModalities) {
      cols.push({
        key: "modalities",
        label: "Modalities",
        sortable: false,
        render: (row) => (
          <ModalityCell
            inputTypes={row._raw.inputTypes}
            outputTypes={row._raw.outputTypes}
          />
        ),
      });
    }

    if (hasTools) {
      cols.push({
        key: "tools",
        label: "Tools",
        align: "left",
        render: (row) => {
          const tools = row._raw.tools;
          if (!tools?.length) return "—";
          return <ToolIconComponent toolNames={tools} />;
        },
      });
    }

    if (hasContext) {
      cols.push({
        key: "context",
        label: "Context",
        align: "right",
        render: (row) =>
          row._model.contextLength
            ? formatContextTokens(row._model.contextLength)
            : "—",
      });
    }

    if (hasSize) {
      cols.push({
        key: "size",
        label: "Size",
        align: "right",
        render: (row) => row._model.size || "—",
      });
    }

    if (hasParams) {
      cols.push({
        key: "params",
        label: "Params",
        align: "right",
        render: (row) => row._model.params || "—",
      });
    }

    if (hasQuant) {
      cols.push({
        key: "quant",
        label: "Quant",
        align: "right",
        render: (row) => row._model.quantization || "—",
      });
    }

    if (hasBpw) {
      cols.push({
        key: "bpw",
        label: "BPW",
        align: "right",
        render: (row) =>
          row._model.bitsPerWeight != null ? row._model.bitsPerWeight : "—",
      });
    }

    if (hasArch) {
      cols.push({
        key: "arch",
        label: "Arch",
        render: (row) => row._model.architecture || "—",
      });
    }

    if (hasPublisher) {
      cols.push({
        key: "publisher",
        label: "Publisher",
        align: "left",
        render: (row) => row._model.publisher || "—",
      });
    }

    if (hasInputPrice) {
      cols.push({
        key: "input",
        label: "Input",
        align: "right",
        render: (row) =>
          row._raw.pricing?.inputPerMillion != null
            ? `$${row._raw.pricing.inputPerMillion}`
            : "—",
      });
    }

    if (hasOutputPrice) {
      cols.push({
        key: "output",
        label: "Output",
        align: "right",
        render: (row) =>
          row._raw.pricing?.outputPerMillion != null
            ? `$${row._raw.pricing.outputPerMillion}`
            : "—",
      });
    }

    for (const arenaCol of arenaCols) {
      cols.push({
        key: arenaCol.key,
        label: arenaCol.label,
        align: "right",
        render: (row) => row._raw.arena?.[arenaCol.dataKey] ?? "—",
      });
    }

    return cols;
  }, [
    onToggleFavorite,
    favorites,
    filtered,
    hasYear,
    hasUsage,
    hasTokens,
    hasModalities,
    hasTools,
    hasContext,
    hasSize,
    hasParams,
    hasQuant,
    hasBpw,
    hasArch,
    hasPublisher,
    hasInputPrice,
    hasOutputPrice,
    hasActions,
    renderActions,
    arenaCols,
    loadingModelKey,
  ]);

  return (
    <div className={styles.container}>
      <FilterBarComponent className={styles.toolbar}>
        {showSearch && (
          <SearchInputComponent
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search models…"
            className={styles.searchWrapper}
          />
        )}
        <FilterDropdownComponent
          groups={[
            ...(onToggleFavorite && favorites.length > 0
              ? [
                  {
                    label: "Favorites",
                    items: [{ key: "favorites", icon: Star, title: "Favorites Only", color: "#f59e0b" }],
                    activeKeys: showFavoritesOnly ? "favorites" : null,
                    isSingleSelect: true,
                    onToggle: () => setShowFavoritesOnly((prev) => !prev),
                  },
                ]
              : []),
            ...(allModalities.length >= 2
              ? [
                  {
                    label: "Modality",
                    items: allModalities
                      .map((t) => {
                        const m = MODALITY_ICONS[t];
                        return m ? { key: t, icon: m.icon, color: MODALITY_COLORS[t], title: m.label } : null;
                      })
                      .filter(Boolean),
                    activeKeys: activeModality,
                    isSingleSelect: true,
                    onToggle: setActiveModality,
                  },
                ]
              : []),
            ...(allTools.length >= 2
              ? [
                  {
                    label: "Tools",
                    items: allTools
                      .map((t) => {
                        const Icon = TOOL_ICONS[t];
                        return Icon ? { key: t, icon: Icon, color: TOOL_COLORS[t], title: t } : null;
                      })
                      .filter(Boolean),
                    activeKeys: activeTool,
                    isSingleSelect: true,
                    onToggle: setActiveTool,
                  },
                ]
              : []),
            ...(showProviderFilter && allProviders.length >= 2
              ? [
                  {
                    label: "Providers",
                    items: allProviders.map((p) => ({
                      key: p,
                      icon: () => <ProviderLogo provider={p} size={13} />,
                      title: PROVIDER_LABELS[p] || p,
                    })),
                    activeKeys: activeProvider,
                    isSingleSelect: true,
                    onToggle: setActiveProvider,
                  },
                ]
              : []),
          ]}
        />
      </FilterBarComponent>

      <SortableTableComponent
        columns={columns}
        data={tableData}
        getRowKey={(row) => `${row._model.provider}-${row._model.key}`}
        onRowClick={onSelect ? (row) => onSelect(row._raw) : undefined}
        emptyText={
          searchQuery.trim() ? "No matching models" : "No models found"
        }
        activeRowKey={activeRowKey}
        highlightedRowKey={highlightedRowKey}
        highlightedRowRef={highlightedRowRef}
      />
    </div>
  );
}

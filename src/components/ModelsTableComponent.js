"use client";

import { useState, useMemo, useCallback } from "react";
import {
  Star,
  ArrowRight,
  CheckSquare2,
  Square,
  Brain,
  Parentheses,
  Globe,
  Terminal,
  Monitor,
  FileSearch,
  Link,
  ImagePlus,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import ProviderLogo, { PROVIDER_LABELS } from "./ProviderLogos";
import {
  MODALITY_ICONS,
  MODALITY_COLORS,
  TOOL_COLORS,
} from "./WorkflowNodeConstants";
import TableComponent from "./TableComponent";
import ProvidersBadgeComponent from "./ProvidersBadgeComponent";
import ModelBadgeComponent from "./ModelBadgeComponent";
import ModelTypeBadgeComponent from "./ModelTypeBadgeComponent";
import ToolIconComponent from "./ToolIconComponent";
import TooltipComponent from "./TooltipComponent";
import SearchInputComponent from "./SearchInputComponent";
import FilterDropdownComponent from "./FilterDropdownComponent";
import { FilterBarComponent } from "./FilterBarComponent";
import ProportionBarComponent from "./ProportionBarComponent";
import CostBadgeComponent from "./CostBadgeComponent";
import {
  formatFileSize,
  formatContextTokens,
  formatNumber,
  formatTokenCount,
  formatLatency,
  formatTokensPerSec,
} from "../utils/utilities";
import {
  requestsColumn,
  usageColumn,
  modalitiesColumn as statsModalitiesColumn,
  toolsColumn as statsToolsColumn,
  tokenColumns,
  costColumns,
  latencyColumn,
  countLinkColumns,
  emptyDash,
} from "../utils/tableColumns";
import styles from "./ModelsTableComponent.module.css";


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
    modelType: model.modelType || null,
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
 * TableComponent can sort on these keys natively.
 */
function buildRow(rawModel, favorites = []) {
  const model = normalizeModel(rawModel);
  const favKey = `${model.provider}:${model.key}`;
  const row = {
    _raw: rawModel,
    _model: model,
    _favKey: favKey,
    model: model.key.toLowerCase(),
    name: model.name.toLowerCase(),
    provider: (PROVIDER_LABELS[model.provider] || model.provider).toLowerCase(),
    year: rawModel.year || 0,
    context:
      rawModel.max_context_length ||
      rawModel.contextLength ||
      model.contextLength ||
      0,
    size: rawModel.size_bytes || parseSize(rawModel.size || model.size) || 0,
    params: parseParams(model.params),
    modelType: (model.modelType || "").toLowerCase(),
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


/* ── Stats mode helpers ─────────────────────────────────────── */

/**
 * Build stats-mode columns from tableColumns.js factories.
 * Used when mode="stats" — the same columns the old ModelsTableComponent used.
 */
function buildStatsColumns({ configModels, totalRequests, totalCost, compact }) {
  const allColumns = [
    {
      key: "model",
      label: "Model",
      description: "The AI model identifier used for the request",
      render: (row) => <ModelBadgeComponent models={row.model ? [row.model] : []} />,
    },
    requestsColumn(),
    usageColumn(totalRequests),
    {
      key: "provider",
      label: "Provider",
      description: "The API provider hosting this model",
      render: (row) => (
        <ProvidersBadgeComponent providers={row.provider ? [row.provider] : []} />
      ),
    },
    statsModalitiesColumn(),
    statsToolsColumn({ configModels }),
    ...tokenColumns(),
    ...costColumns(totalCost),
    latencyColumn(),
    ...countLinkColumns("model", (row) => row.model),
  ];

  if (compact) {
    const COMPACT_KEYS = ["model", "totalRequests", "provider", "totalCost", "avgLatency"];
    return allColumns.filter((c) => COMPACT_KEYS.includes(c.key));
  }
  return allColumns;
}


/**
 * ModelsTableComponent — unified model table supporting four display modes:
 *
 *   mode="model"     — Model specs: name, provider, modalities, tools, context, size,
 *                       params, quant, BPW, arch, publisher, pricing, arena scores.
 *                       Includes search, filters, favorites. (default)
 *
 *   mode="stats"     — Usage statistics: requests, usage, tokens, costs, latency,
 *                       sessions, conversations, workflows. Used on the admin dashboard.
 *
 *   mode="full"      — Combined: model columns + stats columns in a single table.
 *
 *   mode="benchmark" — Benchmark dashboard: model identity columns (Favorite, Name,
 *                       Model, Provider, Type, Modalities) + benchmark-specific
 *                       columns (Tests, Passed, Failed, Pass Rate, Avg Latency, Cost).
 *                       Other model columns are hidden by default but toggleable.
 *
 * @param {Object}   props
 * @param {Array}    props.models            - Model data array (raw models or stat objects)
 * @param {string}   [props.mode="model"]    - Display mode: "model" | "stats" | "full" | "benchmark"
 * @param {Function} [props.onSelect]        - (rawModel) => void — row click handler
 * @param {Function} [props.renderActions]   - (rawModel) => ReactNode — per-row actions
 * @param {boolean}  [props.showSearch]      - Show search bar (model/full modes)
 * @param {boolean}  [props.showProviderFilter] - Show provider filter chips
 * @param {Array}    [props.favorites]       - Array of "provider:model" favorite keys
 * @param {Function} [props.onToggleFavorite] - (key) => void
 * @param {string}   [props.activeRowKey]    - Currently active row key
 * @param {string}   [props.highlightedRowKey] - Keyboard-highlighted row key
 * @param {Function} [props.highlightedRowRef] - Ref callback for highlighted row
 * @param {string}   [props.loadingModelKey] - Model key currently being loaded
 * @param {Object}   [props.configModels]    - Map of "provider:model" → tool names (stats mode)
 * @param {number}   [props.totalRequests]   - Total requests for proportion bars (stats mode)
 * @param {number}   [props.totalCost]       - Total cost for proportion bars (stats mode)
 * @param {string}   [props.emptyText]       - Empty state text
 * @param {boolean}  [props.compact]         - Reduced column set (stats mode)
 * @param {string}   [props.title]           - Optional table title
 * @param {number}   [props.maxHeight]       - Max height for scrollable body
 * @param {Set}      [props.selectedKeys]    - Set of "provider:model" keys for selection column
 * @param {Function} [props.onToggleSelect]  - (rawModel) => void — toggle selection
 * @param {Function} [props.getRowClassName] - (row) => string — custom row class (benchmark mode)
 */
export default function ModelsTableComponent({
  models = [],
  mode = "model",
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
  configModels = {},
  totalRequests: totalRequestsProp,
  totalCost: totalCostProp,
  emptyText,
  compact = false,
  title,
  maxHeight,
  selectedKeys,
  onToggleSelect,
  getRowClassName,
}) {
  /* ── Stats-only mode (simple passthrough) ── */
  if (mode === "stats") {
    const totalRequests =
      (totalRequestsProp ??
      models.reduce((s, m) => s + m.totalRequests, 0)) || 1;
    const totalCost =
      (totalCostProp ??
      models.reduce((s, m) => s + (m.totalCost || 0), 0)) || 1;

    const columns = buildStatsColumns({ configModels, totalRequests, totalCost, compact });

    return (
      <TableComponent
        title={title || "Models"}
        maxHeight={maxHeight ?? 420}
        columns={columns}
        data={models}
        getRowKey={(m, i) => `${m.provider}-${m.model}-${i}`}
        emptyText={emptyText || "No data yet"}
        storageKey="models-stats"
      />
    );
  }

  /* ── Model / Full / Benchmark modes (rich table with filters) ── */
  return (
    <ModelsTableInner
      models={models}
      mode={mode}
      onSelect={onSelect}
      renderActions={renderActions}
      showSearch={showSearch}
      showProviderFilter={showProviderFilter}
      favorites={favorites}
      onToggleFavorite={onToggleFavorite}
      activeRowKey={activeRowKey}
      highlightedRowKey={highlightedRowKey}
      highlightedRowRef={highlightedRowRef}
      loadingModelKey={loadingModelKey}
      configModels={configModels}
      totalRequests={totalRequestsProp}
      totalCost={totalCostProp}
      emptyText={emptyText}
      title={title}
      maxHeight={maxHeight}
      selectedKeys={selectedKeys}
      onToggleSelect={onToggleSelect}
      getRowClassName={getRowClassName}
    />
  );
}


/**
 * Inner component for model/full/benchmark modes — uses hooks so it must be a
 * proper component (can't conditionally call hooks in the parent).
 */
function ModelsTableInner({
  models,
  mode,
  onSelect,
  renderActions,
  showSearch,
  showProviderFilter,
  favorites,
  onToggleFavorite,
  activeRowKey,
  highlightedRowKey,
  highlightedRowRef,
  loadingModelKey,
  emptyText,
  title,
  maxHeight,
  selectedKeys,
  onToggleSelect,
  getRowClassName: getRowClassNameProp,
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

  // Build flat row objects for TableComponent
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
  const hasModelType = filtered.some((m) => normalizeModel(m).modelType);
  const hasUsage = filtered.some((m) => m.usageCount > 0);
  const hasTokens = filtered.some((m) => (m.totalInputTokens || 0) + (m.totalOutputTokens || 0) > 0);
  const hasActions = !!renderActions;
  const hasSelection = !!selectedKeys && !!onToggleSelect;
  const isFull = mode === "full";
  const isBenchmark = mode === "benchmark";

  const arenaCols = ARENA_COLUMNS.filter((col) =>
    filtered.some((m) => m.arena && m.arena[col.dataKey] != null),
  );

  // Build dynamic columns array for TableComponent
  // Memoize select-all handler
  const handleSelectAll = useCallback(() => {
    if (!onToggleSelect || !selectedKeys) return;
    // Check if all currently visible/filtered models are selected
    const allSelected = filtered.length > 0 && filtered.every((m) => {
      const key = `${normalizeModel(m).provider}:${normalizeModel(m).key}`;
      return selectedKeys.has(key);
    });
    // Toggle: if all selected, deselect all visible; otherwise select all visible
    for (const m of filtered) {
      const key = `${normalizeModel(m).provider}:${normalizeModel(m).key}`;
      if (allSelected) {
        // Only deselect if currently selected
        if (selectedKeys.has(key)) onToggleSelect(m);
      } else {
        // Only select if not already selected
        if (!selectedKeys.has(key)) onToggleSelect(m);
      }
    }
  }, [filtered, selectedKeys, onToggleSelect]);

  const columns = useMemo(() => {
    const cols = [];
    // In benchmark mode, non-core model-spec columns default to hidden
    const benchmarkHide = isBenchmark ? { defaultHidden: true } : {};

    // 0. SELECTION — checkbox column (non-hideable, non-sortable)
    if (hasSelection) {
      const allSelected = filtered.length > 0 && filtered.every((m) => {
        const key = `${normalizeModel(m).provider}:${normalizeModel(m).key}`;
        return selectedKeys.has(key);
      });
      const someSelected = !allSelected && filtered.some((m) => {
        const key = `${normalizeModel(m).provider}:${normalizeModel(m).key}`;
        return selectedKeys.has(key);
      });

      cols.push({
        key: "_select",
        label: (
          <span
            className={`${styles.selectWrap} ${allSelected ? styles.selectWrapActive : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              handleSelectAll();
            }}
          >
            {allSelected
              ? <CheckSquare2 size={14} className={styles.selectCheck} />
              : someSelected
                ? <CheckSquare2 size={14} className={styles.selectPartial} />
                : <Square size={14} className={styles.selectBox} />
            }
          </span>
        ),
        description: allSelected ? "Deselect all visible models" : "Select all visible models",
        align: "center",
        sortable: false,
        hideable: false,
        render: (row) => {
          const key = `${row._model.provider}:${row._model.key}`;
          const isSelected = selectedKeys.has(key);
          return (
            <span
              className={`${styles.selectWrap} ${isSelected ? styles.selectWrapActive : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                onToggleSelect(row._raw);
              }}
            >
              {isSelected
                ? <CheckSquare2 size={14} className={styles.selectCheck} />
                : <Square size={14} className={styles.selectBox} />
              }
            </span>
          );
        },
      });
    }

    // 1. FAVORITE — sortable star toggle
    cols.push({
      key: "favorite",
      label: "★",
      description: "Star models to pin them to the top of your list",
      align: "center",
      sortable: true,
      render: (row) => {
        const isFav = favorites.includes(row._favKey);
        if (!onToggleFavorite) return "—";
        return (
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
        );
      },
    });

    // 2. NAME — provider icon + display name + loaded badge + actions
    cols.push({
      key: "name",
      label: "Name",
      description: "Display name of the model",
      align: "left",
      sortValue: (row) => row._model.name.toLowerCase(),
      render: (row) => {
        const model = row._model;
        const rawModel = row._raw;
        return (
          <span className={styles.nameRow}>
            <ProviderLogo provider={model.provider} size={16} />
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
        );
      },
    });

    // 3. MODEL — model key (monospace identifier)
    cols.push({
      key: "model",
      label: "Model",
      description: "Unique model identifier used in API calls",
      align: "left",
      render: (row) => (
        <ModelBadgeComponent models={[row._model.key]} />
      ),
    });

    // 4. PROVIDER — provider badge
    cols.push({
      key: "provider",
      label: "Provider",
      description: "The API provider hosting this model",
      align: "left",
      sortValue: (row) => (PROVIDER_LABELS[row._model.provider] || row._model.provider).toLowerCase(),
      render: (row) => (
        <ProvidersBadgeComponent providers={[row._model.provider]} />
      ),
    });

    // 5. TYPE — model type badge (conversation / audio / embed)
    if (hasModelType) {
      cols.push({
        key: "modelType",
        label: "Type",
        description: "Endpoint-based model category: conversation, audio, or embed",
        align: "left",
        render: (row) => (
          <ModelTypeBadgeComponent modelType={row._model.modelType} />
        ),
      });
    }

    if (hasYear) {
      cols.push({
        key: "year",
        label: "Year",
        description: "Release year of this model",
        align: "right",
        render: (row) => row._raw.year || "—",
        ...benchmarkHide,
      });
    }

    // ── Benchmark-specific columns ──
    if (isBenchmark) {
      cols.push({
        key: "benchTests",
        label: "Tests",
        description: "Total number of benchmark tests run for this model",
        sortable: true,
        align: "right",
        sortValue: (row) => row._raw._benchTotal || 0,
        render: (row) => {
          const v = row._raw._benchTotal || 0;
          return v > 0 ? formatNumber(v) : "—";
        },
      });
      cols.push({
        key: "benchPassed",
        label: "Passed",
        description: "Number of benchmark tests this model passed",
        sortable: true,
        align: "right",
        sortValue: (row) => row._raw._benchPassed || 0,
        render: (row) => (
          <span className={styles.benchPassedCell}>
            <CheckCircle2 size={12} />
            {row._raw._benchPassed || 0}
          </span>
        ),
      });
      cols.push({
        key: "benchFailed",
        label: "Failed",
        description: "Number of benchmark tests this model failed or errored",
        sortable: true,
        align: "right",
        sortValue: (row) => (row._raw._benchFailed || 0) + (row._raw._benchErrored || 0),
        render: (row) => (
          <span className={styles.benchFailedCell}>
            <XCircle size={12} />
            {(row._raw._benchFailed || 0) + (row._raw._benchErrored || 0)}
          </span>
        ),
      });
      cols.push({
        key: "benchPassRate",
        label: "Pass Rate",
        description: "Percentage of benchmark tests this model passed",
        sortable: true,
        sortValue: (row) => row._raw._benchPassRate || 0,
        render: (row) => {
          const pct = Math.round((row._raw._benchPassRate || 0) * 100);
          const color =
            pct >= 80 ? "var(--success)" : pct >= 50 ? "var(--warning)" : "var(--danger)";
          return (
            <span className={styles.benchRateCell}>
              <span className={styles.benchRateBar}>
                <span
                  className={styles.benchRateBarFill}
                  style={{ width: `${pct}%`, background: color }}
                />
              </span>
              <span className={styles.benchRateValue} style={{ color }}>
                {pct}%
              </span>
            </span>
          );
        },
      });
      cols.push({
        key: "benchAvgLatency",
        label: "Avg Latency",
        description: "Average response latency across all benchmark tests",
        sortable: true,
        align: "right",
        sortValue: (row) => row._raw._benchAvgLatency || 0,
        render: (row) => {
          const v = row._raw._benchAvgLatency;
          if (!v || v <= 0) return emptyDash();
          return (
            <span className={styles.benchLatencyCell}>
              <Clock size={12} />
              {v.toFixed(1)}s
            </span>
          );
        },
      });
      cols.push({
        key: "benchCost",
        label: "Cost",
        description: "Total estimated cost across all benchmark tests for this model",
        sortable: true,
        align: "right",
        sortValue: (row) => row._raw._benchTotalCost || 0,
        render: (row) => {
          const v = row._raw._benchTotalCost;
          return v > 0 ? <CostBadgeComponent cost={v} /> : emptyDash();
        },
      });
    }

    // ── Stats columns (full mode only) ──
    if (isFull && hasUsage) {
      const usageTotal = filtered.reduce((s, m) => s + (m.usageCount || 0), 0) || 1;
      cols.push({
        key: "requests",
        label: "Requests",
        description: "Total API requests made with this model",
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
        description: "Proportional share of total requests",
        sortValue: (row) => row._raw.usageCount || 0,
        render: (row) => (
          <ProportionBarComponent
            value={row._raw.usageCount || 0}
            total={usageTotal}
          />
        ),
      });
    }

    if (hasUsage && !isFull) {
      const usageTotal = filtered.reduce((s, m) => s + (m.usageCount || 0), 0) || 1;
      cols.push({
        key: "requests",
        label: "Requests",
        description: "Total API requests made with this model",
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
        description: "Proportional share of total requests",
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
        description: "Total input (prompt) tokens consumed",
        align: "right",
        render: (row) => {
          const v = row._raw.totalInputTokens || 0;
          return v > 0 ? formatTokenCount(v) : "—";
        },
      });
      cols.push({
        key: "totalOutputTokens",
        label: "Tokens Out",
        description: "Total output (completion) tokens generated",
        align: "right",
        render: (row) => {
          const v = row._raw.totalOutputTokens || 0;
          return v > 0 ? formatTokenCount(v) : "—";
        },
      });
      cols.push({
        key: "totalTokens",
        label: "Tokens",
        description: "Combined input + output token count",
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
        description: "Input/output types supported (text, image, audio, video)",
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
        description: "Capabilities like thinking, web search, code execution",
        align: "left",
        ...benchmarkHide,
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
        description: "Maximum context window size in tokens",
        align: "right",
        ...benchmarkHide,
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
        description: "Model file size on disk",
        align: "right",
        ...benchmarkHide,
        render: (row) => row._model.size || "—",
      });
    }

    if (hasParams) {
      cols.push({
        key: "params",
        label: "Params",
        description: "Total parameter count (e.g. 7B, 70B)",
        align: "right",
        ...benchmarkHide,
        render: (row) => row._model.params || "—",
      });
    }

    if (hasQuant) {
      cols.push({
        key: "quant",
        label: "Quant",
        description: "Quantization method (e.g. Q4_K_M, Q8_0)",
        align: "right",
        ...benchmarkHide,
        render: (row) => row._model.quantization || "—",
      });
    }

    if (hasBpw) {
      cols.push({
        key: "bpw",
        label: "BPW",
        description: "Bits per weight — lower means more compression",
        align: "right",
        ...benchmarkHide,
        render: (row) =>
          row._model.bitsPerWeight != null ? row._model.bitsPerWeight : "—",
      });
    }

    if (hasArch) {
      cols.push({
        key: "arch",
        label: "Arch",
        description: "Model architecture (e.g. LLaMA, Mistral, Qwen)",
        ...benchmarkHide,
        render: (row) => row._model.architecture || "—",
      });
    }

    if (hasPublisher) {
      cols.push({
        key: "publisher",
        label: "Publisher",
        description: "Organization that published the model weights",
        align: "left",
        ...benchmarkHide,
        render: (row) => row._model.publisher || "—",
      });
    }

    if (hasInputPrice) {
      cols.push({
        key: "input",
        label: "Input",
        description: "Cost per million input tokens (USD)",
        align: "right",
        ...benchmarkHide,
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
        description: "Cost per million output tokens (USD)",
        align: "right",
        ...benchmarkHide,
        render: (row) =>
          row._raw.pricing?.outputPerMillion != null
            ? `$${row._raw.pricing.outputPerMillion}`
            : "—",
      });
    }

    // ── Full mode: add cost & latency from stats ──
    if (isFull) {
      cols.push({
        key: "totalCost",
        label: "Cost",
        description: "Total estimated cost in USD",
        align: "right",
        sortValue: (row) => row._raw.totalCost || 0,
        render: (row) => {
          const cost = row._raw.totalCost;
          return cost > 0 ? <CostBadgeComponent cost={cost} /> : emptyDash();
        },
      });
      cols.push({
        key: "avgLatency",
        label: "Avg Latency",
        description: "Average round-trip response time",
        align: "right",
        sortValue: (row) => row._raw.avgLatency || 0,
        render: (row) => {
          const v = row._raw.avgLatency;
          return v > 0 ? formatLatency(v) : emptyDash();
        },
      });
      cols.push({
        key: "avgTokensPerSec",
        label: "Tok/s",
        description: "Average output throughput in tokens per second",
        align: "right",
        render: (row) => formatTokensPerSec(row._raw.avgTokensPerSec),
      });
    }

    if (!isBenchmark) {
      for (const arenaCol of arenaCols) {
        cols.push({
          key: arenaCol.key,
          label: arenaCol.label,
          description: `LMArena ${arenaCol.label} benchmark ELO score`,
          align: "right",
          render: (row) => row._raw.arena?.[arenaCol.dataKey] ?? "—",
        });
      }
    }

    return cols;
  }, [
    onToggleFavorite,
    favorites,
    filtered,
    hasYear,
    hasModelType,
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
    hasSelection,
    selectedKeys,
    onToggleSelect,
    handleSelectAll,
    renderActions,
    arenaCols,
    loadingModelKey,
    isFull,
    isBenchmark,
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

      <TableComponent
        title={title}
        maxHeight={maxHeight}
        columns={columns}
        data={tableData}
        getRowKey={(row) => `${row._model.provider}-${row._model.key}`}
        onRowClick={onSelect ? (row) => onSelect(isBenchmark ? row._raw._benchStat : row._raw) : undefined}
        emptyText={
          emptyText || (searchQuery.trim() ? "No matching models" : "No models found")
        }
        activeRowKey={activeRowKey}
        highlightedRowKey={highlightedRowKey}
        highlightedRowRef={highlightedRowRef}
        storageKey={isBenchmark ? "models-benchmark" : "models"}
        getRowClassName={
          getRowClassNameProp
            ? (row) => getRowClassNameProp(isBenchmark ? row._raw._benchStat : row)
            : hasSelection
              ? (row) => {
                  const key = `${row._model.provider}:${row._model.key}`;
                  return selectedKeys.has(key) ? styles.selectedRow : "";
                }
              : undefined
        }
      />
    </div>
  );
}

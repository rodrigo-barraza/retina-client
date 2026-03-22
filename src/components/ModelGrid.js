"use client";

import { useState, useMemo } from "react";
import {
    Search,
    X,
    Star,
    ArrowRight,
} from "lucide-react";
import ProviderLogo, { PROVIDER_LABELS } from "./ProviderLogos";
import { MODALITY_ICONS, MODALITY_COLORS } from "./WorkflowNodeConstants";
import SortableTableComponent from "./SortableTableComponent";
import styles from "./ModelGrid.module.css";

function formatBytes(bytes) {
    if (!bytes) return null;
    if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
    if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
    return `${(bytes / 1024).toFixed(0)} KB`;
}

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

function formatContextLength(tokens) {
    if (!tokens) return null;
    if (tokens >= 1_000_000)
        return `${(tokens / 1_000_000).toFixed(tokens % 1_000_000 === 0 ? 0 : 1)}M`;
    return `${Math.round(tokens / 1000)}K`;
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

function ModalityCell({ inputTypes, outputTypes }) {
    if (!inputTypes?.length && !outputTypes?.length) return "—";
    return (
        <span className={styles.modalities}>
            {(inputTypes || []).map((t) => {
                const m = MODALITY_ICONS[t];
                if (!m) return null;
                const Icon = m.icon;
                return <Icon key={`in-${t}`} size={12} title={m.label} style={{ color: MODALITY_COLORS[t] }} />;
            })}
            {inputTypes?.length > 0 && outputTypes?.length > 0 && (
                <ArrowRight size={10} className={styles.modalityArrow} />
            )}
            {(outputTypes || []).map((t) => {
                const m = MODALITY_ICONS[t];
                if (!m) return null;
                const Icon = m.icon;
                return <Icon key={`out-${t}`} size={12} title={m.label} style={{ color: MODALITY_COLORS[t] }} />;
            })}
        </span>
    );
}

function normalizeModel(model) {
    return {
        key: model.key || model.name,
        name: model.display_name || model.label || model.key || model.name,
        provider: model.provider || "lm-studio",
        size: model.size || formatBytes(model.size_bytes) || null,
        params: model.params || model.params_string || null,
        contextLength: model.contextLength || model.max_context_length || null,
        quantization:
            (typeof model.quantization === "object"
                ? model.quantization?.name
                : model.quantization) || null,
        isLoaded: model.loaded || model.loaded_instances?.length > 0 || false,
        pricing: model.pricing || null,
        arena: model.arena || null,
        year: model.year || null,
    };
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
        context: rawModel.max_context_length || rawModel.contextLength || model.contextLength || 0,
        size: rawModel.size_bytes || parseSize(rawModel.size || model.size) || 0,
        params: parseParams(model.params),
        quant: (model.quantization || "").toLowerCase(),
        input: rawModel.pricing?.inputPerMillion ?? Infinity,
        output: rawModel.pricing?.outputPerMillion ?? Infinity,
        favorite: favorites.includes(favKey) ? 1 : 0,
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
}) {
    const [searchQuery, setSearchQuery] = useState("");
    const [activeProvider, setActiveProvider] = useState(null);
    const [activeModality, setActiveModality] = useState(null);

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

    // Apply modality filter, then provider filter, then search
    const modalityFiltered = activeModality
        ? models.filter(
            (m) =>
                (m.inputTypes || []).includes(activeModality) ||
                (m.outputTypes || []).includes(activeModality),
        )
        : models;

    const providerFiltered = activeProvider
        ? modalityFiltered.filter((m) => normalizeModel(m).provider === activeProvider)
        : modalityFiltered;

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
    const hasInputPrice = filtered.some(
        (m) => m.pricing?.inputPerMillion != null,
    );
    const hasOutputPrice = filtered.some(
        (m) => m.pricing?.outputPerMillion != null,
    );
    const hasModalities = filtered.some(
        (m) => m.inputTypes?.length > 0 || m.outputTypes?.length > 0,
    );
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
                                        <span
                                            className={`${styles.statusDot} ${styles.active}`}
                                        />
                                        Loaded
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
                render: (row) => row._raw.year || "—",
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

        if (hasContext) {
            cols.push({
                key: "context",
                label: "Context",
                render: (row) =>
                    row._model.contextLength
                        ? formatContextLength(row._model.contextLength)
                        : "—",
            });
        }

        if (hasSize) {
            cols.push({
                key: "size",
                label: "Size",
                render: (row) => row._model.size || "—",
            });
        }

        if (hasParams) {
            cols.push({
                key: "params",
                label: "Params",
                render: (row) => row._model.params || "—",
            });
        }

        if (hasQuant) {
            cols.push({
                key: "quant",
                label: "Quant",
                render: (row) => row._model.quantization || "—",
            });
        }

        if (hasInputPrice) {
            cols.push({
                key: "input",
                label: "Input",
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
                render: (row) => row._raw.arena?.[arenaCol.dataKey] ?? "—",
            });
        }

        return cols;
    }, [
        onToggleFavorite, favorites, hasYear, hasModalities,
        hasContext, hasSize, hasParams, hasQuant,
        hasInputPrice, hasOutputPrice, hasActions, renderActions,
        arenaCols,
    ]);

    return (
        <div className={styles.container}>
            <div className={styles.toolbar}>
                {showSearch && (
                    <div className={styles.searchWrapper}>
                        <Search size={14} className={styles.searchIcon} />
                        <input
                            type="text"
                            className={styles.searchInput}
                            placeholder="Search models…"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <button
                                className={styles.searchClear}
                                onClick={() => setSearchQuery("")}
                                title="Clear search"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>
                )}
                {allModalities.length >= 2 && (
                    <div className={styles.filterBar}>
                        {allModalities.map((t) => {
                            const m = MODALITY_ICONS[t];
                            if (!m) return null;
                            const Icon = m.icon;
                            return (
                                <button
                                    key={t}
                                    className={`${styles.filterBtn} ${activeModality === t ? styles.filterBtnActive : ""}`}
                                    onClick={() =>
                                        setActiveModality(activeModality === t ? null : t)
                                    }
                                    title={m.label}
                                >
                                    <Icon size={14} style={{ color: MODALITY_COLORS[t] }} />
                                </button>
                            );
                        })}
                    </div>
                )}
                {showProviderFilter && allProviders.length >= 2 && allModalities.length >= 2 && (
                    <div className={styles.filterDivider} />
                )}
                {showProviderFilter && allProviders.length >= 2 && (
                    <div className={styles.filterBar}>
                        {allProviders.map((p) => (
                            <button
                                key={p}
                                className={`${styles.filterBtn} ${activeProvider === p ? styles.filterBtnActive : ""}`}
                                onClick={() =>
                                    setActiveProvider(activeProvider === p ? null : p)
                                }
                                title={PROVIDER_LABELS[p] || p}
                            >
                                <ProviderLogo provider={p} size={14} />
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <SortableTableComponent
                columns={columns}
                data={tableData}
                getRowKey={(row) => `${row._model.provider}-${row._model.key}`}
                onRowClick={onSelect ? (row) => onSelect(row._raw) : undefined}
                emptyText={searchQuery.trim() ? "No matching models" : "No models found"}
            />
        </div>
    );
}

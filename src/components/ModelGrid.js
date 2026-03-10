"use client";

import { useState } from "react";
import { Search, X, ChevronDown, ChevronUp } from "lucide-react";
import ProviderLogo, { PROVIDER_LABELS } from "./ProviderLogos";
import styles from "./ModelGrid.module.css";

function formatBytes(bytes) {
  if (!bytes) return null;
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

function formatContextLength(tokens) {
  if (!tokens) return null;
  if (tokens >= 1_000_000)
    return `${(tokens / 1_000_000).toFixed(tokens % 1_000_000 === 0 ? 0 : 1)}M`;
  return `${Math.round(tokens / 1000)}K`;
}

const ARENA_COLUMNS = [
  { key: "text", label: "Text" },
  { key: "code", label: "Code" },
  { key: "vision", label: "Vision" },
  { key: "document", label: "Document" },
  { key: "image", label: "Image" },
  { key: "imageEdit", label: "Image Edit" },
  { key: "search", label: "Search" },
];

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
 * Get a numeric sort value for a given model and sort key.
 * Always uses raw data to avoid issues with formatted display strings.
 */
function getSortValue(rawModel, model, key) {
  if (key === "context")
    return (
      rawModel.max_context_length ||
      rawModel.contextLength ||
      model.contextLength ||
      0
    );
  if (key === "size") return rawModel.size_bytes || 0;
  if (key === "params") return parseParams(model.params);
  if (key === "input") return rawModel.pricing?.inputPerMillion ?? Infinity;
  if (key === "output") return rawModel.pricing?.outputPerMillion ?? Infinity;
  // Arena column
  return rawModel.arena?.[key] ?? 0;
}

/**
 * ModelGrid — reusable, sortable model table displaying size, params,
 * context length, pricing, arena scores, and loaded status.
 */
export default function ModelGrid({
  models = [],
  onSelect,
  renderActions,
  showSearch = true,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sort, setSort] = useState({ key: null, dir: "desc" });

  const filtered = searchQuery.trim()
    ? models.filter((m) => {
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
    : models;

  // Sort
  const sorted = sort.key
    ? [...filtered].sort((a, b) => {
        const na = normalizeModel(a);
        const nb = normalizeModel(b);
        const va = getSortValue(a, na, sort.key);
        const vb = getSortValue(b, nb, sort.key);
        return sort.dir === "asc" ? va - vb : vb - va;
      })
    : filtered;

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
  const hasActions = !!renderActions;

  const arenaCols = ARENA_COLUMNS.filter((col) =>
    filtered.some((m) => m.arena && m.arena[col.key] != null),
  );

  const handleSort = (key) => {
    setSort((prev) => {
      if (prev.key === key)
        return { key, dir: prev.dir === "desc" ? "asc" : "desc" };
      return { key, dir: "desc" };
    });
  };

  const SortIcon = ({ colKey }) => {
    if (sort.key !== colKey) return null;
    return sort.dir === "desc" ? (
      <ChevronDown size={12} className={styles.sortIcon} />
    ) : (
      <ChevronUp size={12} className={styles.sortIcon} />
    );
  };

  const sortableTh = (label, key, extra = "") => (
    <th
      className={`${styles.th} ${styles.thSortable} ${extra}`}
      onClick={() => handleSort(key)}
    >
      {label} <SortIcon colKey={key} />
    </th>
  );

  return (
    <div className={styles.container}>
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

      {sorted.length === 0 ? (
        <div className={styles.empty}>
          {searchQuery.trim() ? "No matching models" : "No models found"}
        </div>
      ) : (
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Model</th>
                {hasContext && sortableTh("Context", "context")}
                {hasSize && sortableTh("Size", "size")}
                {hasParams && sortableTh("Params", "params")}
                {hasQuant && <th className={styles.th}>Quant</th>}
                {hasInputPrice && sortableTh("Input", "input")}
                {hasOutputPrice && sortableTh("Output", "output")}
                {arenaCols.map((col) => (
                  <th
                    key={col.key}
                    className={`${styles.th} ${styles.thSortable} ${styles.thArena}`}
                    onClick={() => handleSort(col.key)}
                  >
                    {col.label} <SortIcon colKey={col.key} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((rawModel) => {
                const model = normalizeModel(rawModel);
                const clickable = !!onSelect;

                return (
                  <tr
                    key={`${model.provider}-${model.key}`}
                    className={`${styles.tr} ${clickable ? styles.clickable : ""} ${model.isLoaded ? styles.loadedRow : ""}`}
                    onClick={clickable ? () => onSelect(rawModel) : undefined}
                  >
                    <td className={styles.tdName}>
                      <ProviderLogo provider={model.provider} size={18} />
                      <div className={styles.nameStack}>
                        <div className={styles.nameRow}>
                          <span className={styles.modelName}>{model.name}</span>
                          {model.provider === "lm-studio" && (
                            <span
                              className={
                                model.isLoaded
                                  ? styles.loadedBadge
                                  : styles.availableBadge
                              }
                            >
                              <span
                                className={`${styles.statusDot} ${model.isLoaded ? styles.active : ""}`}
                              />
                              {model.isLoaded ? "Loaded" : "Available"}
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
                        </div>
                        <span className={styles.modelProvider}>
                          {PROVIDER_LABELS[model.provider] || model.provider}
                        </span>
                      </div>
                    </td>
                    {hasContext && (
                      <td className={styles.td}>
                        {model.contextLength
                          ? formatContextLength(model.contextLength)
                          : "—"}
                      </td>
                    )}
                    {hasSize && (
                      <td className={styles.td}>{model.size || "—"}</td>
                    )}
                    {hasParams && (
                      <td className={styles.td}>{model.params || "—"}</td>
                    )}
                    {hasQuant && (
                      <td className={styles.td}>{model.quantization || "—"}</td>
                    )}
                    {hasInputPrice && (
                      <td className={styles.td}>
                        {rawModel.pricing?.inputPerMillion != null
                          ? `$${rawModel.pricing.inputPerMillion}`
                          : "—"}
                      </td>
                    )}
                    {hasOutputPrice && (
                      <td className={styles.td}>
                        {rawModel.pricing?.outputPerMillion != null
                          ? `$${rawModel.pricing.outputPerMillion}`
                          : "—"}
                      </td>
                    )}
                    {arenaCols.map((col) => (
                      <td
                        key={col.key}
                        className={`${styles.td} ${rawModel.arena?.[col.key] != null ? styles.tdArena : styles.tdEmpty}`}
                      >
                        {rawModel.arena?.[col.key] ?? "—"}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

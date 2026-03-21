"use client";

import { useState, useMemo } from "react";
import {
  Search,
  X as XIcon,
  Trash2,
  Type,
  Image,
  Volume2,
  FileText as DocIcon,
  Download,
  Copy,
  Star,
} from "lucide-react";
import ProviderLogo, { PROVIDER_LABELS } from "./ProviderLogos";
import { DateTime } from "luxon";
import styles from "./HistoryList.module.css";
import { MODALITY_COLORS } from "./WorkflowNodeConstants";

const MODALITY_FILTERS = [
  { key: "text", icon: Type, title: "Text" },
  { key: "image", icon: Image, title: "Image" },
  { key: "audio", icon: Volume2, title: "Audio" },
  { key: "doc", icon: DocIcon, title: "Document" },
];

/**
 * HistoryList — shared list component for both conversations and workflows.
 *
 * Props:
 *   items          — array of objects, each must have: id, title, updatedAt/createdAt
 *                    optional: totalCost, modalities, providers, tags[]
 *   activeId       — currently selected item id
 *   onSelect       — (item) => void
 *   onDelete       — (id) => void  (omit to hide delete buttons)
 *   onDownload     — (id) => void  (omit to hide download button)
 *   onCopy         — (id) => void  (omit to hide copy button)
 *   icon           — React element or component for the item icon
 *   readOnly       — disable delete actions
 *   emptyLabel     — label for empty state
 *   searchPlaceholder — placeholder for search
 *   showProviderFilters — show provider filter bar
 *   showModalityFilters — show modality filter bar
 *   admin          — admin mode (show username tags, hide delete)
 */
export default function HistoryList({
  items = [],
  activeId,
  onSelect,
  onDelete,
  onDownload,
  onCopy,
  icon: ItemIcon,
  readOnly = false,
  emptyLabel = "No items",
  searchPlaceholder = "Search...",
  showProviderFilters = true,
  showModalityFilters = true,
  admin = false,
  newIds,
  favorites = [],
  onToggleFavorite,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeModality, setActiveModality] = useState(null);
  const [activeProvider, setActiveProvider] = useState(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // Discover modalities across all items
  const allModalities = useMemo(() => {
    const set = new Set();
    for (const item of items) {
      const mod = item.modalities || {};
      for (const { key } of MODALITY_FILTERS) {
        if (mod[`${key}In`] || mod[`${key}Out`]) set.add(key);
      }
    }
    return MODALITY_FILTERS.filter(({ key }) => set.has(key));
  }, [items]);

  // Discover providers
  const allProviders = useMemo(() => {
    const set = new Set();
    for (const item of items) {
      for (const p of item.providers || []) set.add(p);
    }
    const labelOrder = Object.keys(PROVIDER_LABELS);
    return [...set].sort((a, b) => {
      const ai = labelOrder.indexOf(a);
      const bi = labelOrder.indexOf(b);
      return (ai === -1 ? Infinity : ai) - (bi === -1 ? Infinity : bi);
    });
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (showFavoritesOnly && onToggleFavorite) {
        if (!(favorites || []).includes(item.id)) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesSearch =
          (item.title || "").toLowerCase().includes(q) ||
          (item.subtitle || "").toLowerCase().includes(q) ||
          (item.searchText || "").toLowerCase().includes(q);
        if (!matchesSearch) return false;
      }
      if (activeModality) {
        const mod = item.modalities || {};
        if (!mod[`${activeModality}In`] && !mod[`${activeModality}Out`]) return false;
      }
      if (activeProvider) {
        if (!(item.providers || []).includes(activeProvider)) return false;
      }
      return true;
    });
  }, [items, searchQuery, activeModality, activeProvider, showFavoritesOnly, favorites, onToggleFavorite]);

  const hasFavorites = !!onToggleFavorite;
  const hasFilters = hasFavorites ||
    (showModalityFilters && allModalities.length >= 2) ||
    (showProviderFilters && allProviders.length >= 2);

  return (
    <div className={styles.container}>
      <div className={styles.searchWrapper}>
        <Search size={14} className={styles.searchIcon} />
        <input
          type="text"
          className={styles.searchInput}
          placeholder={searchPlaceholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button
            className={styles.searchClear}
            onClick={() => setSearchQuery("")}
            title="Clear search"
          >
            <XIcon size={14} />
          </button>
        )}
      </div>

      {/* Filter toggles */}
      {hasFilters && (
        <div className={styles.filterSection}>
          {hasFavorites && (
            <div className={styles.filterRow}>
              <span className={styles.filterLabel}>Favorite</span>
              <div className={styles.filterBar}>
                <button
                  className={`${styles.filterBtn} ${showFavoritesOnly ? styles.filterBtnActive : ""}`}
                  onClick={() => setShowFavoritesOnly((v) => !v)}
                  title="Show favorites only"
                >
                  <Star size={13} fill={showFavoritesOnly ? "currentColor" : "none"} />
                </button>
              </div>
            </div>
          )}
          {showModalityFilters && allModalities.length >= 2 && (
            <div className={styles.filterRow}>
              <span className={styles.filterLabel}>Modality</span>
              <div className={styles.filterBar}>
                {allModalities.map(({ key, icon: Icon, title }) => (
                  <button
                    key={key}
                    className={`${styles.filterBtn} ${activeModality === key ? styles.filterBtnActive : ""}`}
                    onClick={() => setActiveModality(activeModality === key ? null : key)}
                    title={title}
                  >
                    <Icon size={13} />
                  </button>
                ))}
              </div>
            </div>
          )}
          {showProviderFilters && allProviders.length >= 2 && (
            <div className={styles.filterRow}>
              <span className={styles.filterLabel}>Provider</span>
              <div className={styles.filterBar}>
                {allProviders.map((p) => (
                  <button
                    key={p}
                    className={`${styles.filterBtn} ${activeProvider === p ? styles.filterBtnActive : ""}`}
                    onClick={() => setActiveProvider(activeProvider === p ? null : p)}
                    title={p}
                  >
                    <ProviderLogo provider={p} size={13} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className={styles.list}>
        {filtered.map((item) => {
          const isActive = item.id === activeId;
          const dt = DateTime.fromISO(item.updatedAt || item.createdAt).toRelative();
          const mod = item.modalities || {};

          return (
            <div
              key={item.id}
              className={`${styles.item} ${isActive ? styles.active : ""}`}
              onClick={() => onSelect(item)}
              data-panel-close
            >
              {ItemIcon && (
                <div className={styles.icon}>
                  <ItemIcon size={14} />
                </div>
              )}
              {onToggleFavorite && (
                <button
                  className={`${styles.favBtn} ${(favorites || []).includes(item.id) ? styles.favBtnActive : ""}`}
                  onClick={(e) => { e.stopPropagation(); onToggleFavorite(item.id); }}
                  title={(favorites || []).includes(item.id) ? "Remove from favorites" : "Add to favorites"}
                >
                  <Star size={12} fill={(favorites || []).includes(item.id) ? "currentColor" : "none"} />
                </button>
              )}
              <div className={styles.content}>
                <div className={styles.title}>
                  {item.title || "Untitled"}
                  {newIds?.has?.(item.id) && (
                    <span className={styles.newBadge}>NEW</span>
                  )}
                </div>
                <div className={styles.meta}>
                  {admin && item.username && item.username !== "unknown" && (
                    <span className={styles.usernameTag}>{item.username}</span>
                  )}
                  {item.tags?.map((tag) => (
                    <span key={tag.label} className={styles.tag} style={tag.style}>
                      {tag.label}
                    </span>
                  ))}
                  <span className={styles.time}>{dt}</span>
                  {item.modelName && (
                    <span className={styles.modelTag} title={item.modelName}>
                      {item.modelName.split("/").pop()}
                    </span>
                  )}
                  {(item.totalCost || 0) > 0 && (
                    <span className={styles.cost}>
                      ${item.totalCost.toFixed(5)}
                    </span>
                  )}
                </div>
                {/* Modality icons */}
                {Object.keys(mod).length > 0 && (
                  <div className={styles.modalities}>
                    {mod.textIn && <span className={styles.modalityIcon} style={{ color: MODALITY_COLORS.text }} title="Text input"><Type size={11} /></span>}
                    {mod.imageIn && <span className={styles.modalityIcon} style={{ color: MODALITY_COLORS.image }} title="Image input"><Image size={11} /></span>}
                    {mod.audioIn && <span className={styles.modalityIcon} style={{ color: MODALITY_COLORS.audio }} title="Audio input"><Volume2 size={11} /></span>}
                    {mod.docIn && <span className={styles.modalityIcon} style={{ color: MODALITY_COLORS.pdf }} title="Document input"><DocIcon size={11} /></span>}
                    {(mod.textIn || mod.imageIn || mod.audioIn || mod.docIn) &&
                      (mod.textOut || mod.imageOut || mod.audioOut) && (
                        <span className={styles.modalityArrow}>→</span>
                      )}
                    {mod.textOut && <span className={styles.modalityIcon} style={{ color: MODALITY_COLORS.text }} title="Text output"><Type size={11} /></span>}
                    {mod.imageOut && <span className={styles.modalityIcon} style={{ color: MODALITY_COLORS.image }} title="Image output"><Image size={11} /></span>}
                    {mod.audioOut && <span className={styles.modalityIcon} style={{ color: MODALITY_COLORS.audio }} title="Audio output"><Volume2 size={11} /></span>}
                  </div>
                )}
              </div>
              {/* Actions */}
              <div className={styles.actions}>
                {onDownload && (
                  <button
                    className={styles.actionBtn}
                    onClick={(e) => { e.stopPropagation(); onDownload(item.id); }}
                    title="Download"
                  >
                    <Download size={12} />
                  </button>
                )}
                {onCopy && (
                  <button
                    className={styles.actionBtn}
                    onClick={(e) => { e.stopPropagation(); onCopy(item.id); }}
                    title="Copy"
                  >
                    <Copy size={12} />
                  </button>
                )}
                {!readOnly && !admin && onDelete && (
                  <button
                    className={`${styles.actionBtn} ${styles.deleteBtn}`}
                    onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
                    title="Delete"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className={styles.empty}>
            {searchQuery.trim() ? "No matches" : emptyLabel}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState, useMemo } from "react";
import {
  Search,
  X as XIcon,
  Trash2,
  Type,
  Image,
  Volume2,
  Video,
  FileText as DocIcon,
  Download,
  Copy,
  Star,
  Wrench,
  Globe,
  Code,
  Brain,
} from "lucide-react";
import { PROVIDER_LABELS } from "./ProviderLogos";
import SidebarFilterComponent, { MODALITY_FILTERS, TOOL_FILTERS } from "./SidebarFilterComponent";
import DatePickerComponent from "./DatePickerComponent";
import TooltipComponent from "./TooltipComponent";
import { DateTime } from "luxon";
import styles from "./HistoryList.module.css";
import { MODALITY_COLORS } from "./WorkflowNodeConstants";

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
  const [activeModalities, setActiveModalities] = useState(new Set());
  const [activeTools, setActiveTools] = useState(new Set());
  const [activeProviders, setActiveProviders] = useState(new Set());
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [dateRange, setDateRange] = useState({ from: "", to: "" });

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

  // Discover tools across all items
  const allTools = useMemo(() => {
    const set = new Set();
    for (const item of items) {
      const mod = item.modalities || {};
      for (const { key } of TOOL_FILTERS) {
        if (mod[key]) set.add(key);
      }
    }
    return TOOL_FILTERS.filter(({ key }) => set.has(key));
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
      if (activeModalities.size > 0) {
        const mod = item.modalities || {};
        const matches = [...activeModalities].some((key) => mod[`${key}In`] || mod[`${key}Out`]);
        if (!matches) return false;
      }
      if (activeTools.size > 0) {
        const mod = item.modalities || {};
        const matches = [...activeTools].some((key) => mod[key]);
        if (!matches) return false;
      }
      if (activeProviders.size > 0) {
        const itemProviders = item.providers || [];
        const matches = [...activeProviders].some((p) => itemProviders.includes(p));
        if (!matches) return false;
      }
      if (dateRange.from || dateRange.to) {
        const itemDate = new Date(item.updatedAt || item.createdAt);
        if (dateRange.from && itemDate < new Date(dateRange.from)) return false;
        if (dateRange.to && itemDate > new Date(dateRange.to + "T23:59:59")) return false;
      }
      return true;
    });
  }, [items, searchQuery, activeModalities, activeTools, activeProviders, showFavoritesOnly, favorites, onToggleFavorite, dateRange]);

  const hasFavorites = !!onToggleFavorite && favorites.length > 0;

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

      <SidebarFilterComponent
        modalities={showModalityFilters ? allModalities : []}
        tools={showModalityFilters ? allTools : []}
        providers={showProviderFilters ? allProviders : []}
        activeModalities={activeModalities}
        activeTools={activeTools}
        activeProviders={activeProviders}
        onModalityChange={setActiveModalities}
        onToolChange={setActiveTools}
        onProviderChange={setActiveProviders}
        showFavoritesOnly={showFavoritesOnly}
        onFavoritesToggle={onToggleFavorite ? () => setShowFavoritesOnly((v) => !v) : undefined}
        hasFavorites={hasFavorites}
      />

      <div className={styles.datePickerWrapper}>
        <DatePickerComponent
          from={dateRange.from}
          to={dateRange.to}
          onChange={setDateRange}
          placeholder="All dates"
          storageKey="retina-date-range"
        />
      </div>

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
                  {(item.totalCost || 0) > 0 && (
                    <span className={styles.cost}>
                      ${item.totalCost.toFixed(5)}
                    </span>
                  )}
                </div>
                {item.modelName && (
                  <span className={styles.modelTag} title={item.modelName}>
                    {item.modelName.split("/").pop()}
                  </span>
                )}
                {/* Modality icons */}
                {Object.keys(mod).length > 0 && (
                  <div className={styles.modalitiesRow}>
                    <div className={styles.modalities}>
                      {mod.textIn && <TooltipComponent label="Text input" position="top"><span className={styles.modalityIcon} style={{ color: MODALITY_COLORS.text }}><Type size={11} /></span></TooltipComponent>}
                      {mod.imageIn && <TooltipComponent label="Image input" position="top"><span className={styles.modalityIcon} style={{ color: MODALITY_COLORS.image }}><Image size={11} /></span></TooltipComponent>}
                      {mod.audioIn && <TooltipComponent label="Audio input" position="top"><span className={styles.modalityIcon} style={{ color: MODALITY_COLORS.audio }}><Volume2 size={11} /></span></TooltipComponent>}
                      {mod.videoIn && <TooltipComponent label="Video input" position="top"><span className={styles.modalityIcon} style={{ color: MODALITY_COLORS.video }}><Video size={11} /></span></TooltipComponent>}
                      {mod.docIn && <TooltipComponent label="Document input" position="top"><span className={styles.modalityIcon} style={{ color: MODALITY_COLORS.pdf }}><DocIcon size={11} /></span></TooltipComponent>}
                      {(mod.textIn || mod.imageIn || mod.audioIn || mod.videoIn || mod.docIn) &&
                        (mod.textOut || mod.imageOut || mod.audioOut) && (
                          <span className={styles.modalityArrow}>→</span>
                        )}
                      {mod.textOut && <TooltipComponent label="Text output" position="top"><span className={styles.modalityIcon} style={{ color: MODALITY_COLORS.text }}><Type size={11} /></span></TooltipComponent>}
                      {mod.imageOut && <TooltipComponent label="Image output" position="top"><span className={styles.modalityIcon} style={{ color: MODALITY_COLORS.image }}><Image size={11} /></span></TooltipComponent>}
                      {mod.audioOut && <TooltipComponent label="Audio output" position="top"><span className={styles.modalityIcon} style={{ color: MODALITY_COLORS.audio }}><Volume2 size={11} /></span></TooltipComponent>}
                    </div>
                    {(mod.thinking || mod.webSearch || mod.codeExecution || mod.functionCalling) && (
                      <div className={styles.toolIcons}>
                        {mod.thinking && (
                          <TooltipComponent label="Thinking" position="top">
                            <span className={styles.modalityIcon} style={{ color: MODALITY_COLORS.thinking }}><Brain size={11} /></span>
                          </TooltipComponent>
                        )}
                        {mod.webSearch && (
                          <TooltipComponent label="Web search" position="top">
                            <span className={styles.modalityIcon} style={{ color: MODALITY_COLORS.webSearch }}><Globe size={11} /></span>
                          </TooltipComponent>
                        )}
                        {mod.codeExecution && (
                          <TooltipComponent label="Code execution" position="top">
                            <span className={styles.modalityIcon} style={{ color: MODALITY_COLORS.codeExecution }}><Code size={11} /></span>
                          </TooltipComponent>
                        )}
                        {mod.functionCalling && (
                          <TooltipComponent label="Function calling" position="top">
                            <span className={styles.modalityIcon} style={{ color: MODALITY_COLORS.functionCalling }}><Wrench size={11} /></span>
                          </TooltipComponent>
                        )}
                      </div>
                    )}
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

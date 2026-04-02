"use client";

import { useState, useMemo } from "react";
import { Star } from "lucide-react";
import ProviderLogo, { PROVIDER_LABELS } from "./ProviderLogos";
import { MODALITY_FILTERS, TOOL_FILTERS } from "./SidebarFilterComponent";
import FilterDropdownComponent from "./FilterDropdownComponent";
import SearchInputComponent from "./SearchInputComponent";
import HistoryItemComponent from "./HistoryItemComponent";
import styles from "./HistoryList.module.css";
import { LS_DATE_RANGE } from "../constants";

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
  initialProviders,
  initialSearch = "",
}) {
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [activeModalities, setActiveModalities] = useState(new Set());
  const [activeTools, setActiveTools] = useState(new Set());
  const [activeProviders, setActiveProviders] = useState(
    () => new Set(initialProviders || []),
  );
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
        const matches = [...activeModalities].some(
          (key) => mod[`${key}In`] || mod[`${key}Out`],
        );
        if (!matches) return false;
      }
      if (activeTools.size > 0) {
        const mod = item.modalities || {};
        const matches = [...activeTools].some((key) => mod[key]);
        if (!matches) return false;
      }
      if (activeProviders.size > 0) {
        const itemProviders = item.providers || [];
        const matches = [...activeProviders].some((p) =>
          itemProviders.includes(p),
        );
        if (!matches) return false;
      }
      if (dateRange.from || dateRange.to) {
        const itemDate = new Date(item.updatedAt || item.createdAt);
        if (dateRange.from && itemDate < new Date(dateRange.from)) return false;
        if (dateRange.to && itemDate > new Date(dateRange.to + "T23:59:59"))
          return false;
      }
      return true;
    });
  }, [
    items,
    searchQuery,
    activeModalities,
    activeTools,
    activeProviders,
    showFavoritesOnly,
    favorites,
    onToggleFavorite,
    dateRange,
  ]);


  return (
    <div className={styles.container}>
      <SearchInputComponent
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder={searchPlaceholder}
        className={styles.searchWrapper}
      />

      <FilterDropdownComponent
        fullWidth
        groups={[
          ...(onToggleFavorite
            ? [
                {
                  label: "Favorites",
                  items: [{ key: "favorites", icon: Star, title: "Favorites Only", color: "#eab308" }],
                  activeKeys: showFavoritesOnly ? "favorites" : null,
                  isSingleSelect: true,
                  onToggle: () => setShowFavoritesOnly((v) => !v),
                },
              ]
            : []),
          ...(showModalityFilters && allModalities.length >= 2
            ? [
                {
                  label: "Modality",
                  items: allModalities.map((m) => ({ key: m.key, icon: m.icon, title: m.title, color: m.color })),
                  activeKeys: activeModalities,
                  onToggle: (key) => {
                    setActiveModalities((prev) => {
                      const next = new Set(prev);
                      next.has(key) ? next.delete(key) : next.add(key);
                      return next;
                    });
                  },
                },
              ]
            : []),
          ...(showModalityFilters && allTools.length >= 1
            ? [
                {
                  label: "Tools",
                  items: allTools.map((t) => ({ key: t.key, icon: t.icon, title: t.title, color: t.color })),
                  activeKeys: activeTools,
                  onToggle: (key) => {
                    setActiveTools((prev) => {
                      const next = new Set(prev);
                      next.has(key) ? next.delete(key) : next.add(key);
                      return next;
                    });
                  },
                },
              ]
            : []),
          ...(showProviderFilters && allProviders.length >= 2
            ? [
                {
                  label: "Providers",
                  items: allProviders.map((p) => ({
                    key: p,
                    icon: () => <ProviderLogo provider={p} size={13} />,
                    title: PROVIDER_LABELS[p] || p,
                  })),
                  activeKeys: activeProviders,
                  onToggle: (key) => {
                    setActiveProviders((prev) => {
                      const next = new Set(prev);
                      next.has(key) ? next.delete(key) : next.add(key);
                      return next;
                    });
                  },
                },
              ]
            : []),
        ]}
        dateRange={dateRange}
        onDateChange={setDateRange}
        dateStorageKey={LS_DATE_RANGE}
      />

      <div className={styles.list}>
        {filtered.map((item) => (
          <HistoryItemComponent
            key={item.id}
            item={item}
            isActive={item.id === activeId}
            onClick={onSelect}
            onDelete={onDelete}
            onDownload={onDownload}
            onCopy={onCopy}
            icon={ItemIcon}
            readOnly={readOnly}
            admin={admin}
            isNew={newIds?.has?.(item.id)}
            isFavorite={(favorites || []).includes(item.id)}
            onToggleFavorite={onToggleFavorite}
            dataPanelClose
          />
        ))}
        {filtered.length === 0 && (
          <div className={styles.empty}>
            {searchQuery.trim() ? "No matches" : emptyLabel}
          </div>
        )}
      </div>
    </div>
  );
}

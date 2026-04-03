"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Star,
  Type,
  Image,
  Volume2,
  Video,
  FileText as DocIcon,
  Globe,
  Code,
  Brain,
  Parentheses,
  ChevronDown,
  X,
  Filter,
  Calendar,
} from "lucide-react";
import ProviderLogo from "./ProviderLogos";
import { PROVIDER_LABELS } from "./ProviderLogos";
import { MODALITY_COLORS, TOOL_COLORS } from "./WorkflowNodeConstants";
import DatePickerComponent from "./DatePickerComponent";
import { DATE_PRESETS, formatDateDisplay, getActiveDatePreset } from "../utils/datePresets";
import styles from "./SidebarFilterComponent.module.css";

const MODALITY_FILTERS = [
  { key: "text", icon: Type, title: "Text", color: MODALITY_COLORS.text },
  { key: "image", icon: Image, title: "Image", color: MODALITY_COLORS.image },
  { key: "audio", icon: Volume2, title: "Audio", color: MODALITY_COLORS.audio },
  { key: "video", icon: Video, title: "Video", color: MODALITY_COLORS.video },
  { key: "doc", icon: DocIcon, title: "Document", color: MODALITY_COLORS.pdf },
];

const TOOL_FILTERS = [
  {
    key: "thinking",
    icon: Brain,
    title: "Thinking",
    color: TOOL_COLORS["Thinking"],
  },
  {
    key: "webSearch",
    icon: Globe,
    title: "Web Search",
    color: TOOL_COLORS["Web Search"],
  },
  {
    key: "codeExecution",
    icon: Code,
    title: "Code Execution",
    color: TOOL_COLORS["Code Execution"],
  },
  {
    key: "functionCalling",
    icon: Parentheses,
    title: "Function Calling",
    color: TOOL_COLORS["Function Calling"],
  },
];

/**
 * SidebarFilterComponent — dropdown + badge (chip) filter for sidebar panels.
 * A dropdown on the left lists available filters by category.
 * Selecting an option toggles it and displays a read-only badge to the right.
 * Badges are display-only and not clickable.
 */
export default function SidebarFilterComponent({
  modalities = [],
  tools = [],
  providers = [],
  activeModalities = new Set(),
  activeTools = new Set(),
  activeProviders = new Set(),
  onModalityChange,
  onToolChange,
  onProviderChange,
  showFavoritesOnly = false,
  onFavoritesToggle,
  _hasFavorites = false,
  dateRange,
  onDateChange,
  dateStorageKey,
  triggerLabel = "Filters",
  toolsGroupLabel = "Tools",
}) {
  const initializedDateRef = useRef(false);
  const [isOpen, setIsOpen] = useState(false);
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const dropdownRef = useRef(null);

  const showFavoriteRow = !!onFavoritesToggle;
  const showModalityRow = modalities.length >= 2;
  const showToolRow = tools.length >= 1;
  const showProviderRow = providers.length >= 2;

  const showDateRange = !!onDateChange;

  // Restore date range from localStorage on mount
  useEffect(() => {
    if (!dateStorageKey || !onDateChange || initializedDateRef.current) return;
    initializedDateRef.current = true;
    try {
      const stored = localStorage.getItem(dateStorageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.from || parsed.to) onDateChange(parsed);
      }
    } catch { /* ignore */ }
  }, [dateStorageKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist date range to localStorage
  useEffect(() => {
    if (!dateStorageKey || !initializedDateRef.current) return;
    try {
      if (dateRange?.from || dateRange?.to) {
        localStorage.setItem(dateStorageKey, JSON.stringify(dateRange));
      } else {
        localStorage.removeItem(dateStorageKey);
      }
    } catch { /* ignore */ }
  }, [dateStorageKey, dateRange]);

  const hasAnyOptions =
    showFavoriteRow || showModalityRow || showToolRow || showProviderRow || showDateRange;

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen]);

  const toggleModality = useCallback(
    (key) => {
      const next = new Set(activeModalities);
      next.has(key) ? next.delete(key) : next.add(key);
      onModalityChange(next);
    },
    [activeModalities, onModalityChange],
  );

  const toggleTool = useCallback(
    (key) => {
      const next = new Set(activeTools);
      next.has(key) ? next.delete(key) : next.add(key);
      onToolChange(next);
    },
    [activeTools, onToolChange],
  );

  const toggleProvider = useCallback(
    (key) => {
      const next = new Set(activeProviders);
      next.has(key) ? next.delete(key) : next.add(key);
      onProviderChange(next);
    },
    [activeProviders, onProviderChange],
  );

  if (!hasAnyOptions) return null;

  // Collect active badges for display
  const badges = [];

  if (showFavoritesOnly) {
    badges.push({
      key: "fav",
      label: "Favorites",
      icon: Star,
      color: "#eab308",
      onRemove: () => onFavoritesToggle(),
    });
  }

  for (const m of modalities) {
    if (activeModalities.has(m.key)) {
      badges.push({
        key: `mod-${m.key}`,
        label: m.title,
        icon: m.icon,
        color: m.color,
        onRemove: () => toggleModality(m.key),
      });
    }
  }

  for (const t of tools) {
    if (activeTools.has(t.key)) {
      badges.push({
        key: `tool-${t.key}`,
        label: t.title,
        icon: t.icon,
        color: t.color,
        onRemove: () => toggleTool(t.key),
      });
    }
  }

  for (const p of providers) {
    if (activeProviders.has(p)) {
      badges.push({
        key: `prov-${p}`,
        label: PROVIDER_LABELS[p] || p,
        providerKey: p,
        onRemove: () => toggleProvider(p),
      });
    }
  }

  // Date range badge
  const dateFrom = dateRange?.from || "";
  const dateTo = dateRange?.to || "";
  const dateLabel = formatDateDisplay(dateFrom, dateTo);
  if (dateLabel) {
    badges.push({
      key: "date",
      label: dateLabel,
      icon: Calendar,
      color: "#6366f1",
      onRemove: () => onDateChange({ from: "", to: "" }),
    });
  }

  return (
    <div className={styles.filterSection}>
      <div className={styles.filterRow}>
        {/* ── Dropdown trigger ── */}
        <div className={styles.dropdownWrapper} ref={dropdownRef}>
          <button
            type="button"
            className={`${styles.dropdownTrigger} ${isOpen ? styles.dropdownTriggerOpen : ""}`}
            onClick={() => setIsOpen((v) => !v)}
          >
            <span className={styles.triggerContent}>
              <span className={styles.triggerIcon}>
                <Filter size={14} />
              </span>
              <span className={styles.triggerText}>{triggerLabel}</span>
              {badges.length > 0 && (
                <span className={styles.triggerCount}>{badges.length}</span>
              )}
            </span>
            <ChevronDown
              size={14}
              className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ""}`}
            />
          </button>

          {/* ── Dropdown menu ── */}
          {isOpen && (
            <div className={styles.dropdownMenu}>
              {/* ── Date range presets (top) ── */}
              {showDateRange && (
                <div className={styles.menuGroup}>
                  <div className={styles.menuGroupLabel}>Date Range</div>
                  {DATE_PRESETS.map((preset) => {
                    const isActive = getActiveDatePreset(dateFrom, dateTo) === preset.label;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        className={`${styles.menuItem} ${isActive ? styles.menuItemActive : ""}`}
                        onClick={() => onDateChange(preset.getValue())}
                      >
                        <Calendar size={13} style={{ color: "#6366f1" }} />
                        <span>{preset.label}</span>
                        {isActive && (
                          <span className={styles.menuCheck}>✓</span>
                        )}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    className={`${styles.menuItem} ${!getActiveDatePreset(dateFrom, dateTo) && (dateFrom || dateTo) ? styles.menuItemActive : ""}`}
                    onClick={() => {
                      setShowCustomDatePicker(true);
                      setIsOpen(false);
                    }}
                  >
                    <Calendar size={13} style={{ color: "#6366f1" }} />
                    <span>Custom…</span>
                    {!getActiveDatePreset(dateFrom, dateTo) && (dateFrom || dateTo) && (
                      <span className={styles.menuCheck}>✓</span>
                    )}
                  </button>
                </div>
              )}

              {showFavoriteRow && (
                <div className={styles.menuGroup}>
                  <div className={styles.menuGroupLabel}>Favorites</div>
                  <button
                    type="button"
                    className={`${styles.menuItem} ${showFavoritesOnly ? styles.menuItemActive : ""}`}
                    onClick={() => {
                      onFavoritesToggle();
                    }}
                  >
                    <Star
                      size={13}
                      style={{ color: "#eab308" }}
                    />
                    <span>Favorites Only</span>
                    {showFavoritesOnly && (
                      <span className={styles.menuCheck}>✓</span>
                    )}
                  </button>
                </div>
              )}

              {showModalityRow && (
                <div className={styles.menuGroup}>
                  <div className={styles.menuGroupLabel}>Modality</div>
                  {modalities.map((m) => {
                    const Icon = m.icon;
                    const isActive = activeModalities.has(m.key);
                    return (
                      <button
                        key={m.key}
                        type="button"
                        className={`${styles.menuItem} ${isActive ? styles.menuItemActive : ""}`}
                        onClick={() => toggleModality(m.key)}
                      >
                        <Icon
                          size={13}
                          style={m.color ? { color: m.color } : undefined}
                        />
                        <span>{m.title}</span>
                        {isActive && (
                          <span className={styles.menuCheck}>✓</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {showToolRow && (
                <div className={styles.menuGroup}>
                  <div className={styles.menuGroupLabel}>{toolsGroupLabel}</div>
                  {tools.map((t) => {
                    const Icon = t.icon;
                    const isActive = activeTools.has(t.key);
                    return (
                      <button
                        key={t.key}
                        type="button"
                        className={`${styles.menuItem} ${isActive ? styles.menuItemActive : ""}`}
                        onClick={() => toggleTool(t.key)}
                      >
                        <Icon
                          size={13}
                          style={t.color ? { color: t.color } : undefined}
                        />
                        <span>{t.title}</span>
                        {isActive && (
                          <span className={styles.menuCheck}>✓</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {showProviderRow && (
                <div className={styles.menuGroup}>
                  <div className={styles.menuGroupLabel}>Providers</div>
                  {providers.map((p) => {
                    const isActive = activeProviders.has(p);
                    return (
                      <button
                        key={p}
                        type="button"
                        className={`${styles.menuItem} ${isActive ? styles.menuItemActive : ""}`}
                        onClick={() => toggleProvider(p)}
                      >
                        <ProviderLogo provider={p} size={13} />
                        <span>{PROVIDER_LABELS[p] || p}</span>
                        {isActive && (
                          <span className={styles.menuCheck}>✓</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Custom DatePicker (shown when "Custom…" is clicked) ── */}
        {showCustomDatePicker && showDateRange && (
          <DatePickerComponent
            from={dateFrom}
            to={dateTo}
            onChange={(val) => {
              onDateChange(val);
              setShowCustomDatePicker(false);
            }}
            placeholder="Pick range…"
            defaultOpen
            hideTrigger
            onClose={() => setShowCustomDatePicker(false)}
          />
        )}

        {/* ── Active filter badges (display-only) ── */}
        {badges.length > 0 && (
          <div className={styles.badgeList}>
            {badges.map((b) => {
              const Icon = b.icon;
              return (
                <span
                  key={b.key}
                  className={styles.badge}
                  style={
                    b.color
                      ? {
                          "--badge-color": b.color,
                          "--badge-bg": `${b.color}18`,
                          "--badge-border": `${b.color}40`,
                        }
                      : undefined
                  }
                >
                  {b.providerKey ? (
                    <ProviderLogo provider={b.providerKey} size={11} />
                  ) : Icon ? (
                    <Icon size={11} />
                  ) : null}
                  <span className={styles.badgeLabel}>{b.label}</span>
                  <button
                    type="button"
                    className={styles.badgeRemove}
                    onClick={(e) => {
                      e.stopPropagation();
                      b.onRemove();
                    }}
                    aria-label={`Remove ${b.label} filter`}
                  >
                    <X size={10} />
                  </button>
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export { MODALITY_FILTERS, TOOL_FILTERS };

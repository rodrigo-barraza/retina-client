"use client";

import { useState, useRef, useEffect } from "react";
import {
  ChevronDown,
  X,
  Filter,
  Calendar,
} from "lucide-react";
import DatePickerComponent from "./DatePickerComponent";
import { DATE_PRESETS, formatDateDisplay, getActiveDatePreset } from "../utils/datePresets";
import styles from "./FilterDropdownComponent.module.css";

/**
 * FilterDropdownComponent — generic dropdown + badge (chip) filter.
 *
 * @param {Object[]} groups — array of filter groups:
 *   { label: string, items: [{ key, icon, title, color?, providerLogo? }], activeKeys: Set|string, onToggle: fn, isSingleSelect?: boolean }
 *
 * @param {Object} dateRange — { from, to } or undefined if no date filtering
 * @param {Function} onDateChange — setter for dateRange
 * @param {string} dateStorageKey — localStorage key for date persistence
 * @param {React.ReactNode} renderIcon — optional custom icon renderer for provider logos etc.
 */
export default function FilterDropdownComponent({
  groups = [],
  dateRange,
  onDateChange,
  dateStorageKey,
  triggerLabel = "Filters",
  fullWidth = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const dropdownRef = useRef(null);
  const initializedDateRef = useRef(false);

  const showDateRange = !!onDateChange;

  const hasAnyOptions = groups.length > 0 || showDateRange;

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

  // Close on outside click
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

  if (!hasAnyOptions) return null;

  // Collect badges
  const badges = [];
  const dateFrom = dateRange?.from || "";
  const dateTo = dateRange?.to || "";

  for (const group of groups) {
    const { items = [], activeKeys, isSingleSelect, onToggle } = group;
    for (const item of items) {
      const isActive = isSingleSelect
        ? activeKeys === item.key
        : activeKeys instanceof Set ? activeKeys.has(item.key) : false;
      if (isActive) {
        badges.push({
          key: `${group.label}-${item.key}`,
          label: item.title,
          icon: item.icon,
          color: item.color,
          onRemove: () => onToggle(isSingleSelect ? null : item.key),
        });
      }
    }
  }

  // Date badge
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
    <div className={styles.filterSection} style={fullWidth ? { width: "100%", boxSizing: "border-box", padding: "0 12px" } : undefined}>
      <div className={styles.filterRow} style={fullWidth ? { flexDirection: "column" } : undefined}>
        {/* ── Dropdown trigger ── */}
        <div className={styles.dropdownWrapper} ref={dropdownRef} style={fullWidth ? { width: "100%" } : undefined}>
          <button
            type="button"
            className={`${styles.dropdownTrigger} ${isOpen ? styles.dropdownTriggerOpen : ""}`}
            onClick={() => setIsOpen((v) => !v)}
            style={fullWidth ? { width: "100%" } : undefined}
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

              {/* ── Dynamic filter groups ── */}
              {groups.map((group) => {
                const { label, items = [], activeKeys, isSingleSelect, onToggle } = group;
                if (items.length === 0) return null;
                return (
                  <div key={label} className={styles.menuGroup}>
                    <div className={styles.menuGroupLabel}>{label}</div>
                    {items.map((item) => {
                      const Icon = item.icon;
                      const isActive = isSingleSelect
                        ? activeKeys === item.key
                        : activeKeys instanceof Set ? activeKeys.has(item.key) : false;
                      return (
                        <button
                          key={item.key}
                          type="button"
                          className={`${styles.menuItem} ${isActive ? styles.menuItemActive : ""}`}
                          onClick={() => onToggle(isSingleSelect && isActive ? null : item.key)}
                        >
                          {Icon && (
                            <Icon
                              size={13}
                              style={item.color ? { color: item.color } : undefined}
                            />
                          )}
                          <span>{item.title}</span>
                          {isActive && (
                            <span className={styles.menuCheck}>✓</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Custom DatePicker ── */}
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
      </div>

      {/* ── Active filter badges ── */}
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
                {Icon && <Icon size={11} />}
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
  );
}

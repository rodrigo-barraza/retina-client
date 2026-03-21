"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";
import styles from "./DatePickerComponent.module.css";

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const PRESETS = [
  { label: "All Time", getValue: () => ({ from: "", to: "" }) },
  { label: "Today", getValue: () => { const d = fmt(new Date()); return { from: d, to: d }; } },
  { label: "Last 7 days", getValue: () => ({ from: fmt(daysAgo(6)), to: fmt(new Date()) }) },
  { label: "Last 30 days", getValue: () => ({ from: fmt(daysAgo(29)), to: fmt(new Date()) }) },
  { label: "This month", getValue: () => { const now = new Date(); return { from: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), to: fmt(now) }; } },
  { label: "Last month", getValue: () => { const now = new Date(); const start = new Date(now.getFullYear(), now.getMonth() - 1, 1); const end = new Date(now.getFullYear(), now.getMonth(), 0); return { from: fmt(start), to: fmt(end) }; } },
  { label: "This year", getValue: () => { const now = new Date(); return { from: fmt(new Date(now.getFullYear(), 0, 1)), to: fmt(now) }; } },
];

function fmt(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function parseDate(str) {
  if (!str) return null;
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function isSameDay(a, b) {
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isInRange(date, from, to) {
  if (!from || !to || !date) return false;
  return date >= from && date <= to;
}

function formatDisplay(from, to) {
  if (!from && !to) return null;
  const opts = { month: "short", day: "numeric" };
  const fromDate = parseDate(from);
  const toDate = parseDate(to);
  if (fromDate && toDate) {
    if (isSameDay(fromDate, toDate)) return fromDate.toLocaleDateString("en-US", opts);
    const fromStr = fromDate.toLocaleDateString("en-US", opts);
    const toStr = toDate.toLocaleDateString("en-US", { ...opts, year: fromDate.getFullYear() !== toDate.getFullYear() ? "numeric" : undefined });
    return `${fromStr} – ${toStr}`;
  }
  if (fromDate) return `From ${fromDate.toLocaleDateString("en-US", opts)}`;
  if (toDate) return `Until ${toDate.toLocaleDateString("en-US", opts)}`;
  return null;
}

function MonthGrid({ year, month, from, to, hoverDate, onDayClick, onDayHover }) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const fromDate = parseDate(from);
  const toDate = parseDate(to);

  // Determine visual range for hover preview
  const rangeStart = fromDate && !toDate && hoverDate
    ? (hoverDate < fromDate ? hoverDate : fromDate)
    : fromDate;
  const rangeEnd = fromDate && !toDate && hoverDate
    ? (hoverDate < fromDate ? fromDate : hoverDate)
    : toDate;

  const cells = [];
  for (let i = 0; i < firstDay; i++) {
    cells.push(<div key={`pad-${i}`} className={styles.dayCell} />);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const isToday = isSameDay(date, today);
    const isStart = isSameDay(date, rangeStart);
    const isEnd = isSameDay(date, rangeEnd);
    const inRange = isInRange(date, rangeStart, rangeEnd);
    const isFuture = date > today;

    const cls = [
      styles.dayBtn,
      isToday && styles.dayToday,
      isStart && styles.dayStart,
      isEnd && styles.dayEnd,
      inRange && !isStart && !isEnd && styles.dayInRange,
      isFuture && styles.dayFuture,
    ].filter(Boolean).join(" ");

    cells.push(
      <button
        key={d}
        type="button"
        className={cls}
        onClick={() => onDayClick(date)}
        onMouseEnter={() => onDayHover(date)}
        disabled={isFuture}
      >
        {d}
      </button>
    );
  }

  return (
    <div className={styles.monthGrid}>
      <div className={styles.dayHeaders}>
        {DAYS.map((d) => <span key={d} className={styles.dayHeader}>{d}</span>)}
      </div>
      <div className={styles.dayCells}>
        {cells}
      </div>
    </div>
  );
}

export default function DatePickerComponent({ from = "", to = "", onChange, placeholder = "All time", storageKey = "" }) {
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => {
    const d = from ? parseDate(from) : new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [selecting, setSelecting] = useState(null); // null | "from" set, waiting for "to"
  const [hoverDate, setHoverDate] = useState(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const initializedRef = useRef(false);

  // Calculate fixed position from trigger bounding rect
  const updateDropdownPos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setDropdownPos({
      top: rect.bottom + 6,
      left: rect.left,
    });
  }, []);

  // Recalculate on open, scroll, and resize
  useEffect(() => {
    if (!open) return;
    updateDropdownPos();
    const handleScroll = () => updateDropdownPos();
    const handleResize = () => updateDropdownPos();
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleResize);
    };
  }, [open, updateDropdownPos]);

  // Restore from localStorage on mount
  useEffect(() => {
    if (!storageKey || initializedRef.current) return;
    initializedRef.current = true;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.from || parsed.to) {
          onChange(parsed);
        }
      }
    } catch {
      // ignore
    }
  }, [storageKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist to localStorage on change
  useEffect(() => {
    if (!storageKey || !initializedRef.current) return;
    try {
      if (from || to) {
        localStorage.setItem(storageKey, JSON.stringify({ from, to }));
      } else {
        localStorage.removeItem(storageKey);
      }
    } catch {
      // ignore
    }
  }, [storageKey, from, to]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setSelecting(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e) {
      if (e.key === "Escape") {
        setOpen(false);
        setSelecting(null);
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  const prevMonth = useCallback(() => {
    setViewDate((v) => {
      const m = v.month - 1;
      return m < 0 ? { year: v.year - 1, month: 11 } : { year: v.year, month: m };
    });
  }, []);

  const nextMonth = useCallback(() => {
    setViewDate((v) => {
      const m = v.month + 1;
      return m > 11 ? { year: v.year + 1, month: 0 } : { year: v.year, month: m };
    });
  }, []);

  const secondMonth = useMemo(() => {
    const m = viewDate.month + 1;
    return m > 11 ? { year: viewDate.year + 1, month: 0 } : { year: viewDate.year, month: m };
  }, [viewDate]);

  const monthLabel = (y, m) => {
    return new Date(y, m).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  const handleDayClick = useCallback((date) => {
    const dateStr = fmt(date);
    if (!selecting) {
      // First click: set "from", wait for "to"
      setSelecting(dateStr);
      setHoverDate(null);
    } else {
      // Second click: determine range order
      const a = selecting;
      const b = dateStr;
      const [rangeFrom, rangeTo] = a <= b ? [a, b] : [b, a];
      onChange({ from: rangeFrom, to: rangeTo });
      setSelecting(null);
      setHoverDate(null);
      setOpen(false);
    }
  }, [selecting, onChange]);

  const handlePreset = useCallback((preset) => {
    const val = preset.getValue();
    onChange(val);
    setSelecting(null);
    setHoverDate(null);
    setOpen(false);
  }, [onChange]);

  const handleClear = useCallback(() => {
    onChange({ from: "", to: "" });
    setSelecting(null);
    setHoverDate(null);
    setOpen(false);
  }, [onChange]);

  const displayText = formatDisplay(from, to);
  const hasValue = !!(from || to);

  // Current "from" during selection: either the selecting state or the committed from
  const activeFrom = selecting || from;
  const activeTo = selecting ? "" : to;

  return (
    <div className={styles.container} ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`${styles.trigger} ${hasValue ? styles.triggerActive : ""} ${open ? styles.triggerOpen : ""}`}
        onClick={() => setOpen((v) => !v)}
      >
        <Calendar size={13} />
        <span className={styles.triggerText}>
          {displayText || placeholder}
        </span>
        {hasValue && (
          <span
            className={styles.triggerClear}
            onClick={(e) => { e.stopPropagation(); handleClear(); }}
            title="Clear dates"
          >
            <X size={12} />
          </span>
        )}
      </button>

      {open && (
        <div className={styles.dropdown} style={{ top: dropdownPos.top, left: dropdownPos.left }}>
          {/* Presets */}
          <div className={styles.presets}>
            {PRESETS.map((p) => {
              const isActive = p.label === "All Time"
                ? !hasValue
                : p.getValue().from === from && p.getValue().to === to;
              return (
                <button
                  key={p.label}
                  type="button"
                  className={`${styles.presetBtn} ${isActive ? styles.presetBtnActive : ""}`}
                  onClick={() => handlePreset(p)}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Calendar */}
          <div className={styles.calendars}>
            {/* Month navigation */}
            <div className={styles.monthNav}>
              <button type="button" className={styles.monthNavBtn} onClick={prevMonth}>
                <ChevronLeft size={14} />
              </button>
              <span className={styles.monthLabel}>
                {monthLabel(viewDate.year, viewDate.month)}
              </span>
              <span className={styles.monthLabel}>
                {monthLabel(secondMonth.year, secondMonth.month)}
              </span>
              <button type="button" className={styles.monthNavBtn} onClick={nextMonth}>
                <ChevronRight size={14} />
              </button>
            </div>

            <div className={styles.monthPair}>
              <MonthGrid
                year={viewDate.year}
                month={viewDate.month}
                from={activeFrom}
                to={activeTo}
                hoverDate={hoverDate}
                onDayClick={handleDayClick}
                onDayHover={setHoverDate}
              />
              <MonthGrid
                year={secondMonth.year}
                month={secondMonth.month}
                from={activeFrom}
                to={activeTo}
                hoverDate={hoverDate}
                onDayClick={handleDayClick}
                onDayHover={setHoverDate}
              />
            </div>

            {selecting && (
              <div className={styles.selectHint}>
                Click a second date to complete the range
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

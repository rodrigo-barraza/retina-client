import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import { DATE_PRESETS, fmtDate as fmt, parseDateValue as parseDate, formatDateDisplay, getActiveDatePreset } from "../utils/datePresets";
import styles from "./DatePickerComponent.module.css";

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function isSameDay(a, b) {
  if (!a || !b) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isInRange(date, from, to) {
  if (!from || !to || !date) return false;
  return date >= from && date <= to;
}

function MonthGrid({
  year,
  month,
  from,
  to,
  hoverDate,
  onDayClick,
  onDayHover,
}) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const fromDate = parseDate(from);
  const toDate = parseDate(to);

  // Determine visual range for hover preview
  const rangeStart =
    fromDate && !toDate && hoverDate
      ? hoverDate < fromDate
        ? hoverDate
        : fromDate
      : fromDate;
  const rangeEnd =
    fromDate && !toDate && hoverDate
      ? hoverDate < fromDate
        ? fromDate
        : hoverDate
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
    ]
      .filter(Boolean)
      .join(" ");

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
      </button>,
    );
  }

  return (
    <div className={styles.monthGrid}>
      <div className={styles.dayHeaders}>
        {DAYS.map((d) => (
          <span key={d} className={styles.dayHeader}>
            {d}
          </span>
        ))}
      </div>
      <div className={styles.dayCells}>{cells}</div>
    </div>
  );
}

export default function DatePickerComponent({
  from = "",
  to = "",
  onChange,
  placeholder = "All time",
  storageKey = "",
  disabled = false,
  defaultOpen = false,
  onClose,
  hideTrigger = false,
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [viewDate, setViewDate] = useState(() => {
    const d = from ? parseDate(from) : new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [selecting, setSelecting] = useState(null); // null | "from" set, waiting for "to"
  const [hoverDate, setHoverDate] = useState(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const dropdownElRef = useRef(null);
  const initializedRef = useRef(false);

  // Calculate fixed position from trigger bounding rect, clamped to viewport
  const updateDropdownPos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    let top = rect.bottom + 6;
    let left = rect.left;

    // After the dropdown is rendered, clamp to viewport
    if (dropdownElRef.current) {
      const dropRect = dropdownElRef.current.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      // Clamp right edge
      if (left + dropRect.width > vw - 8) {
        left = Math.max(8, vw - dropRect.width - 8);
      }
      // Clamp bottom edge — flip above if needed
      if (top + dropRect.height > vh - 8) {
        const above = rect.top - dropRect.height - 6;
        if (above >= 8) {
          top = above;
        } else {
          top = Math.max(8, vh - dropRect.height - 8);
        }
      }
    }

    setDropdownPos({ top, left });
  }, []);

  // Recalculate on open, scroll, and resize
  useEffect(() => {
    if (!open) return;
    // Use rAF so the dropdown is painted before we measure for clamping
    const rafId = requestAnimationFrame(() => {
      updateDropdownPos();
      // Second frame: re-clamp now that position is applied
      requestAnimationFrame(() => updateDropdownPos());
    });
    const handleScroll = () => updateDropdownPos();
    const handleResize = () => updateDropdownPos();
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleResize);
    return () => {
      cancelAnimationFrame(rafId);
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
        onClose?.();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, onClose]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e) {
      if (e.key === "Escape") {
        setOpen(false);
        setSelecting(null);
        onClose?.();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  const prevMonth = useCallback(() => {
    setViewDate((v) => {
      const m = v.month - 1;
      return m < 0
        ? { year: v.year - 1, month: 11 }
        : { year: v.year, month: m };
    });
  }, []);

  const nextMonth = useCallback(() => {
    setViewDate((v) => {
      const m = v.month + 1;
      return m > 11
        ? { year: v.year + 1, month: 0 }
        : { year: v.year, month: m };
    });
  }, []);

  const secondMonth = useMemo(() => {
    const m = viewDate.month + 1;
    return m > 11
      ? { year: viewDate.year + 1, month: 0 }
      : { year: viewDate.year, month: m };
  }, [viewDate]);

  const monthLabel = (y, m) => {
    return new Date(y, m).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  };

  const handleDayClick = useCallback(
    (date) => {
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
        onClose?.();
      }
    },
    [selecting, onChange, onClose],
  );

  const handlePreset = useCallback(
    (preset) => {
      const val = preset.getValue();
      onChange(val);
      setSelecting(null);
      setHoverDate(null);
      setOpen(false);
      onClose?.();
    },
    [onChange, onClose],
  );

  const handleClear = useCallback(() => {
    onChange({ from: "", to: "" });
    setSelecting(null);
    setHoverDate(null);
    setOpen(false);
    onClose?.();
  }, [onChange, onClose]);

  const displayText = formatDateDisplay(from, to);
  const hasValue = !!(from || to);

  // Current "from" during selection: either the selecting state or the committed from
  const activeFrom = selecting || from;
  const activeTo = selecting ? "" : to;

  return (
    <div className={styles.container} ref={containerRef}>
      {!hideTrigger && (
        <button
          ref={triggerRef}
          type="button"
          className={`${styles.trigger} ${open ? styles.triggerOpen : ""} ${disabled ? styles.triggerDisabled : ""}`}
          onClick={() => !disabled && setOpen((v) => !v)}
          disabled={disabled}
        >
          <span className={styles.triggerContent}>
            <span className={styles.triggerIcon}><Calendar size={13} /></span>
            <span className={styles.triggerText}>{displayText || placeholder}</span>
          </span>
          {hasValue ? (
            <span
              className={styles.triggerClear}
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
              title="Clear dates"
            >
              <X size={12} />
            </span>
          ) : (
            <ChevronDown
              size={14}
              className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`}
            />
          )}
        </button>
      )}
      {hideTrigger && <div ref={triggerRef} />}

      {open && (
        <div
          ref={dropdownElRef}
          className={styles.dropdown}
          style={{ top: dropdownPos.top, left: dropdownPos.left }}
        >
          {/* Presets */}
          <div className={styles.presets}>
            {DATE_PRESETS.map((p) => {
              const isActive = getActiveDatePreset(from, to) === p.label;
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
              <button
                type="button"
                className={styles.monthNavBtn}
                onClick={prevMonth}
              >
                <ChevronLeft size={14} />
              </button>
              <span className={styles.monthLabel}>
                {monthLabel(viewDate.year, viewDate.month)}
              </span>
              <span className={styles.monthLabel}>
                {monthLabel(secondMonth.year, secondMonth.month)}
              </span>
              <button
                type="button"
                className={styles.monthNavBtn}
                onClick={nextMonth}
              >
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

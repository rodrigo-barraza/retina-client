import { useState, useEffect, useCallback, useRef } from "react";

/**
 * useDateRange — persist a { from, to } date range to/from localStorage.
 *
 * Replaces the identical date-range load/save useEffect pair that was
 * copy-pasted in SidebarFilterComponent, FilterDropdownComponent, and
 * AdminHeaderContext.
 *
 * @param {string}   storageKey — localStorage key for persistence
 * @param {Function} [onChange] — optional external setter to call on restore
 * @returns {[Object, Function]} [dateRange, setDateRange]
 */
export default function useDateRange(storageKey, onChange) {
  const [dateRange, setDateRangeState] = useState(null);
  const initializedRef = useRef(false);

  // Restore from localStorage on mount
  useEffect(() => {
    if (!storageKey || initializedRef.current) return;
    initializedRef.current = true;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.from || parsed.to) {
          // Intentional: hydrate state from localStorage post-mount (SSR-safe)
          setDateRangeState(parsed);
          onChange?.(parsed);
        }
      }
    } catch { /* ignore */ }
  }, [storageKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist to localStorage on change
  useEffect(() => {
    if (!storageKey || !initializedRef.current) return;
    try {
      if (dateRange?.from || dateRange?.to) {
        localStorage.setItem(storageKey, JSON.stringify(dateRange));
      } else {
        localStorage.removeItem(storageKey);
      }
    } catch { /* ignore */ }
  }, [storageKey, dateRange]);

  const setDateRange = useCallback((range) => {
    setDateRangeState(range);
    onChange?.(range);
  }, [onChange]);

  return [dateRange, setDateRange, initializedRef];
}

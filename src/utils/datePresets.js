/**
 * Shared date-range presets and helpers.
 * Single source of truth for DatePickerComponent, SidebarFilterComponent,
 * and FilterDropdownComponent.
 */

export function fmtDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function isoAgo(ms) {
  return new Date(Date.now() - ms).toISOString();
}

export const DATE_PRESETS = [
  { label: "Last minute", getValue: () => ({ from: isoAgo(60e3), to: "" }), relative: true },
  { label: "Last 5 minutes", getValue: () => ({ from: isoAgo(5 * 60e3), to: "" }), relative: true },
  { label: "Last 30 minutes", getValue: () => ({ from: isoAgo(30 * 60e3), to: "" }), relative: true },
  { label: "Last 1 hour", getValue: () => ({ from: isoAgo(3600e3), to: "" }), relative: true },
  { label: "Last 6 hours", getValue: () => ({ from: isoAgo(6 * 3600e3), to: "" }), relative: true },
  {
    label: "Today",
    getValue: () => {
      const d = fmtDate(new Date());
      return { from: d, to: d };
    },
  },
  {
    label: "Last 7 days",
    getValue: () => ({ from: fmtDate(daysAgo(6)), to: fmtDate(new Date()) }),
  },
  {
    label: "Last 30 days",
    getValue: () => ({ from: fmtDate(daysAgo(29)), to: fmtDate(new Date()) }),
  },
  {
    label: "This month",
    getValue: () => {
      const now = new Date();
      return {
        from: fmtDate(new Date(now.getFullYear(), now.getMonth(), 1)),
        to: fmtDate(now),
      };
    },
  },
  {
    label: "This year",
    getValue: () => {
      const now = new Date();
      return { from: fmtDate(new Date(now.getFullYear(), 0, 1)), to: fmtDate(now) };
    },
  },
  { label: "All Time", getValue: () => ({ from: "", to: "" }) },
];

/**
 * Parse a date string. Handles both YYYY-MM-DD and ISO datetime formats.
 */
export function parseDateValue(str) {
  if (!str) return null;
  // ISO datetime (contains "T")
  if (str.includes("T")) return new Date(str);
  // Day-only
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function isSameDay(a, b) {
  if (!a || !b) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Format a { from, to } range for display in trigger buttons and badges.
 */
export function formatDateDisplay(from, to) {
  if (!from && !to) return null;
  // For relative / sub-day presets, show the preset label directly
  const matchingPreset = DATE_PRESETS.find((p) => {
    if (!p.relative) return false;
    const v = p.getValue();
    return !to && from && v.from.slice(0, 16) === from.slice(0, 16);
  });
  if (matchingPreset) return matchingPreset.label;

  const hasFromTime = from?.includes("T");
  const hasToTime = to?.includes("T");
  const dateOpts = { month: "short", day: "numeric" };
  const timeOpts = { hour: "2-digit", minute: "2-digit", hour12: false };
  const fromDate = parseDateValue(from);
  const toDate = parseDateValue(to);

  const fmtWithTime = (date, hasTime) => {
    const dayStr = date.toLocaleDateString("en-US", dateOpts);
    if (!hasTime) return dayStr;
    const timStr = date.toLocaleTimeString("en-US", timeOpts);
    return `${dayStr} ${timStr}`;
  };

  if (fromDate && toDate) {
    if (isSameDay(fromDate, toDate) && !hasFromTime && !hasToTime)
      return fromDate.toLocaleDateString("en-US", dateOpts);
    return `${fmtWithTime(fromDate, hasFromTime)} – ${fmtWithTime(toDate, hasToTime)}`;
  }
  if (fromDate) return `From ${fmtWithTime(fromDate, hasFromTime)}`;
  if (toDate) return `Until ${fmtWithTime(toDate, hasToTime)}`;
  return null;
}

/**
 * Return the label of the currently active preset, or null if none match.
 */
export function getActiveDatePreset(from, to) {
  for (const p of DATE_PRESETS) {
    if (p.relative) {
      const v = p.getValue();
      if (!to && from && v.from.slice(0, 16) === from.slice(0, 16)) return p.label;
    } else {
      const v = p.getValue();
      if (v.from === (from || "") && v.to === (to || "")) return p.label;
    }
  }
  return null;
}

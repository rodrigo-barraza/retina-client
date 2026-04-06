"use client";

import { useState, useRef, useCallback, useEffect, Fragment } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronUp, Columns3, Check } from "lucide-react";
import tooltipStyles from "./TooltipComponent.module.css";
import styles from "./TableComponent.module.css";

/**
 * TableComponent — a reusable, sortable table component matching the
 * aesthetic. Supports sortable columns, custom cell rendering, expandable
 * sub-rows, and per-column description tooltips.
 *
 * @param {Object} props
 * @param {string} [props.title] — Section title above the table
 * @param {Array<{key: string, label: string, description?: string, sortable?: boolean, align?: string, render?: Function, sortValue?: Function, className?: string}>} props.columns
 * @param {Array} props.data — Array of row objects
 * @param {Function} [props.getRowKey] — (row, i) => unique key
 * @param {Function} [props.getSubRows] — (row) => array of sub-row objects
 * @param {Function} [props.renderExpandedContent] — (row) => ReactNode — full-width panel beneath expanded row
 * @param {Function} [props.onRowClick] — (row) => void
 * @param {string} [props.emptyText] — Text to show when data is empty
 * @param {string} [props.sortKey] — External sort key (for server sorting)
 * @param {string} [props.sortDir] — External sort direction ('asc' | 'desc')
 * @param {Function} [props.onSort] — (key, dir) => void
 */
/**
 * HeaderCell — a `<th>` that optionally renders a portal-based tooltip
 * when the column has a `description`. The tooltip is triggered by
 * hovering the th itself (no wrapper span), so sorting clicks and
 * cursor styles work without interference.
 */
function HeaderCell({ col, thClasses, isSortable, handleSort, sort }) {
  const thRef = useRef(null);
  const [tipMounted, setTipMounted] = useState(false);
  const [tipVisible, setTipVisible] = useState(false);
  const [tipCoords, setTipCoords] = useState({ top: 0, left: 0 });
  const enterTimer = useRef(null);
  const showTimer = useRef(null);
  const unmountTimer = useRef(null);

  const showTip = useCallback(() => {
    if (!thRef.current || !col.description) return;
    clearTimeout(unmountTimer.current);
    const rect = thRef.current.getBoundingClientRect();
    setTipCoords({ top: rect.bottom + 8, left: rect.left + rect.width / 2 });
    setTipMounted(true);
    showTimer.current = setTimeout(() => setTipVisible(true), 10);
  }, [col.description]);

  const hideTip = useCallback(() => {
    clearTimeout(enterTimer.current);
    clearTimeout(showTimer.current);
    setTipVisible(false);
    unmountTimer.current = setTimeout(() => setTipMounted(false), 200);
  }, []);

  const onEnter = useCallback(() => {
    if (!col.description) return;
    clearTimeout(enterTimer.current);
    enterTimer.current = setTimeout(showTip, 400);
  }, [col.description, showTip]);

  const onLeave = useCallback(() => {
    hideTip();
  }, [hideTip]);

  const isActive = sort.key === col.key;
  const sortIcon = isActive
    ? sort.dir === "desc"
      ? <ChevronDown size={12} className={styles.sortIcon} />
      : <ChevronUp size={12} className={styles.sortIcon} />
    : null;

  return (
    <th
      ref={thRef}
      className={thClasses}
      style={{ textAlign: col.align || "left", width: col.width, maxWidth: col.width }}
      onClick={isSortable ? () => handleSort(col.key) : undefined}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      {col.label}
      {isSortable && sortIcon}
      {tipMounted &&
        createPortal(
          <span
            className={`${tooltipStyles.bubble} ${tooltipStyles.bottom} ${tipVisible ? tooltipStyles.visible : ""}`}
            style={{ top: tipCoords.top, left: tipCoords.left }}
          >
            {col.description}
          </span>,
          document.body,
        )}
    </th>
  );
}

/* ── Column visibility filter ──────────────────────── */

/**
 * Reads saved hidden-column keys from localStorage.
 * Falls back to columns with `defaultHidden: true` when no saved state exists.
 * Returns a Set of column keys that should be hidden.
 */
function loadHiddenColumns(storageKey, columns) {
  if (!storageKey) return new Set();
  try {
    const raw = localStorage.getItem(`table-hidden-cols:${storageKey}`);
    if (raw) return new Set(JSON.parse(raw));
  } catch { /* ignore */ }
  // No saved preference — use defaultHidden from column definitions
  if (columns) {
    const defaults = columns.filter((c) => c.defaultHidden).map((c) => c.key);
    if (defaults.length > 0) return new Set(defaults);
  }
  return new Set();
}

function saveHiddenColumns(storageKey, hiddenSet) {
  if (!storageKey) return;
  try {
    localStorage.setItem(
      `table-hidden-cols:${storageKey}`,
      JSON.stringify([...hiddenSet]),
    );
  } catch { /* ignore */ }
}

function ColumnFilter({ columns, hiddenColumns, onToggle, storageKey }) {
  const btnRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  const toggle = useCallback(() => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setCoords({ top: rect.bottom + 4, left: rect.right });
    }
    setOpen((v) => !v);
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (btnRef.current?.contains(e.target)) return;
      // Check if click is inside the portal dropdown
      const dropdown = document.querySelector(`[data-column-filter="${storageKey}"]`);
      if (dropdown?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, storageKey]);

  const hiddenCount = hiddenColumns.size;

  return (
    <>
      <button
        ref={btnRef}
        className={`${styles.columnFilterBtn} ${hiddenCount > 0 ? styles.columnFilterBtnActive : ""}`}
        onClick={toggle}
        title="Show/hide columns"
      >
        <Columns3 size={12} />
        <span>Columns</span>
        {hiddenCount > 0 && (
          <span className={styles.columnFilterCount}>{columns.length - hiddenCount}/{columns.length}</span>
        )}
      </button>
      {open &&
        createPortal(
          <div
            className={styles.columnFilterDropdown}
            data-column-filter={storageKey}
            style={{ top: coords.top, left: coords.left }}
          >
            <div className={styles.columnFilterHeader}>Toggle Columns</div>
            <div className={styles.columnFilterList}>
              {columns.filter((col) => col.hideable !== false).map((col) => {
                const visible = !hiddenColumns.has(col.key);
                return (
                  <button
                    key={col.key}
                    className={`${styles.columnFilterItem} ${visible ? styles.columnFilterItemVisible : ""}`}
                    onClick={() => onToggle(col.key)}
                  >
                    <span className={styles.columnFilterCheck}>
                      {visible && <Check size={10} />}
                    </span>
                    <span className={styles.columnFilterLabel}>{col.label}</span>
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

export default function TableComponent({
  title,
  columns,
  data = [],
  getRowKey,
  getSubRows,
  renderExpandedContent,
  onRowClick,
  emptyText = "No data",
  sortKey: externalSortKey,
  sortDir: externalSortDir,
  onSort,
  maxHeight,
  activeRowKey,
  highlightedRowKey,
  highlightedRowRef,
  onRowMouseEnter,
  onRowMouseLeave,
  getRowClassName,
  mini = false,
  storageKey,
}) {
  const [internalSort, setInternalSort] = useState({ key: null, dir: "desc" });
  const sort = onSort
    ? { key: externalSortKey, dir: externalSortDir }
    : internalSort;
  const [expanded, setExpanded] = useState(new Set());

  /* ── Column visibility ── */
  const [hiddenColumns, setHiddenColumns] = useState(() => loadHiddenColumns(storageKey, columns));

  const toggleColumn = useCallback((key) => {
    setHiddenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      saveHiddenColumns(storageKey, next);
      return next;
    });
  }, [storageKey]);

  const visibleColumns = storageKey
    ? columns.filter((c) => !hiddenColumns.has(c.key))
    : columns;

  /* ── Drag-to-scroll (grab scrolling) ── */
  const scrollRef = useRef(null);
  const dragRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    scrollLeft: 0,
    scrollTop: 0,
    moved: false,
  });

  const onPointerDown = useCallback((e) => {
    // Ignore if clicking interactive elements or table headers
    if (e.target.closest("a, button, input, select, textarea, th")) return;
    const el = scrollRef.current;
    if (!el) return;
    dragRef.current = {
      active: true,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      scrollLeft: el.scrollLeft,
      scrollTop: el.scrollTop,
      moved: false,
    };
  }, []);

  const onPointerMove = useCallback((e) => {
    const d = dragRef.current;
    if (!d.active) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    // 5px threshold to distinguish drag from click
    if (!d.moved && Math.abs(dx) + Math.abs(dy) > 5) {
      d.moved = true;
      // Capture pointer only once we know it's a drag
      const el = scrollRef.current;
      if (el) {
        try {
          el.setPointerCapture(d.pointerId);
        } catch {
          /* ignore */
        }
      }
      scrollRef.current?.classList.add(styles.grabbing);
    }
    if (d.moved) {
      const el = scrollRef.current;
      el.scrollLeft = d.scrollLeft - dx;
      el.scrollTop = d.scrollTop - dy;
    }
  }, []);

  const onPointerUp = useCallback((e) => {
    const d = dragRef.current;
    const wasDrag = d.moved;
    d.active = false;
    d.moved = false;
    const el = scrollRef.current;
    if (el) {
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      el.classList.remove(styles.grabbing);
    }
    // If it was a drag, suppress the next click on the row
    if (wasDrag) {
      const handler = (ev) => {
        ev.stopPropagation();
        ev.preventDefault();
      };
      el?.addEventListener("click", handler, { capture: true, once: true });
    }
  }, []);

  function handleSort(key) {
    let newDir;
    if (sort.key === key) {
      newDir = sort.dir === "desc" ? "asc" : "desc";
    } else {
      newDir = "desc";
    }

    if (onSort) {
      onSort(key, newDir);
    } else {
      setInternalSort({ key, dir: newDir });
    }
  }

  function toggleExpand(rowKey) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(rowKey)) next.delete(rowKey);
      else next.add(rowKey);
      return next;
    });
  }

  // Sort data (only if not controlled)
  const sortCol = sort.key ? columns.find((c) => c.key === sort.key) : null;
  const sorted =
    sort.key && !onSort
      ? [...data].sort((a, b) => {
          const va = sortCol?.sortValue ? sortCol.sortValue(a) : (a[sort.key] ?? 0);
          const vb = sortCol?.sortValue ? sortCol.sortValue(b) : (b[sort.key] ?? 0);
          if (typeof va === "string" && typeof vb === "string") {
            return sort.dir === "asc"
              ? va.localeCompare(vb)
              : vb.localeCompare(va);
          }
          return sort.dir === "asc" ? va - vb : vb - va;
        })
      : data;

  const hasSubRows = !!getSubRows;
  const hasExpandedContent = !!renderExpandedContent;

  return (
    <div className={`${styles.container} ${mini ? styles.mini : ""}`}>
      {(title || storageKey) && (
        <div className={styles.tableHeader}>
          {title && <h2 className={styles.title}>{title}</h2>}
          {storageKey && (
            <ColumnFilter
              columns={columns}
              hiddenColumns={hiddenColumns}
              onToggle={toggleColumn}
              storageKey={storageKey}
            />
          )}
        </div>
      )}

      <div
        ref={scrollRef}
        className={styles.tableScroll}
        style={maxHeight ? { maxHeight, overflowY: "auto" } : undefined}
        data-table-scroll
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <table className={styles.table}>
          <thead>
            <tr>
              {visibleColumns.map((col, _ci) => {
                const isSortable = col.sortable !== false;
                const isActive = sort.key === col.key;
                const thClasses = [
                  styles.th,
                  isSortable ? styles.thSortable : "",
                  isActive ? styles.thActive : "",
                ]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <HeaderCell
                    key={col.key}
                    col={col}
                    thClasses={thClasses}
                    isSortable={isSortable}
                    handleSort={handleSort}
                    sort={sort}
                  />
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length} className={styles.emptyRow}>
                  {emptyText}
                </td>
              </tr>
            ) : (
              sorted.map((row, ri) => {
                const key = getRowKey ? getRowKey(row, ri) : ri;
                const subRows = hasSubRows ? getSubRows(row) : [];
                const isExpanded = expanded.has(key);
                const colsToRender = visibleColumns;
                const isExpandable = (subRows && subRows.length > 0) || hasExpandedContent;
                const clickable = !!onRowClick || isExpandable;
                const isActive = activeRowKey != null && key === activeRowKey;
                const isHighlighted =
                  highlightedRowKey != null && key === highlightedRowKey;
                const customClass = getRowClassName ? getRowClassName(row, ri) : "";

                return (
                  <Fragment key={key}>
                    <tr
                      key={key}
                      ref={
                        isHighlighted && highlightedRowRef
                          ? highlightedRowRef
                          : undefined
                      }
                      className={`${styles.tr} ${clickable ? styles.clickable : ""} ${isExpandable ? styles.expandableRow : ""} ${isActive ? styles.activeRow : ""} ${isHighlighted ? styles.highlightedRow : ""} ${customClass}`}
                      onClick={
                        isExpandable
                          ? () => toggleExpand(key)
                          : onRowClick
                            ? () => onRowClick(row)
                            : undefined
                      }
                      onMouseEnter={
                        onRowMouseEnter ? () => onRowMouseEnter(row, ri) : undefined
                      }
                      onMouseLeave={
                        onRowMouseLeave ? () => onRowMouseLeave(row, ri) : undefined
                      }
                    >
                      {colsToRender.map((col, ci) => {
                        const isFirst = ci === 0;
                        const isSorted = sort.key === col.key;
                        const tdClass = isFirst ? styles.tdName : styles.td;
                        const extraClass = col.className || "";
                        const sortedClass =
                          !isFirst && isSorted ? styles.tdSorted : "";
                        const cellStyle = {
                          ...(col.align ? { textAlign: col.align } : {}),
                          ...(col.width ? { width: col.width, maxWidth: col.width } : {}),
                        };

                        let content;
                        if (col.render) {
                          content = col.render(row, ri);
                        } else {
                          content = row[col.key] ?? "—";
                        }

                        return (
                          <td
                            key={col.key}
                            className={`${tdClass} ${extraClass} ${sortedClass}`}
                            style={cellStyle}
                          >
                            {isFirst && isExpandable && (
                              <span
                                className={`${styles.expandIcon} ${isExpanded ? styles.expandIconOpen : ""}`}
                              >
                                <ChevronDown size={12} />
                              </span>
                            )}
                            {content}
                          </td>
                        );
                      })}
                    </tr>
                    {isExpanded && hasExpandedContent && (
                      <tr className={styles.expandedContentRow}>
                        <td colSpan={colsToRender.length} className={styles.expandedContentCell}>
                          {renderExpandedContent(row)}
                        </td>
                      </tr>
                    )}
                    {isExpanded &&
                      !hasExpandedContent &&
                      subRows.map((sub, si) => (
                        <tr key={`${key}-sub-${si}`} className={styles.subRow}>
                          {colsToRender.map((col, _ci) => {
                            const cellStyle = col.align
                              ? { textAlign: col.align }
                              : {};
                            let content;
                            if (col.renderSub) {
                              content = col.renderSub(sub, si);
                            } else if (col.render) {
                              content = col.render(sub, si);
                            } else {
                              content = sub[col.key] ?? "—";
                            }
                            return (
                              <td key={col.key} style={cellStyle}>
                                {content}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

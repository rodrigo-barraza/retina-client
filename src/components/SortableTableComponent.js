"use client";

import { useState, useRef, useCallback, Fragment } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import styles from "./SortableTableComponent.module.css";

/**
 * SortableTableComponent — a reusable, sortable table component matching the ModelGrid
 * aesthetic. Supports sortable columns, custom cell rendering, and expandable
 * sub-rows.
 *
 * @param {Object} props
 * @param {string} [props.title] — Section title above the table
 * @param {Array<{key: string, label: string, sortable?: boolean, align?: string, render?: Function, className?: string}>} props.columns
 * @param {Array} props.data — Array of row objects
 * @param {Function} [props.getRowKey] — (row, i) => unique key
 * @param {Function} [props.getSubRows] — (row) => array of sub-row objects
 * @param {Function} [props.onRowClick] — (row) => void
 * @param {string} [props.emptyText] — Text to show when data is empty
 * @param {string} [props.sortKey] — External sort key (for server sorting)
 * @param {string} [props.sortDir] — External sort direction ('asc' | 'desc')
 * @param {Function} [props.onSort] — (key, dir) => void
 */
export default function SortableTableComponent({
  title,
  columns,
  data = [],
  getRowKey,
  getSubRows,
  onRowClick,
  emptyText = "No data",
  sortKey: externalSortKey,
  sortDir: externalSortDir,
  onSort,
  maxHeight,
  activeRowKey,
  highlightedRowKey,
  highlightedRowRef,
}) {
  const [internalSort, setInternalSort] = useState({ key: null, dir: "desc" });
  const sort = onSort
    ? { key: externalSortKey, dir: externalSortDir }
    : internalSort;
  const [expanded, setExpanded] = useState(new Set());

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
  const sorted =
    sort.key && !onSort
      ? [...data].sort((a, b) => {
          const va = a[sort.key] ?? 0;
          const vb = b[sort.key] ?? 0;
          if (typeof va === "string" && typeof vb === "string") {
            return sort.dir === "asc"
              ? va.localeCompare(vb)
              : vb.localeCompare(va);
          }
          return sort.dir === "asc" ? va - vb : vb - va;
        })
      : data;

  const SortIcon = ({ colKey }) => {
    if (sort.key !== colKey) return null;
    return sort.dir === "desc" ? (
      <ChevronDown size={12} className={styles.sortIcon} />
    ) : (
      <ChevronUp size={12} className={styles.sortIcon} />
    );
  };

  const hasSubRows = !!getSubRows;

  return (
    <div className={styles.container}>
      {title && <h2 className={styles.title}>{title}</h2>}

      {sorted.length === 0 ? (
        <div className={styles.empty}>{emptyText}</div>
      ) : (
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
                {columns.map((col, ci) => {
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
                    <th
                      key={col.key}
                      className={thClasses}
                      style={
                        ci > 0 && col.align !== "left"
                          ? { textAlign: "right" }
                          : { textAlign: "left" }
                      }
                      onClick={
                        isSortable ? () => handleSort(col.key) : undefined
                      }
                    >
                      {col.label} {isSortable && <SortIcon colKey={col.key} />}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, ri) => {
                const key = getRowKey ? getRowKey(row, ri) : ri;
                const subRows = hasSubRows ? getSubRows(row) : [];
                const isExpanded = expanded.has(key);
                const isExpandable = subRows && subRows.length > 0;
                const clickable = !!onRowClick || isExpandable;
                const isActive = activeRowKey != null && key === activeRowKey;
                const isHighlighted =
                  highlightedRowKey != null && key === highlightedRowKey;

                return (
                  <Fragment key={key}>
                    <tr
                      key={key}
                      ref={
                        isHighlighted && highlightedRowRef
                          ? highlightedRowRef
                          : undefined
                      }
                      className={`${styles.tr} ${clickable ? styles.clickable : ""} ${isExpandable ? styles.expandableRow : ""} ${isActive ? styles.activeRow : ""} ${isHighlighted ? styles.highlightedRow : ""}`}
                      onClick={
                        isExpandable
                          ? () => toggleExpand(key)
                          : onRowClick
                            ? () => onRowClick(row)
                            : undefined
                      }
                    >
                      {columns.map((col, ci) => {
                        const isFirst = ci === 0;
                        const isSorted = sort.key === col.key;
                        const tdClass = isFirst ? styles.tdName : styles.td;
                        const extraClass = col.className || "";
                        const sortedClass =
                          !isFirst && isSorted ? styles.tdSorted : "";
                        const cellStyle =
                          ci > 0 && col.align !== "left"
                            ? { textAlign: "right" }
                            : {};

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
                    {isExpanded &&
                      subRows.map((sub, si) => (
                        <tr key={`${key}-sub-${si}`} className={styles.subRow}>
                          {columns.map((col, ci) => {
                            const cellStyle =
                              ci > 0 && col.align !== "left"
                                ? { textAlign: "right" }
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
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

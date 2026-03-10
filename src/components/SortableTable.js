"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import styles from "./SortableTable.module.css";

/**
 * SortableTable — a reusable, sortable table component matching the ModelGrid
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
 */
export default function SortableTable({
    title,
    columns,
    data = [],
    getRowKey,
    getSubRows,
    onRowClick,
    emptyText = "No data",
}) {
    const [sort, setSort] = useState({ key: null, dir: "desc" });
    const [expanded, setExpanded] = useState(new Set());

    function handleSort(key) {
        setSort((prev) => {
            if (prev.key === key)
                return { key, dir: prev.dir === "desc" ? "asc" : "desc" };
            return { key, dir: "desc" };
        });
    }

    function toggleExpand(rowKey) {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(rowKey)) next.delete(rowKey);
            else next.add(rowKey);
            return next;
        });
    }

    // Sort data
    const sorted = sort.key
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
                <div className={styles.tableScroll}>
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
                                            onClick={isSortable ? () => handleSort(col.key) : undefined}
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

                                return (
                                    <>
                                        <tr
                                            key={key}
                                            className={`${styles.tr} ${clickable ? styles.clickable : ""} ${isExpandable ? styles.expandableRow : ""}`}
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
                                                const tdClass = isFirst ? styles.tdName : styles.td;
                                                const extraClass = col.className || "";
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
                                                        className={`${tdClass} ${extraClass}`}
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
                                    </>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

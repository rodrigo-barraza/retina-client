"use client";

import { useState, useCallback } from "react";
import { ChevronRight, Copy, Check } from "lucide-react";
import styles from "./JsonViewerComponent.module.css";

/**
 * JsonViewerComponent — interactive, collapsible JSON tree viewer.
 *
 * Props:
 *   data      — any JSON-serializable value
 *   label     — optional top-level label (e.g. "Request Payload")
 *   collapsed — default collapse depth (0 = all collapsed, Infinity = expanded)
 *   maxHeight — optional max-height with scroll (e.g. "400px")
 *   className — extra root class
 */
export default function JsonViewerComponent({
  data,
  label,
  collapsed = 1,
  maxHeight,
  className,
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [data]);

  return (
    <div
      className={`${styles.viewer} ${className || ""}`}
      style={maxHeight ? { maxHeight, overflowY: "auto" } : undefined}
    >
      <div className={styles.toolbar}>
        {label && <span className={styles.label}>{label}</span>}
        <button
          className={styles.copyBtn}
          onClick={handleCopy}
          title="Copy JSON"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <div className={styles.tree}>
        <JsonNode value={data} depth={0} defaultCollapsed={collapsed} />
      </div>
    </div>
  );
}

function JsonNode({ keyName, value, depth, defaultCollapsed, isLast = true }) {
  const type = getType(value);
  const isExpandable = type === "object" || type === "array";
  const [expanded, setExpanded] = useState(depth < defaultCollapsed);

  if (isExpandable) {
    const entries =
      type === "array"
        ? value.map((v, i) => [i, v])
        : Object.entries(value);
    const bracket = type === "array" ? ["[", "]"] : ["{", "}"];
    const isEmpty = entries.length === 0;

    return (
      <div className={styles.node}>
        <div
          className={styles.row}
          onClick={() => !isEmpty && setExpanded((e) => !e)}
          style={{ cursor: isEmpty ? "default" : "pointer" }}
        >
          {!isEmpty && (
            <span
              className={`${styles.chevron} ${expanded ? styles.chevronOpen : ""}`}
            >
              <ChevronRight size={12} />
            </span>
          )}
          {keyName !== undefined && (
            <span className={styles.key}>{JSON.stringify(String(keyName))}: </span>
          )}
          {isEmpty ? (
            <span className={styles.bracket}>
              {bracket[0]}{bracket[1]}
            </span>
          ) : expanded ? (
            <span className={styles.bracket}>{bracket[0]}</span>
          ) : (
            <span className={styles.collapsed}>
              {bracket[0]}
              <span className={styles.ellipsis}>
                {entries.length} {type === "array" ? "items" : "keys"}
              </span>
              {bracket[1]}
            </span>
          )}
          {!expanded && !isLast && <span className={styles.comma}>,</span>}
        </div>
        {expanded && (
          <>
            <div className={styles.children}>
              {entries.map(([k, v], i) => (
                <JsonNode
                  key={k}
                  keyName={type === "array" ? undefined : k}
                  value={v}
                  depth={depth + 1}
                  defaultCollapsed={defaultCollapsed}
                  isLast={i === entries.length - 1}
                />
              ))}
            </div>
            <div className={styles.row}>
              <span className={styles.bracket}>{bracket[1]}</span>
              {!isLast && <span className={styles.comma}>,</span>}
            </div>
          </>
        )}
      </div>
    );
  }

  // Primitive value
  return (
    <div className={styles.node}>
      <div className={styles.row}>
        {keyName !== undefined && (
          <span className={styles.key}>{JSON.stringify(String(keyName))}: </span>
        )}
        <span className={styles[`val_${type}`] || styles.val_null}>
          {formatValue(value, type)}
        </span>
        {!isLast && <span className={styles.comma}>,</span>}
      </div>
    </div>
  );
}

function getType(val) {
  if (val === null || val === undefined) return "null";
  if (Array.isArray(val)) return "array";
  return typeof val; // "string", "number", "boolean", "object"
}

function formatValue(val, type) {
  if (type === "string") return JSON.stringify(val);
  if (type === "null") return "null";
  if (type === "boolean") return val ? "true" : "false";
  return String(val);
}

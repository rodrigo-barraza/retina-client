"use client";

import { useState, useMemo, useCallback } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import styles from "./TimelineChartComponent.module.css";

const TABS = [
  { key: "requests", label: "Requests", color: "#6366f1", unit: "" },
  { key: "tokens", label: "Tokens", color: "#a855f7", unit: "" },
  { key: "cost", label: "Cost", color: "#f59e0b", unit: "$" },
  { key: "avgLatency", label: "Latency", color: "#ec4899", unit: "ms" },
  { key: "successRate", label: "Success", color: "#10b981", unit: "%" },
];

function formatNumber(n) {
  if (n === null || n === undefined) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatValue(value, tab) {
  if (value === null || value === undefined) return "—";
  if (tab.key === "cost") {
    return value >= 0.01 ? `$${value.toFixed(4)}` : `$${value.toFixed(6)}`;
  }
  if (tab.key === "avgLatency") {
    return value >= 1000 ? `${(value / 1000).toFixed(1)}s` : `${Math.round(value)}ms`;
  }
  if (tab.key === "successRate") {
    return `${value}%`;
  }
  return formatNumber(value);
}

function yTickFormatter(value, tabKey) {
  if (tabKey === "cost") return `$${value.toFixed(2)}`;
  if (tabKey === "avgLatency") return value >= 1000 ? `${(value / 1000).toFixed(1)}s` : `${value}ms`;
  if (tabKey === "successRate") return `${value}%`;
  return formatNumber(value);
}

/* Custom tooltip */
function ChartTooltipComponent({ active, payload, label, tab }) {
  if (!active || !payload?.length) return null;
  return (
    <div className={styles.tooltip}>
      <span className={styles.tooltipLabel}>{label}</span>
      <span className={styles.tooltipValue} style={{ color: tab.color }}>
        {formatValue(payload[0].value, tab)}
      </span>
    </div>
  );
}

/* Custom glow dot */
function GlowDotComponent({ cx, cy, color }) {
  if (cx == null || cy == null) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r="8" fill={color} opacity="0.2" />
      <circle cx={cx} cy={cy} r="4" fill={color} stroke="#fff" strokeWidth="1.5" />
    </g>
  );
}

/**
 * TimelineChartComponent — tabbed area chart for timeline data.
 *
 * Props:
 *   data     — array of { hour, requests, tokens, cost, avgLatency, successRate, label }
 *   loading  — boolean
 *   height   — chart height in px (default: 260)
 */
export default function TimelineChartComponent({ data = [], loading = false, height = 260 }) {
  const [activeTab, setActiveTab] = useState("requests");
  const tab = TABS.find((t) => t.key === activeTab) || TABS[0];

  const gradientId = `timelineGrad_${tab.key}`;

  const yDomain = useMemo(() => {
    if (tab.key === "successRate") return [0, 100];
    return ["auto", "auto"];
  }, [tab.key]);

  const renderTooltip = useCallback((props) => {
    return <ChartTooltipComponent {...props} tab={tab} />;
  }, [tab]);

  const renderDot = useCallback((props) => {
    return <GlowDotComponent {...props} color={tab.color} />;
  }, [tab]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.tabs}>
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`${styles.tab} ${activeTab === t.key ? styles.tabActive : ""}`}
              onClick={() => setActiveTab(t.key)}
              style={activeTab === t.key ? { color: t.color, borderColor: t.color } : undefined}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.chartArea} style={{ height }}>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 8, right: 12, bottom: 0, left: -12 }}
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={tab.color} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={tab.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 6"
                stroke="rgba(255,255,255,0.04)"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fill: "#5a6078", fontSize: 11 }}
                axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: "#5a6078", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => yTickFormatter(v, tab.key)}
                domain={yDomain}
              />
              <Tooltip
                content={renderTooltip}
                cursor={{
                  stroke: `${tab.color}40`,
                  strokeWidth: 1,
                  strokeDasharray: "4 4",
                }}
              />
              <Area
                type="monotone"
                dataKey={tab.key}
                stroke={tab.color}
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                activeDot={renderDot}
                animationDuration={500}
                animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className={styles.empty}>
            {loading ? "Loading..." : "No data yet"}
          </div>
        )}
      </div>
    </div>
  );
}

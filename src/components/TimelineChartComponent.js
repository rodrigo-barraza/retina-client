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
  Customized,
} from "recharts";
import styles from "./TimelineChartComponent.module.css";
import ChartTabsComponent from "./ChartTabsComponent";
import { formatNumber } from "../utils/utilities";

const TABS = [
  { key: "requests", label: "Requests", color: "#6366f1", unit: "" },
  { key: "tokens", label: "Tokens", color: "#a855f7", unit: "" },
  { key: "cost", label: "Cost", color: "#f59e0b", unit: "$" },
  { key: "avgLatency", label: "Latency", color: "#ec4899", unit: "ms" },
  { key: "successRate", label: "Success", color: "#10b981", unit: "%" },
];

/**
 * VerticalGridLines — renders thin vertical lines at every data point.
 * Used for 10-min and hourly granularity to visually subdivide the chart
 * without adding extra XAxis labels.
 *
 * Injected via Recharts' <Customized /> component.
 */
function VerticalGridLines(props) {
  const { formattedGraphicalItems, offset } = props;

  const areaItem = formattedGraphicalItems?.[0];
  const points =
    areaItem?.props?.points || areaItem?.points || [];
  if (points.length < 2) return null;

  const yTop = offset?.top ?? 0;
  const yBottom = yTop + (offset?.height ?? 0);

  return (
    <g className="vertical-grid-lines">
      {points.map((pt, i) => (
        <line
          key={`vg-${i}`}
          x1={pt.x}
          y1={yTop}
          x2={pt.x}
          y2={yBottom}
          stroke="rgba(255,255,255,0.04)"
          strokeWidth={0.5}
        />
      ))}
    </g>
  );
}

function formatValue(value, tab) {
  if (value === null || value === undefined) return "—";
  if (tab.key === "cost") {
    return value >= 0.01 ? `$${value.toFixed(4)}` : `$${value.toFixed(6)}`;
  }
  if (tab.key === "avgLatency") {
    return value >= 1000
      ? `${(value / 1000).toFixed(1)}s`
      : `${Math.round(value)}ms`;
  }
  if (tab.key === "successRate") {
    return `${value}%`;
  }
  return formatNumber(value);
}

function yTickFormatter(value, tabKey) {
  if (tabKey === "cost") return `$${value.toFixed(2)}`;
  if (tabKey === "avgLatency")
    return value >= 1000 ? `${(value / 1000).toFixed(1)}s` : `${value}ms`;
  if (tabKey === "successRate") return `${value}%`;
  return formatNumber(value);
}

/* Custom tooltip — uses `label` field (always present, e.g. "14:10") */
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
      <circle
        cx={cx}
        cy={cy}
        r="4"
        fill={color}
        stroke="#fff"
        strokeWidth="1.5"
      />
    </g>
  );
}

/**
 * Custom XAxis tick — only renders text when `tickLabel` is non-empty.
 * This keeps the axis sparse for 10-min granularity (label only at hour marks).
 */
function SparseTick({ x, y, payload, data }) {
  const entry = data?.[payload?.index];
  const text = entry?.tickLabel;
  if (!text) return null;
  return (
    <text
      x={x}
      y={y + 12}
      textAnchor="middle"
      fill="#5a6078"
      fontSize={11}
    >
      {text}
    </text>
  );
}

/**
 * TimelineChartComponent — tabbed area chart for timeline data.
 *
 * Props:
 *   data     — array of { hour, requests, tokens, cost, avgLatency, successRate, label, tickLabel }
 *   loading  — boolean
 *   height   — chart height in px (default: 260)
 */
export default function TimelineChartComponent({
  data = [],
  loading = false,
  height = 260,
  title = "Activity Over Time",
}) {
  const [activeTab, setActiveTab] = useState("requests");
  const tab = TABS.find((t) => t.key === activeTab) || TABS[0];

  const gradientId = `timelineGrad_${tab.key}`;

  const yDomain = useMemo(() => {
    if (tab.key === "successRate") return [0, 100];
    return ["auto", "auto"];
  }, [tab.key]);

  const renderTooltip = useCallback(
    (props) => {
      return <ChartTooltipComponent {...props} tab={tab} />;
    },
    [tab],
  );

  const renderDot = useCallback(
    (props) => {
      return <GlowDotComponent {...props} color={tab.color} />;
    },
    [tab],
  );

  // Detect if we have sub-hourly data where we need sparse tick labels
  const hasSubHourBins = useMemo(() => {
    if (!data.length) return false;
    return data[0]?.hour?.includes(":") ?? false;
  }, [data]);

  // For low-density sub-daily data we draw vertical grid lines at every data point.
  // At high density (>50 pts) the lines merge into visual noise, so skip them.
  const needsVerticalGrid = useMemo(() => {
    if (!data.length || data.length > 50) return false;
    const h = data[0]?.hour || "";
    return h.length > 10; // any sub-daily granularity
  }, [data]);

  // Custom tick renderer that pulls tickLabel from data
  const renderTick = useCallback(
    (props) => <SparseTick {...props} data={data} />,
    [data],
  );

  return (
    <div className={styles.container}>
      {title && <h2 className={styles.title}>{title}</h2>}
      <div className={styles.header}>
        <ChartTabsComponent
          tabs={TABS}
          activeTab={activeTab}
          onChange={setActiveTab}
        />
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
              {needsVerticalGrid && (
                <Customized component={VerticalGridLines} />
              )}
              <XAxis
                dataKey="label"
                tick={hasSubHourBins ? renderTick : { fill: "#5a6078", fontSize: 11 }}
                axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
                tickLine={false}
                interval={hasSubHourBins ? 0 : "preserveStartEnd"}
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

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
 * Compute the number of vertical sub-divisions to draw between each data point.
 *
 * ≤ 24 hourly points  → 6 subs (one line every 10 min)
 * 25–168 hourly points → 1 per data point (just data-point grid lines)
 * date-level or larger → 0 (keep as-is)
 */
function getSubDivisions(data) {
  if (!data.length) return 0;
  const isHourly = data[0]?.hour?.length > 10;
  if (!isHourly) return 0;
  if (data.length <= 24) return 6;   // ≤ 1 day → every 10 min
  if (data.length <= 168) return 1;  // 1–7 days → every hour (data-point lines)
  return 0;
}

/**
 * SubGridLines — renders minor vertical grid lines between data points.
 * Injected via Recharts' <Customized /> component, which passes chart internals.
 */
function SubGridLines(props) {
  const {
    xAxisMap,
    yAxisMap,
    formattedGraphicalItems,
    offset,
  } = props;

  const xAxis = xAxisMap && Object.values(xAxisMap)[0];
  const yAxis = yAxisMap && Object.values(yAxisMap)[0];
  if (!xAxis || !yAxis) return null;

  // Recharts v3: items are { graphicalItem, data, points } or { props: { points } }
  const areaItem = formattedGraphicalItems?.[0];
  const points =
    areaItem?.props?.points ||      // v2 format
    areaItem?.points ||              // v3 format
    [];
  if (points.length < 2) return null;

  // Recover original data for period detection
  const sourceData =
    areaItem?.item?.props?.data ||   // v2
    areaItem?.props?.data ||         // v3 alt
    props.chartData ||               // possible direct pass
    [];
  const subs = getSubDivisions(sourceData);
  if (subs === 0) return null;

  const yTop = offset?.top ?? 0;
  const yBottom = yTop + (offset?.height ?? 0);
  const lines = [];

  if (subs === 1) {
    // 1–7 day range: thin vertical line at each hourly data point
    for (let i = 0; i < points.length; i++) {
      lines.push(
        <line
          key={`dg-${i}`}
          x1={points[i].x}
          y1={yTop}
          x2={points[i].x}
          y2={yBottom}
          stroke="rgba(255,255,255,0.04)"
          strokeWidth={0.5}
        />,
      );
    }
  } else {
    // ≤ 24h: data-point lines + sub-division lines between them
    for (let i = 0; i < points.length; i++) {
      // Data point vertical line (slightly more visible than sub-divs)
      lines.push(
        <line
          key={`dp-${i}`}
          x1={points[i].x}
          y1={yTop}
          x2={points[i].x}
          y2={yBottom}
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={0.5}
        />,
      );
      // Sub-division lines to the next data point
      if (i < points.length - 1) {
        const x0 = points[i].x;
        const x1Pos = points[i + 1].x;
        const step = (x1Pos - x0) / subs;
        for (let j = 1; j < subs; j++) {
          const x = x0 + step * j;
          lines.push(
            <line
              key={`sg-${i}-${j}`}
              x1={x}
              y1={yTop}
              x2={x}
              y2={yBottom}
              stroke="rgba(255,255,255,0.025)"
              strokeWidth={0.5}
            />,
          );
        }
      }
    }
  }

  return <g className="sub-grid-lines">{lines}</g>;
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
 * TimelineChartComponent — tabbed area chart for timeline data.
 *
 * Props:
 *   data     — array of { hour, requests, tokens, cost, avgLatency, successRate, label }
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

  // Determine whether we need vertical data-point grid lines
  const showVerticalGrid = useMemo(() => {
    if (!data.length) return false;
    const isHourly = data[0]?.hour?.length > 10;
    return isHourly && data.length > 24 && data.length <= 168;
  }, [data]);

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
                vertical={showVerticalGrid}
              />
              <Customized component={SubGridLines} />
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

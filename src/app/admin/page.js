"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Activity,
  Zap,
  DollarSign,
  Clock,
  AlertCircle,
  CheckCircle,
  TrendingUp,
  Workflow,
} from "lucide-react";
import { IrisService } from "../../services/IrisService";
import StatsCard from "../../components/StatsCard";
import styles from "./page.module.css";

const PROVIDER_COLORS = [
  "#6366f1",
  "#a855f7",
  "#ec4899",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#ef4444",
  "#06b6d4",
];

const TIME_RANGES = [
  { key: "day", label: "24h", hours: 24 },
  { key: "week", label: "7d", hours: 168 },
  { key: "month", label: "30d", hours: 720 },
  { key: "year", label: "1y", hours: 8760 },
  { key: "all", label: "All", hours: 0 },
];

function formatNumber(n) {
  if (n === null || n === undefined) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatCost(n) {
  if (n === null || n === undefined) return "$0.00";
  return `$${n.toFixed(4)}`;
}

function formatLatency(ms) {
  if (ms === null || ms === undefined) return "0ms";
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

function getDateRange(rangeKey) {
  if (rangeKey === "all") return {};
  const range = TIME_RANGES.find((r) => r.key === rangeKey);
  if (!range) return {};
  const from = new Date(Date.now() - range.hours * 60 * 60 * 1000).toISOString();
  return { from };
}

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [projectStats, setProjectStats] = useState([]);
  const [modelStats, setModelStats] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [recentRequests, setRecentRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Time range
  const [timeRange, setTimeRange] = useState("day");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [useCustom, setUseCustom] = useState(false);

  // Hovering chart
  const [hoveredBar, setHoveredBar] = useState(null);

  const dateParams = useMemo(() => {
    if (useCustom && (customFrom || customTo)) {
      const p = {};
      if (customFrom) p.from = new Date(customFrom).toISOString();
      if (customTo) p.to = new Date(customTo + "T23:59:59").toISOString();
      return p;
    }
    return getDateRange(timeRange);
  }, [timeRange, useCustom, customFrom, customTo]);

  const timelineHours = useMemo(() => {
    if (useCustom) return 720; // 30 days for custom range
    const range = TIME_RANGES.find((r) => r.key === timeRange);
    return range?.hours || 24;
  }, [timeRange, useCustom]);

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [statsData, projects, models, timelineData, requestsData] =
        await Promise.all([
          IrisService.getStats(dateParams),
          IrisService.getProjectStats(dateParams),
          IrisService.getModelStats(dateParams),
          IrisService.getTimeline(timelineHours, dateParams),
          IrisService.getRequests({
            limit: 10,
            sort: "timestamp",
            order: "desc",
            ...dateParams,
          }),
        ]);

      setStats(statsData);
      setProjectStats(projects);
      setModelStats(models);
      setTimeline(timelineData);
      setRecentRequests(requestsData.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [dateParams, timelineHours]);

  useEffect(() => {
    loadDashboard();
    const interval = setInterval(loadDashboard, 60000);
    return () => clearInterval(interval);
  }, [loadDashboard]);

  // Build provider distribution from model stats
  const providerMap = {};
  modelStats.forEach((m) => {
    providerMap[m.provider] = (providerMap[m.provider] || 0) + m.totalRequests;
  });
  const providerEntries = Object.entries(providerMap).sort(
    (a, b) => b[1] - a[1],
  );
  const totalProviderRequests =
    providerEntries.reduce((s, [, v]) => s + v, 0) || 1;

  // SVG donut
  const donutRadius = 45;
  const donutCircumference = 2 * Math.PI * donutRadius;
  let donutOffset = 0;

  // Top 10 models
  const topModels = [...modelStats]
    .sort((a, b) => b.totalRequests - a.totalRequests)
    .slice(0, 10);

  // Chart data
  const maxTimelineRequests = Math.max(...timeline.map((t) => t.requests), 1);
  const chartWidth = 600;
  const chartHeight = 140;
  const chartPadding = { top: 10, right: 10, bottom: 24, left: 40 };
  const plotW = chartWidth - chartPadding.left - chartPadding.right;
  const plotH = chartHeight - chartPadding.top - chartPadding.bottom;

  const timeRangeLabel = useMemo(() => {
    const range = TIME_RANGES.find((r) => r.key === timeRange);
    return range?.label || "Custom";
  }, [timeRange]);

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Dashboard</h1>
        <p className={styles.pageSubtitle}>
          Prism AI Gateway — Overview &amp; Analytics
        </p>
      </div>

      {/* ── Time Range Toolbar ── */}
      <div className={styles.timeToolbar}>
        <div className={styles.timePills}>
          {TIME_RANGES.map((r) => (
            <button
              key={r.key}
              className={`${styles.timePill} ${!useCustom && timeRange === r.key ? styles.timePillActive : ""}`}
              onClick={() => {
                setUseCustom(false);
                setTimeRange(r.key);
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className={styles.datePicker}>
          <input
            type="date"
            className={styles.dateInput}
            value={customFrom}
            onChange={(e) => {
              setCustomFrom(e.target.value);
              setUseCustom(true);
            }}
            placeholder="From"
          />
          <span className={styles.dateArrow}>→</span>
          <input
            type="date"
            className={styles.dateInput}
            value={customTo}
            onChange={(e) => {
              setCustomTo(e.target.value);
              setUseCustom(true);
            }}
            placeholder="To"
          />
        </div>
      </div>

      {error && (
        <div className={styles.errorBanner}>
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {/* Stats Row */}
      <div className={styles.statsGrid}>
        <StatsCard
          label="Total Requests"
          value={loading ? "..." : formatNumber(stats?.totalRequests)}
          subtitle={useCustom ? "Custom range" : `Last ${timeRangeLabel}`}
          icon={Activity}
          variant="accent"
          loading={loading}
        />
        <StatsCard
          label="Total Tokens"
          value={
            loading
              ? "..."
              : formatNumber(
                  (stats?.totalInputTokens || 0) +
                    (stats?.totalOutputTokens || 0),
                )
          }
          subtitle={
            loading
              ? ""
              : `${formatNumber(stats?.totalInputTokens)} in / ${formatNumber(stats?.totalOutputTokens)} out`
          }
          icon={Zap}
          variant="info"
          loading={loading}
        />
        <StatsCard
          label="Total Cost"
          value={loading ? "..." : formatCost(stats?.totalCost)}
          subtitle="Estimated spend"
          icon={DollarSign}
          variant="warning"
          loading={loading}
        />
        <StatsCard
          label="Avg Latency"
          value={loading ? "..." : formatLatency(stats?.avgLatency)}
          subtitle={
            loading ? "" : `${stats?.avgTokensPerSec?.toFixed(0) || 0} tok/s`
          }
          icon={Clock}
          variant="success"
          loading={loading}
        />
        <StatsCard
          label="Success Rate"
          value={
            loading
              ? "..."
              : `${stats?.totalRequests ? ((stats.successCount / stats.totalRequests) * 100).toFixed(1) : 0}%`
          }
          subtitle={loading ? "" : `${stats?.errorCount || 0} errors`}
          icon={stats?.errorCount > 0 ? AlertCircle : CheckCircle}
          variant={stats?.errorCount > 0 ? "danger" : "success"}
          loading={loading}
        />
      </div>

      {/* ── Charts Row ── */}
      <div className={styles.chartsRow}>
        {/* Requests Timeline Chart */}
        <div className={styles.chartCard}>
          <div className={styles.chartTitle}>
            <TrendingUp size={14} />
            Requests Over Time
          </div>
          <div className={styles.chartSvgWrapper}>
            {timeline.length > 0 ? (
              <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                className={styles.chartSvg}
                preserveAspectRatio="none"
              >
                {/* Y-axis grid lines */}
                {[0.25, 0.5, 0.75, 1].map((pct) => (
                  <g key={pct}>
                    <line
                      x1={chartPadding.left}
                      y1={chartPadding.top + plotH * (1 - pct)}
                      x2={chartPadding.left + plotW}
                      y2={chartPadding.top + plotH * (1 - pct)}
                      stroke="var(--border-subtle)"
                      strokeDasharray="3 3"
                    />
                    <text
                      x={chartPadding.left - 6}
                      y={chartPadding.top + plotH * (1 - pct) + 3}
                      fill="var(--text-muted)"
                      fontSize="8"
                      textAnchor="end"
                    >
                      {formatNumber(Math.round(maxTimelineRequests * pct))}
                    </text>
                  </g>
                ))}

                {/* Area fill */}
                <path
                  d={(() => {
                    const pts = timeline.map((t, i) => {
                      const x = chartPadding.left + (i / (timeline.length - 1 || 1)) * plotW;
                      const y = chartPadding.top + plotH - (t.requests / maxTimelineRequests) * plotH;
                      return `${x},${y}`;
                    });
                    return `M${pts[0]} ${pts.map((p) => `L${p}`).join(" ")} L${chartPadding.left + plotW},${chartPadding.top + plotH} L${chartPadding.left},${chartPadding.top + plotH} Z`;
                  })()}
                  fill="url(#areaGrad)"
                  opacity="0.3"
                />

                {/* Line */}
                <path
                  d={timeline
                    .map((t, i) => {
                      const x = chartPadding.left + (i / (timeline.length - 1 || 1)) * plotW;
                      const y = chartPadding.top + plotH - (t.requests / maxTimelineRequests) * plotH;
                      return `${i === 0 ? "M" : "L"}${x},${y}`;
                    })
                    .join(" ")}
                  fill="none"
                  stroke="var(--accent-color)"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />

                {/* Hover bars */}
                {timeline.map((t, i) => {
                  const x = chartPadding.left + (i / (timeline.length - 1 || 1)) * plotW;
                  const y = chartPadding.top + plotH - (t.requests / maxTimelineRequests) * plotH;
                  const barW = plotW / timeline.length;
                  return (
                    <g key={i}>
                      <rect
                        x={x - barW / 2}
                        y={chartPadding.top}
                        width={barW}
                        height={plotH}
                        fill="transparent"
                        onMouseEnter={() => setHoveredBar(i)}
                        onMouseLeave={() => setHoveredBar(null)}
                      />
                      {hoveredBar === i && (
                        <>
                          <circle cx={x} cy={y} r="3" fill="var(--accent-color)" />
                          <rect
                            x={x - 36}
                            y={y - 22}
                            width="72"
                            height="16"
                            rx="3"
                            fill="var(--bg-secondary)"
                            stroke="var(--border-color)"
                          />
                          <text
                            x={x}
                            y={y - 11}
                            fill="var(--text-primary)"
                            fontSize="8"
                            textAnchor="middle"
                          >
                            {t.requests} req
                          </text>
                        </>
                      )}
                    </g>
                  );
                })}

                {/* X-axis labels */}
                {timeline
                  .filter(
                    (_, i) =>
                      i === 0 ||
                      i === timeline.length - 1 ||
                      i % Math.max(1, Math.floor(timeline.length / 6)) === 0,
                  )
                  .map((t, _j, arr) => {
                    const i = timeline.indexOf(t);
                    const x = chartPadding.left + (i / (timeline.length - 1 || 1)) * plotW;
                    return (
                      <text
                        key={i}
                        x={x}
                        y={chartHeight - 4}
                        fill="var(--text-muted)"
                        fontSize="7"
                        textAnchor="middle"
                      >
                        {t.hour?.slice(11) || ""}h
                      </text>
                    );
                  })}

                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent-color)" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="var(--accent-color)" stopOpacity="0" />
                  </linearGradient>
                </defs>
              </svg>
            ) : (
              <div className={styles.chartEmpty}>
                {loading ? "Loading..." : "No data yet"}
              </div>
            )}
          </div>
        </div>

        {/* Provider Distribution */}
        <div className={styles.chartCard}>
          <div className={styles.chartTitle}>Provider Distribution</div>
          <div className={styles.donutContainer}>
            {providerEntries.length > 0 ? (
              <>
                <svg width="110" height="110" viewBox="0 0 110 110">
                  {providerEntries.map(([provider, count], i) => {
                    const pct = count / totalProviderRequests;
                    const dashLength = pct * donutCircumference;
                    const currentOffset = donutOffset;
                    donutOffset += dashLength;
                    return (
                      <circle
                        key={provider}
                        cx="55"
                        cy="55"
                        r={donutRadius}
                        fill="none"
                        stroke={PROVIDER_COLORS[i % PROVIDER_COLORS.length]}
                        strokeWidth="10"
                        strokeDasharray={`${dashLength} ${donutCircumference - dashLength}`}
                        strokeDashoffset={-currentOffset}
                        transform="rotate(-90 55 55)"
                        style={{ transition: "all 0.5s ease" }}
                      />
                    );
                  })}
                </svg>
                <div className={styles.donutLegend}>
                  {providerEntries.map(([provider, count], i) => (
                    <div key={provider} className={styles.legendItem}>
                      <span
                        className={styles.legendDot}
                        style={{
                          background:
                            PROVIDER_COLORS[i % PROVIDER_COLORS.length],
                        }}
                      />
                      <span>
                        {provider} ({count})
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className={styles.chartEmpty}>
                {loading ? "Loading..." : "No data yet"}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Top Models + Top Providers ── */}
      <div className={styles.twoCol}>
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Top Models</h2>
          </div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Model</th>
                <th>Provider</th>
                <th>Requests</th>
                <th>Cost</th>
                <th>Avg Latency</th>
              </tr>
            </thead>
            <tbody>
              {topModels.length > 0 ? (
                topModels.map((m, i) => (
                  <tr key={`${m.provider}-${m.model}-${i}`}>
                    <td style={{ fontWeight: 500, color: "var(--text-primary)" }}>
                      {m.model}
                    </td>
                    <td>
                      <span className={styles.badgeProvider}>{m.provider}</span>
                    </td>
                    <td>{formatNumber(m.totalRequests)}</td>
                    <td>{formatCost(m.totalCost)}</td>
                    <td>{formatLatency(m.avgLatency)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={5}
                    style={{
                      textAlign: "center",
                      color: "var(--text-muted)",
                      padding: 24,
                    }}
                  >
                    {loading ? "Loading..." : "No data yet"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Top Providers</h2>
          </div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Provider</th>
                <th>Requests</th>
                <th>% Share</th>
              </tr>
            </thead>
            <tbody>
              {providerEntries.length > 0 ? (
                providerEntries.map(([provider, count], i) => (
                  <tr key={provider}>
                    <td style={{ fontWeight: 500, color: "var(--text-primary)" }}>
                      <span className={styles.providerRow}>
                        <span
                          className={styles.legendDot}
                          style={{
                            background:
                              PROVIDER_COLORS[i % PROVIDER_COLORS.length],
                          }}
                        />
                        {provider}
                      </span>
                    </td>
                    <td>{formatNumber(count)}</td>
                    <td>
                      <div className={styles.shareBar}>
                        <div
                          className={styles.shareBarFill}
                          style={{
                            width: `${(count / totalProviderRequests) * 100}%`,
                            background:
                              PROVIDER_COLORS[i % PROVIDER_COLORS.length],
                          }}
                        />
                        <span>
                          {((count / totalProviderRequests) * 100).toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={3}
                    style={{
                      textAlign: "center",
                      color: "var(--text-muted)",
                      padding: 24,
                    }}
                  >
                    {loading ? "Loading..." : "No data yet"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Recent Requests + Projects ── */}
      <div className={styles.twoCol}>
        {/* Recent Requests */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Recent Requests</h2>
            <Link href="/admin/requests" className={styles.sectionAction}>
              View all →
            </Link>
          </div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Time</th>
                <th>Model</th>
                <th>Tokens</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentRequests.length > 0 ? (
                recentRequests.map((r, i) => (
                  <tr key={r.requestId || i}>
                    <td>
                      {r.timestamp
                        ? new Date(r.timestamp).toLocaleTimeString()
                        : "-"}
                    </td>
                    <td>{r.model || "-"}</td>
                    <td>
                      {formatNumber(
                        (r.inputTokens || 0) + (r.outputTokens || 0),
                      )}
                    </td>
                    <td>
                      <span
                        className={`${styles.badge} ${r.success ? styles.badgeSuccess : styles.badgeError}`}
                      >
                        {r.success ? "OK" : "ERR"}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={4}
                    style={{
                      textAlign: "center",
                      color: "var(--text-muted)",
                      padding: 24,
                    }}
                  >
                    {loading ? "Loading..." : "No requests yet"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Project Breakdown */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Projects</h2>
          </div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Project</th>
                <th>Requests</th>
                <th>Cost</th>
                <th>Workflows</th>
              </tr>
            </thead>
            <tbody>
              {projectStats.length > 0 ? (
                projectStats.map((p, i) => (
                  <tr key={p.project || i}>
                    <td
                      style={{ fontWeight: 500, color: "var(--text-primary)" }}
                    >
                      {p.project}
                    </td>
                    <td>{formatNumber(p.totalRequests)}</td>
                    <td>{formatCost(p.totalCost)}</td>
                    <td>
                      {p.workflowCount > 0 ? (
                        <Link href="/admin/workflows" className={styles.workflowLink}>
                          <Workflow size={12} />
                          {p.workflowCount}
                        </Link>
                      ) : (
                        <span style={{ color: "var(--text-muted)" }}>0</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={4}
                    style={{
                      textAlign: "center",
                      color: "var(--text-muted)",
                      padding: 24,
                    }}
                  >
                    {loading ? "Loading..." : "No projects yet"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

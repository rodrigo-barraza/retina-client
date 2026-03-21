"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Sector,
} from "recharts";
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
import IrisService from "../../services/IrisService";
import StatsCard from "../../components/StatsCard";
import DatePickerComponent from "../../components/DatePickerComponent";
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
  const from = new Date(
    Date.now() - range.hours * 60 * 60 * 1000,
  ).toISOString();
  return { from };
}

/* ── Recharts custom tooltip ── */
function TimelineTooltipComponent({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className={styles.chartTooltip}>
      <span className={styles.chartTooltipLabel}>{label}</span>
      <span className={styles.chartTooltipValue}>
        {payload[0].value.toLocaleString()} requests
      </span>
    </div>
  );
}

/* ── Custom glow dot for active point ── */
function GlowDotComponent(props) {
  const { cx, cy } = props;
  if (cx == null || cy == null) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r="8" fill="#6366f1" opacity="0.2" />
      <circle cx={cx} cy={cy} r="4" fill="#6366f1" stroke="#fff" strokeWidth="1.5" />
    </g>
  );
}

/* ── Recharts active pie sector with outward expansion ── */
function renderActiveSector(props) {
  const {
    cx,
    cy,
    innerRadius,
    outerRadius,
    startAngle,
    endAngle,
    fill,
    payload,
    percent,
  } = props;

  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius - 2}
        outerRadius={outerRadius + 6}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        opacity={1}
        style={{ filter: `drop-shadow(0 0 8px ${fill})` }}
      />
      <text
        x={cx}
        y={cy - 7}
        textAnchor="middle"
        fill="#f8f8f8"
        fontSize="13"
        fontWeight="600"
      >
        {payload.name}
      </text>
      <text
        x={cx}
        y={cy + 10}
        textAnchor="middle"
        fill="#8e95ae"
        fontSize="11"
      >
        {(percent * 100).toFixed(1)}%
      </text>
    </g>
  );
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
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const useCustom = !!(dateRange.from || dateRange.to);

  // Active pie sector
  const [activePieIndex, setActivePieIndex] = useState(null);

  const dateParams = useMemo(() => {
    if (useCustom) {
      const p = {};
      if (dateRange.from) p.from = new Date(dateRange.from).toISOString();
      if (dateRange.to)
        p.to = new Date(dateRange.to + "T23:59:59").toISOString();
      return p;
    }
    return getDateRange(timeRange);
  }, [timeRange, useCustom, dateRange]);

  const timelineHours = useMemo(() => {
    if (useCustom) return 720;
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

  // Top 10 models
  const topModels = [...modelStats]
    .sort((a, b) => b.totalRequests - a.totalRequests)
    .slice(0, 10);

  // Recharts-friendly timeline data — add display label
  const chartData = useMemo(() => {
    return timeline.map((t) => ({
      ...t,
      label: t.hour ? t.hour.slice(11) + "h" : "",
    }));
  }, [timeline]);

  // Recharts-friendly pie data
  const pieData = useMemo(() => {
    return providerEntries.map(([name, value], i) => ({
      name,
      value,
      fill: PROVIDER_COLORS[i % PROVIDER_COLORS.length],
    }));
  }, [providerEntries]);

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
                setDateRange({ from: "", to: "" });
                setTimeRange(r.key);
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
        <DatePickerComponent
          from={dateRange.from}
          to={dateRange.to}
          onChange={setDateRange}
        />
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
        {/* Requests Timeline — Recharts Area Chart */}
        <div className={styles.chartCard}>
          <div className={styles.chartTitle}>
            <TrendingUp size={14} />
            Requests Over Time
          </div>
          <div className={styles.rechartsWrapper}>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart
                  data={chartData}
                  margin={{ top: 8, right: 12, bottom: 0, left: -12 }}
                >
                  <defs>
                    <linearGradient
                      id="areaFillGrad"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
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
                    tickFormatter={formatNumber}
                  />
                  <Tooltip
                    content={<TimelineTooltipComponent />}
                    cursor={{
                      stroke: "rgba(99,102,241,0.25)",
                      strokeWidth: 1,
                      strokeDasharray: "4 4",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="requests"
                    stroke="#6366f1"
                    strokeWidth={2}
                    fill="url(#areaFillGrad)"
                    activeDot={<GlowDotComponent />}
                    animationDuration={800}
                    animationEasing="ease-out"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className={styles.chartEmpty}>
                {loading ? "Loading..." : "No data yet"}
              </div>
            )}
          </div>
        </div>

        {/* Provider Distribution — Recharts Pie Chart */}
        <div className={styles.chartCard}>
          <div className={styles.chartTitle}>Provider Distribution</div>
          <div className={styles.donutContainer}>
            {pieData.length > 0 ? (
              <>
                <div className={styles.pieWrapper}>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={48}
                        outerRadius={72}
                        paddingAngle={2}
                        dataKey="value"
                        activeIndex={activePieIndex}
                        activeShape={renderActiveSector}
                        onMouseEnter={(_, index) => setActivePieIndex(index)}
                        onMouseLeave={() => setActivePieIndex(null)}
                        animationDuration={600}
                        animationEasing="ease-out"
                      >
                        {pieData.map((entry, i) => (
                          <Cell
                            key={entry.name}
                            fill={entry.fill}
                            stroke="transparent"
                            opacity={
                              activePieIndex === null ||
                              activePieIndex === i
                                ? 1
                                : 0.35
                            }
                            style={{ transition: "opacity 0.2s ease" }}
                          />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className={styles.donutLegend}>
                  {providerEntries.map(([provider, count], i) => (
                    <div
                      key={provider}
                      className={styles.legendItem}
                      onMouseEnter={() => setActivePieIndex(i)}
                      onMouseLeave={() => setActivePieIndex(null)}
                    >
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
                    <td
                      style={{
                        fontWeight: 500,
                        color: "var(--text-primary)",
                      }}
                    >
                      {m.model}
                    </td>
                    <td>
                      <span className={styles.badgeProvider}>
                        {m.provider}
                      </span>
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
                    <td
                      style={{
                        fontWeight: 500,
                        color: "var(--text-primary)",
                      }}
                    >
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
                      style={{
                        fontWeight: 500,
                        color: "var(--text-primary)",
                      }}
                    >
                      {p.project}
                    </td>
                    <td>{formatNumber(p.totalRequests)}</td>
                    <td>{formatCost(p.totalCost)}</td>
                    <td>
                      {p.workflowCount > 0 ? (
                        <Link
                          href="/admin/workflows"
                          className={styles.workflowLink}
                        >
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

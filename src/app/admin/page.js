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
  Workflow,
} from "lucide-react";
import IrisService from "../../services/IrisService";
import StatsCard from "../../components/StatsCard";
import DatePickerComponent from "../../components/DatePickerComponent";
import TimelineChartComponent from "../../components/TimelineChartComponent";
import DistributionChartComponent from "../../components/DistributionChartComponent";
import UsageBarComponent from "../../components/UsageBarComponent";
import styles from "./page.module.css";

const PROVIDER_COLORS = [
  "#6366f1", "#a855f7", "#ec4899", "#f59e0b",
  "#10b981", "#3b82f6", "#ef4444", "#06b6d4",
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



export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [projectStats, setProjectStats] = useState([]);
  const [modelStats, setModelStats] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [recentRequests, setRecentRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Date range
  const [dateRange, setDateRange] = useState({ from: "", to: "" });

  const dateParams = useMemo(() => {
    const p = {};
    if (dateRange.from) p.from = new Date(dateRange.from).toISOString();
    if (dateRange.to)
      p.to = new Date(dateRange.to + "T23:59:59").toISOString();
    return p;
  }, [dateRange]);

  const timelineHours = useMemo(() => {
    if (dateRange.from || dateRange.to) return 720;
    return 8760; // 1 year default for "All Time"
  }, [dateRange]);

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
      setTimeline(timelineData.data || timelineData);
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

  // Build provider distribution for Top Providers table
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

  const totalModelRequests =
    modelStats.reduce((s, m) => s + m.totalRequests, 0) || 1;

  // Recharts-friendly timeline data — add display label
  const chartData = useMemo(() => {
    return timeline.map((t) => {
      let label = "";
      if (t.hour) {
        if (t.hour.length <= 10) {
          const [y, m, d] = t.hour.split("-").map(Number);
          const date = new Date(y, m - 1, d);
          label = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        } else {
          label = t.hour.slice(11) + "h";
        }
      }
      return { ...t, label };
    });
  }, [timeline]);


  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Dashboard</h1>
        <p className={styles.pageSubtitle}>
          Prism AI Gateway — Overview &amp; Analytics
        </p>
      </div>

      {/* ── Date Range Toolbar ── */}
      <div className={styles.timeToolbar}>
        <DatePickerComponent
          from={dateRange.from}
          to={dateRange.to}
          onChange={setDateRange}
          storageKey="retina-date-range"
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
          subtitle={dateRange.from || dateRange.to ? "Custom range" : "All time"}
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
        {/* Requests Timeline — Tabbed Chart */}
        <div className={styles.chartCard}>
          <TimelineChartComponent
            data={chartData}
            loading={loading}
            height={220}
          />
        </div>

        {/* Distribution — Tabbed Pie Chart */}
        <div className={styles.chartCard}>
          <DistributionChartComponent
            modelStats={modelStats}
            projectStats={projectStats}
            stats={stats}
            loading={loading}
          />
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
                <th>Usage</th>
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
                    <td>
                      <UsageBarComponent
                        value={m.totalRequests}
                        total={totalModelRequests}
                      />
                    </td>
                    <td>{formatCost(m.totalCost)}</td>
                    <td>{formatLatency(m.avgLatency)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={6}
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
                <th>Usage</th>
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
                      <UsageBarComponent
                        value={count}
                        total={totalProviderRequests}
                        color={PROVIDER_COLORS[i % PROVIDER_COLORS.length]}
                      />
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

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Activity,
  Zap,
  DollarSign,
  Clock,
  AlertCircle,
  CheckCircle,
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

  useEffect(() => {
    async function loadDashboard() {
      try {
        setLoading(true);
        setError(null);

        const [statsData, projects, models, timelineData, requestsData] =
          await Promise.all([
            IrisService.getStats(),
            IrisService.getProjectStats(),
            IrisService.getModelStats(),
            IrisService.getTimeline(24),
            IrisService.getRequests({
              limit: 10,
              sort: "timestamp",
              order: "desc",
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
    }

    loadDashboard();
    const interval = setInterval(loadDashboard, 60000);
    return () => clearInterval(interval);
  }, []);

  const maxTimelineRequests = Math.max(...timeline.map((t) => t.requests), 1);

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

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Dashboard</h1>
        <p className={styles.pageSubtitle}>
          Prism AI Gateway — Overview &amp; Analytics
        </p>
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
          subtitle="Last 24 hours"
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

      {/* Charts Row */}
      <div className={styles.chartsRow}>
        <div className={styles.chartCard}>
          <div className={styles.chartTitle}>Requests (Last 24h)</div>
          <div className={styles.barChart}>
            {timeline.length > 0 ? (
              timeline.map((t, i) => (
                <div
                  key={i}
                  className={styles.bar}
                  style={{
                    height: `${(t.requests / maxTimelineRequests) * 100}%`,
                  }}
                  data-tooltip={`${t.hour?.slice(11) || ""}:00 — ${t.requests} req`}
                />
              ))
            ) : (
              <div
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--text-muted)",
                  fontSize: 13,
                }}
              >
                {loading ? "Loading..." : "No data yet"}
              </div>
            )}
          </div>
        </div>

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
              <div
                style={{
                  color: "var(--text-muted)",
                  fontSize: 13,
                }}
              >
                {loading ? "Loading..." : "No data yet"}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Two-column: Recent Requests + Project Breakdown */}
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

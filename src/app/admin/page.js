"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import CountLinkComponent from "../../components/CountLinkComponent";
import {
  Activity,
  Zap,
  DollarSign,
  Clock,
  CheckCircle,
  AlertCircle,
  Workflow,
  MessageSquare,
  FolderOpen,
  Hash,
  TrendingUp,
} from "lucide-react";
import IrisService from "../../services/IrisService";
import PrismService from "../../services/PrismService";
import {
  formatNumber,
  formatCost,
  formatLatency,
  formatTokensPerSec,
  buildDateRangeParams,
} from "../../utils/utilities";
import StatsCard from "../../components/StatsCard";
import DatePickerComponent from "../../components/DatePickerComponent";
import TimelineChartComponent from "../../components/TimelineChartComponent";
import DistributionChartComponent from "../../components/DistributionChartComponent";
import ProportionBarComponent from "../../components/ProportionBarComponent";
import SortableTableComponent from "../../components/SortableTableComponent";
import ToolIconComponent from "../../components/ToolIconComponent";
import CostBadgeComponent from "../../components/CostBadgeComponent";
import ProjectBadgeComponent from "../../components/ProjectBadgeComponent";
import UserBadgeComponent from "../../components/UserBadgeComponent";
import SelectDropdown from "../../components/SelectDropdown";
import { ErrorMessage } from "../../components/StateMessageComponent";
import { useAdminHeader } from "../../components/AdminHeaderContext";
import useProjectFilter from "../../hooks/useProjectFilter";
import styles from "./page.module.css";
import { LS_DATE_RANGE } from "../../constants";
import { getRequestsColumns } from "./requestsColumns";
import { DateTime } from "luxon";

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

export default function DashboardPage() {
  const { projectFilter, projectOptions, handleProjectChange } =
    useProjectFilter();
  const { setControls } = useAdminHeader();
  const [stats, setStats] = useState(null);
  const [projectStats, setProjectStats] = useState([]);
  const [modelStats, setModelStats] = useState([]);
  const [configModels, setConfigModels] = useState({});

  const [timeline, setTimeline] = useState([]);
  const [recentRequests, setRecentRequests] = useState([]);
  const [recentSessions, setRecentSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Date range
  const [dateRange, setDateRange] = useState({ from: "", to: "" });

  const dateParams = useMemo(
    () => buildDateRangeParams(dateRange),
    [dateRange],
  );

  const timelineHours = useMemo(() => {
    if (dateRange.from || dateRange.to) return 720;
    return 8760; // 1 year default for "All Time"
  }, [dateRange]);

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const filterParams = { ...dateParams };
      if (projectFilter) filterParams.project = projectFilter;

      const [statsData, projects, models, timelineData, requestsData, sessionsData, prismConfig] =
        await Promise.all([
          IrisService.getStats(filterParams),
          IrisService.getProjectStats(filterParams),
          IrisService.getModelStats(filterParams),
          IrisService.getTimeline(timelineHours, filterParams),
          IrisService.getRequests({
            limit: 10,
            sort: "timestamp",
            order: "desc",
            ...filterParams,
          }),
          IrisService.getSessions({
            page: 1,
            limit: 5,
            sort: "createdAt",
            order: "desc",
          }),
          PrismService.getConfig().catch(() => null),
        ]);

      setStats(statsData);
      setProjectStats(projects);
      setModelStats(models);

      // Build model→tools lookup from Prism config
      if (prismConfig?.textToText?.models) {
        const lookup = {};
        for (const [provider, models] of Object.entries(prismConfig.textToText.models)) {
          for (const m of models) {
            const key = `${provider}:${m.name}`;
            if (m.tools?.length) lookup[key] = m.tools;
          }
        }
        setConfigModels(lookup);
      }

      setTimeline(timelineData.data || timelineData);
      setRecentRequests(requestsData.data || []);
      setRecentSessions(sessionsData.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [dateParams, timelineHours, projectFilter]);

  useEffect(() => {
    loadDashboard();
    const interval = setInterval(loadDashboard, 60000);
    return () => clearInterval(interval);
  }, [loadDashboard]);

  // Inject project dropdown into AdminShell header
  useEffect(() => {
    setControls(
      <SelectDropdown
        value={projectFilter || ""}
        options={projectOptions}
        onChange={handleProjectChange}
        placeholder="All Projects"
      />,
    );
  }, [setControls, projectFilter, projectOptions, handleProjectChange]);

  // Cleanup on unmount
  useEffect(() => {
    return () => setControls(null);
  }, [setControls]);

  // Build provider distribution from model stats
  const providerAgg = {};
  modelStats.forEach((m) => {
    if (!providerAgg[m.provider]) {
      providerAgg[m.provider] = {
        provider: m.provider,
        totalRequests: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCost: 0,
        latencySum: 0,
        tpsSum: 0,
        tpsCount: 0,
        modelCount: 0,
        conversationCount: 0,
        workflowCount: 0,
        sessionCount: 0,
      };
    }
    const p = providerAgg[m.provider];
    p.totalRequests += m.totalRequests;
    p.totalInputTokens += m.totalInputTokens || 0;
    p.totalOutputTokens += m.totalOutputTokens || 0;
    p.totalCost += m.totalCost || 0;
    p.latencySum += (m.avgLatency || 0) * m.totalRequests;
    p.modelCount += 1;
    p.conversationCount += m.conversationCount || 0;
    p.workflowCount += m.workflowCount || 0;
    p.sessionCount += m.sessionCount || 0;
    if (m.avgTokensPerSec) {
      p.tpsSum += m.avgTokensPerSec * m.totalRequests;
      p.tpsCount += m.totalRequests;
    }
  });
  const providerData = Object.values(providerAgg)
    .map((p) => ({
      ...p,
      avgLatency: p.totalRequests > 0 ? p.latencySum / p.totalRequests : 0,
      avgTokensPerSec: p.tpsCount > 0 ? p.tpsSum / p.tpsCount : null,
    }))
    .sort((a, b) => b.totalRequests - a.totalRequests);
  const totalProviderRequests =
    providerData.reduce((s, p) => s + p.totalRequests, 0) || 1;
  const totalProviderCost =
    providerData.reduce((s, p) => s + p.totalCost, 0) || 1;

  // Top 10 models
  const topModels = [...modelStats].sort(
    (a, b) => b.totalRequests - a.totalRequests,
  );

  const totalModelRequests =
    modelStats.reduce((s, m) => s + m.totalRequests, 0) || 1;
  const totalModelCost =
    modelStats.reduce((s, m) => s + (m.totalCost || 0), 0) || 1;

  // Project totals for proportion bars
  const totalProjectRequests =
    projectStats.reduce((s, x) => s + x.totalRequests, 0) || 1;
  const totalProjectCost =
    projectStats.reduce((s, x) => s + (x.totalCost || 0), 0) || 1;

  // Recharts-friendly timeline data — add display label
  const chartData = useMemo(() => {
    return timeline.map((t) => {
      let label = "";
      let tickLabel = "";
      if (t.hour) {
        if (t.hour.length <= 10) {
          // Daily bin: "2026-03-21"
          const [y, m, d] = t.hour.split("-").map(Number);
          const date = new Date(y, m - 1, d);
          label = date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          });
          tickLabel = label;
        } else if (t.hour.includes(":")) {
          // 10-minute bin: "2026-03-21T14:10" or "2026-03-21T14:0"
          const timePart = t.hour.slice(11); // "14:10" or "14:0"
          const [hh, mm] = timePart.split(":");
          const paddedMM = (mm || "0").padStart(2, "0");
          label = `${hh}:${paddedMM}`;
          // Only show tick label on hour marks (minute = 0)
          tickLabel = paddedMM === "00" ? `${hh}h` : "";
        } else {
          // Hourly bin: "2026-03-21T14"
          label = t.hour.slice(11) + "h";
          tickLabel = label;
        }
      }
      return { ...t, label, tickLabel };
    });
  }, [timeline]);

  // Derived stats for extra cards
  const avgCostPerRequest = stats?.totalRequests > 0
    ? stats.totalCost / stats.totalRequests
    : 0;

  return (
    <div className={styles.page}>
      {/* ── Date Range Toolbar ── */}
      <div className={styles.timeToolbar}>
        <DatePickerComponent
          from={dateRange.from}
          to={dateRange.to}
          onChange={setDateRange}
          storageKey={LS_DATE_RANGE}
        />
      </div>

      <ErrorMessage message={error} />

      {/* Stats Row */}
      <div className={styles.statsGrid}>
        <StatsCard
          label="Total Requests"
          value={loading ? "..." : formatNumber(stats?.totalRequests)}
          subtitle={
            dateRange.from || dateRange.to ? "Custom range" : "All time"
          }
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
            loading ? "" : `${formatTokensPerSec(stats?.avgTokensPerSec)} tok/s`
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
        <StatsCard
          label="Sessions"
          value={loading ? "..." : formatNumber(stats?.sessionCount)}
          subtitle={loading ? "" : `${formatNumber(stats?.conversationCount)} conversations`}
          icon={FolderOpen}
          variant="accent"
          loading={loading}
        />
        <StatsCard
          label="Avg Cost / Request"
          value={loading ? "..." : formatCost(avgCostPerRequest)}
          subtitle="Per-request average"
          icon={TrendingUp}
          variant="info"
          loading={loading}
        />
        <StatsCard
          label="Models Used"
          value={loading ? "..." : formatNumber(modelStats.length)}
          subtitle={loading ? "" : `${providerData.length} providers`}
          icon={Hash}
          variant="warning"
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
            projectStats={projectStats}
            providerStats={providerData}
            modelStats={modelStats}
            stats={stats}
            loading={loading}
          />
        </div>
      </div>

      {/* ── Projects ── */}
      <SortableTableComponent
        title="Projects"
        maxHeight={420}
        columns={[
          { key: "project", label: "Project" },
          {
            key: "totalRequests",
            label: "Requests",
            align: "right",
            render: (p) => formatNumber(p.totalRequests),
          },
          {
            key: "usage",
            label: "Usage",
            sortValue: (p) => p.totalRequests,
            render: (p) => (
              <ProportionBarComponent
                value={p.totalRequests}
                total={totalProjectRequests}
              />
            ),
          },
          { key: "providerCount", label: "Providers", align: "right" },
          { key: "modelCount", label: "Models", align: "right" },
          {
            key: "totalInputTokens",
            label: "Tokens In",
            align: "right",
            render: (p) => formatNumber(p.totalInputTokens),
          },
          {
            key: "totalOutputTokens",
            label: "Tokens Out",
            align: "right",
            render: (p) => formatNumber(p.totalOutputTokens),
          },
          {
            key: "avgTokensPerSec",
            label: "Tok/s",
            align: "right",
            render: (p) => formatTokensPerSec(p.avgTokensPerSec),
          },
          {
            key: "totalCost",
            label: "Cost",
            align: "right",
            render: (p) => (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                {formatCost(p.totalCost)}
                <ProportionBarComponent
                  value={p.totalCost}
                  total={totalProjectCost}
                  color="var(--warning)"
                />
              </span>
            ),
          },
          {
            key: "avgLatency",
            label: "Avg Latency",
            align: "right",
            render: (p) => formatLatency(p.avgLatency),
          },
          {
            key: "sessionCount",
            label: "Sessions",
            align: "right",
            render: (p) => (
              <CountLinkComponent
                count={p.sessionCount}
                href={`/admin/sessions?project=${encodeURIComponent(p.project)}`}
                icon={FolderOpen}
                className={styles.workflowLink}
              />
            ),
          },
          {
            key: "conversationCount",
            label: "Conversations",
            align: "right",
            render: (p) => (
              <CountLinkComponent
                count={p.conversationCount}
                href={`/admin/conversations?project=${encodeURIComponent(p.project)}`}
                icon={MessageSquare}
                className={styles.workflowLink}
              />
            ),
          },
          {
            key: "workflowCount",
            label: "Workflows",
            align: "right",
            render: (p) => (
              <CountLinkComponent
                count={p.workflowCount}
                href={`/admin/workflows?project=${encodeURIComponent(p.project)}`}
                icon={Workflow}
                className={styles.workflowLink}
              />
            ),
          },
        ]}
        data={projectStats}
        getRowKey={(p, i) => p.project || i}
        emptyText={loading ? "Loading..." : "No projects yet"}
      />

      {/* ── Providers ── */}
      <SortableTableComponent
        title="Providers"
        maxHeight={420}
        columns={[
          {
            key: "provider",
            label: "Provider",
            render: (p, i) => (
              <span
                style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    flexShrink: 0,
                    background: PROVIDER_COLORS[i % PROVIDER_COLORS.length],
                  }}
                />
                {p.provider}
              </span>
            ),
          },
          {
            key: "totalRequests",
            label: "Requests",
            align: "right",
            render: (p) => formatNumber(p.totalRequests),
          },
          {
            key: "usage",
            label: "Usage",
            sortValue: (p) => p.totalRequests,
            render: (p, i) => (
              <ProportionBarComponent
                value={p.totalRequests}
                total={totalProviderRequests}
                color={PROVIDER_COLORS[i % PROVIDER_COLORS.length]}
              />
            ),
          },
          { key: "modelCount", label: "Models", align: "right" },
          {
            key: "totalInputTokens",
            label: "Tokens In",
            render: (p) => formatNumber(p.totalInputTokens),
          },
          {
            key: "totalOutputTokens",
            label: "Tokens Out",
            render: (p) => formatNumber(p.totalOutputTokens),
          },
          {
            key: "avgTokensPerSec",
            label: "Tok/s",
            render: (p) => formatTokensPerSec(p.avgTokensPerSec),
          },
          {
            key: "totalCost",
            label: "Cost",
            render: (p) => (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                {formatCost(p.totalCost)}
                <ProportionBarComponent
                  value={p.totalCost}
                  total={totalProviderCost}
                  color="var(--warning)"
                />
              </span>
            ),
          },
          {
            key: "avgLatency",
            label: "Avg Latency",
            render: (p) => formatLatency(p.avgLatency),
          },
          {
            key: "sessionCount",
            label: "Sessions",
            align: "right",
            render: (p) => (
              <CountLinkComponent
                count={p.sessionCount}
                href={`/admin/sessions?provider=${encodeURIComponent(p.provider)}`}
                icon={FolderOpen}
                className={styles.workflowLink}
              />
            ),
          },
          {
            key: "conversationCount",
            label: "Conversations",
            align: "right",
            render: (p) => (
              <CountLinkComponent
                count={p.conversationCount}
                href={`/admin/conversations?provider=${encodeURIComponent(p.provider)}`}
                icon={MessageSquare}
                className={styles.workflowLink}
              />
            ),
          },
          {
            key: "workflowCount",
            label: "Workflows",
            align: "right",
            render: (p) => (
              <CountLinkComponent
                count={p.workflowCount}
                href={`/admin/workflows?provider=${encodeURIComponent(p.provider)}`}
                icon={Workflow}
                className={styles.workflowLink}
              />
            ),
          },
        ]}
        data={providerData}
        getRowKey={(p) => p.provider}
        emptyText={loading ? "Loading..." : "No data yet"}
      />

      {/* ── Models ── */}
      <SortableTableComponent
        title="Models"
        maxHeight={420}
        columns={[
          { key: "model", label: "Model" },
          {
            key: "totalRequests",
            label: "Requests",
            align: "right",
            render: (m) => formatNumber(m.totalRequests),
          },
          {
            key: "usage",
            label: "Usage",
            sortValue: (m) => m.totalRequests,
            render: (m) => (
              <ProportionBarComponent
                value={m.totalRequests}
                total={totalModelRequests}
              />
            ),
          },
          {
            key: "provider",
            label: "Provider",
            render: (m) => (
              <span className={styles.badgeProvider}>{m.provider}</span>
            ),
          },
          {
            key: "toolsUsed",
            label: "Tools",
            align: "left",
            sortable: false,
            render: (m) => {
              const tools = configModels[`${m.provider}:${m.model}`];
              if (!tools?.length) {
                return <span style={{ color: "var(--text-muted)" }}>—</span>;
              }
              return <ToolIconComponent toolNames={tools} />;
            },
          },
          {
            key: "totalInputTokens",
            label: "Tokens In",
            align: "right",
            render: (m) => formatNumber(m.totalInputTokens),
          },
          {
            key: "totalOutputTokens",
            label: "Tokens Out",
            align: "right",
            render: (m) => formatNumber(m.totalOutputTokens),
          },
          {
            key: "avgTokensPerSec",
            label: "Tok/s",
            align: "right",
            render: (m) => formatTokensPerSec(m.avgTokensPerSec),
          },
          {
            key: "totalCost",
            label: "Cost",
            align: "right",
            render: (m) => (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                {formatCost(m.totalCost)}
                <ProportionBarComponent
                  value={m.totalCost}
                  total={totalModelCost}
                  color="var(--warning)"
                />
              </span>
            ),
          },
          {
            key: "avgLatency",
            label: "Avg Latency",
            align: "right",
            render: (m) => formatLatency(m.avgLatency),
          },
          {
            key: "sessionCount",
            label: "Sessions",
            align: "right",
            render: (m) => (
              <CountLinkComponent
                count={m.sessionCount}
                href={`/admin/sessions?model=${encodeURIComponent(m.model)}`}
                icon={FolderOpen}
                className={styles.workflowLink}
              />
            ),
          },
          {
            key: "conversationCount",
            label: "Conversations",
            align: "right",
            render: (m) => (
              <CountLinkComponent
                count={m.conversationCount}
                href={`/admin/conversations?model=${encodeURIComponent(m.model)}`}
                icon={MessageSquare}
                className={styles.workflowLink}
              />
            ),
          },
          {
            key: "workflowCount",
            label: "Workflows",
            align: "right",
            render: (m) => (
              <CountLinkComponent
                count={m.workflowCount}
                href={`/admin/workflows?model=${encodeURIComponent(m.model)}`}
                icon={Workflow}
                className={styles.workflowLink}
              />
            ),
          },
        ]}
        data={topModels}
        getRowKey={(m, i) => `${m.provider}-${m.model}-${i}`}
        emptyText={loading ? "Loading..." : "No data yet"}
      />

      {/* ── Recent Sessions ── */}
      <SortableTableComponent
        maxHeight={420}
        title={
          <span
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
            }}
          >
            Recent Sessions
            <Link href="/admin/sessions" className={styles.sectionAction}>
              View all →
            </Link>
          </span>
        }
        columns={[
          {
            key: "id",
            label: "Session",
            render: (s) => (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <FolderOpen size={12} style={{ opacity: 0.5, flexShrink: 0 }} />
                {s.id?.slice(0, 8) || "—"}
              </span>
            ),
          },
          {
            key: "project",
            label: "Project",
            render: (s) => s.project
              ? <ProjectBadgeComponent project={s.project} />
              : <span style={{ color: "var(--text-muted)" }}>—</span>,
          },
          {
            key: "username",
            label: "User",
            render: (s) => s.username
              ? <UserBadgeComponent username={s.username} />
              : <span style={{ color: "var(--text-muted)" }}>—</span>,
          },
          {
            key: "conversationCount",
            label: "Conversations",
            align: "right",
            render: (s) => (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <MessageSquare size={11} style={{ opacity: 0.5 }} />
                {s.conversationCount || 0}
              </span>
            ),
          },
          {
            key: "requestCount",
            label: "Requests",
            align: "right",
            render: (s) => formatNumber(s.requestCount || 0),
          },
          {
            key: "totalInputTokens",
            label: "Tokens In",
            align: "right",
            render: (s) => formatNumber(s.totalInputTokens || 0),
          },
          {
            key: "totalOutputTokens",
            label: "Tokens Out",
            align: "right",
            render: (s) => formatNumber(s.totalOutputTokens || 0),
          },
          {
            key: "totalCost",
            label: "Cost",
            align: "right",
            render: (s) => <CostBadgeComponent cost={s.totalCost} />,
          },
          {
            key: "createdAt",
            label: "Created",
            align: "right",
            render: (s) => s.createdAt
              ? DateTime.fromISO(s.createdAt).toRelative()
              : "—",
          },
        ]}
        data={recentSessions}
        getRowKey={(s, i) => s.id || i}
        emptyText={loading ? "Loading..." : "No sessions yet"}
      />

      {/* ── Recent Requests ── */}
      <SortableTableComponent
        maxHeight={420}
        title={
          <span
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
            }}
          >
            Recent Requests
            <Link href="/admin/requests" className={styles.sectionAction}>
              View all →
            </Link>
          </span>
        }
        columns={getRequestsColumns()}
        data={recentRequests}
        getRowKey={(r, i) => r.requestId || i}
        emptyText={loading ? "Loading..." : "No requests yet"}
      />
    </div>
  );
}

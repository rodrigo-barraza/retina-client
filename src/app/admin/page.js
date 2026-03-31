"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Zap,
  DollarSign,
  Clock,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Box,
  Layers,
  Server,
  ScrollText,
  FolderOpen,
  MessageSquare,
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

import TimelineChartComponent from "../../components/TimelineChartComponent";
import DistributionChartComponent from "../../components/DistributionChartComponent";
import ProjectsTableComponent from "../../components/ProjectsTableComponent";
import ProvidersTableComponent from "../../components/ProvidersTableComponent";
import ModelsTableComponent from "../../components/ModelsTableComponent";
import RequestsTableComponent from "../../components/RequestsTableComponent";
import ConversationsTableComponent from "../../components/ConversationsTableComponent";
import SessionsTableComponent from "../../components/SessionsTableComponent";

import SelectDropdown from "../../components/SelectDropdown";
import { ErrorMessage } from "../../components/StateMessageComponent";
import { useAdminHeader } from "../../components/AdminHeaderContext";
import useProjectFilter from "../../hooks/useProjectFilter";
import styles from "./page.module.css";

export default function DashboardPage() {
  const { projectFilter, projectOptions, handleProjectChange } =
    useProjectFilter();
  const { setControls, dateRange } = useAdminHeader();
  const [stats, setStats] = useState(null);
  const [projectStats, setProjectStats] = useState([]);
  const [modelStats, setModelStats] = useState([]);
  const [configModels, setConfigModels] = useState({});

  const [timeline, setTimeline] = useState([]);
  const [recentRequests, setRecentRequests] = useState([]);
  const [recentSessions, setRecentSessions] = useState([]);
  const [recentConversations, setRecentConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);



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

      const filterParams = { ...dateParams };
      if (projectFilter) filterParams.project = projectFilter;

      const [statsData, projects, models, timelineData, requestsData, sessionsData, conversationsData, prismConfig] =
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
            ...filterParams,
          }),
          IrisService.getConversations({
            page: 1,
            limit: 10,
            sort: "updatedAt",
            order: "desc",
            ...filterParams,
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
      setRecentConversations(conversationsData.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [dateParams, timelineHours, projectFilter]);

  useEffect(() => {
    // Immediately enter loading state and clear stale data when filters change
    setLoading(true);
    setError(null);
    setStats(null);
    setProjectStats([]);
    setModelStats([]);
    setTimeline([]);
    setRecentRequests([]);
    setRecentSessions([]);
    setRecentConversations([]);

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
        icon={<Box size={15} />}
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
        models: [],
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
    if (m.model) p.models.push(m.model);
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

      <ErrorMessage message={error} />

      {/* ── Resource Navigation ── */}
      <div className={styles.resourceNav}>
        <Link href="#" className={styles.resourceCard} onClick={(e) => { e.preventDefault(); document.getElementById('projects-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>
          <Box size={18} className={styles.resourceIcon} />
          <span className={styles.resourceCount}>
            {loading ? "—" : formatNumber(projectStats.length)}
          </span>
          <span className={styles.resourceLabel}>Projects</span>
        </Link>
        <Link href="/admin/providers" className={styles.resourceCard}>
          <Layers size={18} className={styles.resourceIcon} />
          <span className={styles.resourceCount}>
            {loading ? "—" : formatNumber(providerData.length)}
          </span>
          <span className={styles.resourceLabel}>Providers</span>
        </Link>
        <Link href="/admin/models" className={styles.resourceCard}>
          <Server size={18} className={styles.resourceIcon} />
          <span className={styles.resourceCount}>
            {loading ? "—" : formatNumber(modelStats.length)}
          </span>
          <span className={styles.resourceLabel}>Models</span>
        </Link>
        <Link href="/admin/sessions" className={styles.resourceCard}>
          <FolderOpen size={18} className={styles.resourceIcon} />
          <span className={styles.resourceCount}>
            {loading ? "—" : formatNumber(stats?.sessionCount)}
          </span>
          <span className={styles.resourceLabel}>Sessions</span>
        </Link>
        <Link href="/admin/conversations" className={styles.resourceCard}>
          <MessageSquare size={18} className={styles.resourceIcon} />
          <span className={styles.resourceCount}>
            {loading ? "—" : formatNumber(stats?.conversationCount)}
          </span>
          <span className={styles.resourceLabel}>Conversations</span>
        </Link>
        <Link href="/admin/requests" className={styles.resourceCard}>
          <ScrollText size={18} className={styles.resourceIcon} />
          <span className={styles.resourceCount}>
            {loading ? "—" : formatNumber(stats?.totalRequests)}
          </span>
          <span className={styles.resourceLabel}>Requests</span>
        </Link>
      </div>

      {/* Stats Row */}
      <div className={styles.statsGrid}>
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
          label="Avg Cost / Request"
          value={loading ? "..." : formatCost(avgCostPerRequest)}
          subtitle="Per-request average"
          icon={TrendingUp}
          variant="info"
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
      <div id="projects-table">
        <ProjectsTableComponent
          projects={projectStats}
          totalRequests={totalProjectRequests}
          totalCost={totalProjectCost}
          emptyText={loading ? "Loading..." : "No projects yet"}
        />
      </div>

      {/* ── Providers ── */}
      <ProvidersTableComponent
        providers={providerData}
        totalRequests={totalProviderRequests}
        totalCost={totalProviderCost}
        emptyText={loading ? "Loading..." : "No data yet"}
      />

      {/* ── Models ── */}
      <ModelsTableComponent
        models={topModels}
        configModels={configModels}
        totalRequests={totalModelRequests}
        totalCost={totalModelCost}
        emptyText={loading ? "Loading..." : "No data yet"}
      />

      {/* ── Recent Sessions ── */}
      <SessionsTableComponent
        sessions={recentSessions}
        compact
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
        emptyText={loading ? "Loading..." : "No sessions yet"}
      />

      {/* ── Recent Conversations ── */}
      <ConversationsTableComponent
        conversations={recentConversations}
        title={
          <span
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
            }}
          >
            Conversations
            <Link href="/admin/conversations" className={styles.sectionAction}>
              View all →
            </Link>
          </span>
        }
        emptyText={loading ? "Loading..." : "No conversations yet"}
        compact
      />

      {/* ── Recent Requests ── */}
      <RequestsTableComponent
        requests={recentRequests}
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
        emptyText={loading ? "Loading..." : "No requests yet"}
      />
    </div>
  );
}

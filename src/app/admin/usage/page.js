"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DollarSign,
  Activity,
  ArrowDownToLine,
  ArrowUpFromLine,
} from "lucide-react";

import IrisService from "../../../services/IrisService";
import {
  formatNumber,
  formatCost,
  formatTokensPerSec,
  buildDateRangeParams,
} from "../../../utils/utilities";
import StatsCard from "../../../components/StatsCard";
import SelectDropdown from "../../../components/SelectDropdown";
import SortableTable from "../../../components/SortableTableComponent";
import DatePickerComponent from "../../../components/DatePickerComponent";
import PageHeaderComponent from "../../../components/PageHeaderComponent";
import { ErrorMessage } from "../../../components/StateMessageComponent";
import BadgeComponent from "../../../components/BadgeComponent";
import { useAdminHeader } from "../../../components/AdminHeaderContext";
import useProjectFilter from "../../../hooks/useProjectFilter";
import styles from "./page.module.css";
import { LS_DATE_RANGE } from "../../../constants";

const ENDPOINT_LABELS = {
  chat: "Chat",
  audio: "Audio",
  embed: "Embed",
};

// Shared column renderers
const costRender = (row) => (
  <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
    {formatCost(row.totalCost)}
  </span>
);
const tokensInRender = (row) => formatNumber(row.totalInputTokens);
const tokensOutRender = (row) => formatNumber(row.totalOutputTokens);
const requestsRender = (row) => formatNumber(row.totalRequests);
const tpsRender = (row) => formatTokensPerSec(row.avgTokensPerSec);

// Merge endpoint rows that map to the same modality label
function mergeByModality(rows) {
  const map = {};
  for (const row of rows) {
    const label = ENDPOINT_LABELS[row.endpoint] || row.endpoint;
    if (!map[label]) {
      map[label] = { ...row, endpoint: row.endpoint, _label: label };
    } else {
      const m = map[label];
      const prevReq = m.totalRequests;
      const curReq = row.totalRequests;
      m.totalCost += row.totalCost;
      m.totalInputTokens += row.totalInputTokens;
      m.totalOutputTokens += row.totalOutputTokens;
      // Weighted average for tok/s
      if (row.avgTokensPerSec && m.avgTokensPerSec) {
        m.avgTokensPerSec =
          (m.avgTokensPerSec * prevReq + row.avgTokensPerSec * curReq) /
          (prevReq + curReq);
      } else if (row.avgTokensPerSec) {
        m.avgTokensPerSec = row.avgTokensPerSec;
      }
      m.totalRequests += row.totalRequests;
    }
  }
  return Object.values(map);
}

export default function UsagePage() {
  const { projectFilter, projectOptions, handleProjectChange } =
    useProjectFilter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [projectBreakdown, setProjectBreakdown] = useState("provider");
  const [dateRange, setDateRange] = useState({ from: "", to: "" });

  const loadCosts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (projectFilter) params.project = projectFilter;
      Object.assign(params, buildDateRangeParams(dateRange));
      const result = await IrisService.getCostStats(params);
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [dateRange, projectFilter]);

  useEffect(() => {
    loadCosts();
  }, [loadCosts]);

  // Inject controls into AdminShell header
  const { setControls } = useAdminHeader();

  useEffect(() => {
    setControls(
      <>
        <SelectDropdown
          value={projectFilter || ""}
          options={projectOptions}
          onChange={handleProjectChange}
          placeholder="All Projects"
        />
        <ErrorMessage message={error} />
      </>,
    );
  }, [setControls, projectFilter, projectOptions, handleProjectChange, error]);

  useEffect(() => {
    return () => setControls(null);
  }, [setControls]);

  const totals = data?.totals || {};

  // ── Column definitions ────────────────────────────────────

  const projectCols = [
    {
      key: "project",
      label: "Project",
      align: "left",
      renderSub: (row) => (
        <BadgeComponent variant="provider">{row.provider}</BadgeComponent>
      ),
    },
    {
      key: "totalRequests",
      label: "Requests",
      align: "right",
      render: requestsRender,
      renderSub: requestsRender,
    },
    {
      key: "totalInputTokens",
      label: "Tokens In",
      align: "right",
      render: tokensInRender,
      renderSub: tokensInRender,
    },
    {
      key: "totalOutputTokens",
      label: "Tokens Out",
      align: "right",
      render: tokensOutRender,
      renderSub: tokensOutRender,
    },
    {
      key: "avgTokensPerSec",
      label: "Tok/s",
      align: "right",
      render: tpsRender,
      renderSub: tpsRender,
    },
    {
      key: "totalCost",
      label: "Cost",
      align: "right",
      render: costRender,
      renderSub: costRender,
    },
  ];

  const projectModalityCols = [
    {
      key: "project",
      label: "Project",
      align: "left",
      renderSub: (row) => (
        <BadgeComponent variant="modality">
          {ENDPOINT_LABELS[row.endpoint] || row.endpoint}
        </BadgeComponent>
      ),
    },
    {
      key: "totalRequests",
      label: "Requests",
      align: "right",
      render: requestsRender,
      renderSub: requestsRender,
    },
    {
      key: "totalInputTokens",
      label: "Tokens In",
      align: "right",
      render: tokensInRender,
      renderSub: tokensInRender,
    },
    {
      key: "totalOutputTokens",
      label: "Tokens Out",
      align: "right",
      render: tokensOutRender,
      renderSub: tokensOutRender,
    },
    {
      key: "avgTokensPerSec",
      label: "Tok/s",
      align: "right",
      render: tpsRender,
      renderSub: tpsRender,
    },
    {
      key: "totalCost",
      label: "Cost",
      align: "right",
      render: costRender,
      renderSub: costRender,
    },
  ];

  const projectModelCols = [
    {
      key: "project",
      label: "Project",
      align: "left",
      renderSub: (row) => row.model || "—",
    },
    {
      key: "totalRequests",
      label: "Requests",
      align: "right",
      render: requestsRender,
      renderSub: requestsRender,
    },
    {
      key: "totalInputTokens",
      label: "Tokens In",
      align: "right",
      render: tokensInRender,
      renderSub: tokensInRender,
    },
    {
      key: "totalOutputTokens",
      label: "Tokens Out",
      align: "right",
      render: tokensOutRender,
      renderSub: tokensOutRender,
    },
    {
      key: "avgTokensPerSec",
      label: "Tok/s",
      align: "right",
      render: tpsRender,
      renderSub: tpsRender,
    },
    {
      key: "totalCost",
      label: "Cost",
      align: "right",
      render: costRender,
      renderSub: costRender,
    },
  ];

  const providerColumns = [
    {
      key: "provider",
      label: "Provider",
      align: "left",
    },
    { key: "totalRequests", label: "Requests", align: "right", render: requestsRender },
    { key: "totalInputTokens", label: "Tokens In", align: "right", render: tokensInRender },
    { key: "totalOutputTokens", label: "Tokens Out", align: "right", render: tokensOutRender },
    { key: "avgTokensPerSec", label: "Tok/s", align: "right", render: tpsRender },
    { key: "totalCost", label: "Cost", align: "right", render: costRender },
  ];

  const modalityColumns = [
    {
      key: "endpoint",
      label: "Modality",
      align: "left",
      render: (row) => (
        <BadgeComponent variant="modality">
          {ENDPOINT_LABELS[row.endpoint] || row.endpoint}
        </BadgeComponent>
      ),
    },
    { key: "totalRequests", label: "Requests", align: "right", render: requestsRender },
    { key: "totalInputTokens", label: "Tokens In", align: "right", render: tokensInRender },
    { key: "totalOutputTokens", label: "Tokens Out", align: "right", render: tokensOutRender },
    { key: "avgTokensPerSec", label: "Tok/s", align: "right", render: tpsRender },
    { key: "totalCost", label: "Cost", align: "right", render: costRender },
  ];

  const modelColumns = [
    {
      key: "model",
      label: "Model",
      align: "left",
    },
    {
      key: "provider",
      label: "Provider",
      render: (row) => (
        <BadgeComponent variant="provider">{row.provider}</BadgeComponent>
      ),
    },
    { key: "totalRequests", label: "Requests", align: "right", render: requestsRender },
    { key: "totalInputTokens", label: "Tokens In", align: "right", render: tokensInRender },
    { key: "totalOutputTokens", label: "Tokens Out", align: "right", render: tokensOutRender },
    { key: "avgTokensPerSec", label: "Tok/s", align: "right", render: tpsRender },
    { key: "totalCost", label: "Cost", align: "right", render: costRender },
  ];

  return (
    <div className={styles.page}>
      <PageHeaderComponent
        title="Usage"
        subtitle="Cost breakdown across all projects, providers, and modalities"
      />

      {/* Date Filter */}
      <div className={styles.dateFilter}>
        <DatePickerComponent
          from={dateRange.from}
          to={dateRange.to}
          onChange={setDateRange}
          storageKey={LS_DATE_RANGE}
        />
      </div>

      {/* Stats Row */}
      <div className={styles.statsGrid}>
        <StatsCard
          label="Total Cost"
          value={loading ? "..." : formatCost(totals.totalCost)}
          subtitle="All-time estimated spend"
          icon={DollarSign}
          variant="warning"
          loading={loading}
        />
        <StatsCard
          label="Total Requests"
          value={loading ? "..." : formatNumber(totals.totalRequests)}
          subtitle="API calls made"
          icon={Activity}
          variant="accent"
          loading={loading}
        />
        <StatsCard
          label="Tokens In"
          value={loading ? "..." : formatNumber(totals.totalInputTokens)}
          subtitle="Total input tokens"
          icon={ArrowDownToLine}
          variant="info"
          loading={loading}
        />
        <StatsCard
          label="Tokens Out"
          value={loading ? "..." : formatNumber(totals.totalOutputTokens)}
          subtitle="Total output tokens"
          icon={ArrowUpFromLine}
          variant="success"
          loading={loading}
        />
      </div>

      {/* Cost by Project — with breakdown selector */}
      <div className={styles.section}>
        <SortableTable
          title={
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                whiteSpace: "nowrap",
              }}
            >
              Cost by Project
              <SelectDropdown
                value={projectBreakdown}
                onChange={setProjectBreakdown}
                options={[
                  { value: "provider", label: "Provider" },
                  { value: "modality", label: "Modality" },
                  { value: "model", label: "Model" },
                ]}
              />
            </span>
          }
          columns={
            projectBreakdown === "modality"
              ? projectModalityCols
              : projectBreakdown === "model"
                ? projectModelCols
                : projectCols
          }
          data={data?.byProject || []}
          getRowKey={(row) => `${row.project}-${projectBreakdown}`}
          getSubRows={(row) =>
            projectBreakdown === "modality"
              ? mergeByModality(row.byEndpoint || [])
              : projectBreakdown === "model"
                ? row.byModel || []
                : row.byProvider || []
          }
          emptyText={loading ? "Loading..." : "No data yet"}
        />
      </div>

      {/* Two-column: Provider + Modality */}
      <div className={styles.twoCol}>
        <div className={styles.section}>
          <SortableTable
            title="Cost by Provider"
            columns={providerColumns}
            data={data?.byProvider || []}
            getRowKey={(row) => row.provider}
            emptyText={loading ? "Loading..." : "No data yet"}
          />
        </div>

        <div className={styles.section}>
          <SortableTable
            title="Cost by Modality"
            columns={modalityColumns}
            data={mergeByModality(data?.byEndpoint || [])}
            getRowKey={(row) => row.endpoint}
            emptyText={loading ? "Loading..." : "No data yet"}
          />
        </div>
      </div>

      {/* Cost by Model */}
      <div className={styles.section}>
        <SortableTable
          title="Cost by Model"
          columns={modelColumns}
          data={data?.byModel || []}
          getRowKey={(row) => `${row.model}-${row.provider}`}
          emptyText={loading ? "Loading..." : "No data yet"}
        />
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useMemo } from "react";
import IrisService from "../../../services/IrisService";
import SortableTableComponent from "../../../components/SortableTableComponent";
import PageHeaderComponent from "../../../components/PageHeaderComponent";

import SelectDropdown from "../../../components/SelectDropdown";
import {
  LoadingMessage,
  ErrorMessage,
} from "../../../components/StateMessageComponent";
import {
  formatNumber,
  formatCost,
  formatLatency,
  formatTokensPerSec,
  buildDateRangeParams,
} from "../../../utils/utilities";
import { useAdminHeader } from "../../../components/AdminHeaderContext";
import useProjectFilter from "../../../hooks/useProjectFilter";
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

export default function ProvidersPage() {
  const { projectFilter, projectOptions, handleProjectChange } =
    useProjectFilter();
  const { setControls, dateRange } = useAdminHeader();
  const [modelStats, setModelStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedProvider, setExpandedProvider] = useState(null);


  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const params = {};
        if (projectFilter) params.project = projectFilter;
        Object.assign(params, buildDateRangeParams(dateRange));
        const models = await IrisService.getModelStats(params);
        setModelStats(models);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [dateRange, projectFilter]);

  // Aggregate by provider
  const providers = useMemo(() => {
    const map = {};
    modelStats.forEach((m) => {
      if (!map[m.provider]) {
        map[m.provider] = {
          provider: m.provider,
          totalRequests: 0,
          totalCost: 0,
          totalTokens: 0,
          avgLatency: 0,
          models: [],
          _latencySum: 0,
          _latencyCount: 0,
        };
      }
      const p = map[m.provider];
      p.totalRequests += m.totalRequests;
      p.totalCost += m.totalCost;
      p.totalTokens += m.totalTokens;
      p._latencySum += (m.avgLatency || 0) * m.totalRequests;
      p._latencyCount += m.totalRequests;
      p.models.push(m);
    });

    return Object.values(map)
      .map((p) => ({
        ...p,
        avgLatency: p._latencyCount ? p._latencySum / p._latencyCount : 0,
        models: p.models.sort((a, b) => b.totalRequests - a.totalRequests),
      }))
      .sort((a, b) => b.totalRequests - a.totalRequests);
  }, [modelStats]);

  const totalRequests = providers.reduce((s, p) => s + p.totalRequests, 0) || 1;

  const modelColumns = useMemo(
    () => [
      {
        key: "model",
        label: "Model",
        render: (m) => (
          <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>
            {m.model}
          </span>
        ),
      },
      {
        key: "totalRequests",
        label: "Requests",
        render: (m) => formatNumber(m.totalRequests),
        align: "right",
      },
      {
        key: "totalTokens",
        label: "Tokens",
        render: (m) => formatNumber(m.totalTokens),
        align: "right",
      },
      {
        key: "avgTokensPerSec",
        label: "Tok/s",
        render: (m) => formatTokensPerSec(m.avgTokensPerSec),
        align: "right",
      },
      {
        key: "totalCost",
        label: "Cost",
        render: (m) => formatCost(m.totalCost),
        align: "right",
      },
      {
        key: "avgLatency",
        label: "Avg Latency",
        render: (m) => formatLatency(m.avgLatency),
        align: "right",
      },
    ],
    [],
  );



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

  return (
    <div className={styles.page}>
      <PageHeaderComponent
        title="Providers"
        subtitle={`${providers.length} providers \u00B7 ${modelStats.length} models`}
      />



      {loading && <LoadingMessage message="Loading provider data..." />}

      <div className={styles.providerList}>
        {providers.map((p, i) => {
          const color = PROVIDER_COLORS[i % PROVIDER_COLORS.length];
          const share = ((p.totalRequests / totalRequests) * 100).toFixed(1);
          const isExpanded = expandedProvider === p.provider;

          return (
            <div key={p.provider} className={styles.providerCard}>
              <button
                className={styles.providerHeader}
                onClick={() =>
                  setExpandedProvider(isExpanded ? null : p.provider)
                }
              >
                <div className={styles.providerName}>
                  <span
                    className={styles.providerDot}
                    style={{ background: color }}
                  />
                  <span>{p.provider}</span>
                  <span className={styles.modelCount}>
                    {p.models.length} models
                  </span>
                </div>
                <div className={styles.providerStats}>
                  <span className={styles.statItem}>
                    <span className={styles.statValue}>
                      {formatNumber(p.totalRequests)}
                    </span>
                    <span className={styles.statLabel}>requests</span>
                  </span>
                  <span className={styles.statItem}>
                    <span className={styles.statValue}>
                      {formatCost(p.totalCost)}
                    </span>
                    <span className={styles.statLabel}>cost</span>
                  </span>
                  <span className={styles.statItem}>
                    <span className={styles.statValue}>
                      {formatLatency(p.avgLatency)}
                    </span>
                    <span className={styles.statLabel}>avg latency</span>
                  </span>
                  <span className={styles.statItem}>
                    <span className={styles.statValue}>{share}%</span>
                    <span className={styles.statLabel}>share</span>
                  </span>
                </div>
                <div className={styles.shareBar}>
                  <div
                    className={styles.shareBarFill}
                    style={{ width: `${share}%`, background: color }}
                  />
                </div>
              </button>
              {isExpanded && (
                <div className={styles.modelList}>
                  <SortableTableComponent
                    columns={modelColumns}
                    data={p.models}
                    getRowKey={(m) => m.model}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

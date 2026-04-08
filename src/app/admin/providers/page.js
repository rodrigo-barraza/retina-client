"use client";

import { useState, useEffect, useMemo } from "react";
import IrisService from "../../../services/IrisService";
import TableComponent from "../../../components/TableComponent";


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
  const { setControls, setTitleBadge, dateRange } = useAdminHeader();
  const [modelStats, setModelStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedProvider, setExpandedProvider] = useState(null);
  const [rateLimits, setRateLimits] = useState({});

  useEffect(() => {
    // Immediately enter loading state and clear stale data when filters change
    setLoading(true);
    setError(null);
    setModelStats([]);

    async function load() {
      try {
        const params = {};
        if (projectFilter) params.project = projectFilter;
        Object.assign(params, buildDateRangeParams(dateRange));
        const [models, limits] = await Promise.all([
          IrisService.getModelStats(params),
          IrisService.getRateLimits().catch(() => ({})),
        ]);
        setModelStats(models);
        setRateLimits(limits);
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
    return () => {
      setControls(null);
      setTitleBadge(null);
    };
  }, [setControls, setTitleBadge]);

  // Set title badge with provider count
  useEffect(() => {
    setTitleBadge(providers.length);
  }, [setTitleBadge, providers.length]);

  return (
    <div className={styles.page}>

      {loading && <LoadingMessage message="Loading provider data..." />}

      <div className={styles.providerList}>
        {providers.map((p, i) => {
          const color = PROVIDER_COLORS[i % PROVIDER_COLORS.length];
          const share = ((p.totalRequests / totalRequests) * 100).toFixed(1);
          const isExpanded = expandedProvider === p.provider;
          const providerLimits = rateLimits[p.provider];

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
                  {providerLimits && (
                    <span className={styles.rateLimitBadge}>
                      {providerLimits.dynamic ? "⚡ Live" : "📋 Static"}
                    </span>
                  )}
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

              {/* Rate Limits Section */}
              {providerLimits && (
                <RateLimitPanel data={providerLimits} providerName={p.provider} />
              )}

              {isExpanded && (
                <div className={styles.modelList}>
                  <TableComponent
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

// ── Rate Limit Panel ──────────────────────────────────────────

function RateLimitPanel({ data, providerName }) {
  const { rateLimits, updatedAt, dynamic: _dynamic } = data;

  // Google has a different structure (models map)
  if (providerName === "google" && rateLimits?.models) {
    return (
      <div className={styles.rateLimitPanel}>
        <div className={styles.rateLimitHeader}>
          <span className={styles.rateLimitTitle}>Rate Limits</span>
          <span className={styles.rateLimitMeta}>
            {rateLimits.note || "Static tier limits"}
          </span>
        </div>
        <div className={styles.rateLimitGrid}>
          {Object.entries(rateLimits.models).map(([model, limits]) => (
            <div key={model} className={styles.rateLimitModelCard}>
              <span className={styles.rateLimitModelName}>{model}</span>
              <div className={styles.rateLimitMetrics}>
                <RateLimitMetric label="RPM" value={limits.rpm} />
                <RateLimitMetric label="TPM" value={limits.tpm} />
                {limits.rpd && <RateLimitMetric label="RPD" value={limits.rpd} />}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // OpenAI / Anthropic — dynamic limits
  if (!rateLimits?.requests && !rateLimits?.tokens) return null;

  const timeAgo = updatedAt ? getTimeAgo(updatedAt) : null;

  return (
    <div className={styles.rateLimitPanel}>
      <div className={styles.rateLimitHeader}>
        <span className={styles.rateLimitTitle}>Rate Limits</span>
        {timeAgo && (
          <span className={styles.rateLimitMeta}>
            Updated {timeAgo}
          </span>
        )}
      </div>
      <div className={styles.rateLimitGrid}>
        {/* Requests */}
        {rateLimits.requests?.limit != null && (
          <div className={styles.rateLimitCard}>
            <span className={styles.rateLimitCardLabel}>Requests</span>
            <ProgressBar
              current={rateLimits.requests.remaining}
              max={rateLimits.requests.limit}
            />
            <span className={styles.rateLimitCardValues}>
              {formatNumber(rateLimits.requests.remaining ?? 0)} / {formatNumber(rateLimits.requests.limit)} remaining
            </span>
            {rateLimits.requests.reset && (
              <span className={styles.rateLimitReset}>
                Resets in {rateLimits.requests.reset}
              </span>
            )}
          </div>
        )}

        {/* Tokens */}
        {rateLimits.tokens?.limit != null && (
          <div className={styles.rateLimitCard}>
            <span className={styles.rateLimitCardLabel}>Tokens</span>
            <ProgressBar
              current={rateLimits.tokens.remaining}
              max={rateLimits.tokens.limit}
            />
            <span className={styles.rateLimitCardValues}>
              {formatNumber(rateLimits.tokens.remaining ?? 0)} / {formatNumber(rateLimits.tokens.limit)} remaining
            </span>
            {rateLimits.tokens.reset && (
              <span className={styles.rateLimitReset}>
                Resets in {rateLimits.tokens.reset}
              </span>
            )}
          </div>
        )}

        {/* Anthropic extra: Input Tokens */}
        {rateLimits.inputTokens?.limit != null && (
          <div className={styles.rateLimitCard}>
            <span className={styles.rateLimitCardLabel}>Input Tokens</span>
            <ProgressBar
              current={rateLimits.inputTokens.remaining}
              max={rateLimits.inputTokens.limit}
            />
            <span className={styles.rateLimitCardValues}>
              {formatNumber(rateLimits.inputTokens.remaining ?? 0)} / {formatNumber(rateLimits.inputTokens.limit)} remaining
            </span>
          </div>
        )}

        {/* Anthropic extra: Output Tokens */}
        {rateLimits.outputTokens?.limit != null && (
          <div className={styles.rateLimitCard}>
            <span className={styles.rateLimitCardLabel}>Output Tokens</span>
            <ProgressBar
              current={rateLimits.outputTokens.remaining}
              max={rateLimits.outputTokens.limit}
            />
            <span className={styles.rateLimitCardValues}>
              {formatNumber(rateLimits.outputTokens.remaining ?? 0)} / {formatNumber(rateLimits.outputTokens.limit)} remaining
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function ProgressBar({ current, max }) {
  if (max == null || max === 0) return null;

  const remaining = current ?? 0;
  const pct = Math.max(0, Math.min(100, (remaining / max) * 100));
  // Color gradient: green (>60%), yellow (30-60%), red (<30%)
  const hue = Math.round((pct / 100) * 120); // 0=red, 60=yellow, 120=green

  return (
    <div className={styles.progressBarTrack}>
      <div
        className={styles.progressBarFill}
        style={{
          width: `${pct}%`,
          background: `hsl(${hue}, 70%, 50%)`,
        }}
      />
    </div>
  );
}

function RateLimitMetric({ label, value }) {
  return (
    <span className={styles.rateLimitMetric}>
      <span className={styles.rateLimitMetricValue}>
        {value != null ? formatNumber(value) : "—"}
      </span>
      <span className={styles.rateLimitMetricLabel}>{label}</span>
    </span>
  );
}

function getTimeAgo(isoString) {
  const diff = Date.now() - new Date(isoString).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

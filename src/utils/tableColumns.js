/**
 * tableColumns.js — Shared column factory functions for all *TableComponent
 * wrappers. Each factory returns one or more column definition objects
 * compatible with TableComponent's `columns` prop.
 *
 * Usage:
 *   import { tokenColumns, costColumns, ... } from "../utils/tableColumns";
 *   const columns = [identityCol, ...tokenColumns(), ...costColumns(total)];
 */

import {
  FolderOpen,
  MessageSquare,
  Workflow,
  Zap,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Timer,
  Gauge,
  HardDrive,
  Calendar,
  Brain,
  Wrench,
  Loader2,
} from "lucide-react";
import ModelBadgeComponent from "../components/ModelBadgeComponent";
import ProvidersBadgeComponent from "../components/ProvidersBadgeComponent";
import AgentBadgeComponent from "../components/AgentBadgeComponent";
import ProjectBadgeComponent from "../components/ProjectBadgeComponent";
import UserBadgeComponent from "../components/UserBadgeComponent";
import CountLinkComponent from "../components/CountLinkComponent";
import CostBadgeComponent from "../components/CostBadgeComponent";
import ProportionBarComponent from "../components/ProportionBarComponent";
import ModalityIconComponent from "../components/ModalityIconComponent";
import ToolIconComponent from "../components/ToolIconComponent";
import BadgeComponent from "../components/BadgeComponent";
import ProviderLogo from "../components/ProviderLogos";
import {
  formatTokenCount,
  formatLatency,
  formatTokensPerSec,
  formatDateTime,
  getTotalInputTokens,
  formatCost,
} from "./utilities";
import { PROVIDER_COLORS } from "../constants";
import styles from "../components/TableComponents.module.css";

/* ── Helpers ────────────────────────────────────────────── */

/** Renders a muted "—" dash — replaces all inline style={{ color: "var(--text-muted)" }} */
export const emptyDash = () => <span className={styles.emptyDash}>—</span>;

/** Render a value or a muted dash if falsy/zero */
export const valueOrDash = (val, render) =>
  val ? render(val) : emptyDash();

/** Merge modalities from an array of conversations into a single object */
export function mergeModalities(conversations) {
  const merged = {};
  for (const c of conversations) {
    if (!c.modalities) continue;
    for (const [key, val] of Object.entries(c.modalities)) {
      if (val) merged[key] = true;
    }
  }
  return Object.keys(merged).length > 0 ? merged : null;
}

/** Get duration in ms from createdAt/updatedAt or startedAt/finishedAt */
export function getDurationMs(row) {
  const start = row.startedAt || row.createdAt;
  const end = row.finishedAt || row.updatedAt;
  if (!start || !end) return 0;
  return Math.max(0, new Date(end) - new Date(start));
}

/** Format ms duration into human-readable string */
export function formatDuration(ms) {
  if (!ms || ms <= 0) return null;
  if (ms < 1000) return "<1s";
  const secs = Math.round(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const rem = secs % 60;
  if (mins < 60) return rem > 0 ? `${mins}m ${rem}s` : `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hrs}h ${remMins}m` : `${hrs}h`;
}

// Re-export PROVIDER_COLORS so existing consumers don't need to change imports
export { PROVIDER_COLORS };

/* ── Column Factories ───────────────────────────────────── */

/* ·· Identity / name columns ·· */

export const modelColumn = () => ({
  key: "model",
  label: "Model",
  description: "The AI model identifier used for the request",
  render: (row) => <ModelBadgeComponent models={row.model ? [row.model] : []} />,
});

export const providerColumn = () => ({
  key: "provider",
  label: "Provider",
  description: "The API provider hosting this model (e.g. OpenAI, Google, Anthropic)",
  render: (row) => (
    <ProvidersBadgeComponent providers={row.provider ? [row.provider] : []} />
  ),
});

export const projectColumn = () => ({
  key: "project",
  label: "Project",
  description: "The project or application this request belongs to",
  render: (row) => <ProjectBadgeComponent project={row.project} />,
});

export const userColumn = () => ({
  key: "username",
  label: "User",
  description: "The user who initiated this request",
  sortable: false,
  render: (row) => <UserBadgeComponent username={row.username} />,
});

/* ·· Models / Providers (as badge lists) ·· */

export const modelsListColumn = ({ mini = false } = {}) => ({
  key: "models",
  label: "Models",
  description: "All distinct models used in this group",
  sortable: false,
  render: (row) => <ModelBadgeComponent models={row.models} mini={mini} />,
});

export const modelCountColumn = () => ({
  key: "modelCount",
  label: "Models",
  description: "Number of distinct models used",
  sortValue: (row) => (row.models?.length || row.modelCount || 0),
  render: (row) => <ModelBadgeComponent models={row.models || []} />,
});

export const providersListColumn = ({ mini = false } = {}) => ({
  key: "providers",
  label: "Providers",
  description: "All distinct providers used in this group",
  sortable: false,
  render: (row) => <ProvidersBadgeComponent providers={row.providers} mini={mini} />,
});

export const providerCountColumn = () => ({
  key: "providerCount",
  label: "Providers",
  description: "Number of distinct API providers used",
  sortValue: (row) => (row.providers || []).length,
  render: (row) => <ProvidersBadgeComponent providers={row.providers || []} />,
});

/* ·· Request / usage columns ·· */

export const requestsColumn = () => ({
  key: "totalRequests",
  label: "Requests",
  description: "Total number of API requests made",
  align: "right",
  render: (row) => row.totalRequests?.toLocaleString() || "0",
});

export const requestCountColumn = () => ({
  key: "requestCount",
  label: "Requests",
  description: "Number of individual API calls",
  sortable: true,
  align: "right",
  render: (row) =>
    (row.requestCount || 0) > 0 ? (
      <span className={styles.countCell}>
        <Zap size={10} />
        {row.requestCount}
      </span>
    ) : (
      emptyDash()
    ),
});

export const usageColumn = (totalRequests, color) => ({
  key: "usage",
  label: "Usage",
  description: "Proportional share of total requests",
  sortValue: (row) => row.totalRequests,
  render: (row, _i) => (
    <ProportionBarComponent
      value={row.totalRequests}
      total={totalRequests}
      color={color}
    />
  ),
});

/* ·· Modalities ·· */

export const modalitiesColumn = ({ mini = false, fromConversations = false } = {}) => ({
  key: "modalities",
  label: "Modalities",
  description: "Input/output types supported (text, image, audio, video)",
  sortValue: (row) => {
    const mods = fromConversations
      ? mergeModalities(row.conversations || [])
      : row.modalities;
    return mods ? Object.values(mods).filter(Boolean).length : 0;
  },
  render: (row) => {
    const mods = fromConversations
      ? mergeModalities(row.conversations || [])
      : row.modalities;
    if (!mods) return emptyDash();
    return <ModalityIconComponent modalities={mods} size={mini ? 9 : 12} />;
  },
});

/* ·· Tools ·· */

export const toolsColumn = ({ mini = false, configModels } = {}) => ({
  key: "toolNames",
  label: "Tools",
  description: "External tools and capabilities configured for this model",
  sortable: false,
  align: "left",
  render: (row) => {
    // Support either direct toolNames array or config-based lookup
    if (configModels) {
      const tools = configModels[`${row.provider}:${row.model}`];
      if (!tools?.length) return emptyDash();
      return <ToolIconComponent toolNames={tools} size={mini ? 10 : undefined} />;
    }
    return <ToolIconComponent toolNames={row.toolNames} toolCallNames={row.toolCallNames} size={mini ? 10 : undefined} />;
  },
});

/* ·· Token columns ·· */

/** Returns 4 columns: Tokens In, Tokens Out, Tokens (total), Tok/s */
export const tokenColumns = ({
  inputKey = "totalInputTokens",
  outputKey = "totalOutputTokens",
  tpsKey = "avgTokensPerSec",
  showDash = false,
} = {}) => [
  {
    key: inputKey,
    label: "Tokens In",
    description: "Total input (prompt) tokens consumed",
    align: "right",
    render: (row) => {
      const v = row[inputKey];
      if (showDash && !(v > 0)) return emptyDash();
      return formatTokenCount(v);
    },
  },
  {
    key: outputKey,
    label: "Tokens Out",
    description: "Total output (completion) tokens generated",
    align: "right",
    render: (row) => {
      const v = row[outputKey];
      if (showDash && !(v > 0)) return emptyDash();
      return formatTokenCount(v);
    },
  },
  {
    key: "totalTokens",
    label: "Tokens",
    description: "Combined input + output token count",
    align: "right",
    sortValue: (row) => (row[inputKey] || 0) + (row[outputKey] || 0),
    render: (row) => {
      const total = (row[inputKey] || 0) + (row[outputKey] || 0);
      if (showDash && total <= 0) return emptyDash();
      return total > 0 ? formatTokenCount(total) : "0";
    },
  },
  {
    key: tpsKey,
    label: "Tok/s",
    description: "Average output throughput in tokens per second",
    align: "right",
    render: (row) => formatTokensPerSec(row[tpsKey]),
  },
];

/* ·· Cost columns ·· */

/** Returns 2 columns: Cost, Cost % */
export const costColumns = (totalCost, { costKey = "totalCost", mini = false } = {}) => [
  {
    key: costKey,
    label: "Cost",
    description: "Total estimated cost in USD",
    sortable: true,
    align: "right",
    render: (row) => <CostBadgeComponent cost={row[costKey]} mini={mini} />,
  },
  {
    key: "costShare",
    label: "Cost %",
    description: "Proportional share of total cost",
    sortable: true,
    sortValue: (row) => row[costKey],
    render: (row) => (
      <ProportionBarComponent
        value={row[costKey]}
        total={totalCost}
        color="var(--warning)"
        mini={mini}
      />
    ),
  },
];

/* ·· Latency ·· */

export const latencyColumn = (key = "avgLatency", label = "Avg Latency") => ({
  key,
  label,
  description: "Average round-trip response time",
  sortable: true,
  align: "right",
  render: (row) => {
    const v = row[key];
    if (!v || v <= 0) return emptyDash();
    return formatLatency(v);
  },
});

/* ·· Count link columns (Sessions / Conversations / Workflows) ·· */

/**
 * Returns 3 columns with CountLinkComponent: Sessions, Conversations, Workflows.
 * @param {string} entityKey — query-param key (e.g. "model", "provider", "project")
 * @param {Function} entityValue — (row) => value for the query param
 */
export const countLinkColumns = (entityKey, entityValue) => [
  {
    key: "sessionCount",
    label: "Sessions",
    description: "Number of user sessions that used this entity",
    align: "right",
    render: (row) => (
      <CountLinkComponent
        count={row.sessionCount}
        href={`/admin/sessions?${entityKey}=${encodeURIComponent(entityValue(row))}`}
        icon={FolderOpen}
      />
    ),
  },
  {
    key: "conversationCount",
    label: "Conversations",
    description: "Number of conversations that used this entity",
    align: "right",
    render: (row) => (
      <CountLinkComponent
        count={row.conversationCount}
        href={`/admin/conversations?${entityKey}=${encodeURIComponent(entityValue(row))}`}
        icon={MessageSquare}
      />
    ),
  },
  {
    key: "workflowCount",
    label: "Workflows",
    description: "Number of workflows that used this entity",
    align: "right",
    render: (row) => (
      <CountLinkComponent
        count={row.workflowCount}
        href={`/admin/workflows?${entityKey}=${encodeURIComponent(entityValue(row))}`}
        icon={Workflow}
      />
    ),
  },
];

/* ·· Conversation count (inline icon) ·· */

export const conversationCountColumn = () => ({
  key: "conversationCount",
  label: "Convos",
  description: "Total number of conversations",
  sortable: true,
  align: "right",
  render: (row) => {
    const count = row.conversationCount || (row.conversations || []).length || 0;
    return (
      <span className={styles.countCell}>
        <MessageSquare size={10} />
        {count}
      </span>
    );
  },
});

/* ·· Duration columns ·· */

export const durationColumn = ({ useDurationMs = false } = {}) => ({
  key: "duration",
  label: "Duration",
  description: "Elapsed wall-clock time from start to finish",
  sortable: false,
  align: "right",
  sortValue: (row) => useDurationMs ? getDurationMs(row) : 0,
  render: (row) => {
    const ms = useDurationMs ? getDurationMs(row) : (() => {
      // Session-style: startedAt / finishedAt
      if (!row.startedAt || !row.finishedAt) return 0;
      return new Date(row.finishedAt) - new Date(row.startedAt);
    })();
    const dur = formatDuration(ms);
    if (!dur) return emptyDash();
    return (
      <span className={styles.durationCell}>
        <Clock size={10} />
        {dur}
      </span>
    );
  },
});

export const durationShareColumn = (totalDuration, { mini = false } = {}) => ({
  key: "durationShare",
  label: "Duration %",
  description: "Proportional share of total duration",
  sortable: true,
  sortValue: (row) => getDurationMs(row),
  render: (row) => (
    <ProportionBarComponent
      value={getDurationMs(row)}
      total={totalDuration}
      color="var(--accent-color)"
      mini={mini}
    />
  ),
});

/* ·· Timestamps ·· */

export const createdAtColumn = (key = "createdAt") => ({
  key,
  label: "Created",
  description: "When this record was first created",
  sortable: true,
  align: "right",
  render: (row) => formatDateTime(row[key]),
});

/* ·· Session ID ·· */

export const sessionIdColumn = () => ({
  key: "id",
  label: "Session",
  description: "Unique session identifier (click to view conversations)",
  sortable: false,
  render: (s) => (
    <a
      href={`/admin/conversations?session=${s.id}`}
      className={styles.sessionIdCell}
      title={`View conversations for session ${s.id}`}
      onClick={(e) => e.stopPropagation()}
    >
      <FolderOpen size={12} className={styles.sessionIcon} />
      <span className={styles.sessionIdText}>{s.id.slice(0, 8)}</span>
    </a>
  ),
});

/* ·· Conversation title ·· */

export const conversationTitleColumn = ({ mini = false } = {}) => ({
  key: "title",
  label: "Conversation",
  description: "Auto-generated conversation title",
  sortable: false,
  render: (c) => (
    <span className={`${styles.conversationTitle} ${mini ? styles.conversationTitleMini : ""}`}>
      <MessageSquare size={mini ? 9 : 12} />
      {c.title || "Untitled"}
    </span>
  ),
});

/* ·· Project / User as inline badges (for Conversations) ·· */

export const projectBadgeColumn = ({ mini = false } = {}) => ({
  key: "project",
  label: "Project",
  description: "The project this conversation belongs to",
  sortable: false,
  render: (c) =>
    c.project ? (
      <BadgeComponent variant="info" mini={mini}>{c.project}</BadgeComponent>
    ) : (
      emptyDash()
    ),
});

export const userBadgeColumn = ({ mini = false } = {}) => ({
  key: "username",
  label: "User",
  description: "The user who started this conversation",
  sortable: false,
  render: (c) =>
    c.username && c.username !== "unknown" ? (
      <BadgeComponent variant="provider" mini={mini}>{c.username}</BadgeComponent>
    ) : (
      emptyDash()
    ),
});

/* ·· Endpoint ·· */

export const endpointColumn = () => ({
  key: "endpoint",
  label: "Endpoint",
  description: "The API endpoint path called (e.g. /chat, /image, /audio)",
  render: (r) => (
    <BadgeComponent variant="endpoint">{r.endpoint || "-"}</BadgeComponent>
  ),
});

export const operationColumn = () => ({
  key: "operation",
  label: "Operation",
  description: "The semantic purpose of this LLM call (e.g. chat, agent:iteration, memory:extract)",
  render: (r) => (
    <BadgeComponent variant="info">{r.operation || "-"}</BadgeComponent>
  ),
});

/* ·· Agent ·· */

export const agentColumn = () => ({
  key: "agent",
  label: "Agent",
  description: "The originating agent that made this request (e.g. CODING, LUPOS)",
  sortable: false,
  render: (r) => {
    // Normalize: sessions expose `agents` (array), requests expose `agent` (string)
    const agents = r.agents || (r.agent ? [r.agent] : []);
    return <AgentBadgeComponent agents={agents} />;
  },
});

/* ·· Status ·· */

export const statusColumn = () => ({
  key: "success",
  label: "Status",
  description: "Whether the request completed successfully (OK) or failed (ERR)",
  align: "right",
  render: (r) => (
    <BadgeComponent variant={r.success ? "success" : "error"}>
      {r.success ? "OK" : "ERR"}
    </BadgeComponent>
  ),
});

/* ── Benchmark result columns ──────────────────────────── */

export const benchmarkStatusColumn = () => ({
  key: "status",
  label: "Status",
  description: "Whether the model passed, failed, or errored on this benchmark",
  sortValue: (r) => (r._running ? -2 : r.error ? -1 : r.passed ? 1 : 0),
  render: (r) => {
    if (r._running) {
      return (
        <span className={styles.benchmarkStatusCell}>
          <Loader2 size={16} className={styles.benchmarkRunningIcon} />
          <span>{r._phase || "Running"}</span>
        </span>
      );
    }
    if (r.error) {
      return (
        <span className={styles.benchmarkStatusCell}>
          <AlertTriangle size={16} className={styles.benchmarkErrorIcon} />
          <span>Error</span>
        </span>
      );
    }
    if (r.passed) {
      return (
        <span className={styles.benchmarkStatusCell}>
          <CheckCircle2 size={16} className={styles.benchmarkPassIcon} />
          <span>Pass</span>
        </span>
      );
    }
    return (
      <span className={styles.benchmarkStatusCell}>
        <XCircle size={16} className={styles.benchmarkFailIcon} />
        <span>Fail</span>
      </span>
    );
  },
});

export const benchmarkModelColumn = () => ({
  key: "label",
  label: "Model",
  description: "The model and provider tested",
  render: (r) => (
    <span className={styles.benchmarkModelCell}>
      <span className={styles.benchmarkModelName}>{r.label}</span>
      <span className={styles.benchmarkModelProvider}>{r.provider}</span>
      {r._running && r._progress > 0 && (
        <span className={styles.benchmarkProgressPct}>
          {Math.round(r._progress * 100)}%
        </span>
      )}
    </span>
  ),
});

export const benchmarkToolsColumn = () => ({
  key: "toolsEnabled",
  label: "Tools",
  description: "Whether tool use (function calling) was enabled for this run",
  sortable: true,
  sortValue: (r) => (r.toolsEnabled ? 1 : 0),
  defaultHidden: true,
  render: (r) =>
    r.toolsEnabled ? (
      <BadgeComponent variant="warning" mini>
        <Wrench size={10} /> Tools
      </BadgeComponent>
    ) : (
      emptyDash()
    ),
});

export const benchmarkThinkingColumn = () => ({
  key: "thinkingEnabled",
  label: "Thinking",
  description: "Whether extended thinking / chain-of-thought was enabled",
  sortable: true,
  sortValue: (r) => (r.thinkingEnabled ? 1 : 0),
  defaultHidden: true,
  render: (r) =>
    r.thinkingEnabled ? (
      <BadgeComponent variant="accent" mini>
        <Brain size={10} /> Thinking
      </BadgeComponent>
    ) : (
      emptyDash()
    ),
});

/**
 * Model file size column for benchmarks.
 * Shows the GGUF/weight file size for local models (e.g. "4.3 GB").
 * @param {Object} modelConfigMap  Map of "provider:modelName" → model config object
 */
export const benchmarkSizeColumn = ({ modelConfigMap = {} } = {}) => ({
  key: "size",
  label: "Size",
  description: "Model file/weight size on disk (local models only)",
  sortable: true,
  sortValue: (r) => {
    const cfg = modelConfigMap[`${r.provider}:${r.model}`];
    const s = cfg?.size || "";
    const match = s.match(/([\d.]+)\s*(GB|MB|KB)/i);
    if (!match) return 0;
    const val = parseFloat(match[1]);
    const unit = match[2].toUpperCase();
    if (unit === "GB") return val * 1024;
    if (unit === "MB") return val;
    return val / 1024;
  },
  align: "right",
  render: (r) => {
    const cfg = modelConfigMap[`${r.provider}:${r.model}`];
    if (!cfg?.size) return emptyDash();
    return (
      <span className={styles.benchmarkTpsCell}>
        <HardDrive size={10} />
        {cfg.size}
      </span>
    );
  },
});

/**
 * Highlight the expected value substring inside a response string.
 * Returns an array of React nodes with <mark> wrapping matched portions.
 */
function highlightExpected(text, expected, matchMode) {
  if (!text || !expected) return text || "—";

  const norm = (s) => s.trim().toLowerCase();
  const normText = norm(text);
  const normExpected = norm(expected);

  // For regex mode, find the first match in the original text
  if (matchMode === "regex") {
    try {
      const re = new RegExp(`(${expected})`, "i");
      const match = text.match(re);
      if (!match) return text;
      const idx = match.index;
      const len = match[0].length;
      return (
        <>
          {text.slice(0, idx)}
          <mark className={styles.benchmarkHighlight}>{text.slice(idx, idx + len)}</mark>
          {text.slice(idx + len)}
        </>
      );
    } catch {
      return text;
    }
  }

  // For exact mode — highlight the entire response if it matches
  if (matchMode === "exact" && normText === normExpected) {
    return <mark className={styles.benchmarkHighlight}>{text}</mark>;
  }

  // For contains / startsWith — find the substring position (case-insensitive)
  const idx = normText.indexOf(normExpected);
  if (idx === -1) return text;

  const before = text.slice(0, idx);
  const matched = text.slice(idx, idx + expected.trim().length);
  const after = text.slice(idx + expected.trim().length);

  return (
    <>
      {before}
      <mark className={styles.benchmarkHighlight}>{matched}</mark>
      {after}
    </>
  );
}

export const benchmarkResponseColumn = ({ expectedValue, matchMode } = {}) => ({
  key: "response",
  label: "Response",
  description: "The model's output text (or error message)",
  sortable: false,
  render: (r) => {
    if (r.error) {
      return <span className={styles.benchmarkErrorMessage}>{r.error}</span>;
    }
    return (
      <span className={styles.benchmarkResponseCell} title={r.response}>
        {expectedValue
          ? highlightExpected(r.response, expectedValue, matchMode || r.matchMode)
          : (r.response || "—")}
      </span>
    );
  },
});

export const benchmarkLatencyColumn = () => ({
  key: "latency",
  label: "Latency",
  description: "Time taken for the model to respond",
  sortable: true,
  align: "right",
  render: (r) =>
    r.latency ? (
      <span className={styles.monoCell}>{formatLatency(r.latency)}</span>
    ) : (
      emptyDash()
    ),
});

export const benchmarkDurationColumn = () => ({
  key: "duration",
  label: "Duration",
  description: "Wall-clock time from request start to finish",
  sortable: true,
  sortValue: (r) => r.latency || 0,
  align: "right",
  render: (r) => {
    if (!r.latency) return emptyDash();
    return (
      <span className={styles.durationCell}>
        <Timer size={10} />
        {formatLatency(r.latency)}
      </span>
    );
  },
});

export const benchmarkTokensInColumn = () => ({
  key: "tokensIn",
  label: "Tokens In",
  description: "Input (prompt) tokens consumed by this model",
  sortable: true,
  sortValue: (r) => getTotalInputTokens(r.usage) || 0,
  align: "right",
  render: (r) => {
    const v = getTotalInputTokens(r.usage);
    return v > 0 ? <span className={styles.monoCell}>{formatTokenCount(v)}</span> : emptyDash();
  },
});

export const benchmarkTokensOutColumn = () => ({
  key: "tokensOut",
  label: "Tokens Out",
  description: "Output (completion) tokens generated by this model",
  sortable: true,
  sortValue: (r) => r.usage?.outputTokens || 0,
  align: "right",
  render: (r) => {
    const v = r.usage?.outputTokens || 0;
    return v > 0 ? <span className={styles.monoCell}>{formatTokenCount(v)}</span> : emptyDash();
  },
});

export const benchmarkTokPerSecColumn = () => ({
  key: "tokPerSec",
  label: "Tok/s",
  description: "Output throughput — completion tokens per second",
  sortable: true,
  sortValue: (r) => {
    const out = r.usage?.outputTokens || 0;
    return r.latency > 0 && out > 0 ? out / r.latency : 0;
  },
  align: "right",
  render: (r) => {
    const out = r.usage?.outputTokens || 0;
    if (!r.latency || r.latency <= 0 || out <= 0) return emptyDash();
    const tps = out / r.latency;
    return (
      <span className={styles.benchmarkTpsCell}>
        <Gauge size={10} />
        {tps.toFixed(1)}
      </span>
    );
  },
});

export const benchmarkCostColumn = () => ({
  key: "estimatedCost",
  label: "Cost",
  description: "Estimated cost for this individual model run",
  sortable: true,
  align: "right",
  render: (r) =>
    r.estimatedCost != null ? (
      <span className={styles.monoCell}>${r.estimatedCost.toFixed(6)}</span>
    ) : (
      emptyDash()
    ),
});

export const benchmarkDateColumn = () => ({
  key: "completedAt",
  label: "Date",
  description: "When this model was tested",
  sortable: true,
  align: "right",
  render: (r) =>
    r.completedAt ? (
      <span className={styles.durationCell}>
        <Calendar size={10} />
        {formatDateTime(r.completedAt)}
      </span>
    ) : (
      emptyDash()
    ),
});

export const benchmarkMatchModeColumn = () => ({
  key: "matchMode",
  label: "Match",
  description: "Evaluation strategy used to compare response against expected value",
  sortable: false,
  render: (r) => {
    const labels = {
      contains: "Contains",
      exact: "Exact",
      startsWith: "Starts With",
      regex: "Regex",
    };
    return (
      <BadgeComponent variant="info" mini>
        {labels[r.matchMode] || r.matchMode || "—"}
      </BadgeComponent>
    );
  },
});

/* ── Benchmark Dashboard columns (aggregated model stats) ── */

export const dashboardModelColumn = () => ({
  key: "label",
  label: "Model",
  description: "Model name and provider tested across benchmarks",
  sortable: true,
  render: (r) => (
    <span className={styles.dashboardModelCell}>
      <ProviderLogo provider={r.provider} size={16} />
      <span className={styles.dashboardModelName}>{r.label}</span>
    </span>
  ),
});

export const dashboardProviderColumn = () => ({
  key: "provider",
  label: "Provider",
  description: "The API provider hosting this model",
  sortable: true,
  render: (r) => (
    <ProvidersBadgeComponent providers={r.provider ? [r.provider] : []} />
  ),
});

export const dashboardTestsColumn = () => ({
  key: "total",
  label: "Tests",
  description: "Total number of benchmark tests run for this model",
  sortable: true,
  align: "right",
  render: (r) => (
    <span className={styles.monoCell}>{r.total}</span>
  ),
});

export const dashboardPassedColumn = () => ({
  key: "passed",
  label: "Pass",
  description: "Number of benchmark tests this model passed",
  sortable: true,
  align: "right",
  render: (r) => (
    <span className={styles.dashboardPassedCell}>
      <CheckCircle2 size={12} />
      {r.passed}
    </span>
  ),
});

export const dashboardFailedColumn = () => ({
  key: "failed",
  label: "Fail",
  description: "Number of benchmark tests this model failed or errored",
  sortable: true,
  sortValue: (r) => r.failed + r.errored,
  align: "right",
  render: (r) => (
    <span className={styles.dashboardFailedCell}>
      <XCircle size={12} />
      {r.failed + r.errored}
    </span>
  ),
});

export const dashboardPassRateColumn = () => ({
  key: "passRate",
  label: "Pass Rate",
  description: "Percentage of benchmark tests this model passed",
  sortable: true,
  width: "100px",
  render: (r) => {
    const pct = Math.round(r.passRate * 100);
    const color =
      pct >= 80 ? "var(--success)" : pct >= 50 ? "var(--warning)" : "var(--danger)";
    return (
      <span className={styles.dashboardRateCell}>
        <span className={styles.dashboardRateBar}>
          <span
            className={styles.dashboardRateBarFill}
            style={{ width: `${pct}%`, background: color }}
          />
        </span>
        <span className={styles.dashboardRateValue} style={{ color }}>
          {pct}%
        </span>
      </span>
    );
  },
});

export const dashboardAvgLatencyColumn = () => ({
  key: "avgLatency",
  label: "Avg Latency",
  description: "Average response latency across all benchmark tests",
  sortable: true,
  align: "right",
  render: (r) => (
    <span className={styles.durationCell}>
      <Clock size={12} />
      {r.avgLatency.toFixed(1)}s
    </span>
  ),
});

export const dashboardCostColumn = () => ({
  key: "totalCost",
  label: "Cost",
  description: "Total estimated cost across all benchmark tests for this model",
  sortable: true,
  align: "right",
  render: (r) =>
    r.totalCost > 0 ? (
      <span className={styles.monoCell}>{formatCost(r.totalCost)}</span>
    ) : (
      emptyDash()
    ),
});

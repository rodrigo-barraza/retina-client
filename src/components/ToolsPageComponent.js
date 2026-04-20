"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import PrismService from "../services/PrismService";
import StorageService from "../services/StorageService";
import {
  Wrench,
  Search,
  LayoutGrid,
  List,
  RefreshCw,
  X,
  Play,
  AlertCircle,
  Braces,
  Cloud,
  Globe,
  Cpu,
  Terminal,
  GitBranch,
  Database,
  Zap,
  Shield,
  Heart,
  Navigation,
  Ship,
  Lightbulb,
  MessageCircle,
  Palette,
  Gamepad2,
  Bot,
  Brain,
  Layers,
  FileSearch,
  FolderOpen,
  Cog,
  Clock,
  Package,
  BarChart3,
  Activity,
  DollarSign,
  TrendingUp,
  Calendar,
  Hash,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import styles from "./ToolsPageComponent.module.css";

// ── Agent color mapping (stable hues per built-in agent) ───────
const AGENT_COLORS = {
  CODING: "#3b82f6",
  OOG: "#a78bfa",
  LUPOS: "#ef4444",
  STICKERS: "#f59e0b",
  LIGHTS: "#22c55e",
  DIGEST: "#14b8a6",
};

function getAgentColor(agentId) {
  return AGENT_COLORS[agentId] || "var(--accent-color)";
}

/**
 * Build a reverse map: toolName → [{ id, name }] from agents list.
 * Each agent has enabledToolNames (resolved array of tool name strings).
 */
function buildToolAgentMap(agents) {
  const map = {};
  for (const agent of agents) {
    if (!agent.enabledToolNames) continue;
    for (const toolName of agent.enabledToolNames) {
      if (!map[toolName]) map[toolName] = [];
      map[toolName].push({ id: agent.id, name: agent.name });
    }
  }
  return map;
}

// ── Domain → Icon mapping ──────────────────────────────────────
const DOMAIN_ICONS = {
  "Weather & Environment": Cloud,
  "Events": Zap,
  "Sports": Gamepad2,
  "Markets & Commodities": Database,
  "Trends": Globe,
  "Products": Package,
  "Finance": Database,
  "Knowledge": Brain,
  "Movies & TV": Palette,
  "Health": Heart,
  "Transit": Navigation,
  "Utilities": Cog,
  "Compute": Cpu,
  "Maritime": Ship,
  "Energy": Lightbulb,
  "Communication": MessageCircle,
  "Creative": Palette,
  "Discord": MessageCircle,
  "Smart Home": Lightbulb,
  "Reasoning": Brain,
  "Coordinator": Bot,
  "Agentic: File Operations": FolderOpen,
  "Agentic: Search & Discovery": FileSearch,
  "Agentic: Web": Globe,
  "Agentic: Command Execution": Terminal,
  "Agentic: Git": GitBranch,
  "Agentic: Browser": Globe,
  "Agentic: Code Intelligence": Cpu,
  "Agentic: Task Management": Layers,
  "Agentic: Memory": Brain,
  "Agentic: Agent Management": Bot,
  "Agentic: Meta": Cog,
  "Agentic: Scheduling": Clock,
  "Agentic: Skills": Zap,
  "Agentic: Control Flow": Shield,
  "Agentic: Structured Output": Braces,
  "Agentic: Git Isolation": GitBranch,
};

function getDomainIcon(domain) {
  return DOMAIN_ICONS[domain] || Wrench;
}

/** Count parameters from a tool schema */
function countParams(tool) {
  const props = tool.parameters?.properties;
  if (!props) return 0;
  return Object.keys(props).length;
}

/** Extract all unique domains from tools */
function extractDomains(tools) {
  const set = new Set();
  for (const t of tools) {
    if (t.domain) set.add(t.domain);
  }
  return [...set].sort();
}

/** Extract all unique labels from tools */
function extractLabels(tools) {
  const set = new Set();
  for (const t of tools) {
    if (t.labels) {
      for (const l of t.labels) set.add(l);
    }
  }
  return [...set].sort();
}

/** Group tools by domain */
function groupByDomain(tools) {
  const groups = {};
  for (const tool of tools) {
    const domain = tool.domain || "Uncategorized";
    if (!groups[domain]) groups[domain] = [];
    groups[domain].push(tool);
  }
  const sortKey = (d) => {
    if (d.startsWith("Agentic:")) return `2_${d}`;
    if (d === "Coordinator") return "3_Coordinator";
    if (d === "Reasoning") return "3_Reasoning";
    return `0_${d}`;
  };
  return Object.fromEntries(
    Object.entries(groups).sort((a, b) => sortKey(a[0]).localeCompare(sortKey(b[0]))),
  );
}

/** Humanize a tool name: get_weather_forecast → Weather Forecast */
function humanizeToolName(name) {
  return name
    .replace(/^(get|set|search|list|create|delete|update|fetch|read|write|check|run|execute|find|query|rank|lookup|send|track|stop|cancel|submit|browse|navigate|click|scroll|type|clear|wait|close|open|save|load|ask|plan|log|emit|extract|consolidate|manage|add|remove|use|exit|enter)_/i, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Extract output fields from the `fields` parameter enum, if present */
function extractOutputFields(tool) {
  const fieldsParam = tool.parameters?.properties?.fields;
  if (!fieldsParam) return null;
  // Fields param has items.enum or direct enum
  if (fieldsParam.items?.enum) return fieldsParam.items.enum;
  if (fieldsParam.enum) return fieldsParam.enum;
  // Check description for available fields hint
  return null;
}

/** Get input parameters (excluding the `fields` meta-param) */
function getInputParams(tool) {
  const props = tool.parameters?.properties || {};
  return Object.entries(props).filter(([name]) => name !== "fields");
}

// ── Helpers for stat formatting ───────────────────────────────────

function formatCost(cost) {
  if (!cost || cost === 0) return "$0.00";
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

function formatNumber(n) {
  if (n == null) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatLatency(ms) {
  if (!ms) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function timeAgo(dateStr) {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

// ── Tool Detail Modal ────────────────────────────────────────────

function ToolDetailModal({ tool, onClose, agents, stats, allTools }) {
  const router = useRouter();
  const required = new Set(tool.parameters?.required || []);
  const inputParams = getInputParams(tool);
  const outputFields = extractOutputFields(tool);
  const cleanName = humanizeToolName(tool.name);
  const [showRaw, setShowRaw] = useState(false);

  const handleTryTool = () => {
    if (!allTools) return;
    const allToolNames = allTools.map((t) => t.name);
    const disabledBuiltIns = allToolNames.filter((n) => n !== tool.name);
    StorageService.set("toolMemory:agent:NONE", { disabledBuiltIns });
    router.push("/agents?agent=NONE&fc=true&thinking=true");
  };

  // Close on Escape
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const successRate = stats
    ? ((stats.successCount / (stats.successCount + stats.failureCount)) * 100) || 0
    : 0;

  return (
    <div className={styles.detailOverlay} onClick={onClose}>
      <div className={styles.detailPanel} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.detailHeader}>
          <div className={styles.detailTitleBlock}>
            <div className={styles.detailCleanName}>{cleanName}</div>
            <div className={styles.detailTitle}>{tool.name}</div>
            <div className={styles.detailDomainRow}>
              {tool.domain && (
                <span className={styles.toolDomain}>{tool.domain}</span>
              )}
              {tool.dataSource && (
                <span className={styles.dataSourceBadge}>
                  <span className={styles.dataSourceType}>{tool.dataSource.type}</span>
                  {tool.dataSource.provider && (
                    <span className={styles.dataSourceProvider}>
                      {tool.dataSource.provider}
                    </span>
                  )}
                  {tool.dataSource.intervalSeconds && (
                    <span className={styles.dataSourceInterval}>
                      ~{tool.dataSource.intervalSeconds}s
                    </span>
                  )}
                </span>
              )}
              {tool.labels?.map((l) => (
                <span key={l} className={styles.toolLabel}>{l}</span>
              ))}
              {agents?.length > 0 && agents.map((a) => (
                <span
                  key={a.id}
                  className={styles.agentBadge}
                  style={{ "--agent-color": getAgentColor(a.id) }}
                >
                  <Bot size={10} />
                  {a.name}
                </span>
              ))}
            </div>
          </div>
          <button className={styles.detailClose} onClick={onClose} title="Close">
            <X />
          </button>
        </div>

        {/* Body */}
        <div className={styles.detailBody}>
          <button className={styles.tryToolBtn} onClick={handleTryTool}>
            <Play size={14} /> Try Tool in Direct Chat
          </button>

          {/* Description */}
          <div className={styles.detailDescription}>{tool.description}</div>

          {/* Lifetime Stats */}
          <div className={styles.detailSection}>
            <div className={styles.detailSectionTitle}>
              <BarChart3 size={12} /> Lifetime Usage Stats
            </div>
            {stats ? (
              <>
                <div className={styles.statsGrid}>
                  <div className={styles.statCell}>
                    <Hash size={14} className={styles.statCellIcon} />
                    <div className={styles.statCellValue}>{formatNumber(stats.totalCalls)}</div>
                    <div className={styles.statCellLabel}>Total Calls</div>
                  </div>
                  <div className={styles.statCell}>
                    <Activity size={14} className={styles.statCellIcon} />
                    <div className={styles.statCellValue}>{formatNumber(stats.totalRequests)}</div>
                    <div className={styles.statCellLabel}>Requests</div>
                  </div>
                  <div className={styles.statCell}>
                    <DollarSign size={14} className={styles.statCellIcon} />
                    <div className={styles.statCellValue}>{formatCost(stats.totalCost)}</div>
                    <div className={styles.statCellLabel}>Total Cost</div>
                  </div>
                  <div className={styles.statCell}>
                    <TrendingUp size={14} className={styles.statCellIcon} />
                    <div className={styles.statCellValue}>{formatLatency(stats.avgLatency)}</div>
                    <div className={styles.statCellLabel}>Avg Latency</div>
                  </div>
                  <div className={styles.statCell}>
                    <Zap size={14} className={styles.statCellIcon} />
                    <div className={styles.statCellValue}>{formatNumber(stats.totalInputTokens + stats.totalOutputTokens)}</div>
                    <div className={styles.statCellLabel}>Total Tokens</div>
                  </div>
                  <div className={styles.statCell}>
                    <CheckCircle2 size={14} className={styles.statCellIcon} />
                    <div className={styles.statCellValue}>{successRate.toFixed(0)}%</div>
                    <div className={styles.statCellLabel}>Success Rate</div>
                  </div>
                </div>

                {/* Time Range */}
                <div className={styles.statsTimeRange}>
                  <div className={styles.statsTimeItem}>
                    <Calendar size={12} />
                    <span className={styles.statsTimeLabel}>First used</span>
                    <span className={styles.statsTimeValue}>{timeAgo(stats.firstUsed)}</span>
                  </div>
                  <div className={styles.statsTimeItem}>
                    <Clock size={12} />
                    <span className={styles.statsTimeLabel}>Last used</span>
                    <span className={styles.statsTimeValue}>{timeAgo(stats.lastUsed)}</span>
                  </div>
                  {stats.failureCount > 0 && (
                    <div className={styles.statsTimeItem}>
                      <XCircle size={12} />
                      <span className={styles.statsTimeLabel}>Failures</span>
                      <span className={styles.statsTimeValueDanger}>{stats.failureCount}</span>
                    </div>
                  )}
                </div>

                {/* Top Models / Agents */}
                {(stats.topModels?.length > 0 || stats.topAgents?.length > 0) && (
                  <div className={styles.statsBreakdown}>
                    {stats.topModels?.length > 0 && (
                      <div className={styles.statsBreakdownCol}>
                        <div className={styles.statsBreakdownTitle}>Top Models</div>
                        {stats.topModels.map((m) => (
                          <div key={m.model} className={styles.statsBreakdownRow}>
                            <span className={styles.statsBreakdownName}>{m.model}</span>
                            <span className={styles.statsBreakdownCount}>{m.count}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {stats.topAgents?.length > 0 && (
                      <div className={styles.statsBreakdownCol}>
                        <div className={styles.statsBreakdownTitle}>Top Agents</div>
                        {stats.topAgents.map((a) => (
                          <div key={a.agent} className={styles.statsBreakdownRow}>
                            <span className={styles.statsBreakdownName}>{a.agent}</span>
                            <span className={styles.statsBreakdownCount}>{a.count}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className={styles.statsEmpty}>
                <Activity size={16} />
                No usage data recorded yet
              </div>
            )}
          </div>

          {/* Payload (Input Parameters) */}
          {inputParams.length > 0 && (
            <div className={styles.detailSection}>
              <div className={styles.detailSectionTitle}>
                Payload — Input Parameters ({inputParams.length})
              </div>
              <table className={styles.paramTable}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {inputParams.map(([name, schema]) => (
                    <tr key={name}>
                      <td>
                        <span className={styles.paramName}>{name}</span>
                        {required.has(name) && (
                          <span className={styles.paramRequired}>req</span>
                        )}
                      </td>
                      <td>
                        <span className={styles.paramType}>
                          {schema.type || "any"}
                        </span>
                        {schema.enum && (
                          <div className={styles.paramEnum}>
                            {schema.enum.map((v) => (
                              <span key={v} className={styles.enumValue}>{String(v)}</span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td>{schema.description || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Output Fields */}
          {outputFields && outputFields.length > 0 && (
            <div className={styles.detailSection}>
              <div className={styles.detailSectionTitle}>
                Output — Available Fields ({outputFields.length})
              </div>
              <div className={styles.outputFieldsGrid}>
                {outputFields.map((f) => (
                  <span key={f} className={styles.outputField}>{f}</span>
                ))}
              </div>
            </div>
          )}

          {/* Raw JSON schema (collapsible) */}
          <div className={styles.detailSection}>
            <button
              className={styles.rawToggle}
              onClick={() => setShowRaw(!showRaw)}
            >
              <span className={styles.detailSectionTitle}>Raw Schema</span>
              <span className={styles.rawChevron} data-open={showRaw}>▾</span>
            </button>
            {showRaw && (
              <pre className={styles.jsonBlock}>
                {JSON.stringify(tool, null, 2)}
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Tool Card (Grid view) ────────────────────────────────────────

function ToolCard({ tool, onClick, agents }) {
  const paramCount = countParams(tool);
  return (
    <div className={styles.toolCard} onClick={onClick}>
      <div className={styles.toolCardHeader}>
        <span className={styles.toolName}>{tool.name}</span>
        {tool.domain && (
          <span className={styles.toolDomain}>{tool.domain}</span>
        )}
      </div>
      <div className={styles.toolDescription}>{tool.description}</div>
      <div className={styles.toolMeta}>
        {agents?.length > 0 && (
          <div className={styles.agentBadges}>
            {agents.map((a) => (
              <span
                key={a.id}
                className={styles.agentBadge}
                style={{ "--agent-color": getAgentColor(a.id) }}
                title={`Used by ${a.name}`}
              >
                <Bot size={10} />
                {a.name}
              </span>
            ))}
          </div>
        )}
        {tool.labels?.slice(0, 4).map((l) => (
          <span key={l} className={styles.toolLabel}>{l}</span>
        ))}
        {paramCount > 0 && (
          <span className={styles.paramCount}>
            <Braces /> {paramCount} param{paramCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Tool Row (List view) ─────────────────────────────────────────

function ToolRow({ tool, onClick, agents }) {
  const paramCount = countParams(tool);
  return (
    <div className={styles.toolRow} onClick={onClick}>
      <span className={styles.toolRowName}>{tool.name}</span>
      <span className={styles.toolRowDesc}>{tool.description}</span>
      <div className={styles.toolRowMeta}>
        {agents?.length > 0 && agents.map((a) => (
          <span
            key={a.id}
            className={styles.agentBadge}
            style={{ "--agent-color": getAgentColor(a.id) }}
            title={`Used by ${a.name}`}
          >
            <Bot size={10} />
            {a.name}
          </span>
        ))}
        {tool.domain && (
          <span className={styles.toolDomain}>{tool.domain}</span>
        )}
        {paramCount > 0 && (
          <span className={styles.paramCount}>
            <Braces /> {paramCount}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────

export default function ToolsPageComponent() {
  const [tools, setTools] = useState([]);
  const [agents, setAgents] = useState([]);
  const [toolStats, setToolStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [domainFilter, setDomainFilter] = useState("");
  const [labelFilter, setLabelFilter] = useState("");
  const [agentFilter, setAgentFilter] = useState("");
  const [view, setView] = useState("grid"); // "grid" | "list"

  // Detail modal
  const [selectedTool, setSelectedTool] = useState(null);

  // ── Fetch tools ──────────────────────────────────────────────
  const fetchTools = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [schemas, agentList] = await Promise.all([
        PrismService.getBuiltInToolSchemas(),
        PrismService.getAgentPersonas().catch(() => []),
      ]);
      setTools(schemas || []);
      setAgents(agentList || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Fetch tool usage stats (non-blocking) ────────────────────
  const fetchToolStats = useCallback(async () => {
    try {
      const stats = await PrismService.getToolStats();
      const map = {};
      for (const s of stats || []) {
        map[s.tool] = s;
      }
      setToolStats(map);
    } catch {
      // Non-critical — silently ignore
    }
  }, []);

  useEffect(() => {
    fetchTools();
    fetchToolStats();
  }, [fetchTools, fetchToolStats]);

  // ── Refresh (re-fetch from tools-api) ────────────────────────
  const handleRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await PrismService.refreshBuiltInToolSchemas();
      await fetchTools();
    } catch (err) {
      setError(err.message);
    } finally {
      setRefreshing(false);
    }
  }, [fetchTools]);

  // ── Derived data ─────────────────────────────────────────────
  const allDomains = useMemo(() => extractDomains(tools), [tools]);
  const allLabels = useMemo(() => extractLabels(tools), [tools]);
  const toolAgentMap = useMemo(() => buildToolAgentMap(agents), [agents]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    // Pre-compute agent filter set if active
    const agentToolSet = agentFilter
      ? new Set((agents.find((a) => a.id === agentFilter)?.enabledToolNames) || [])
      : null;
    return tools.filter((t) => {
      if (domainFilter && t.domain !== domainFilter) return false;
      if (labelFilter && !t.labels?.includes(labelFilter)) return false;
      if (agentToolSet && !agentToolSet.has(t.name)) return false;
      if (q) {
        const agentNames = (toolAgentMap[t.name] || []).map((a) => a.name).join(" ");
        const haystack = `${t.name} ${t.description} ${t.domain || ""} ${(t.labels || []).join(" ")} ${agentNames}`.toLowerCase();
        return haystack.includes(q);
      }
      return true;
    });
  }, [tools, search, domainFilter, labelFilter, agentFilter, agents, toolAgentMap]);

  const grouped = useMemo(() => groupByDomain(filtered), [filtered]);

  // ── Render ───────────────────────────────────────────────────

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.loadingSpinner} />
          <span className={styles.loadingText}>Loading tools from Prism…</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>
            <Wrench className={styles.titleIcon} size={22} />
            Tools
          </h1>
          <p className={styles.subtitle}>
            All available tool schemas from the Tools API — used for agentic function calling.
          </p>
        </div>

        <div className={styles.headerRight}>
          {/* Stats */}
          <div className={styles.statsBadges}>
            <div className={styles.statBadge}>
              <span className={styles.statValue}>{tools.length}</span> tools
            </div>
            <div className={styles.statBadge}>
              <span className={styles.statValue}>{allDomains.length}</span> domains
            </div>
            <div className={styles.statBadge}>
              <span className={styles.statValue}>{allLabels.length}</span> labels
            </div>
          </div>

          <button
            className={`${styles.refreshBtn} ${refreshing ? styles.spinning : ""}`}
            onClick={handleRefresh}
            disabled={refreshing}
            title="Re-fetch schemas from tools-api"
          >
            <RefreshCw /> Refresh
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className={styles.error}>
          <AlertCircle />
          {error}
        </div>
      )}

      {/* Filter bar */}
      <div className={styles.filterBar}>
        <div className={styles.searchWrapper}>
          <Search className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            type="text"
            placeholder="Search tools by name, description, or label…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className={styles.domainFilter}
          value={domainFilter}
          onChange={(e) => setDomainFilter(e.target.value)}
        >
          <option value="">All Domains</option>
          {allDomains.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>

        <select
          className={styles.labelFilter}
          value={labelFilter}
          onChange={(e) => setLabelFilter(e.target.value)}
        >
          <option value="">All Labels</option>
          {allLabels.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>

        <select
          className={styles.agentFilterSelect}
          value={agentFilter}
          onChange={(e) => setAgentFilter(e.target.value)}
        >
          <option value="">All Agents</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>{a.name} ({a.toolCount})</option>
          ))}
        </select>

        <div className={styles.viewToggle}>
          <button
            className={`${styles.viewBtn} ${view === "grid" ? styles.viewActive : ""}`}
            onClick={() => setView("grid")}
            title="Grid view"
          >
            <LayoutGrid />
          </button>
          <button
            className={`${styles.viewBtn} ${view === "list" ? styles.viewActive : ""}`}
            onClick={() => setView("list")}
            title="List view"
          >
            <List />
          </button>
        </div>
      </div>

      {/* Tools display */}
      {filtered.length === 0 ? (
        <div className={styles.emptyState}>
          <Search />
          <p>No tools match your filters.</p>
        </div>
      ) : (
        Object.entries(grouped).map(([domain, domainTools]) => {
          const DomainIcon = getDomainIcon(domain);
          return (
            <div key={domain} className={styles.domainSection}>
              <div className={styles.domainHeader}>
                <DomainIcon className={styles.domainIcon} />
                <h2>{domain}</h2>
                <span className={styles.domainCount}>{domainTools.length}</span>
              </div>

              {view === "grid" ? (
                <div className={styles.toolGrid}>
                  {domainTools.map((tool) => (
                    <ToolCard
                      key={tool.name}
                      tool={tool}
                      agents={toolAgentMap[tool.name]}
                      onClick={() => setSelectedTool(tool)}
                    />
                  ))}
                </div>
              ) : (
                <div className={styles.toolList}>
                  {domainTools.map((tool) => (
                    <ToolRow
                      key={tool.name}
                      tool={tool}
                      agents={toolAgentMap[tool.name]}
                      onClick={() => setSelectedTool(tool)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}

      {/* Detail modal */}
      {selectedTool && (
        <ToolDetailModal
          tool={selectedTool}
          agents={toolAgentMap[selectedTool.name]}
          stats={toolStats[selectedTool.name]}
          allTools={tools}
          onClose={() => setSelectedTool(null)}
        />
      )}
    </div>
  );
}

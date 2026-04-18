"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  Plus,
  Trash2,
  Edit3,
  Save,
  X,
  Bot,
  Wrench,
  FolderTree,
  BookOpen,
  Search,
  ChevronRight,
  ChevronDown,
  AlertCircle,
  FolderOpen,
  Globe2,
  TerminalSquare,
  GitBranch,
  MonitorSmartphone,
  Code2,
  CloudSun,
  CalendarDays,
  TrendingUp,
  ShoppingCart,
  BarChart3,
  Film,
  Heart,
  Bus,
  Ship,
  Fuel,
  Radio,
  Cpu,
  Sparkles,
  Layers,
} from "lucide-react";
import PrismService from "../services/PrismService.js";
import ButtonComponent from "./ButtonComponent.js";
import ToggleSwitchComponent from "./ToggleSwitch.js";
import { renderToolName } from "../utils/utilities";
import styles from "./CustomAgentsPanel.module.css";

// ── Domain icon mapping (mirrors CustomToolsPanel) ──────────────
const DOMAIN_ICONS = {
  "Weather & Environment": CloudSun,
  Events: CalendarDays,
  "Markets & Commodities": BarChart3,
  Trends: TrendingUp,
  Products: ShoppingCart,
  Finance: BarChart3,
  Knowledge: BookOpen,
  "Movies & TV": Film,
  Health: Heart,
  Transit: Bus,
  Maritime: Ship,
  Energy: Fuel,
  Compute: Cpu,
  Communication: Radio,
  "Agentic: File Operations": FolderOpen,
  "Agentic: Search & Discovery": Search,
  "Agentic: Web": Globe2,
  "Agentic: Command Execution": TerminalSquare,
  "Agentic: Git": GitBranch,
  "Agentic: Browser": MonitorSmartphone,
  "Agentic: Code Intelligence": Code2,
  Creative: Sparkles,
  Coordinator: Bot,
  Other: Layers,
};

/** Clean display labels for domains (strips 'Agentic: ' prefix) */
const DOMAIN_LABELS = {
  "Agentic: File Operations": "File Operations",
  "Agentic: Search & Discovery": "Search & Discovery",
  "Agentic: Web": "Web",
  "Agentic: Command Execution": "Command Execution",
  "Agentic: Git": "Git",
  "Agentic: Browser": "Browser",
  "Agentic: Code Intelligence": "Code Intelligence",
};

const DOMAIN_ORDER = [
  "Agentic: File Operations",
  "Agentic: Search & Discovery",
  "Agentic: Web",
  "Agentic: Command Execution",
  "Agentic: Git",
  "Agentic: Browser",
  "Agentic: Code Intelligence",
  "Weather & Environment",
  "Events",
  "Markets & Commodities",
  "Trends",
  "Products",
  "Finance",
  "Knowledge",
  "Movies & TV",
  "Health",
  "Compute",
  "Communication",
  "Transit",
  "Maritime",
  "Energy",
  "Creative",
  "Coordinator",
  "Other",
];

const EMPTY_AGENT = {
  name: "",
  description: "",
  project: "coding",
  identity: "",
  guidelines: "",
  toolPolicy: "",
  enabledTools: [],
  usesDirectoryTree: false,
  usesCodingGuidelines: false,
};

// ── Tri-state checkbox: global select-all ───────────────────────
function MasterCheckbox({ enabledCount, totalCount, onToggle, label }) {
  const ref = useRef(null);
  const allChecked = totalCount > 0 && enabledCount === totalCount;
  const partial = enabledCount > 0 && !allChecked;

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = partial;
  }, [partial]);

  return (
    <label className={styles.bulkCheckboxRow}>
      <input
        ref={ref}
        type="checkbox"
        className={styles.toolCheckbox}
        checked={allChecked}
        onChange={onToggle}
      />
      <span className={styles.bulkCheckboxLabel}>{label}</span>
    </label>
  );
}

// ── Tri-state checkbox: per-domain select-all ───────────────────
function DomainCheckbox({ domainEnabled, totalCount, onToggle }) {
  const ref = useRef(null);
  const allChecked = totalCount > 0 && domainEnabled === totalCount;
  const partial = domainEnabled > 0 && !allChecked;

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = partial;
  }, [partial]);

  return (
    <input
      ref={ref}
      type="checkbox"
      className={styles.domainCheckbox}
      checked={allChecked}
      onChange={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      onClick={(e) => e.stopPropagation()}
    />
  );
}

/**
 * CustomAgentsPanel — CRUD interface for user-defined agent personas.
 *
 * @param {Array} agents - Current list of custom agents from the database
 * @param {Function} onAgentsChange - Callback to refresh the agents list
 * @param {Array} availableTools - All built-in tool schemas for the tool picker
 */
export default function CustomAgentsPanel({
  agents = [],
  onAgentsChange,
  availableTools = [],
}) {
  const [editingAgent, setEditingAgent] = useState(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);
  const [toolSearch, setToolSearch] = useState("");
  const [collapsedDomains, setCollapsedDomains] = useState(new Set());
  const [error, setError] = useState(null);

  // ── CRUD ─────────────────────────────────────────────────────

  const handleCreate = useCallback(() => {
    setEditingAgent({ ...EMPTY_AGENT, enabledTools: [] });
    setIsNew(true);
    setError(null);
  }, []);

  const handleEdit = useCallback((agent) => {
    setEditingAgent({
      ...agent,
      enabledTools: agent.enabledTools || [],
    });
    setIsNew(false);
    setError(null);
  }, []);

  const handleCancel = useCallback(() => {
    setEditingAgent(null);
    setIsNew(false);
    setError(null);
  }, []);

  const handleSave = useCallback(async () => {
    if (!editingAgent.name?.trim()) {
      setError("Agent name is required");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (isNew) {
        await PrismService.createCustomAgent(editingAgent);
      } else {
        await PrismService.updateCustomAgent(
          editingAgent._id,
          editingAgent,
        );
      }
      setEditingAgent(null);
      setIsNew(false);
      onAgentsChange?.();
    } catch (err) {
      setError(err.message || "Failed to save agent");
    } finally {
      setSaving(false);
    }
  }, [editingAgent, isNew, onAgentsChange]);

  const handleDelete = useCallback((id) => {
    setConfirmingDeleteId(id);
  }, []);

  const confirmDelete = useCallback(
    async (id) => {
      try {
        await PrismService.deleteCustomAgent(id);
        setConfirmingDeleteId(null);
        onAgentsChange?.();
      } catch (err) {
        console.error("Failed to delete agent:", err);
      }
    },
    [onAgentsChange],
  );

  // ── Tool toggling ────────────────────────────────────────────

  const toggleTool = useCallback((toolName) => {
    setEditingAgent((a) => {
      const tools = a.enabledTools || [];
      const has = tools.includes(toolName);
      return {
        ...a,
        enabledTools: has
          ? tools.filter((t) => t !== toolName)
          : [...tools, toolName],
      };
    });
  }, []);

  const selectAllTools = useCallback(() => {
    setEditingAgent((a) => ({
      ...a,
      enabledTools: availableTools.map((t) => t.name),
    }));
  }, [availableTools]);

  const deselectAllTools = useCallback(() => {
    setEditingAgent((a) => ({
      ...a,
      enabledTools: [],
    }));
  }, []);

  // ── Group tools by domain ────────────────────────────────────

  const query = toolSearch.toLowerCase().trim();

  const filteredTools = useMemo(() => {
    if (!query) return availableTools;
    return availableTools.filter(
      (t) =>
        t.name?.toLowerCase().includes(query) ||
        renderToolName(t.name)?.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query),
    );
  }, [availableTools, query]);

  const groupedTools = useMemo(() => {
    const groups = new Map();
    for (const tool of filteredTools) {
      const domain = tool.domain || "Other";
      if (!groups.has(domain)) groups.set(domain, []);
      groups.get(domain).push(tool);
    }
    const sorted = [];
    for (const domain of DOMAIN_ORDER) {
      if (groups.has(domain)) sorted.push([domain, groups.get(domain)]);
    }
    for (const [domain, tools] of groups) {
      if (!DOMAIN_ORDER.includes(domain)) sorted.push([domain, tools]);
    }
    return sorted;
  }, [filteredTools]);

  const toggleDomain = useCallback((domain) => {
    setCollapsedDomains((prev) => {
      const next = new Set(prev);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      return next;
    });
  }, []);

  // Toggle all tools in a domain
  const toggleDomainTools = useCallback(
    (domainTools) => {
      setEditingAgent((a) => {
        const currentTools = new Set(a.enabledTools || []);
        const domainNames = domainTools.map((t) => t.name);
        const allEnabled = domainNames.every((n) => currentTools.has(n));

        if (allEnabled) {
          // Disable all in domain
          return {
            ...a,
            enabledTools: (a.enabledTools || []).filter(
              (t) => !domainNames.includes(t),
            ),
          };
        } else {
          // Enable all in domain
          const merged = new Set([...(a.enabledTools || []), ...domainNames]);
          return { ...a, enabledTools: [...merged] };
        }
      });
    },
    [],
  );

  // ── Form field updaters ──────────────────────────────────────

  const updateField = useCallback((field, value) => {
    setEditingAgent((a) => ({ ...a, [field]: value }));
  }, []);

  // ── Edit form ────────────────────────────────────────────────

  if (editingAgent) {
    const enabledSet = new Set(editingAgent.enabledTools || []);
    const enabledCount = enabledSet.size;

    return (
      <div className={styles.formOverlay}>
        <div className={styles.formHeader}>
          <h3>{isNew ? "New Agent" : `Edit: ${editingAgent.name}`}</h3>
          <button className={styles.cancelBtn} onClick={handleCancel}>
            <X size={16} />
          </button>
        </div>

        <div className={styles.form}>
          {/* Name + Project */}
          <div className={styles.formRow}>
            <div className={styles.formGroup} style={{ flex: 2 }}>
              <label>Agent Name</label>
              <input
                type="text"
                className={styles.input}
                value={editingAgent.name}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder="My Agent"
              />
              <span className={styles.hint}>
                Display name — will generate ID: CUSTOM_{editingAgent.name
                  ? editingAgent.name.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "")
                  : "..."}
              </span>
            </div>
            <div className={styles.formGroup} style={{ flex: 1 }}>
              <label>Project</label>
              <input
                type="text"
                className={styles.input}
                value={editingAgent.project}
                onChange={(e) => updateField("project", e.target.value)}
                placeholder="coding"
              />
              <span className={styles.hint}>
                Project scope for sessions
              </span>
            </div>
          </div>

          {/* Description */}
          <div className={styles.formGroup}>
            <label>Description</label>
            <input
              type="text"
              className={styles.input}
              value={editingAgent.description}
              onChange={(e) => updateField("description", e.target.value)}
              placeholder="Short description for the agent picker..."
            />
          </div>

          {/* Identity Prompt */}
          <div className={styles.formGroup}>
            <label>Identity Prompt</label>
            <textarea
              className={styles.textarea}
              value={editingAgent.identity}
              onChange={(e) => updateField("identity", e.target.value)}
              placeholder="You are a senior backend engineer specializing in..."
              rows={5}
            />
            <span className={styles.hint}>
              Core personality and role — injected at the top of the system prompt
            </span>
          </div>

          {/* Guidelines */}
          <div className={styles.formGroup}>
            <label>Response Guidelines</label>
            <textarea
              className={styles.textarea}
              value={editingAgent.guidelines}
              onChange={(e) => updateField("guidelines", e.target.value)}
              placeholder="## Guidelines&#10;- Always explain your reasoning...&#10;- Use bullet points for clarity..."
              rows={4}
            />
            <span className={styles.hint}>
              Always injected into the system prompt — behavioral instructions for how the agent should respond
            </span>
          </div>

          {/* Tool Policy */}
          <div className={styles.formGroup}>
            <label>Tool Policy</label>
            <textarea
              className={styles.textarea}
              value={editingAgent.toolPolicy}
              onChange={(e) => updateField("toolPolicy", e.target.value)}
              placeholder="# Tool Usage&#10;- Use read_file before editing...&#10;- Always run tests after changes..."
              rows={4}
            />
            <span className={styles.hint}>
              Instructions for how the agent should use its tools
            </span>
          </div>

          {/* Toggles */}
          <div className={styles.formGroup}>
            <label>Context Injection</label>
            <div className={styles.toggleRow}>
              <div className={styles.toggleLabel}>
                <span className={styles.toggleTitle}>
                  <FolderTree size={12} style={{ marginRight: 4, verticalAlign: -1 }} />
                  Directory Tree
                </span>
                <span className={styles.toggleHint}>
                  Inject workspace file structure into context
                </span>
              </div>
              <ToggleSwitchComponent
                checked={editingAgent.usesDirectoryTree}
                onChange={() =>
                  updateField("usesDirectoryTree", !editingAgent.usesDirectoryTree)
                }
              />
            </div>
            <div className={styles.toggleRow}>
              <div className={styles.toggleLabel}>
                <span className={styles.toggleTitle}>
                  <BookOpen size={12} style={{ marginRight: 4, verticalAlign: -1 }} />
                  Coding Defaults
                </span>
                <span className={styles.toggleHint}>
                  Inject generic coding conventions and coordinator orchestration mode
                </span>
              </div>
              <ToggleSwitchComponent
                checked={editingAgent.usesCodingGuidelines}
                onChange={() =>
                  updateField(
                    "usesCodingGuidelines",
                    !editingAgent.usesCodingGuidelines,
                  )
                }
              />
            </div>
          </div>

          {/* Tool Picker */}
          <div className={styles.toolsSection}>
            <div className={styles.toolsSectionHeader}>
              <label style={{ margin: 0, fontSize: 12, fontWeight: 500, color: "var(--text-secondary)" }}>
                Enabled Tools
              </label>
              <span className={styles.toolsSummary}>
                {enabledCount} / {availableTools.length} selected
              </span>
            </div>

            <div className={styles.toolsListWrapper}>
              {/* Search */}
              <div className={styles.toolsSearch}>
                <input
                  type="text"
                  className={styles.toolsSearchInput}
                  placeholder="Search tools..."
                  value={toolSearch}
                  onChange={(e) => setToolSearch(e.target.value)}
                />
              </div>

              {/* Master select-all checkbox */}
              <MasterCheckbox
                enabledCount={enabledCount}
                totalCount={availableTools.length}
                onToggle={() => {
                  if (enabledCount === availableTools.length) {
                    deselectAllTools();
                  } else {
                    selectAllTools();
                  }
                }}
                label="Select All"
              />

              {/* Domain groups */}
              {groupedTools.map(([domain, tools]) => {
                const DomainIcon = DOMAIN_ICONS[domain] || Layers;
                const label = DOMAIN_LABELS[domain] || domain;
                const collapsed = collapsedDomains.has(domain);
                const domainEnabled = tools.filter((t) =>
                  enabledSet.has(t.name),
                ).length;

                return (
                  <div key={domain} className={styles.domainGroup}>
                    <div
                      className={styles.domainHeader}
                      onClick={() => toggleDomain(domain)}
                    >
                      {collapsed ? (
                        <ChevronRight size={12} />
                      ) : (
                        <ChevronDown size={12} />
                      )}
                      <span className={styles.domainIcon}>
                        <DomainIcon size={12} />
                      </span>
                      {label}
                      <span className={styles.domainCount}>
                        {domainEnabled}/{tools.length}
                      </span>
                      <DomainCheckbox
                        domainEnabled={domainEnabled}
                        totalCount={tools.length}
                        onToggle={() => toggleDomainTools(tools)}
                      />
                    </div>

                    {!collapsed &&
                      tools.map((tool) => (
                        <label key={tool.name} className={styles.toolRow}>
                          <input
                            type="checkbox"
                            className={styles.toolCheckbox}
                            checked={enabledSet.has(tool.name)}
                            onChange={() => toggleTool(tool.name)}
                          />
                          <span className={styles.toolName}>
                            {renderToolName(tool.name)}
                          </span>
                        </label>
                      ))}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--error)", fontSize: 12 }}>
              <AlertCircle size={14} />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.formFooter}>
          <ButtonComponent
            variant="ghost"
            size="sm"
            onClick={handleCancel}
          >
            Cancel
          </ButtonComponent>
          <ButtonComponent
            variant="primary"
            size="sm"
            icon={Save}
            onClick={handleSave}
            disabled={saving || !editingAgent.name?.trim()}
          >
            {saving ? "Saving…" : isNew ? "Create Agent" : "Save Changes"}
          </ButtonComponent>
        </div>
      </div>
    );
  }

  // ── Agent list view ──────────────────────────────────────────

  return (
    <div className={styles.container}>
      {agents.length > 0 && (
        <div className={styles.panelHeader}>
          <ButtonComponent
            variant="ghost"
            size="sm"
            icon={Plus}
            onClick={handleCreate}
          >
            New Agent
          </ButtonComponent>
        </div>
      )}

      {agents.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <Bot size={24} />
          </div>
          <span className={styles.emptyTitle}>No custom agents yet</span>
          <span className={styles.emptyHint}>
            Create your own agent persona with a custom system prompt and
            hand-picked tools from the full tool suite.
          </span>
          <ButtonComponent
            variant="primary"
            size="sm"
            icon={Plus}
            onClick={handleCreate}
          >
            Create Agent
          </ButtonComponent>
        </div>
      ) : (
        <div className={styles.agentList}>
          {agents.map((agent) => {
            const isConfirming = confirmingDeleteId === agent._id;

            return (
              <div key={agent._id} className={styles.agentCard}>
                <div className={styles.agentIcon}>
                  <Bot size={16} />
                </div>
                <div className={styles.agentInfo}>
                  <span className={styles.agentName}>{agent.name}</span>
                  {agent.description && (
                    <span className={styles.agentDesc}>
                      {agent.description}
                    </span>
                  )}
                  <div className={styles.agentMeta}>
                    <span className={styles.agentBadge}>
                      <Wrench size={9} />
                      {agent.enabledTools?.length || 0} tools
                    </span>
                    <span className={styles.agentBadge}>
                      {agent.agentId}
                    </span>
                  </div>
                </div>

                <div className={styles.agentActions}>
                  {isConfirming ? (
                    <div className={styles.confirmRow}>
                      <span className={styles.confirmText}>Delete?</span>
                      <ButtonComponent
                        variant="danger"
                        size="xs"
                        onClick={() => confirmDelete(agent._id)}
                      >
                        Yes
                      </ButtonComponent>
                      <ButtonComponent
                        variant="ghost"
                        size="xs"
                        onClick={() => setConfirmingDeleteId(null)}
                      >
                        No
                      </ButtonComponent>
                    </div>
                  ) : (
                    <>
                      <button
                        className={styles.actionBtn}
                        onClick={() => handleEdit(agent)}
                        title="Edit"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                        onClick={() => handleDelete(agent._id)}
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

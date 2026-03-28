"use client";

import { useState, useCallback, useMemo } from "react";
import {
  Plus,
  Trash2,
  Edit3,
  Save,
  X,
  ChevronDown,
  ChevronRight,
  Globe,
  Cpu,
  Shield,
} from "lucide-react";
import PrismService from "../services/PrismService.js";
import ButtonComponent from "./ButtonComponent.js";
import ToggleSwitchComponent from "./ToggleSwitch.js";
import SearchInputComponent from "./SearchInputComponent.js";
import { renderToolName } from "../utils/utilities";
import styles from "./CustomToolsPanel.module.css";

const PROJECT = "retina-console";

const PARAM_TYPES = [
  { value: "string", label: "String" },
  { value: "number", label: "Number" },
  { value: "integer", label: "Integer" },
  { value: "boolean", label: "Boolean" },
];

const HTTP_METHODS = [
  { value: "GET", label: "GET" },
  { value: "POST", label: "POST" },
];

const EMPTY_PARAM = {
  name: "",
  type: "string",
  description: "",
  required: false,
  enum: "",
};

const EMPTY_TOOL = {
  name: "",
  description: "",
  endpoint: "",
  method: "GET",
  bearerToken: "",
  parameters: [],
  enabled: true,
};

export default function CustomToolsPanel({
  tools,
  onToolsChange,
  builtInTools = [],
  disabledBuiltIns = new Set(),
  onToggleBuiltIn,
  onToggleAllBuiltIn,
  offlineTools = new Set(),
}) {
  const [editingTool, setEditingTool] = useState(null);
  const [isNew, setIsNew] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [builtInOpen, setBuiltInOpen] = useState(true);
  const [customOpen, setCustomOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);

  // ── CRUD ─────────────────────────────────────────────────────

  const handleCreate = useCallback(() => {
    setEditingTool({ ...EMPTY_TOOL, parameters: [] });
    setIsNew(true);
  }, []);

  const handleEdit = useCallback((tool) => {
    setEditingTool({
      ...tool,
      parameters: (tool.parameters || []).map((p) => ({
        ...p,
        enum: Array.isArray(p.enum) ? p.enum.join(", ") : p.enum || "",
      })),
    });
    setIsNew(false);
  }, []);

  const handleCancel = useCallback(() => {
    setEditingTool(null);
    setIsNew(false);
  }, []);

  const handleSave = useCallback(async () => {
    if (!editingTool.name || !editingTool.endpoint) return;
    setSaving(true);
    try {
      const payload = {
        ...editingTool,
        project: PROJECT,
        parameters: editingTool.parameters
          .map((p) => ({
            name: p.name,
            type: p.type,
            description: p.description,
            required: p.required,
            ...(p.enum?.trim()
              ? {
                  enum: p.enum
                    .split(",")
                    .map((v) => v.trim())
                    .filter(Boolean),
                }
              : {}),
          }))
          .filter((p) => p.name.trim()),
      };

      if (isNew) {
        await PrismService.createCustomTool(payload);
      } else {
        await PrismService.updateCustomTool(
          editingTool.id || editingTool._id,
          payload,
        );
      }

      setEditingTool(null);
      setIsNew(false);
      onToolsChange();
    } catch (err) {
      console.error("Failed to save tool:", err);
    } finally {
      setSaving(false);
    }
  }, [editingTool, isNew, onToolsChange]);

  const handleDelete = useCallback((id) => {
    setConfirmingDeleteId(id);
  }, []);

  const confirmDelete = useCallback(
    async (id) => {
      try {
        await PrismService.deleteCustomTool(id);
        setConfirmingDeleteId(null);
        onToolsChange();
      } catch (err) {
        console.error("Failed to delete tool:", err);
      }
    },
    [onToolsChange],
  );

  const handleToggle = useCallback(
    async (tool) => {
      try {
        await PrismService.updateCustomTool(tool.id || tool._id, {
          enabled: !tool.enabled,
        });
        onToolsChange();
      } catch (err) {
        console.error("Failed to toggle tool:", err);
      }
    },
    [onToolsChange],
  );

  // ── Parameter management ─────────────────────────────────────

  const addParameter = useCallback(() => {
    setEditingTool((t) => ({
      ...t,
      parameters: [...t.parameters, { ...EMPTY_PARAM }],
    }));
  }, []);

  const updateParameter = useCallback((index, field, value) => {
    setEditingTool((t) => ({
      ...t,
      parameters: t.parameters.map((p, i) =>
        i === index ? { ...p, [field]: value } : p,
      ),
    }));
  }, []);

  const removeParameter = useCallback((index) => {
    setEditingTool((t) => ({
      ...t,
      parameters: t.parameters.filter((_, i) => i !== index),
    }));
  }, []);

  // ── Tool list ────────────────────────────────────────────────

  const enabledBuiltIn = builtInTools.length - disabledBuiltIns.size;

  // ── Search filtering ────────────────────────────────────────
  const query = searchQuery.toLowerCase().trim();

  const filteredCustomTools = useMemo(() => {
    if (!query) return tools;
    return tools.filter(
      (t) =>
        t.name?.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query),
    );
  }, [tools, query]);

  const filteredBuiltInTools = useMemo(() => {
    if (!query) return builtInTools;
    return builtInTools.filter(
      (t) =>
        t.name?.toLowerCase().includes(query) ||
        renderToolName(t.name)?.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query),
    );
  }, [builtInTools, query]);

  // ── Toggle-all states ───────────────────────────────────────
  const onlineBuiltInTools = builtInTools.filter(
    (t) => !offlineTools.has(t.name),
  );
  const allBuiltInEnabled =
    onlineBuiltInTools.length > 0 &&
    onlineBuiltInTools.every((t) => !disabledBuiltIns.has(t.name));

  const enabledCustomCount = tools.filter((t) => t.enabled).length;
  const allCustomEnabled =
    tools.length > 0 && enabledCustomCount === tools.length;

  const handleToggleAllCustom = useCallback(async () => {
    const newEnabled = !allCustomEnabled;
    try {
      await Promise.all(
        tools.map((t) =>
          PrismService.updateCustomTool(t.id || t._id, {
            enabled: newEnabled,
          }),
        ),
      );
      onToolsChange();
    } catch (err) {
      console.error("Failed to toggle all custom tools:", err);
    }
  }, [allCustomEnabled, tools, onToolsChange]);

  // ── Edit form ────────────────────────────────────────────────

  if (editingTool) {
    return (
      <div className={styles.container}>
        <div className={styles.formHeader}>
          <h3>{isNew ? "New Tool" : "Edit Tool"}</h3>
          <button className={styles.cancelBtn} onClick={handleCancel}>
            <X size={16} />
          </button>
        </div>

        <div className={styles.form}>
          <div className={styles.formGroup}>
            <label>Function Name</label>
            <input
              type="text"
              className={styles.input}
              value={editingTool.name}
              onChange={(e) =>
                setEditingTool((t) => ({
                  ...t,
                  name: e.target.value
                    .replace(/[^a-zA-Z0-9_]/g, "_")
                    .toLowerCase(),
                }))
              }
              placeholder="get_stock_price"
            />
            <span className={styles.hint}>
              snake_case — this is what the AI calls
            </span>
          </div>

          <div className={styles.formGroup}>
            <label>Description</label>
            <textarea
              className={styles.textarea}
              value={editingTool.description}
              onChange={(e) =>
                setEditingTool((t) => ({ ...t, description: e.target.value }))
              }
              placeholder="Get current stock price for a given ticker symbol..."
              rows={3}
            />
            <span className={styles.hint}>
              Tell the AI when to use this tool
            </span>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup} style={{ flex: 1 }}>
              <label>Endpoint URL</label>
              <input
                type="text"
                className={styles.input}
                value={editingTool.endpoint}
                onChange={(e) =>
                  setEditingTool((t) => ({ ...t, endpoint: e.target.value }))
                }
                placeholder="http://localhost:3000/api/stock"
              />
            </div>
            <div className={styles.formGroup} style={{ width: 100 }}>
              <label>Method</label>
              <select
                className={styles.select}
                value={editingTool.method}
                onChange={(e) =>
                  setEditingTool((t) => ({ ...t, method: e.target.value }))
                }
              >
                {HTTP_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label>
              <Shield size={12} style={{ marginRight: 4, verticalAlign: -1 }} />
              Bearer Token
              <span className={styles.optional}> (optional)</span>
            </label>
            <input
              type="password"
              className={styles.input}
              value={editingTool.bearerToken || ""}
              onChange={(e) =>
                setEditingTool((t) => ({ ...t, bearerToken: e.target.value }))
              }
              placeholder="sk-... or token value"
              autoComplete="off"
            />
            <span className={styles.hint}>
              Sent as Authorization: Bearer &lt;token&gt;
            </span>
          </div>

          {/* Parameters */}
          <div className={styles.paramsSection}>
            <div className={styles.paramsSectionHeader}>
              <label>Parameters</label>
              <button className={styles.addParamBtn} onClick={addParameter}>
                <Plus size={12} /> Add
              </button>
            </div>

            {editingTool.parameters.length === 0 && (
              <div className={styles.paramsEmpty}>
                No parameters — tool will be called without arguments.
              </div>
            )}

            {editingTool.parameters.map((param, i) => (
              <div key={i} className={styles.paramCard}>
                <div className={styles.paramCardHeader}>
                  <span className={styles.paramIndex}>#{i + 1}</span>
                  <button
                    className={styles.paramRemoveBtn}
                    onClick={() => removeParameter(i)}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>

                <div className={styles.paramFields}>
                  <div className={styles.paramRow}>
                    <div className={styles.paramField}>
                      <label>Name</label>
                      <input
                        type="text"
                        className={styles.inputSmall}
                        value={param.name}
                        onChange={(e) =>
                          updateParameter(i, "name", e.target.value)
                        }
                        placeholder="symbol"
                      />
                    </div>
                    <div className={styles.paramField} style={{ width: 100 }}>
                      <label>Type</label>
                      <select
                        className={styles.selectSmall}
                        value={param.type}
                        onChange={(e) =>
                          updateParameter(i, "type", e.target.value)
                        }
                      >
                        {PARAM_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className={styles.paramFieldToggle}>
                      <label>Req</label>
                      <ToggleSwitchComponent
                        checked={param.required}
                        onChange={(v) => updateParameter(i, "required", v)}
                        size="small"
                      />
                    </div>
                  </div>

                  <div className={styles.paramField}>
                    <label>Description</label>
                    <input
                      type="text"
                      className={styles.inputSmall}
                      value={param.description}
                      onChange={(e) =>
                        updateParameter(i, "description", e.target.value)
                      }
                      placeholder="Stock ticker symbol (e.g. AAPL)"
                    />
                  </div>

                  <div className={styles.paramField}>
                    <label>
                      Enum values{" "}
                      <span className={styles.optional}>
                        (comma-separated, optional)
                      </span>
                    </label>
                    <input
                      type="text"
                      className={styles.inputSmall}
                      value={param.enum}
                      onChange={(e) =>
                        updateParameter(i, "enum", e.target.value)
                      }
                      placeholder="1d, 5d, 1m, 3m, 1y"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            className={styles.saveBtn}
            onClick={handleSave}
            disabled={!editingTool.name || !editingTool.endpoint || saving}
          >
            <Save size={14} />
            {saving ? "Saving..." : isNew ? "Create Tool" : "Save Changes"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* ── Search ── */}
      <SearchInputComponent
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Filter tools…"
        className={styles.searchBar}
      />

      {/* ── Custom tools ── */}
      <div
        className={styles.sectionHeader}
        onClick={() => setCustomOpen((v) => !v)}
      >
        {customOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <Globe size={12} />
        <span>
          Custom ({enabledCustomCount}/{tools.length})
        </span>
        <div
          className={styles.sectionActions}
          onClick={(e) => e.stopPropagation()}
        >
          {tools.length > 0 && (
            <ToggleSwitchComponent
              checked={allCustomEnabled}
              onChange={() => handleToggleAllCustom()}
              size="small"
            />
          )}
          <ButtonComponent
            variant="primary"
            size="xs"
            icon={Plus}
            onClick={handleCreate}
          >
            New Tool
          </ButtonComponent>
        </div>
      </div>

      {customOpen && filteredCustomTools.length === 0 && tools.length === 0 && (
        <div className={styles.emptyCustom}>
          Create a tool to connect any API.
        </div>
      )}

      {customOpen &&
        filteredCustomTools.length === 0 &&
        tools.length > 0 &&
        query && (
          <div className={styles.emptyCustom}>
            No custom tools match &ldquo;{searchQuery}&rdquo;
          </div>
        )}

      {customOpen &&
        filteredCustomTools.map((tool) => {
          const id = tool.id || tool._id;
          const isExpanded = expandedId === id;
          return (
            <div
              key={id}
              className={`${styles.toolCard} ${!tool.enabled ? styles.toolDisabled : ""}`}
            >
              <div
                className={styles.toolCardHeader}
                onClick={() => setExpandedId(isExpanded ? null : id)}
              >
                <button className={styles.expandBtn}>
                  {isExpanded ? (
                    <ChevronDown size={14} />
                  ) : (
                    <ChevronRight size={14} />
                  )}
                </button>
                <div className={styles.toolCardInfo}>
                  <span className={styles.toolCardName}>{tool.name}</span>
                  <span className={styles.toolCardMeta}>
                    <span
                      className={styles.methodBadge}
                      data-method={tool.method}
                    >
                      {tool.method}
                    </span>
                    {tool.parameters?.length > 0 && (
                      <span>{tool.parameters.length} params</span>
                    )}
                  </span>
                </div>
                <div className={styles.toolCardActions}>
                  <ToggleSwitchComponent
                    checked={tool.enabled}
                    onChange={() => handleToggle(tool)}
                    size="small"
                  />
                </div>
              </div>

              {isExpanded && (
                <div className={styles.toolCardBody}>
                  <p className={styles.toolCardDesc}>
                    {tool.description || "No description"}
                  </p>
                  <div className={styles.toolCardEndpoint}>
                    <Globe size={11} />
                    <code>{tool.endpoint}</code>
                  </div>
                  {tool.bearerToken && (
                    <div className={styles.toolCardEndpoint}>
                      <Shield size={11} />
                      <span style={{ opacity: 0.6 }}>
                        Bearer token configured
                      </span>
                    </div>
                  )}
                  {tool.parameters?.length > 0 && (
                    <div className={styles.toolCardParams}>
                      {tool.parameters.map((p, i) => (
                        <div key={i} className={styles.toolCardParam}>
                          <code>{p.name}</code>
                          <span className={styles.paramType}>{p.type}</span>
                          {p.required && (
                            <span className={styles.paramRequired}>
                              required
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className={styles.toolCardFooter}>
                    <ButtonComponent
                      variant="secondary"
                      size="xs"
                      icon={Edit3}
                      onClick={() => handleEdit(tool)}
                    >
                      Edit
                    </ButtonComponent>
                    {confirmingDeleteId === id ? (
                      <div className={styles.deleteConfirm}>
                        <span className={styles.deleteConfirmLabel}>
                          Delete?
                        </span>
                        <ButtonComponent
                          variant="danger"
                          size="xs"
                          onClick={() => confirmDelete(id)}
                        >
                          Yes
                        </ButtonComponent>
                        <ButtonComponent
                          variant="secondary"
                          size="xs"
                          onClick={() => setConfirmingDeleteId(null)}
                        >
                          No
                        </ButtonComponent>
                      </div>
                    ) : (
                      <ButtonComponent
                        variant="danger"
                        size="xs"
                        icon={Trash2}
                        onClick={() => handleDelete(id)}
                      >
                        Delete
                      </ButtonComponent>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

      {/* ── Built-in tools ── */}
      <div
        className={styles.sectionHeader}
        style={{ marginTop: 12 }}
        onClick={() => setBuiltInOpen((v) => !v)}
      >
        {builtInOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <Cpu size={12} />
        <span>
          Built-in ({enabledBuiltIn}/{builtInTools.length})
        </span>
        {onlineBuiltInTools.length > 0 && (
          <div
            className={styles.sectionActions}
            onClick={(e) => e.stopPropagation()}
          >
            <ToggleSwitchComponent
              checked={allBuiltInEnabled}
              onChange={() => onToggleAllBuiltIn?.(!allBuiltInEnabled)}
              size="small"
            />
          </div>
        )}
      </div>

      {builtInOpen && filteredBuiltInTools.length === 0 && query && (
        <div className={styles.emptyCustom}>
          No built-in tools match &ldquo;{searchQuery}&rdquo;
        </div>
      )}

      {builtInOpen &&
        filteredBuiltInTools.map((tool) => {
          const isDisabled = disabledBuiltIns.has(tool.name);
          const isOffline = offlineTools.has(tool.name);
          const isExpanded = expandedId === `builtin-${tool.name}`;
          const paramCount = Object.keys(
            tool.parameters?.properties || {},
          ).length;

          return (
            <div
              key={`builtin-${tool.name}`}
              className={`${styles.toolCard} ${styles.builtInCard} ${isOffline ? styles.offlineCard : ""} ${isDisabled ? styles.toolDisabled : ""}`}
            >
              <div
                className={styles.toolCardHeader}
                onClick={() =>
                  setExpandedId(isExpanded ? null : `builtin-${tool.name}`)
                }
              >
                <button className={styles.expandBtn}>
                  {isExpanded ? (
                    <ChevronDown size={14} />
                  ) : (
                    <ChevronRight size={14} />
                  )}
                </button>
                <div className={styles.toolCardInfo}>
                  <span className={styles.toolCardName}>
                    {renderToolName(tool.name)}
                  </span>
                  <span className={styles.toolCardMeta}>
                    {isOffline ? (
                      <span className={styles.offlineBadge}>Offline</span>
                    ) : (
                      <span className={styles.builtInBadge}>Built-in</span>
                    )}
                    {paramCount > 0 && <span>{paramCount} params</span>}
                  </span>
                </div>
                <div className={styles.toolCardActions}>
                  <ToggleSwitchComponent
                    checked={!isDisabled}
                    onChange={() => onToggleBuiltIn?.(tool.name)}
                    size="small"
                    disabled={isOffline}
                  />
                </div>
              </div>

              {isExpanded && (
                <div className={styles.toolCardBody}>
                  <p className={styles.toolCardDesc}>{tool.description}</p>
                  {paramCount > 0 && (
                    <div className={styles.toolCardParams}>
                      {Object.entries(tool.parameters.properties).map(
                        ([name, schema]) => (
                          <div key={name} className={styles.toolCardParam}>
                            <code>{name}</code>
                            <span className={styles.paramType}>
                              {schema.type}
                            </span>
                            {tool.parameters.required?.includes(name) && (
                              <span className={styles.paramRequired}>
                                required
                              </span>
                            )}
                          </div>
                        ),
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
}

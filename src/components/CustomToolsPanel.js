"use client";

import { useState, useCallback, useRef } from "react";
import {
  Plus,
  Trash2,
  Edit3,
  Save,
  X,
  Upload,
  FileText,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Globe,
  Shield,
} from "lucide-react";
import PrismService from "../services/PrismService.js";
import ButtonComponent from "./ButtonComponent.js";
import ToggleSwitchComponent from "./ToggleSwitch.js";
import TextAreaComponent from "./TextAreaComponent.js";
import ToolSelectionComponent from "./ToolSelectionComponent";
import styles from "./CustomToolsPanel.module.css";

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
  project,
  builtInTools = [],
  disabledBuiltIns = new Set(),
  onToggleBuiltIn,
  agent = true,
}) {
  const [editingTool, setEditingTool] = useState(null);
  const [isNew, setIsNew] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [customOpen, setCustomOpen] = useState(true);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);
  const [inputMode, setInputMode] = useState("manual"); // "manual" | "json"
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState(null);
  const [jsonSuccess, setJsonSuccess] = useState(null);
  const fileInputRef = useRef(null);

  // ── CRUD ─────────────────────────────────────────────────────

  const handleCreate = useCallback(() => {
    setEditingTool({ ...EMPTY_TOOL, parameters: [] });
    setIsNew(true);
    setInputMode("manual");
    setJsonText("");
    setJsonError(null);
    setJsonSuccess(null);
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
    setInputMode("manual");
    setJsonText("");
    setJsonError(null);
    setJsonSuccess(null);
  }, []);

  const handleCancel = useCallback(() => {
    setEditingTool(null);
    setIsNew(false);
    setInputMode("manual");
    setJsonText("");
    setJsonError(null);
    setJsonSuccess(null);
  }, []);

  const handleSave = useCallback(async () => {
    if (!editingTool.name || !editingTool.endpoint) return;
    setSaving(true);
    try {
      const payload = {
        ...editingTool,
        ...(project ? { project } : {}),
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
  }, [editingTool, isNew, onToolsChange, project]);

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

  // ── JSON import ──────────────────────────────────────────────

  /**
   * Parse a pasted/uploaded JSON in any of these OpenAI-compatible shapes:
   *  1. Full tool definition:  { type: "function", function: { name, description, parameters } }
   *  2. Function wrapper:      { name, description, parameters: { type: "object", properties } }
   *  3. Raw parameters object: { type: "object", properties: { ... } }
   *  4. Array of tools:        [ { type: "function", function: ... }, ... ]  (uses first)
   */
  const parseJsonDefinition = useCallback(
    (raw) => {
      setJsonError(null);
      setJsonSuccess(null);

      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        setJsonError("Invalid JSON — check syntax");
        return;
      }

      // Unwrap array → first element
      if (Array.isArray(parsed)) {
        if (parsed.length === 0) {
          setJsonError("Empty array — provide at least one tool definition");
          return;
        }
        parsed = parsed[0];
      }

      let name = "";
      let description = "";
      let parametersObj = null;

      // Shape 1: { type: "function", function: { ... } }
      if (parsed.type === "function" && parsed.function) {
        const fn = parsed.function;
        name = fn.name || "";
        description = fn.description || "";
        parametersObj = fn.parameters || null;
      }
      // Shape 2: { name, parameters: { type: "object", properties } }
      else if (parsed.name && parsed.parameters?.properties) {
        name = parsed.name;
        description = parsed.description || "";
        parametersObj = parsed.parameters;
      }
      // Shape 3: Raw parameters { type: "object", properties }
      else if (parsed.type === "object" && parsed.properties) {
        parametersObj = parsed;
      } else {
        setJsonError(
          'Unrecognized shape — expected an OpenAI tool definition, a {name, parameters} object, or a raw {type:"object", properties} schema',
        );
        return;
      }

      // Convert parametersObj → flat parameter list
      const params = [];
      if (parametersObj?.properties) {
        const required = parametersObj.required || [];
        for (const [pName, schema] of Object.entries(
          parametersObj.properties,
        )) {
          params.push({
            name: pName,
            type: schema.type || "string",
            description: schema.description || "",
            required: required.includes(pName),
            enum: Array.isArray(schema.enum) ? schema.enum.join(", ") : "",
          });
        }
      }

      setEditingTool((t) => ({
        ...t,
        ...(name ? { name: name.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase() } : {}),
        ...(description ? { description } : {}),
        parameters: params,
      }));

      const parts = [];
      if (name) parts.push("name");
      if (description) parts.push("description");
      parts.push(`${params.length} parameter${params.length !== 1 ? "s" : ""}`);
      setJsonSuccess(`Imported ${parts.join(", ")}`);
    },
    [],
  );

  const handleJsonFileUpload = useCallback(
    (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target.result;
        setJsonText(text);
        parseJsonDefinition(text);
      };
      reader.readAsText(file);
      // Reset so re-uploading the same file triggers onChange
      e.target.value = "";
    },
    [parseJsonDefinition],
  );

  // ── Tool list ────────────────────────────────────────────────

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
            <TextAreaComponent
              className={styles.textarea}
              value={editingTool.description}
              onChange={(e) =>
                setEditingTool((t) => ({ ...t, description: e.target.value }))
              }
              placeholder="Get current stock price for a given ticker symbol..."
              minRows={3}
              maxRows={8}
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
              <div className={styles.paramsModeToggle}>
                <button
                  className={`${styles.modeBtn} ${inputMode === "manual" ? styles.modeBtnActive : ""}`}
                  onClick={() => setInputMode("manual")}
                >
                  Manual
                </button>
                <button
                  className={`${styles.modeBtn} ${inputMode === "json" ? styles.modeBtnActive : ""}`}
                  onClick={() => setInputMode("json")}
                >
                  <FileText size={10} />
                  JSON
                </button>
              </div>
              {inputMode === "manual" && (
                <button className={styles.addParamBtn} onClick={addParameter}>
                  <Plus size={12} /> Add
                </button>
              )}
            </div>

            {inputMode === "manual" && (
              <>
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
                            size="mini"
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
              </>
            )}

            {inputMode === "json" && (
              <div className={styles.jsonImportSection}>
                <div className={styles.jsonImportHint}>
                  Paste an OpenAI-style tool definition, a function schema, or
                  a raw parameters object. Name, description, and parameters
                  will be auto-populated.
                </div>
                <TextAreaComponent
                  className={`${styles.textarea} ${styles.jsonTextarea}`}
                  value={jsonText}
                  onChange={(e) => {
                    setJsonText(e.target.value);
                    setJsonError(null);
                    setJsonSuccess(null);
                  }}
                  placeholder={`{\n  "type": "function",\n  "function": {\n    "name": "get_weather",\n    "description": "Get current weather",\n    "parameters": {\n      "type": "object",\n      "properties": {\n        "location": {\n          "type": "string",\n          "description": "City name"\n        }\n      },\n      "required": ["location"]\n    }\n  }\n}`}
                  minRows={10}
                  maxRows={20}
                  autoResize={false}
                  spellCheck={false}
                />
                <div className={styles.jsonActions}>
                  <button
                    className={styles.jsonParseBtn}
                    onClick={() => parseJsonDefinition(jsonText)}
                    disabled={!jsonText.trim()}
                  >
                    <CheckCircle size={12} />
                    Apply JSON
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,application/json"
                    style={{ display: "none" }}
                    onChange={handleJsonFileUpload}
                  />
                  <button
                    className={styles.jsonUploadBtn}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload size={12} />
                    Upload .json
                  </button>
                </div>
                {jsonError && (
                  <div className={styles.jsonFeedback} data-type="error">
                    <AlertCircle size={12} />
                    {jsonError}
                  </div>
                )}
                {jsonSuccess && (
                  <div className={styles.jsonFeedback} data-type="success">
                    <CheckCircle size={12} />
                    {jsonSuccess}
                  </div>
                )}
              </div>
            )}
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

  // ── Non-agent view: lightweight ToolSelectionComponent only ──
  if (!agent) {
    const derivedEnabled = builtInTools
      .filter((t) => !disabledBuiltIns.has(t.name))
      .map((t) => t.name);

    return (
      <ToolSelectionComponent
        availableTools={builtInTools}
        enabledTools={derivedEnabled}
        onEnabledToolsChange={(newEnabled) => {
          const enabledSet = new Set(newEnabled);
          for (const tool of builtInTools) {
            const isDisabled = disabledBuiltIns.has(tool.name);
            const shouldBeEnabled = enabledSet.has(tool.name);
            if (isDisabled && shouldBeEnabled) onToggleBuiltIn?.(tool.name);
            else if (!isDisabled && !shouldBeEnabled) onToggleBuiltIn?.(tool.name);
          }
        }}
      />
    );
  }

  // ── Derive enabled tools from disabledBuiltIns for ToolSelectionComponent ──
  const derivedEnabled = builtInTools
    .filter((t) => !disabledBuiltIns.has(t.name))
    .map((t) => t.name);

  const handleSelectionChange = (newEnabled) => {
    const enabledSet = new Set(newEnabled);
    for (const tool of builtInTools) {
      const isDisabled = disabledBuiltIns.has(tool.name);
      const shouldBeEnabled = enabledSet.has(tool.name);
      if (isDisabled && shouldBeEnabled) onToggleBuiltIn?.(tool.name);
      else if (!isDisabled && !shouldBeEnabled) onToggleBuiltIn?.(tool.name);
    }
  };

  return (
    <div className={styles.container}>
      {/* ── Built-in tools via ToolSelectionComponent ── */}
      <ToolSelectionComponent
        availableTools={builtInTools}
        enabledTools={derivedEnabled}
        onEnabledToolsChange={handleSelectionChange}
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
              size="mini"
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

      {customOpen && tools.length === 0 && (
        <div className={styles.emptyCustom}>
          Create a tool to connect any API.
        </div>
      )}

      {customOpen &&
        tools.map((tool) => {
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
                    size="mini"
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
                          variant="destructive"
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
                        variant="destructive"
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
    </div>
  );
}


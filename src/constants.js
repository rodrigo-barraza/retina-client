/**
 * constants.js — Centralized constants for the Retina app.
 *
 * All localStorage key strings live here so they're discoverable,
 * searchable, and impossible to silently misspell.
 *
 * Keys used via StorageService are automatically prefixed with "retina:"
 * by the service itself — these constants hold the *un-prefixed* key.
 *
 * Keys used via raw localStorage are stored exactly as-is — these
 * constants hold the full key string.
 */

// ── StorageService keys (auto-prefixed "retina:<key>") ───────────
export const SK_THEME = "theme";
export const SK_LAST_PROVIDER = "lastProvider";
export const SK_LAST_MODEL = "lastModel";
export const SK_INFERENCE_MODE = "inferenceMode";

// ── Page-scoped model memory keys (auto-prefixed "retina:<key>") ──
// Each page remembers the last-used model independently.
// Value shape: { provider, model, isLocal }
export const SK_MODEL_MEMORY_AGENT = "modelMemory:agent";
export const SK_MODEL_MEMORY_CONVERSATIONS = "modelMemory:conversations";
export const SK_MODEL_MEMORY_SYNTHESIS = "modelMemory:synthesis";
export const SK_MODEL_MEMORY_BENCHMARKS = "modelMemory:benchmarks";

// ── Page-scoped tool toggle memory keys (auto-prefixed "retina:<key>") ──
// Each page remembers which tools are toggled on/off.
// Value shape: { disabledBuiltIns: string[], toolToggles: { key: boolean } }
export const SK_TOOL_MEMORY_AGENT = "toolMemory:agent";
export const SK_TOOL_MEMORY_CONVERSATIONS = "toolMemory:conversations";
export const SK_TOOL_MEMORY_SYNTHESIS = "toolMemory:synthesis";
export const SK_TOOL_MEMORY_BENCHMARKS = "toolMemory:benchmarks";

// ── Application constants ────────────────────────────────────────
export const MAX_TOOL_ITERATIONS = 25;
export const PROJECT_AGENT = "retina-agent";

// ── Raw localStorage keys (no namespace prefix) ─────────────────
export const LS_PANEL_LEFT = "panel_left";
export const LS_PANEL_RIGHT = "panel_right";
export const LS_PANEL_NAV = "panel_nav";
export const LS_SYSTEM_INSTRUCTIONS = "retina_system_instructions";
export const LS_WORKFLOW_INSPECTOR_WIDTH = "workflow-inspector-width";
export const LS_WORKFLOW_EXPANDED_NODES = "workflow-expanded-nodes";
export const LS_WORKFLOW_VIEWS = "workflow-views";
export const LS_ADMIN_PROJECT_FILTER = "admin:projectFilter";
export const LS_DATE_RANGE = "retina-date-range";

// ── Settings defaults (shared by HomePage, Agent, admin) ──────
export const SETTINGS_DEFAULTS = {
  provider: "",
  model: "",
  systemPrompt: "",
  temperature: 1.0,
  maxTokens: 2048,
  topP: 1,
  topK: 0,
  frequencyPenalty: 0,
  presencePenalty: 0,
  stopSequences: "",
  thinkingEnabled: false,
  reasoningEffort: "high",
  thinkingLevel: "high",
  thinkingBudget: "",
  webSearchEnabled: false,
  verbosity: "",
  reasoningSummary: "",
};

// ── Chart / UI color palette ─────────────────────────────────────
/** Cycled by row index for provider charts, tables, and distribution bars. */
export const PROVIDER_COLORS = [
  "#6366f1", "#a855f7", "#ec4899", "#f59e0b",
  "#10b981", "#3b82f6", "#ef4444", "#06b6d4",
];

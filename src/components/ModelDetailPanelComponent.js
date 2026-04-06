"use client";

import { useEffect, useCallback, useMemo } from "react";
import {
  X,
  Brain,
  Parentheses,
  Globe,
  Terminal,
  Monitor,
  FileSearch,
  Link,
  ImagePlus,
  ArrowRight,
  Info,
  Cpu,
  DollarSign,
  Trophy,
  Layers,
  Zap,
  Shield,
  Box,
  Hash,
} from "lucide-react";
import ProviderLogo, { PROVIDER_LABELS } from "./ProviderLogos";
import ProvidersBadgeComponent from "./ProvidersBadgeComponent";
import ModelTypeBadgeComponent from "./ModelTypeBadgeComponent";
import {
  MODALITY_ICONS,
  MODALITY_COLORS,
  TOOL_COLORS,
} from "./WorkflowNodeConstants";
import {
  formatContextTokens,
  formatFileSize,
  formatNumber,
  formatTokenCount,
} from "../utils/utilities";
import styles from "./ModelDetailPanelComponent.module.css";


const TOOL_ICONS = {
  Thinking: Brain,
  "Function Calling": Parentheses,
  "Web Search": Globe,
  "Google Search": Globe,
  "Code Execution": Terminal,
  "Computer Use": Monitor,
  "File Search": FileSearch,
  "URL Context": Link,
  "Image Generation": ImagePlus,
};

const ARENA_LABELS = {
  text: "Text",
  code: "Code",
  vision: "Vision",
  document: "Document",
  image: "Image",
  imageEdit: "Image Edit",
  search: "Search",
};

const PRICING_LABELS = {
  inputPerMillion: "Input / 1M tokens",
  cachedInputPerMillion: "Cached Input / 1M",
  cacheWriteInputPerMillion: "Cache Write / 1M",
  outputPerMillion: "Output / 1M tokens",
  audioInputPerMillion: "Audio Input / 1M",
  audioOutputPerMillion: "Audio Output / 1M",
  imageInputPerMillion: "Image Input / 1M",
  imageOutputPerMillion: "Image Output / 1M",
  cachedImageInputPerMillion: "Cached Image / 1M",
  inputOver272kPerMillion: "Input >272K / 1M",
  outputOver272kPerMillion: "Output >272K / 1M",
  webSearchPer1kCalls: "Web Search / 1K calls",
  perMinute: "Per minute",
  perCharacter: "Per character",
};


/**
 * ModelDetailPanelComponent — a slide-in right panel showing comprehensive
 * model card information when a model row is clicked in the ModelsTable.
 *
 * @param {Object}   props
 * @param {Object}   props.model    — Raw model object from the table
 * @param {Function} props.onClose  — Called when the panel should close
 */
export default function ModelDetailPanelComponent({ model, onClose }) {
  // Close on Escape key
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Normalize model fields
  const m = useMemo(() => {
    if (!model) return null;
    const name = model.display_name || model.label || model.key || model.name;
    const provider = model.provider || "lm-studio";
    const quantization =
      (typeof model.quantization === "object"
        ? model.quantization?.name
        : model.quantization) || null;

    return {
      name,
      key: model.key || model.name,
      provider,
      providerLabel: PROVIDER_LABELS[provider] || provider,
      modelType: model.modelType || null,
      year: model.year || null,
      contextLength: model.contextLength || model.max_context_length || null,
      maxOutputTokens: model.maxOutputTokens || null,
      inputTypes: model.inputTypes || [],
      outputTypes: model.outputTypes || [],
      tools: model.tools || [],
      pricing: model.pricing || null,
      arena: model.arena || null,
      size: model.size || (model.size_bytes ? formatFileSize(model.size_bytes) : null),
      params: model.params || model.params_string || null,
      quantization,
      bitsPerWeight: model.bitsPerWeight ?? model.quantization?.bits_per_weight ?? null,
      architecture: model.architecture || null,
      publisher: model.publisher || null,
      isLoaded: model.loaded || model.loaded_instances?.length > 0 || false,
      streaming: model.streaming ?? null,
      thinking: model.thinking ?? null,
      vision: model.vision ?? null,
      webSearch: model.webSearch ?? null,
      codeExecution: model.codeExecution ?? null,
      webFetch: model.webFetch ?? null,
      urlContext: model.urlContext ?? null,
      jsonMode: model.jsonMode ?? null,
      liveAPI: model.liveAPI ?? null,
      responsesAPI: model.responsesAPI ?? null,
      imageAPI: model.imageAPI ?? null,
      verbosity: model.verbosity ?? null,
      reasoningSummary: model.reasoningSummary ?? null,
      thinkingLevels: model.thinkingLevels || null,
      mediaLimits: model.mediaLimits || null,
      assistantImages: model.assistantImages,
      supportsSystemPrompt: model.supportsSystemPrompt,
      defaultTemperature: model.defaultTemperature,
      // Usage stats
      usageCount: model.usageCount || 0,
      totalInputTokens: model.totalInputTokens || 0,
      totalOutputTokens: model.totalOutputTokens || 0,
    };
  }, [model]);

  if (!m) return null;

  // Determine the biggest context for the bar (1M is the max reference)
  const MAX_CONTEXT_REF = 1_048_576;
  const contextPct = m.contextLength
    ? Math.min((m.contextLength / MAX_CONTEXT_REF) * 100, 100)
    : 0;

  // Collect pricing entries
  const pricingEntries = m.pricing
    ? Object.entries(m.pricing).filter(
        ([, val]) => val != null && val > 0,
      )
    : [];

  // Collect arena entries
  const arenaEntries = m.arena
    ? Object.entries(m.arena).filter(([, val]) => val != null && val > 0)
    : [];

  // Capability flags
  const capabilities = [];
  if (m.streaming) capabilities.push("Streaming");
  if (m.jsonMode) capabilities.push("JSON Mode");
  if (m.liveAPI) capabilities.push("Live API");
  if (m.responsesAPI) capabilities.push("Responses API");
  if (m.imageAPI) capabilities.push("Image API");
  if (m.verbosity) capabilities.push("Verbosity Control");
  if (m.reasoningSummary) capabilities.push("Reasoning Summary");
  if (m.webFetch) capabilities.push("Web Fetch");
  if (m.urlContext) capabilities.push("URL Context");
  if (m.codeExecution) capabilities.push("Code Execution");
  if (m.supportsSystemPrompt !== false) capabilities.push("System Prompt");
  if (m.assistantImages === false) capabilities.push("No Assistant Images");

  return (
    <div className={styles.overlay}>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.panel}>
        {/* ── Header ──────────────────────────────────────── */}
        <div className={styles.header}>
          <ProviderLogo provider={m.provider} size={28} />
          <div className={styles.headerInfo}>
            <div className={styles.headerName}>{m.name}</div>
            <div className={styles.headerProvider}>
              {m.providerLabel}
              {m.year && <span>· {m.year}</span>}
              {m.modelType && (
                <ModelTypeBadgeComponent modelType={m.modelType} />
              )}
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} title="Close">
            <X size={16} />
          </button>
        </div>

        {/* ── Body ────────────────────────────────────────── */}
        <div className={styles.body}>
          {/* ── Identity ─────────────────────────────────── */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>
              <Info size={12} />
              Identity
            </div>
            <div className={styles.kvGrid}>
              <span className={styles.kvLabel}>API Name</span>
              <span className={styles.kvValueMono}>{m.key}</span>

              <span className={styles.kvLabel}>Provider</span>
              <span className={styles.kvValue}>
                <ProvidersBadgeComponent providers={[m.provider]} />
              </span>

              {m.year && (
                <>
                  <span className={styles.kvLabel}>Release Year</span>
                  <span className={styles.kvValue}>{m.year}</span>
                </>
              )}

              {m.publisher && (
                <>
                  <span className={styles.kvLabel}>Publisher</span>
                  <span className={styles.kvValue}>{m.publisher}</span>
                </>
              )}

              {m.architecture && (
                <>
                  <span className={styles.kvLabel}>Architecture</span>
                  <span className={styles.kvValue}>{m.architecture}</span>
                </>
              )}

              {m.provider === "lm-studio" && (
                <>
                  <span className={styles.kvLabel}>Status</span>
                  <span className={styles.kvValue}>
                    <span
                      className={`${styles.statusBadge} ${m.isLoaded ? styles.loaded : styles.available}`}
                    >
                      {m.isLoaded ? "● Loaded" : "○ Available"}
                    </span>
                  </span>
                </>
              )}
            </div>
          </div>

          <div className={styles.divider} />

          {/* ── Context & Tokens ─────────────────────────── */}
          {(m.contextLength || m.maxOutputTokens || m.params || m.size) && (
            <>
              <div className={styles.section}>
                <div className={styles.sectionTitle}>
                  <Cpu size={12} />
                  Specifications
                </div>
                <div className={styles.kvGrid}>
                  {m.contextLength && (
                    <>
                      <span className={styles.kvLabel}>Context Window</span>
                      <span className={styles.kvValue}>
                        <div className={styles.contextBar}>
                          <div className={styles.contextBarTrack}>
                            <div
                              className={styles.contextBarFill}
                              style={{ width: `${contextPct}%` }}
                            />
                          </div>
                          <span className={styles.contextBarLabel}>
                            {formatContextTokens(m.contextLength)}
                          </span>
                        </div>
                      </span>
                    </>
                  )}

                  {m.maxOutputTokens && (
                    <>
                      <span className={styles.kvLabel}>Max Output</span>
                      <span className={styles.kvValueMono}>
                        {formatContextTokens(m.maxOutputTokens)}
                      </span>
                    </>
                  )}

                  {m.params && (
                    <>
                      <span className={styles.kvLabel}>Parameters</span>
                      <span className={styles.kvValue}>{m.params}</span>
                    </>
                  )}

                  {m.size && (
                    <>
                      <span className={styles.kvLabel}>Size on Disk</span>
                      <span className={styles.kvValue}>{m.size}</span>
                    </>
                  )}

                  {m.quantization && (
                    <>
                      <span className={styles.kvLabel}>Quantization</span>
                      <span className={styles.kvValueMono}>{m.quantization}</span>
                    </>
                  )}

                  {m.bitsPerWeight != null && (
                    <>
                      <span className={styles.kvLabel}>Bits per Weight</span>
                      <span className={styles.kvValueMono}>{m.bitsPerWeight}</span>
                    </>
                  )}

                  {m.defaultTemperature != null && (
                    <>
                      <span className={styles.kvLabel}>Default Temp</span>
                      <span className={styles.kvValueMono}>{m.defaultTemperature}</span>
                    </>
                  )}
                </div>
              </div>
              <div className={styles.divider} />
            </>
          )}

          {/* ── Modalities ───────────────────────────────── */}
          {(m.inputTypes.length > 0 || m.outputTypes.length > 0) && (
            <>
              <div className={styles.section}>
                <div className={styles.sectionTitle}>
                  <Layers size={12} />
                  Modalities
                </div>
                <div className={styles.modalitiesRow}>
                  {m.inputTypes.map((t) => {
                    const meta = MODALITY_ICONS[t];
                    if (!meta) return null;
                    const Icon = meta.icon;
                    return (
                      <span
                        key={`in-${t}`}
                        className={styles.modalityChip}
                        style={{ color: MODALITY_COLORS[t] }}
                      >
                        <Icon size={12} />
                        {meta.label}
                      </span>
                    );
                  })}
                  {m.inputTypes.length > 0 && m.outputTypes.length > 0 && (
                    <ArrowRight size={14} className={styles.modalityArrow} />
                  )}
                  {m.outputTypes.map((t) => {
                    const meta = MODALITY_ICONS[t];
                    if (!meta) return null;
                    const Icon = meta.icon;
                    return (
                      <span
                        key={`out-${t}`}
                        className={styles.modalityChip}
                        style={{ color: MODALITY_COLORS[t] }}
                      >
                        <Icon size={12} />
                        {meta.label}
                      </span>
                    );
                  })}
                </div>
              </div>
              <div className={styles.divider} />
            </>
          )}

          {/* ── Media Limits ─────────────────────────────── */}
          {m.mediaLimits && Object.keys(m.mediaLimits).length > 0 && (
            <>
              <div className={styles.section}>
                <div className={styles.sectionTitle}>
                  <Box size={12} />
                  Media Limits
                </div>
                <div className={styles.mediaLimitsGrid}>
                  {Object.entries(m.mediaLimits).map(([type, limits]) => (
                    <div key={type} className={styles.mediaLimitCard}>
                      <span className={styles.mediaLimitType}>{type}</span>
                      {limits.maxCount && (
                        <span className={styles.mediaLimitValue}>
                          {formatNumber(limits.maxCount)} files
                        </span>
                      )}
                      {limits.maxSizeMB && (
                        <span className={styles.mediaLimitValue}>
                          {limits.maxSizeMB} MB max
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className={styles.divider} />
            </>
          )}

          {/* ── Tools ────────────────────────────────────── */}
          {m.tools.length > 0 && (
            <>
              <div className={styles.section}>
                <div className={styles.sectionTitle}>
                  <Zap size={12} />
                  Tools & Capabilities
                </div>
                <div className={styles.toolsGrid}>
                  {m.tools.map((tool) => {
                    const Icon = TOOL_ICONS[tool];
                    const color = TOOL_COLORS[tool];
                    return (
                      <span
                        key={tool}
                        className={styles.toolChip}
                        style={color ? { color, borderColor: `${color}33` } : undefined}
                      >
                        {Icon && <Icon size={12} />}
                        {tool}
                      </span>
                    );
                  })}
                </div>

                {/* Thinking levels */}
                {m.thinkingLevels && m.thinkingLevels.length > 0 && (
                  <div className={styles.kvGrid} style={{ marginTop: 10 }}>
                    <span className={styles.kvLabel}>Thinking Levels</span>
                    <span className={styles.kvValue}>
                      {m.thinkingLevels.join(", ")}
                    </span>
                  </div>
                )}
              </div>
              <div className={styles.divider} />
            </>
          )}

          {/* ── API Capabilities ──────────────────────────── */}
          {capabilities.length > 0 && (
            <>
              <div className={styles.section}>
                <div className={styles.sectionTitle}>
                  <Shield size={12} />
                  API Features
                </div>
                <div className={styles.toolsGrid}>
                  {capabilities.map((cap) => (
                    <span key={cap} className={styles.toolChip}>
                      {cap}
                    </span>
                  ))}
                </div>
              </div>
              <div className={styles.divider} />
            </>
          )}

          {/* ── Pricing ──────────────────────────────────── */}
          {pricingEntries.length > 0 && (
            <>
              <div className={styles.section}>
                <div className={styles.sectionTitle}>
                  <DollarSign size={12} />
                  Pricing
                </div>
                <div className={styles.pricingGrid}>
                  {pricingEntries.map(([key, val]) => (
                    <div key={key} className={styles.pricingRow}>
                      <span className={styles.pricingLabel}>
                        {PRICING_LABELS[key] || key}
                      </span>
                      <span className={styles.pricingValue}>
                        ${typeof val === "number" ? val.toFixed(val < 0.01 ? 4 : 2) : val}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className={styles.divider} />
            </>
          )}

          {/* ── Arena Scores ─────────────────────────────── */}
          {arenaEntries.length > 0 && (
            <>
              <div className={styles.section}>
                <div className={styles.sectionTitle}>
                  <Trophy size={12} />
                  LMArena ELO Scores
                </div>
                <div className={styles.arenaGrid}>
                  {arenaEntries.map(([key, val]) => (
                    <div key={key} className={styles.arenaCard}>
                      <span className={styles.arenaScore}>{val}</span>
                      <span className={styles.arenaLabel}>
                        {ARENA_LABELS[key] || key}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className={styles.divider} />
            </>
          )}

          {/* ── Usage Stats ──────────────────────────────── */}
          {m.usageCount > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>
                <Hash size={12} />
                Usage Statistics
              </div>
              <div className={styles.kvGrid}>
                <span className={styles.kvLabel}>Total Requests</span>
                <span className={styles.kvValueMono}>
                  {formatNumber(m.usageCount)}
                </span>

                {m.totalInputTokens > 0 && (
                  <>
                    <span className={styles.kvLabel}>Input Tokens</span>
                    <span className={styles.kvValueMono}>
                      {formatTokenCount(m.totalInputTokens)}
                    </span>
                  </>
                )}

                {m.totalOutputTokens > 0 && (
                  <>
                    <span className={styles.kvLabel}>Output Tokens</span>
                    <span className={styles.kvValueMono}>
                      {formatTokenCount(m.totalOutputTokens)}
                    </span>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

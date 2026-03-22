"use client";

import { Type, Image, Volume2, Video, FileText, Hash, MessageSquare, Wrench } from "lucide-react";

// ── Modality Icons (icon, label, color) ──
export const MODALITY_ICONS = {
  text: { icon: Type, label: "Text", color: "#6366f1" },
  image: { icon: Image, label: "Image", color: "#10b981" },
  audio: { icon: Volume2, label: "Audio", color: "#f59e0b" },
  video: { icon: Video, label: "Video", color: "#f43f5e" },
  pdf: { icon: FileText, label: "PDF", color: "#64748b" },
  embedding: { icon: Hash, label: "Embedding", color: "#06b6d4" },
  conversation: { icon: MessageSquare, label: "Conversation", color: "#8b5cf6" },
  tools: { icon: Wrench, label: "Tools", color: "#f97316" },
};

// ── Modality Colors ──
export const MODALITY_COLORS = {
  text: "#6366f1",
  image: "#10b981",
  audio: "#f59e0b",
  video: "#f43f5e",
  pdf: "#64748b",
  embedding: "#06b6d4",
  conversation: "#8b5cf6",
  tools: "#f97316",
};

// ── Asset-type Icons ──
export const ASSET_ICONS = {
  text: Type,
  audio: Volume2,
  conversation: MessageSquare,
  tools: Wrench,
};

// ── Role labels for conversation compound ports ──
export const ROLE_LABELS = { system: "System Prompt", user: "User", assistant: "Assistant" };

// ── Dimension Constants ──
export const NODE_WIDTH_BASE = 220;
export const ASSET_NODE_WIDTH_BASE = 200;
export const MODALITY_ICON_WIDTH = 18;
export const MIN_MODALITY_ICONS_FOR_BASE = 3;
export const PORT_RADIUS = 7;
export const HEADER_HEIGHT = 36;
export const PORT_SECTION_HEIGHT = 24;
export const ASSET_CONTENT_HEIGHT = 175;
export const ASSET_CONTENT_HEIGHT_COMPACT = 175;
export const CONFIG_AREA_HEIGHT = 160;
export const ASSET_INFO_HEIGHT = 80;

// ── Compound port ID helpers for conversation input nodes ──
// Port format: "{msgIndex}.{modality}" e.g. "0.text", "1.image"
export function parseCompoundPort(portId) {
  const dotIdx = portId.indexOf(".");
  if (dotIdx === -1) return null;
  return {
    index: parseInt(portId.substring(0, dotIdx)),
    modality: portId.substring(dotIdx + 1),
  };
}

export function getBaseModality(portId) {
  const parsed = parseCompoundPort(portId);
  return parsed ? parsed.modality : portId;
}

// ── Node dimensions ──
export function getNodeWidth(node) {
  if (node.nodeType) {
    if (node.modality === "conversation") {
      const mods = (node.supportedModalities || ["text"]).filter((t) => t !== "conversation");
      const extraIcons = Math.max(0, mods.length - MIN_MODALITY_ICONS_FOR_BASE);
      return NODE_WIDTH_BASE + extraIcons * MODALITY_ICON_WIDTH;
    }
    return ASSET_NODE_WIDTH_BASE;
  }
  const rawInputs = (node.rawInputTypes || node.inputTypes || []).filter((t) => t !== "conversation");
  const extraIcons = Math.max(0, rawInputs.length - MIN_MODALITY_ICONS_FOR_BASE);
  return NODE_WIDTH_BASE + extraIcons * MODALITY_ICON_WIDTH;
}

const TEXT_LINE_HEIGHT = 16; // ~11px font × 1.4 line-height + padding
const TEXT_MIN_HEIGHT = 36;
const CHARS_PER_LINE = 22; // rough estimate for node width

export function getAssetContentHeight(node) {
  // Text input nodes: auto-size based on content, up to 175px
  if (node.nodeType === "input" && node.modality === "text") {
    const text = node.content || "";
    if (!text) return TEXT_MIN_HEIGHT;
    const lines = text.split("\n");
    let totalLines = 0;
    for (const line of lines) {
      totalLines += Math.max(1, Math.ceil(line.length / CHARS_PER_LINE));
    }
    const estimated = totalLines * TEXT_LINE_HEIGHT + 12; // 12px padding
    return Math.max(TEXT_MIN_HEIGHT, Math.min(estimated, ASSET_CONTENT_HEIGHT));
  }
  return ASSET_CONTENT_HEIGHT;
}

export function getAssetInfoHeight(node) {
  if (node.nodeType === "viewer" || node.modality === "text") return 0;
  return ASSET_INFO_HEIGHT;
}

export function getNodeHeight(node, isExpanded = false) {
  if (node.nodeType) {
    const inputCount = (node.inputTypes || []).length;
    const outputCount = (node.outputTypes || []).length;
    const portRows = Math.max(inputCount, outputCount, 1);
    const infoHeight = getAssetInfoHeight(node);
    const contentHeight = isExpanded ? getAssetContentHeight(node) + infoHeight : 0;
    return HEADER_HEIGHT + contentHeight + portRows * PORT_SECTION_HEIGHT + 12;
  }
  const inputCount = (node.inputTypes || []).length;
  const outputCount = (node.outputTypes || []).length;
  const portRows = Math.max(inputCount, outputCount, 1);
  const configHeight = isExpanded ? CONFIG_AREA_HEIGHT : 0;
  return HEADER_HEIGHT + configHeight + portRows * PORT_SECTION_HEIGHT + 12;
}

export function getPortPosition(node, portType, portIndex, configOffset = 0) {
  const width = getNodeWidth(node);
  const x = portType === "input" ? 0 : width;
  const startY = HEADER_HEIGHT + configOffset + 8;
  const spacing = PORT_SECTION_HEIGHT;
  const y = startY + portIndex * spacing + spacing / 2;
  return { x: node.position.x + x, y: node.position.y + y };
}

/**
 * Generate a smooth bezier curve path between two points.
 */
export function edgePath(x1, y1, x2, y2) {
  const dx = Math.abs(x2 - x1);
  const cp = Math.max(dx * 0.5, 60);
  return `M ${x1} ${y1} C ${x1 + cp} ${y1}, ${x2 - cp} ${y2}, ${x2} ${y2}`;
}

/**
 * requestDetailHelpers.js — Shared helpers for the request detail drawer
 * used by both /admin/requests and /admin/sessions pages.
 *
 * Centralises extractMediaAssets, getMediaTypeFromRef,
 * buildRequestDetailSections, and reconstructChatMessages so they
 * aren't copy-pasted across pages.
 */

import {
  formatNumber,
  formatLatency,
  formatTokensPerSec,
} from "./utilities";
import BadgeComponent from "../components/BadgeComponent";
import ModalityIconComponent from "../components/ModalityIconComponent";
import CostBadgeComponent from "../components/CostBadgeComponent";
import { prepareDisplayMessages } from "../components/MessageList";

/* ── Media extraction ──────────────────────────────────────────── */

/**
 * Recursively walk request/response payloads and collect media URLs
 * (minio://, data:image/…, https://…jpg, etc.) with their origin
 * ("user" for request, "ai" for response).
 */
export function extractMediaAssets(obj) {
  const seen = new Set();
  const assets = [];
  const search = (node, origin) => {
    if (!node) return;
    if (typeof node === "string") {
      if (seen.has(node)) return;
      if (
        node.startsWith("minio://") ||
        node.startsWith("data:image/") ||
        node.startsWith("data:audio/") ||
        node.startsWith("data:video/") ||
        node.startsWith("data:application/pdf")
      ) {
        seen.add(node);
        assets.push({ url: node, origin });
      } else if (node.startsWith("http://") || node.startsWith("https://")) {
        const ext = node.split("?")[0].split(".").pop()?.toLowerCase();
        if (
          ["png", "jpg", "jpeg", "gif", "webp", "mp3", "wav", "ogg", "webm", "mp4", "mov", "avi", "pdf"].includes(ext)
        ) {
          seen.add(node);
          assets.push({ url: node, origin });
        }
      }
    } else if (Array.isArray(node)) {
      node.forEach((n) => search(n, origin));
    } else if (typeof node === "object") {
      Object.values(node).forEach((n) => search(n, origin));
    }
  };
  search(obj?.requestPayload, "user");
  search(obj?.responsePayload, "ai");
  return assets;
}

/**
 * Classify a media reference string into a type for MediaCardComponent.
 */
export function getMediaTypeFromRef(ref) {
  if (!ref) return "image";
  const isData = ref.startsWith("data:");
  if (isData) {
    if (ref.startsWith("data:audio")) return "audio";
    if (ref.startsWith("data:video")) return "video";
    if (ref.startsWith("data:application/pdf")) return "pdf";
    return "image";
  }
  const ext = ref.split("?")[0].split(".").pop()?.toLowerCase();
  if (["mp3", "wav", "ogg", "webm"].includes(ext)) return "audio";
  if (["mp4", "avi", "mov"].includes(ext)) return "video";
  if (ext === "pdf") return "pdf";
  return "image";
}

/* ── Detail sections builder ───────────────────────────────────── */

/**
 * Build the 4-section array (General, Usage, Timing, Parameters)
 * consumed by <RequestDetailsComponent sections={…}>.
 *
 * Both /admin/requests and /admin/sessions pass the exact same
 * section definitions — this function is the single source of truth.
 */
export function buildRequestDetailSections(req) {
  if (!req) return [];
  return [
    {
      title: "General",
      items: [
        {
          label: "Request ID",
          value: req.requestId || "-",
          mono: true,
        },
        {
          label: "Timestamp",
          value: req.timestamp
            ? new Date(req.timestamp).toLocaleString()
            : "-",
        },
        {
          label: "Project",
          value: req.project ? (
            <BadgeComponent variant="info">{req.project}</BadgeComponent>
          ) : "-",
        },
        {
          label: "Endpoint",
          value: (
            <BadgeComponent variant="endpoint">
              {req.endpoint || "-"}
            </BadgeComponent>
          ),
        },
        {
          label: "Operation",
          value: (
            <BadgeComponent variant="info">
              {req.operation || "-"}
            </BadgeComponent>
          ),
        },
        {
          label: "Provider",
          value: req.provider ? (
            <BadgeComponent variant="provider">{req.provider}</BadgeComponent>
          ) : "-",
        },
        { label: "Model", value: req.model || "-" },
        {
          label: "Modalities",
          value: req.modalities ? (
            <ModalityIconComponent modalities={req.modalities} size={14} />
          ) : "-",
        },
        {
          label: "Status",
          value: (
            <BadgeComponent
              variant={req.success ? "success" : "error"}
            >
              {req.success ? "Success" : "Error"}
            </BadgeComponent>
          ),
        },
        {
          label: "Tools Used",
          value: (
            <BadgeComponent
              variant={req.toolsUsed ? "endpoint" : "info"}
            >
              {req.toolsUsed ? "Yes" : "No"}
            </BadgeComponent>
          ),
        },
        ...(req.errorMessage
          ? [
              {
                label: "Error",
                value: (
                  <span style={{ color: "var(--danger)" }}>
                    {req.errorMessage}
                  </span>
                ),
              },
            ]
          : []),
      ],
    },
    {
      title: "Usage",
      items: [
        {
          label: "Input Tokens",
          value: formatNumber(req.inputTokens),
        },
        {
          label: "Output Tokens",
          value: formatNumber(req.outputTokens),
        },
        {
          label: "Estimated Cost",
          value: <CostBadgeComponent cost={req.estimatedCost} />,
        },
        {
          label: "Tokens/sec",
          value: formatTokensPerSec(req.tokensPerSec),
        },
        {
          label: "Input Chars",
          value: formatNumber(req.inputCharacters),
        },
        {
          label: "Output Chars",
          value: formatNumber(req.outputCharacters),
        },
        {
          label: "Messages",
          value: req.messageCount || 0,
        },
      ],
    },
    {
      title: "Timing",
      items: [
        {
          label: "Time to Generation",
          value: formatLatency(req.timeToGeneration),
        },
        {
          label: "Generation Time",
          value: formatLatency(req.generationTime),
        },
        {
          label: "Total Time",
          value: formatLatency(req.totalTime),
        },
      ],
    },
    {
      title: "Parameters",
      items: [
        {
          label: "Temperature",
          value: req.temperature ?? "-",
        },
        {
          label: "Max Tokens",
          value: req.maxTokens ?? "-",
        },
        { label: "Top P", value: req.topP ?? "-" },
        { label: "Top K", value: req.topK ?? "-" },
        {
          label: "Frequency Penalty",
          value: req.frequencyPenalty ?? "-",
        },
        {
          label: "Presence Penalty",
          value: req.presencePenalty ?? "-",
        },
      ],
    },
  ];
}

/* ── Chat message reconstruction ───────────────────────────────── */

/**
 * Reconstruct a displayable chat message array from the raw
 * request/response payloads stored in a request log document.
 *
 * Returns { messages, systemPrompt } or null if there's nothing
 * to display.
 */
export function reconstructChatMessages(selectedRequest) {
  const reqPayload = selectedRequest?.requestPayload;
  const resPayload = selectedRequest?.responsePayload;
  if (!reqPayload?.messages?.length) return null;

  // Start with the prompt messages from the request
  const chatMessages = [...reqPayload.messages];

  // Append the assistant response
  if (resPayload) {
    const assistantMsg = {
      role: "assistant",
      content: "",
      model: selectedRequest.model,
      provider: selectedRequest.provider,
    };

    // Handle different response formats
    if (resPayload.text) {
      // Prism standardized format
      assistantMsg.content = resPayload.text;
    } else if (resPayload.content) {
      assistantMsg.content = resPayload.content;
    } else if (resPayload.candidates?.[0]?.content?.parts) {
      // Google format
      assistantMsg.content = resPayload.candidates[0].content.parts
        .map((p) => p.text || "")
        .join("");
    } else if (resPayload.choices?.[0]?.message?.content) {
      // OpenAI format
      assistantMsg.content = resPayload.choices[0].message.content;
    } else if (typeof resPayload === "string") {
      assistantMsg.content = resPayload;
    }

    // Extract tool calls if present
    const toolCalls =
      resPayload.choices?.[0]?.message?.tool_calls ||
      resPayload.toolCalls;
    if (toolCalls?.length) {
      assistantMsg.toolCalls = toolCalls.map((tc) => ({
        id: tc.id,
        name: tc.function?.name || tc.name,
        args:
          typeof tc.function?.arguments === "string"
            ? JSON.parse(tc.function.arguments)
            : tc.function?.arguments || tc.args || {},
      }));
    }

    // Extract generated images
    if (resPayload.images?.length) {
      assistantMsg.images = resPayload.images;
    }

    // Extract thinking content
    if (resPayload.thinking) {
      assistantMsg.thinking = resPayload.thinking;
    }

    if (assistantMsg.content || assistantMsg.toolCalls?.length || assistantMsg.images?.length) {
      chatMessages.push(assistantMsg);
    }
  }

  const messages = prepareDisplayMessages(chatMessages);
  const systemPrompt = chatMessages.find((m) => m.role === "system")?.content;
  if (!messages.length) return null;

  return { messages, systemPrompt };
}

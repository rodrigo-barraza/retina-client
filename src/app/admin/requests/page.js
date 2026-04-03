"use client";

import { useState, useEffect, useCallback } from "react";
import { Download, MessageSquare, GitBranch, FolderOpen } from "lucide-react";
import { useRouter } from "next/navigation";
import HistoryItemComponent from "../../../components/HistoryItemComponent";
import JsonViewerComponent from "../../../components/JsonViewerComponent";
import IrisService from "../../../services/IrisService";
import {
  formatNumber,
  formatLatency,
  formatTokensPerSec,
  buildDateRangeParams,
} from "../../../utils/utilities";

import RequestsTableComponent from "../../../components/RequestsTableComponent";
import PaginationComponent from "../../../components/PaginationComponent";


import SelectDropdown from "../../../components/SelectDropdown";
import { ErrorMessage } from "../../../components/StateMessageComponent";
import {
  FilterBarComponent,
  FilterGroupComponent,
  FilterInputComponent,
  FilterSelectComponent,
  FilterClearButton,
} from "../../../components/FilterBarComponent";
import BadgeComponent from "../../../components/BadgeComponent";
import CostBadgeComponent from "../../../components/CostBadgeComponent";
import ButtonComponent from "../../../components/ButtonComponent";
import DetailDrawerComponent from "../../../components/DetailDrawerComponent";
import MessageList, { prepareDisplayMessages } from "../../../components/MessageList";
import MediaCardComponent from "../../../components/MediaCardComponent";
import { useAdminHeader } from "../../../components/AdminHeaderContext";
import useProjectFilter from "../../../hooks/useProjectFilter";
import styles from "./page.module.css";



function extractMediaAssets(obj) {
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
          ["png", "jpg", "jpeg", "gif", "webp", "mp3", "wav", "ogg", "webm", "mp4", "mov", "avi", "pdf"].includes(
            ext
          )
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

function getMediaTypeFromRef(ref) {
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

export default function RequestsPage() {
  const router = useRouter();
  const { projectFilter, projectOptions, handleProjectChange } =
    useProjectFilter();
  const { setControls, setTitleBadge, dateRange } = useAdminHeader();
  const [requests, setRequests] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sort, setSort] = useState("timestamp");
  const [order, setOrder] = useState("desc");
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [associations, setAssociations] = useState(null);
  const [loadingAssociations, setLoadingAssociations] = useState(false);
  const [filters, setFilters] = useState({
    provider: "",
    model: "",
    endpoint: "",
    success: "",
  });

  const [hoveredConversationId, setHoveredConversationId] = useState(null);

  const LIMIT = 50;

  const loadRequests = useCallback(async () => {
    try {

      const params = { page, limit: LIMIT, sort, order };
      if (projectFilter) params.project = projectFilter;
      Object.entries(filters).forEach(([k, v]) => {
        if (v) params[k] = v;
      });
      Object.assign(params, buildDateRangeParams(dateRange));

      const data = await IrisService.getRequests(params);
      setRequests(data.data || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, sort, order, filters, dateRange, projectFilter]);

  useEffect(() => {
    // Immediately enter loading state and clear stale data when filters change
    setLoading(true);
    setError(null);
    setRequests([]);
    setTotal(0);

    loadRequests();
  }, [loadRequests]);

  // Fetch associations when a request is selected
  useEffect(() => {
    if (!selectedRequest?.requestId) {
      setAssociations(null);
      return;
    }
    let cancelled = false;
    setLoadingAssociations(true);
    IrisService.getRequestAssociations(selectedRequest.requestId)
      .then((data) => {
        if (!cancelled) setAssociations(data);
      })
      .catch(() => {
        if (!cancelled)
          setAssociations({ conversations: [], workflows: [], sessions: [] });
      })
      .finally(() => {
        if (!cancelled) setLoadingAssociations(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedRequest?.requestId]);

  function handleSort(key, dir) {
    setSort(key);
    setOrder(dir);
    setPage(1);
  }

  const handleFilterChange = useCallback((key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }, []);

  function clearFilters() {
    setFilters({
      provider: "",
      model: "",
      endpoint: "",
      success: "",
    });
    setPage(1);
  }



  const exportCSV = useCallback(() => {
    const headers = [
      "Timestamp", "Project", "Endpoint", "Provider", "Model",
      "Tokens In", "Tokens Out", "Cost", "Tok/s", "Latency", "Status",
    ].join(",");
    const rows = requests.map((r) =>
      [
        r.timestamp || "",
        r.project || "",
        r.endpoint || "",
        r.provider || "",
        r.model || "",
        r.inputTokens || 0,
        r.outputTokens || 0,
        r.estimatedCost || 0,
        r.tokensPerSec ? formatTokensPerSec(r.tokensPerSec) : "",
        r.totalTime || 0,
        r.success ? "OK" : "ERR",
      ].join(","),
    );
    const csv = [headers, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `iris-requests-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [requests]);

  const totalPages = Math.ceil(total / LIMIT);



  // Inject controls into AdminShell header
  useEffect(() => {
    setControls(
      <>
        {total > 0 && (
          <span className={styles.headerBadge}>
            {formatNumber(total)} total
          </span>
        )}
        <ErrorMessage message={error} />
        <SelectDropdown
          value={projectFilter || ""}
          options={projectOptions}
          onChange={handleProjectChange}
          placeholder="All Projects"
        />
      </>,
    );
  }, [
    setControls,
    total,
    error,
    projectFilter,
    projectOptions,
    handleProjectChange,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      setControls(null);
      setTitleBadge(null);
    };
  }, [setControls, setTitleBadge]);

  // Set title badge with total count
  useEffect(() => {
    setTitleBadge(formatNumber(total));
  }, [setTitleBadge, total]);

  return (
    <div className={styles.page}>
      {/* Filters */}
      <FilterBarComponent>
        <FilterGroupComponent label="Provider">
          <FilterSelectComponent
            value={filters.provider}
            onChange={(val) => handleFilterChange("provider", val)}
            options={[
              { value: "", label: "All" },
              { value: "openai", label: "OpenAI" },
              { value: "anthropic", label: "Anthropic" },
              { value: "google", label: "Google" },
              { value: "elevenlabs", label: "ElevenLabs" },
            ]}
          />
        </FilterGroupComponent>
        <FilterGroupComponent label="Model">
          <FilterInputComponent
            placeholder="Filter by model..."
            value={filters.model}
            onChange={(val) => handleFilterChange("model", val)}
          />
        </FilterGroupComponent>
        <FilterGroupComponent label="Endpoint">
          <FilterSelectComponent
            value={filters.endpoint}
            onChange={(val) => handleFilterChange("endpoint", val)}
            options={[
              { value: "", label: "All" },
              { value: "/chat", label: "/chat" },
              { value: "/audio", label: "/audio" },
              { value: "/embed", label: "/embed" },
              { value: "live", label: "Live" },
            ]}
          />
        </FilterGroupComponent>
        <FilterGroupComponent label="Status">
          <FilterSelectComponent
            value={filters.success}
            onChange={(val) => handleFilterChange("success", val)}
            options={[
              { value: "", label: "All" },
              { value: "true", label: "Success" },
              { value: "false", label: "Error" },
            ]}
          />
        </FilterGroupComponent>

        <FilterClearButton onClick={clearFilters} />
        <ButtonComponent
          variant="secondary"
          icon={Download}
          onClick={exportCSV}
          size="small"
        >
          Export CSV
        </ButtonComponent>
      </FilterBarComponent>

      {/* Table */}
      <div className={styles.tableWrapper}>
        <RequestsTableComponent
          requests={requests}
          sortKey={sort}
          sortDir={order}
          onSort={handleSort}
          maxHeight={null}
          onRowMouseEnter={(row) => {
            if (row.conversationId) setHoveredConversationId(row.conversationId);
          }}
          onRowMouseLeave={() => setHoveredConversationId(null)}
          getRowClassName={(row) =>
            hoveredConversationId && row.conversationId === hoveredConversationId
              ? styles.sharedConversationRow
              : ""
          }
          onRowClick={async (req) => {
            setSelectedRequest(req);
            try {
              const full = await IrisService.getRequest(req.requestId);
              setSelectedRequest(full);
            } catch {
              /* keep partial data */
            }
          }}
          emptyText={loading ? "Loading..." : "No requests found"}
        />

        {/* Pagination */}
        <PaginationComponent
          page={page}
          totalPages={totalPages}
          totalItems={total}
          onPageChange={setPage}
          limit={LIMIT}
        />
      </div>

      <DetailDrawerComponent
        open={!!selectedRequest}
        onClose={() => setSelectedRequest(null)}
        title="Request Detail"
        sections={
          selectedRequest
            ? [
                {
                  title: "General",
                  items: [
                    {
                      label: "Request ID",
                      value: selectedRequest.requestId || "-",
                      mono: true,
                    },
                    {
                      label: "Timestamp",
                      value: selectedRequest.timestamp
                        ? new Date(selectedRequest.timestamp).toLocaleString()
                        : "-",
                    },
                    { label: "Project", value: selectedRequest.project || "-" },
                    {
                      label: "Endpoint",
                      value: selectedRequest.endpoint || "-",
                    },
                    {
                      label: "Provider",
                      value: selectedRequest.provider || "-",
                    },
                    { label: "Model", value: selectedRequest.model || "-" },
                    {
                      label: "Status",
                      value: (
                        <BadgeComponent
                          variant={
                            selectedRequest.success ? "success" : "error"
                          }
                        >
                          {selectedRequest.success ? "Success" : "Error"}
                        </BadgeComponent>
                      ),
                    },
                    {
                      label: "Tools Used",
                      value: (
                        <BadgeComponent
                          variant={
                            selectedRequest.toolsUsed ? "endpoint" : "info"
                          }
                        >
                          {selectedRequest.toolsUsed ? "Yes" : "No"}
                        </BadgeComponent>
                      ),
                    },
                    ...(selectedRequest.errorMessage
                      ? [
                          {
                            label: "Error",
                            value: (
                              <span style={{ color: "var(--danger)" }}>
                                {selectedRequest.errorMessage}
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
                      value: formatNumber(selectedRequest.inputTokens),
                    },
                    {
                      label: "Output Tokens",
                      value: formatNumber(selectedRequest.outputTokens),
                    },
                    {
                      label: "Estimated Cost",
                      value: <CostBadgeComponent cost={selectedRequest.estimatedCost} />,
                    },
                    {
                      label: "Tokens/sec",
                      value: formatTokensPerSec(selectedRequest.tokensPerSec),
                    },
                    {
                      label: "Input Chars",
                      value: formatNumber(selectedRequest.inputCharacters),
                    },
                    {
                      label: "Output Chars",
                      value: formatNumber(selectedRequest.outputCharacters),
                    },
                    {
                      label: "Messages",
                      value: selectedRequest.messageCount || 0,
                    },
                  ],
                },
                {
                  title: "Timing",
                  items: [
                    {
                      label: "Time to Generation",
                      value: formatLatency(selectedRequest.timeToGeneration),
                    },
                    {
                      label: "Generation Time",
                      value: formatLatency(selectedRequest.generationTime),
                    },
                    {
                      label: "Total Time",
                      value: formatLatency(selectedRequest.totalTime),
                    },
                  ],
                },
                {
                  title: "Parameters",
                  items: [
                    {
                      label: "Temperature",
                      value: selectedRequest.temperature ?? "-",
                    },
                    {
                      label: "Max Tokens",
                      value: selectedRequest.maxTokens ?? "-",
                    },
                    { label: "Top P", value: selectedRequest.topP ?? "-" },
                    { label: "Top K", value: selectedRequest.topK ?? "-" },
                    {
                      label: "Frequency Penalty",
                      value: selectedRequest.frequencyPenalty ?? "-",
                    },
                    {
                      label: "Presence Penalty",
                      value: selectedRequest.presencePenalty ?? "-",
                    },
                  ],
                },
              ]
            : []
        }
      >
        {selectedRequest && (
          <>
            <div className={styles.detailSection}>
              <div className={styles.detailSectionTitle}>Associations</div>
              {loadingAssociations ? (
                <span style={{ color: "var(--text-muted)" }}>Loading…</span>
              ) : (
                <div className={styles.associationGrid}>
                  <div className={styles.associationGroup}>
                    <span className={styles.associationGroupLabel}>
                      <MessageSquare size={12} /> Conversations
                    </span>
                    {associations?.conversations?.length > 0 ? (
                      <div className={styles.associationList}>
                        {associations.conversations.map((c) => (
                          <HistoryItemComponent
                            key={c.id}
                            item={{
                              id: c.id,
                              title: c.title || "Untitled",
                              tags: c.project
                                ? [
                                    {
                                      label: c.project,
                                      style: {
                                        background: "var(--accent-subtle)",
                                        color: "var(--accent-color)",
                                      },
                                    },
                                  ]
                                : [],
                              updatedAt: c.updatedAt || c.createdAt,
                              createdAt: c.createdAt,
                              totalCost: c.totalCost || 0,
                              modalities: c.modalities || {},
                              modelName: c.model || null,
                              username: c.username,
                            }}
                            icon={MessageSquare}
                            admin
                            onClick={() =>
                              router.push(`/admin/conversations/${c.id}`)
                            }
                          />
                        ))}
                      </div>
                    ) : (
                      <span className={styles.associationEmpty}>—</span>
                    )}
                  </div>
                  <div className={styles.associationGroup}>
                    <span className={styles.associationGroupLabel}>
                      <GitBranch size={12} /> Workflows
                    </span>
                    {associations?.workflows?.length > 0 ? (
                      <div className={styles.associationList}>
                        {associations.workflows.map((w) => (
                          <HistoryItemComponent
                            key={w.id}
                            item={{
                              id: w.id,
                              title: w.name || "Untitled",
                              tags: [
                                {
                                  label: `${w.nodeCount} nodes · ${w.edgeCount} edges`,
                                  style: {
                                    background: "var(--bg-tertiary)",
                                    color: "var(--text-muted)",
                                  },
                                },
                              ],
                              updatedAt: w.updatedAt || w.createdAt,
                            }}
                            icon={GitBranch}
                            onClick={() =>
                              router.push(`/admin/workflows/${w.id}`)
                            }
                          />
                        ))}
                      </div>
                    ) : (
                      <span className={styles.associationEmpty}>—</span>
                    )}
                  </div>
                  <div className={styles.associationGroup}>
                    <span className={styles.associationGroupLabel}>
                      <FolderOpen size={12} /> Sessions
                    </span>
                    {associations?.sessions?.length > 0 ? (
                      <div className={styles.associationList}>
                        {associations.sessions.map((s) => (
                          <HistoryItemComponent
                            key={s.id}
                            item={{
                              id: s.id,
                              title: s.id.slice(0, 8),
                              tags: [
                                {
                                  label: `${s.conversationCount} conversation${s.conversationCount !== 1 ? "s" : ""}`,
                                  style: {
                                    background: "var(--bg-tertiary)",
                                    color: "var(--text-muted)",
                                  },
                                },
                              ],
                              updatedAt: s.updatedAt || s.createdAt,
                            }}
                            icon={FolderOpen}
                            onClick={() =>
                              router.push("/admin/sessions")
                            }
                          />
                        ))}
                      </div>
                    ) : (
                      <span className={styles.associationEmpty}>—</span>
                    )}
                  </div>
                </div>
              )}
            </div>
            {(() => {
              const mediaAssets = extractMediaAssets(selectedRequest);
              if (!mediaAssets.length) return null;
              return (
                <div className={styles.detailSection}>
                  <div className={styles.detailSectionTitle}>Media Assets</div>
                  <div className={styles.mediaGrid}>
                    {mediaAssets.map((asset, idx) => (
                      <MediaCardComponent
                        key={idx}
                        media={{
                          url: asset.url,
                          mediaType: getMediaTypeFromRef(asset.url),
                          origin: asset.origin,
                        }}
                        compact
                        showInfo={false}
                        showOrigin
                      />
                    ))}
                  </div>
                </div>
              );
            })()}
            {(() => {
              // Reconstruct chat messages from request/response payloads
              const req = selectedRequest;
              const reqPayload = req?.requestPayload;
              const resPayload = req?.responsePayload;
              if (!reqPayload?.messages?.length) return null;

              // Start with the prompt messages from the request
              const chatMessages = [...reqPayload.messages];

              // Append the assistant response
              if (resPayload) {
                const assistantMsg = {
                  role: "assistant",
                  content: "",
                  model: req.model,
                  provider: req.provider,
                };

                // Handle different response formats
                if (resPayload.content) {
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

                if (assistantMsg.content || assistantMsg.toolCalls?.length) {
                  chatMessages.push(assistantMsg);
                }
              }

              const displayMessages = prepareDisplayMessages(chatMessages);
              if (!displayMessages.length) return null;

              return (
                <div className={styles.detailSection}>
                  <div className={styles.detailSectionTitle}>Chat Preview</div>
                  <div className={styles.chatPreview}>
                    <MessageList messages={displayMessages} readOnly />
                  </div>
                </div>
              );
            })()}
            {selectedRequest.requestPayload && (
              <div className={styles.detailSection}>
                <JsonViewerComponent
                  data={selectedRequest.requestPayload}
                  label="Request Payload"
                  collapsed={1}
                  maxHeight="400px"
                />
              </div>
            )}
            {selectedRequest.responsePayload && (
              <div className={styles.detailSection}>
                <JsonViewerComponent
                  data={selectedRequest.responsePayload}
                  label="Response Payload"
                  collapsed={1}
                  maxHeight="400px"
                />
              </div>
            )}
          </>
        )}
      </DetailDrawerComponent>
    </div>
  );
}

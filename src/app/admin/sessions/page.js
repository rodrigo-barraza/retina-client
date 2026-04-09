"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { FolderOpen, Loader, MessageSquare, GitBranch } from "lucide-react";
import { useRouter } from "next/navigation";
import IrisService from "../../../services/IrisService";
import { buildDateRangeParams } from "../../../utils/utilities";
import {
  extractMediaAssets,
  getMediaTypeFromRef,
  buildRequestDetailSections,
  reconstructChatMessages,
} from "../../../utils/requestDetailHelpers";
import PaginationComponent from "../../../components/PaginationComponent";
import SessionsTableComponent from "../../../components/SessionsTableComponent";
import SelectDropdown from "../../../components/SelectDropdown";
import { useAdminHeader } from "../../../components/AdminHeaderContext";
import useProjectFilter from "../../../hooks/useProjectFilter";
import RequestDetailsComponent from "../../../components/RequestDetailsComponent";
import JsonViewerComponent from "../../../components/JsonViewerComponent";
import HistoryItemComponent from "../../../components/HistoryItemComponent";
import ChatPreviewComponent from "../../../components/ChatPreviewComponent";
import MediaCardComponent from "../../../components/MediaCardComponent";

import styles from "./page.module.css";

const PAGE_SIZE = 30;
const POLL_INTERVAL = 5000; // 5s

export default function SessionsPage() {
  const router = useRouter();
  const { projectFilter, projectOptions, handleProjectChange } =
    useProjectFilter();
  const { setControls, setTitleBadge, dateRange } = useAdminHeader();
  const [sessions, setSessions] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("createdAt");
  const [order, setOrder] = useState("desc");
  const [loading, setLoading] = useState(true);
  const initialLoadDone = useRef(false);
  const fetchGenRef = useRef(0);

  // Request detail drawer state
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [associations, setAssociations] = useState(null);
  const [loadingAssociations, setLoadingAssociations] = useState(false);

  const dateParams = useMemo(
    () => buildDateRangeParams(dateRange),
    [dateRange],
  );

  const loadSessions = useCallback(async () => {
    const gen = fetchGenRef.current;
    try {
      const params = {
        page,
        limit: PAGE_SIZE,
        sort,
        order,
        ...dateParams,
      };
      if (projectFilter) params.project = projectFilter;

      const data = await IrisService.getSessions(params);
      // Discard stale responses from previous filter/page generations
      if (gen !== fetchGenRef.current) return;
      setSessions(data.data || []);
      setTotal(data.total || 0);
    } catch (err) {
      if (gen !== fetchGenRef.current) return;
      console.error("Failed to load sessions:", err);
    } finally {
      if (gen !== fetchGenRef.current) return;
      if (!initialLoadDone.current) {
        initialLoadDone.current = true;
        setLoading(false);
      }
    }
  }, [page, sort, order, dateParams, projectFilter]);

  useEffect(() => {
    // Bump generation to invalidate any in-flight requests from previous effect
    fetchGenRef.current += 1;
    initialLoadDone.current = false;
    setLoading(true);

    loadSessions();

    // Subscribe to change stream SSE for real-time updates.
    // Session data is aggregated from sessions + requests + conversations
    // via $lookup, so we need to refresh on changes to all three collections.
    // Debounce to batch rapid request-level changes during streaming.
    let pollInterval = null;
    let debounceTimer = null;
    const debouncedLoad = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(loadSessions, 800);
    };
    const es = IrisService.subscribeCollectionChanges({
      onStatus: (data) => {
        if (!data.changeStreams) {
          // No Change Streams — fall back to polling
          if (!pollInterval) {
            pollInterval = setInterval(loadSessions, POLL_INTERVAL);
          }
        }
      },
      onChange: (event) => {
        if (event.collection === "sessions") {
          // Session created/updated — immediate refresh
          loadSessions();
        } else if (
          event.collection === "requests" ||
          event.collection === "conversations"
        ) {
          // Request/conversation changes update aggregated session data
          // (tokens, cost, models, etc.) — debounce to batch streaming updates
          debouncedLoad();
        }
      },
    });

    return () => {
      es.close();
      if (pollInterval) clearInterval(pollInterval);
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [loadSessions]);

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

  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Handle request row click — fetch full details and open drawer
  const handleRequestRowClick = useCallback(async (req) => {
    setSelectedRequest(req);
    try {
      const full = await IrisService.getRequest(req.requestId);
      setSelectedRequest(full);
    } catch {
      /* keep partial data */
    }
  }, []);

  // Inject controls into AdminShell header
  useEffect(() => {
    setControls(
      <>
        <SelectDropdown
          value={projectFilter || ""}
          options={projectOptions}
          onChange={handleProjectChange}
          placeholder="All Projects"
        />
      </>,
    );
  }, [setControls, total, projectFilter, projectOptions, handleProjectChange]);

  useEffect(() => {
    return () => {
      setControls(null);
      setTitleBadge(null);
    };
  }, [setControls, setTitleBadge]);

  // Set title badge with total count
  useEffect(() => {
    setTitleBadge(total);
  }, [setTitleBadge, total]);

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>
          <Loader size={16} className={styles.spinning} />
          Loading sessions…
        </div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className={styles.page}>
        <div className={styles.empty}>
          <FolderOpen size={36} style={{ opacity: 0.3 }} />
          <div>No sessions yet</div>
          <div style={{ fontSize: 12 }}>
            Sessions are created when AI calls are grouped together
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <SessionsTableComponent
        sessions={sessions}
        emptyText="No sessions"
        sortKey={sort}
        sortDir={order}
        onSort={(key, dir) => {
          setSort(key);
          setOrder(dir);
          setPage(1);
        }}
        onRequestRowClick={handleRequestRowClick}
      />

      {/* Pagination */}
      <PaginationComponent
        page={page}
        totalPages={totalPages}
        totalItems={total}
        onPageChange={setPage}
        limit={PAGE_SIZE}
      />

      {/* Request detail drawer */}
      <RequestDetailsComponent
        open={!!selectedRequest}
        onClose={() => setSelectedRequest(null)}
        title="Request Detail"
        sections={buildRequestDetailSections(selectedRequest)}
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
              const chat = reconstructChatMessages(selectedRequest);
              if (!chat) return null;
              return (
                <div className={styles.detailSection}>
                  <div className={styles.detailSectionTitle}>Chat Preview</div>
                  <ChatPreviewComponent
                    messages={chat.messages}
                    systemPrompt={chat.systemPrompt}
                    readOnly
                  />
                </div>
              );
            })()}
            {selectedRequest.requestPayload && (
              <div className={styles.detailSection}>
                <JsonViewerComponent
                  data={selectedRequest.requestPayload}
                  label="Request Payload"
                  maxHeight="400px"
                />
              </div>
            )}
            {selectedRequest.responsePayload && (
              <div className={styles.detailSection}>
                <JsonViewerComponent
                  data={selectedRequest.responsePayload}
                  label="Response Payload"
                  maxHeight="400px"
                />
              </div>
            )}
          </>
        )}
      </RequestDetailsComponent>
    </div>
  );
}

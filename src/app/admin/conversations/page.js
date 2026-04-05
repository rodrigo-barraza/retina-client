"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  getUniqueModels,
  getConversationCost,
  getConversationTokenStats,
  getUsedTools,
  buildDateRangeParams,
} from "../../../utils/utilities";
import { useSearchParams } from "next/navigation";
import {
  Loader,
  MessageSquare,
  Settings,
  SlidersHorizontal,
} from "lucide-react";

import IrisService from "../../../services/IrisService";
import MessageList, {
  prepareDisplayMessages,
} from "../../../components/MessageList";
import SettingsPanel from "../../../components/SettingsPanel";
import ParametersPanelComponent from "../../../components/ParametersPanelComponent";
import HistoryPanel, { getModalities } from "../../../components/HistoryPanel";

import ThreePanelLayout from "../../../components/ThreePanelLayout";
import SelectDropdown from "../../../components/SelectDropdown";
import TabBarComponent from "../../../components/TabBarComponent";
import ModelPickerPopoverComponent from "../../../components/ModelPickerPopoverComponent";
import { ErrorMessage } from "../../../components/StateMessageComponent";
import { useAdminHeader } from "../../../components/AdminHeaderContext";
import useProjectFilter from "../../../hooks/useProjectFilter";
import ProjectBadgeComponent from "../../../components/ProjectBadgeComponent";
import UserBadgeComponent from "../../../components/UserBadgeComponent";

import { SETTINGS_DEFAULTS } from "../../../constants";
import styles from "./page.module.css";

const POLL_INTERVAL = 5000; // 5s

export default function ConversationsPage({ initialId = null, sessionId = null }) {
  const { projectFilter, projectOptions, handleProjectChange } =
    useProjectFilter();
  const searchParams = useSearchParams();
  const providerFilter = searchParams.get("provider") || null;
  const modelFilter = searchParams.get("model") || null;
  const sessionParam = searchParams.get("session") || sessionId;
  const { setControls, setTitleBadge, dateRange, sessionFilter, setSessionFilter } = useAdminHeader();
  const [conversations, setConversations] = useState([]);

  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(initialId);
  const [selectedConv, setSelectedConv] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [config, setConfig] = useState(null);

  const [newIds, setNewIds] = useState(new Set());
  const [generatingCount, setGeneratingCount] = useState(0);
  const [changeStreamsActive, setChangeStreamsActive] = useState(false);

  const [workflows, setWorkflows] = useState([]);
  const [leftTab, setLeftTab] = useState("settings");

  const knownIdsRef = useRef(null); // null = not yet initialized
  const lastFingerprintRef = useRef("");
  const autoSelectedRef = useRef(!!initialId);
  const viewerBodyRef = useRef(null);

  // Sync the session parameter into the admin header context
  useEffect(() => {
    if (sessionParam) {
      setSessionFilter(sessionParam);
    }
    return () => {
      // Only clear if we set it — avoid clearing on unmount when there's no session
      if (sessionParam) setSessionFilter(null);
    };
  }, [sessionParam, setSessionFilter]);

  // The active session filter (from URL param or context)
  const activeSession = sessionParam || sessionFilter;

  useEffect(() => {
    IrisService.getConfig()
      .then(setConfig)
      .catch(() => {});
  }, []);

  // If initialId is set, load that conversation immediately
  useEffect(() => {
    if (initialId) {
      setLoadingDetail(true);
      IrisService.getConversation(initialId)
        .then(setSelectedConv)
        .catch(() => setSelectedConv(null))
        .finally(() => setLoadingDetail(false));
    }
  }, [initialId]);

  const loadConversations = useCallback(async () => {
    try {
      const params = {
        page: 1,
        limit: 200,
        sort: "updatedAt",
        order: "desc",
      };
      // When filtering by session, skip date/project filters
      if (activeSession) {
        params.session = activeSession;
      } else {
        Object.assign(params, buildDateRangeParams(dateRange));
        if (projectFilter) params.project = projectFilter;
      }
      if (providerFilter) params.provider = providerFilter;
      if (modelFilter) params.model = modelFilter;
      const data = await IrisService.getConversations(params);
      const list = data.data || [];

      // Build fingerprint from meaningful fields
      const fp = list
        .map((c) => `${c.id}:${c.messages?.length || c.messageCount || 0}`)
        .join("|");

      if (fp !== lastFingerprintRef.current) {
        lastFingerprintRef.current = fp;
        setConversations(list);
        setFingerprint(fp);
      }

      // Track new IDs
      const currentIds = new Set(list.map((c) => c.id));
      if (knownIdsRef.current === null) {
        // First load — mark everything as known
        knownIdsRef.current = currentIds;
      } else {
        // Find new IDs that weren't known before
        const freshIds = new Set();
        for (const id of currentIds) {
          if (!knownIdsRef.current.has(id)) freshIds.add(id);
        }
        if (freshIds.size > 0) {
          setNewIds((prev) => {
            const merged = new Set(prev);
            for (const id of freshIds) merged.add(id);
            return merged;
          });
          // Update known IDs
          knownIdsRef.current = currentIds;
        }
      }

      // Auto-select on first load (only if no initialId)
      if (list.length > 0 && !autoSelectedRef.current) {
        autoSelectedRef.current = true;
        selectConversation(list[0].id);
      }

      setError((prev) => (prev !== null ? null : prev));
    } catch (err) {
      setError(err.message);
    }
  }, [projectFilter, providerFilter, modelFilter, dateRange, activeSession]);

  // Initial stats fetch (SSE subscription for generating count is handled
  // globally by AdminShell to avoid duplicate SSE connections).
  useEffect(() => {
    IrisService.getConversationStats(projectFilter)
      .then((data) => {
        setGeneratingCount(data.generatingCount || 0);
      })
      .catch(() => {});
  }, [projectFilter]);

  // Live conversation detail — re-fetch when Change Streams detect updates
  const fingerprintRef = useRef("");
  const [fingerprint, setFingerprint] = useState("");
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  // Refresh the selected conversation detail
  const refreshSelectedConv = useCallback(async (id) => {
    if (!id) return;
    try {
      const full = await IrisService.getConversation(id);
      setSelectedConv((prev) => {
        const oldMsgs = prev?.messages || [];
        const newMsgs = full?.messages || [];
        if (oldMsgs.length !== newMsgs.length) return full;
        const oldLast = oldMsgs[oldMsgs.length - 1];
        const newLast = newMsgs[newMsgs.length - 1];
        if (oldLast?.content?.length !== newLast?.content?.length) return full;
        // Also refresh if isGenerating changed
        if (prev?.isGenerating !== full?.isGenerating) return full;
        return prev;
      });
    } catch (err) {
      console.error("Failed to refresh selected conversation:", err);
    }
  }, []);

  // Change Stream-driven: instant detail refresh when selected conv is updated
  useEffect(() => {
    if (!changeStreamsActive) return;

    const onEvent = (event) => {
      if (
        event.collection === "conversations" &&
        selectedIdRef.current &&
        event.id === selectedIdRef.current
      ) {
        refreshSelectedConv(selectedIdRef.current);
      }
    };

    const es = IrisService.subscribeCollectionChanges({
      onChange: onEvent,
    });

    return () => es.close();
  }, [changeStreamsActive, refreshSelectedConv]);

  // Fallback: fingerprint-based refresh (when list changes detected new data)
  useEffect(() => {
    if (changeStreamsActive) return; // Change Streams handle this
    if (!selectedId || fingerprint === fingerprintRef.current) return;
    fingerprintRef.current = fingerprint;
    refreshSelectedConv(selectedId);
  }, [selectedId, fingerprint, changeStreamsActive, refreshSelectedConv]);

  // Conversation list — SSE-driven with polling fallback
  useEffect(() => {
    // Immediately clear stale data and reset tracking when filters change
    knownIdsRef.current = null;
    // Only reset auto-select when there is no initialId — otherwise the
    // deep-linked conversation would be overwritten by list[0].
    if (!initialId) autoSelectedRef.current = false;
    lastFingerprintRef.current = "";
    setConversations([]);
    setFingerprint("");

    loadConversations();

    // Subscribe to change stream SSE for real-time updates
    let pollInterval = null;
    const es = IrisService.subscribeCollectionChanges({
      onStatus: (data) => {
        setChangeStreamsActive(!!data.changeStreams);
        if (!data.changeStreams) {
          // No Change Streams — fall back to polling
          if (!pollInterval) {
            pollInterval = setInterval(loadConversations, POLL_INTERVAL);
          }
        }
      },
      onChange: (event) => {
        if (event.collection === "conversations") {
          loadConversations();
        }
      },
    });

    return () => {
      es.close();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [loadConversations]);

  // Fetch workflows for the selected conversation
  useEffect(() => {
    if (!selectedId) {
      setWorkflows([]);
      return;
    }
    IrisService.getConversationWorkflows(selectedId)
      .then(setWorkflows)
      .catch(() => setWorkflows([]));
  }, [selectedId]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (!loadingDetail && selectedConv && viewerBodyRef.current) {
      const el = viewerBodyRef.current;
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, loadingDetail]);

  const generatingDisplay = useMemo(() => generatingCount, [generatingCount]);

  async function selectConversation(id) {
    if (id === selectedId) return;
    setSelectedId(id);
    // Update URL for deep-linking (preserve all filter params)
    const params = new URLSearchParams();
    if (activeSession) params.set("session", activeSession);
    if (projectFilter) params.set("project", projectFilter);
    if (providerFilter) params.set("provider", providerFilter);
    if (modelFilter) params.set("model", modelFilter);
    const qs = params.toString();
    window.history.replaceState(
      null,
      "",
      `/admin/conversations/${id}${qs ? `?${qs}` : ""}`,
    );
    // Remove NEW badge when clicking into a conversation
    setNewIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setLoadingDetail(true);
    try {
      const conv = await IrisService.getConversation(id);
      setSelectedConv(conv);
    } catch {
      setSelectedConv(null);
    } finally {
      setLoadingDetail(false);
    }
  }

  const convTitle = selectedConv
    ? selectedConv.title || "Untitled Conversation"
    : "Select a conversation";

  const msgs = useMemo(() => selectedConv?.messages || [], [selectedConv]);

  const uniqueModels = useMemo(
    () => getUniqueModels(msgs),
    [msgs],
  );

  const totalCost = useMemo(
    () => getConversationCost(msgs),
    [msgs],
  );

  const { totalTokens, requestCount } = useMemo(
    () => getConversationTokenStats(msgs),
    [msgs],
  );

  // Derive tools used across all messages with invocation counts
  const usedTools = useMemo(() => getUsedTools(msgs), [msgs]);

  const modalities = useMemo(
    () => getModalities(selectedConv?.messages || []),
    [selectedConv],
  );

  const settingsWithDefaults = useMemo(
    () => ({ ...SETTINGS_DEFAULTS, ...(selectedConv?.settings || {}) }),
    [selectedConv],
  );

  // Inject controls into AdminShell header
  useEffect(() => {
    setControls(
      <>
        <SelectDropdown
          value={projectFilter || ""}
          options={projectOptions}
          onChange={handleProjectChange}
          placeholder="All Projects"
          disabled={!!activeSession}
        />
        {generatingCount > 0 && (
          <span className={`${styles.statPill} ${styles.statPillGenerating}`}>
            <Loader size={10} className={styles.spinning} />
            {generatingDisplay} generating
          </span>
        )}
        <ErrorMessage message={error} />
      </>,
    );
  }, [
    setControls,
    projectFilter,
    projectOptions,
    handleProjectChange,
    generatingCount,
    generatingDisplay,
    error,
    activeSession,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      setControls(null);
      setTitleBadge(null);
    };
  }, [setControls, setTitleBadge]);

  // Set title badge with conversations count
  useEffect(() => {
    setTitleBadge(conversations.length);
  }, [setTitleBadge, conversations.length]);

  return (
    <div className={styles.page}>
      {/* Chat-like 3-panel layout */}
      <div className={styles.chatContainer}>
        <ThreePanelLayout
          leftPanel={
            selectedConv?.settings ? (
              <>
                <TabBarComponent
                  tabs={[
                    {
                      key: "settings",
                      icon: <Settings size={14} />,
                    },
                    {
                      key: "params",
                      icon: <SlidersHorizontal size={14} />,
                    },
                  ]}
                  activeTab={leftTab}
                  onChange={setLeftTab}
                />
                {leftTab === "settings" && (
                  <SettingsPanel
                    config={config}
                    settings={settingsWithDefaults}
                    readOnly
                    hideProviderModel
                    workflows={workflows}
                    conversationStats={
                      selectedConv?.messages?.length > 0
                        ? (() => {
                            const displayMessages = prepareDisplayMessages(selectedConv.messages);
                            return {
                              messageCount: displayMessages.length,
                              deletedCount:
                                (selectedConv.messageCount || selectedConv.messages.length) -
                                selectedConv.messages.length,
                              requestCount,
                              uniqueModels,
                              totalTokens,
                              totalCost,
                              originalTotalCost: selectedConv.totalCost || 0,
                              usedTools,
                              modalities,
                            };
                          })()
                        : null
                    }
                  />
                )}
                {leftTab === "params" && (
                  <ParametersPanelComponent
                    settings={settingsWithDefaults}
                    config={config}
                    readOnly
                  />
                )}
              </>
            ) : (
              <div className={styles.emptyPanel}>
                Select a conversation to view settings
              </div>
            )
          }
          rightPanel={
            <HistoryPanel
              conversations={conversations}
              activeId={selectedId}
              onSelect={(conv) => selectConversation(conv.id)}
              readOnly
              showProject
              showUsername
              newIds={newIds}
              initialProviders={providerFilter ? [providerFilter] : undefined}
              initialSearch={modelFilter || ""}
            />
          }
          rightTitle={`${conversations.length} Conversations`}
          headerTitle={convTitle}
          headerMeta={
            selectedConv && (
              <div className={styles.headerMeta}>
                <ProjectBadgeComponent project={selectedConv.project} />
                <UserBadgeComponent username={selectedConv.username} />
                {selectedConv.isGenerating && (
                  <span className={styles.generatingBadge}>
                    <Loader size={12} className={styles.spinning} />
                    Generating
                  </span>
                )}
              </div>
            )
          }
          headerCenter={
            selectedConv?.settings?.provider ? (
              <ModelPickerPopoverComponent
                config={config}
                settings={settingsWithDefaults}
                onSelectModel={() => {}}
                readOnly
              />
            ) : null
          }
        >
          <div className={styles.viewerBody} ref={viewerBodyRef}>
            {!selectedConv && !loadingDetail ? (
              <div className={styles.emptyViewer}>
                <MessageSquare
                  size={40}
                  style={{ opacity: 0.3, marginBottom: 12 }}
                />
                <div>Select a conversation to view</div>
              </div>
            ) : loadingDetail ? (
              <div className={styles.emptyViewer}>Loading conversation...</div>
            ) : (
              <MessageList
                messages={prepareDisplayMessages(selectedConv.messages || [])}
                readOnly
                systemPrompt={selectedConv.systemPrompt}
              />
            )}
          </div>
        </ThreePanelLayout>
      </div>
    </div>
  );
}

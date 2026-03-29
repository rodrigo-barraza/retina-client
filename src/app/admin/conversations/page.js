"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
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

import styles from "./page.module.css";

const POLL_INTERVAL = 5000; // 5s

const SETTINGS_DEFAULTS = {
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

export default function ConversationsPage({ initialId = null }) {
  const { projectFilter, projectOptions, handleProjectChange } =
    useProjectFilter();
  const searchParams = useSearchParams();
  const providerFilter = searchParams.get("provider") || null;
  const modelFilter = searchParams.get("model") || null;
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(initialId);
  const [selectedConv, setSelectedConv] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [config, setConfig] = useState(null);

  const [newIds, setNewIds] = useState(new Set());
  const [generatingCount, setGeneratingCount] = useState(0);
  const [recentCount, setRecentCount] = useState(0);
  const [workflows, setWorkflows] = useState([]);
  const [leftTab, setLeftTab] = useState("settings");

  const knownIdsRef = useRef(null); // null = not yet initialized
  const lastFingerprintRef = useRef("");
  const autoSelectedRef = useRef(!!initialId);
  const viewerBodyRef = useRef(null);
  const intervalRef = useRef(null);

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
      if (projectFilter) params.project = projectFilter;
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
      setLoading((prev) => (prev ? false : prev));
    } catch (err) {
      setError(err.message);
      setLoading((prev) => (prev ? false : prev));
    }
  }, [projectFilter, providerFilter, modelFilter]);

  // Initial stats fetch + SSE subscription for real-time updates
  useEffect(() => {
    // Immediate HTTP fetch for initial values
    IrisService.getConversationStats(projectFilter)
      .then((data) => {
        setGeneratingCount(data.generatingCount || 0);
        setRecentCount(data.recentCount || 0);
      })
      .catch(() => {
        /* SSE will handle it */
      });

    // SSE for continuous real-time updates
    const es = IrisService.subscribeConversationStats((data) => {
      setGeneratingCount(data.generatingCount || 0);
      setRecentCount(data.recentCount || 0);
    }, projectFilter);
    return () => es.close();
  }, [projectFilter]);

  // Re-fetch selected conversation periodically via conversation list fingerprint
  const fingerprintRef = useRef("");
  const [fingerprint, setFingerprint] = useState("");

  useEffect(() => {
    if (!selectedId || fingerprint === fingerprintRef.current) return;
    fingerprintRef.current = fingerprint;
    let cancelled = false;
    (async () => {
      try {
        const full = await IrisService.getConversation(selectedId);
        if (!cancelled) {
          setSelectedConv((prev) => {
            const oldMsgs = prev?.messages || [];
            const newMsgs = full?.messages || [];
            if (oldMsgs.length !== newMsgs.length) return full;
            const oldLast = oldMsgs[oldMsgs.length - 1];
            const newLast = newMsgs[newMsgs.length - 1];
            if (oldLast?.content?.length !== newLast?.content?.length)
              return full;
            return prev;
          });
        }
      } catch (err) {
        console.error("Failed to refresh selected conversation:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId, fingerprint]);

  // Polling — conversation list only
  useEffect(() => {
    knownIdsRef.current = null;
    autoSelectedRef.current = false;
    loadConversations();
    intervalRef.current = setInterval(loadConversations, POLL_INTERVAL);
    return () => clearInterval(intervalRef.current);
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

  const uniqueModels = useMemo(
    () => [
      ...new Set(
        (selectedConv?.messages || [])
          .filter((m) => m.role === "assistant" && m.model)
          .map((m) => m.model),
      ),
    ],
    [selectedConv],
  );

  const totalCost = useMemo(
    () =>
      (selectedConv?.messages || []).reduce(
        (sum, m) => sum + (m.estimatedCost || 0),
        0,
      ),
    [selectedConv],
  );

  const { totalTokens, requestCount } = useMemo(() => {
    let input = 0;
    let output = 0;
    let requests = 0;
    for (const m of selectedConv?.messages || []) {
      if (m.role !== "assistant" || !m.usage) continue;
      requests++;
      input +=
        (m.usage.inputTokens || 0) +
        (m.usage.cacheReadInputTokens || 0) +
        (m.usage.cacheCreationInputTokens || 0);
      output += m.usage.outputTokens || 0;
    }
    return {
      totalTokens: { input, output, total: input + output },
      requestCount: requests,
    };
  }, [selectedConv]);

  // Derive tools used across all messages with invocation counts
  const usedTools = useMemo(() => {
    const counts = new Map();
    for (const m of selectedConv?.messages || []) {
      if (m.role !== "assistant") continue;
      if (m.thinking) counts.set("Thinking", (counts.get("Thinking") || 0) + 1);
      if (m.toolCalls?.length > 0) {
        counts.set("Function Calling", (counts.get("Function Calling") || 0) + 1);
        for (const tc of m.toolCalls) {
          if (tc.name) counts.set(tc.name, (counts.get(tc.name) || 0) + 1);
        }
      }
    }
    return [...counts.entries()].map(([name, count]) => ({ name, count }));
  }, [selectedConv]);

  const modalities = useMemo(
    () => getModalities(selectedConv?.messages || []),
    [selectedConv],
  );

  const settingsWithDefaults = useMemo(
    () => ({ ...SETTINGS_DEFAULTS, ...(selectedConv?.settings || {}) }),
    [selectedConv],
  );

  const { setControls } = useAdminHeader();

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
        <span className={styles.liveDot}>
          <span className={styles.liveDotInner} />
          Live
        </span>
        <span className={styles.statPill}>
          {loading ? "..." : recentCount} recent
        </span>
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
    loading,
    recentCount,
    generatingCount,
    generatingDisplay,
    error,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => setControls(null);
  }, [setControls]);

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
                        ? {
                            messageCount: selectedConv.messages.length,
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
                          }
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
                <span className={styles.metaBadge}>{selectedConv.project}</span>
                {selectedConv.username &&
                  selectedConv.username !== "unknown" && (
                    <span className={styles.userBadge}>
                      {selectedConv.username}
                    </span>
                  )}
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
              />
            )}
          </div>
        </ThreePanelLayout>
      </div>
    </div>
  );
}

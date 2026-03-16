"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
    Activity,
    AlertCircle,
    Loader,
    MessageSquare,
} from "lucide-react";
import { IrisService } from "../../../services/IrisService";
import { PrismService } from "../../../services/PrismService";
import MessageList from "../../../components/MessageList";
import SettingsPanel from "../../../components/SettingsPanel";
import HistoryPanel from "../../../components/HistoryPanel";
import StatsCard from "../../../components/StatsCard";
import ThreePanelLayout from "../../../components/ThreePanelLayout";
import styles from "./page.module.css";

const POLL_INTERVAL = 5000; // 5s

export default function ConversationsPage({ initialId = null }) {
    const [conversations, setConversations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedId, setSelectedId] = useState(initialId);
    const [selectedConv, setSelectedConv] = useState(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [config, setConfig] = useState(null);
    const [showModelList, setShowModelList] = useState(false);
    const [newIds, setNewIds] = useState(new Set());
    const [activeCount, setActiveCount] = useState(0);
    const [fingerprint, setFingerprint] = useState("");

    const knownIdsRef = useRef(null); // null = not yet initialized
    const lastFingerprintRef = useRef("");
    const autoSelectedRef = useRef(!!initialId);
    const viewerBodyRef = useRef(null);
    const intervalRef = useRef(null);

    useEffect(() => {
        PrismService.getConfig()
            .then(setConfig)
            .catch(() => { });
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
            const data = await IrisService.getConversations({
                page: 1,
                limit: 200,
                sort: "updatedAt",
                order: "desc",
            });
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
    }, []);

    // Also poll live activity for stats
    const loadLiveStats = useCallback(async () => {
        try {
            const live = await IrisService.getLiveActivity(5);
            setActiveCount(live.activeCount || 0);
        } catch { /* ignore */ }
    }, []);

    // Re-fetch selected conversation when fingerprint changes
    const fingerprintRef = useRef("");

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
                        if (oldLast?.content?.length !== newLast?.content?.length) return full;
                        return prev;
                    });
                }
            } catch (err) {
                console.error("Failed to refresh selected conversation:", err);
            }
        })();
        return () => { cancelled = true; };
    }, [selectedId, fingerprint]);

    // Polling
    useEffect(() => {
        loadConversations();
        loadLiveStats();
        intervalRef.current = setInterval(() => {
            loadConversations();
            loadLiveStats();
        }, POLL_INTERVAL);
        return () => clearInterval(intervalRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Auto-scroll to bottom
    useEffect(() => {
        if (!loadingDetail && selectedConv && viewerBodyRef.current) {
            const el = viewerBodyRef.current;
            requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedId, loadingDetail]);

    const generatingCount = useMemo(
        () => conversations.filter((c) => c.isGenerating).length,
        [conversations],
    );

    const recentActiveCount = useMemo(
        () => conversations.filter((c) => {
            const diff = Date.now() - new Date(c.updatedAt || c.lastActivity).getTime();
            return diff < 120000;
        }).length,
        [conversations],
    );

    async function selectConversation(id) {
        if (id === selectedId) return;
        setSelectedId(id);
        // Update URL for deep-linking
        window.history.replaceState(null, "", `/admin/conversations/${id}`);
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

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <div className={styles.titleRow}>
                    <h1 className={styles.pageTitle}>Conversations</h1>
                    <span className={styles.liveDot}>
                        <span className={styles.liveDotInner} />
                        Live
                    </span>
                </div>
                <p className={styles.pageSubtitle}>
                    Browse conversations across all projects
                </p>
            </div>

            {error && (
                <div className={styles.errorBanner}>
                    <AlertCircle size={18} />
                    {error}
                </div>
            )}

            {/* Stats */}
            <div className={styles.statsRow}>
                <StatsCard
                    label="Active Conversations"
                    value={loading ? "..." : activeCount}
                    subtitle="Updated in last 5 minutes"
                    icon={Activity}
                    variant="success"
                    loading={loading}
                />
                <StatsCard
                    label="Active Now"
                    value={loading ? "..." : recentActiveCount}
                    subtitle="Updated in last 2 minutes"
                    icon={MessageSquare}
                    variant="accent"
                    loading={loading}
                />
                <StatsCard
                    label="Generating"
                    value={loading ? "..." : generatingCount}
                    subtitle="Currently streaming"
                    icon={Loader}
                    variant="info"
                    loading={loading}
                />
            </div>

            {/* Chat-like 3-panel layout */}
            <div className={styles.chatContainer}>
                <ThreePanelLayout
                    leftPanel={
                        selectedConv?.settings ? (
                            <SettingsPanel
                                config={config}
                                settings={selectedConv.settings}
                                readOnly
                            />
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
                        />
                    }
                    rightTitle="Conversations"
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
                                <span>{selectedConv.messages?.length || 0} messages</span>
                                {uniqueModels.length === 1 && <span>{uniqueModels[0]}</span>}
                                {uniqueModels.length > 1 && (
                                    <span className={styles.modelDropdownWrapper}>
                                        <button
                                            className={styles.modelDropdownTrigger}
                                            onClick={() => setShowModelList((v) => !v)}
                                        >
                                            {uniqueModels.length} models
                                        </button>
                                        {showModelList && (
                                            <>
                                                <div
                                                    className={styles.modelDropdownBackdrop}
                                                    onClick={() => setShowModelList(false)}
                                                />
                                                <div className={styles.modelDropdown}>
                                                    {uniqueModels.map((m) => (
                                                        <div key={m} className={styles.modelDropdownItem}>
                                                            {m}
                                                        </div>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </span>
                                )}
                                {totalCost > 0 && <span>${totalCost.toFixed(5)}</span>}
                                {selectedConv.isGenerating && (
                                    <span className={styles.generatingBadge}>
                                        <Loader size={12} className={styles.spinning} />
                                        Generating
                                    </span>
                                )}
                            </div>
                        )
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
                            <MessageList messages={selectedConv.messages || []} readOnly />
                        )}
                    </div>
                </ThreePanelLayout>
            </div>
        </div>
    );
}

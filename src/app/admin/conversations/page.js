"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { AlertCircle, MessageSquare } from "lucide-react";
import { IrisService } from "../../../services/IrisService";
import { PrismService } from "../../../services/PrismService";
import MessageList from "../../../components/MessageList";
import SettingsPanel from "../../../components/SettingsPanel";
import HistoryPanel from "../../../components/HistoryPanel";
import ThreePanelLayout from "../../../components/ThreePanelLayout";
import styles from "./page.module.css";

export default function ConversationsPage() {
    const [conversations, setConversations] = useState([]);
    const [_loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedId, setSelectedId] = useState(null);
    const [selectedConv, setSelectedConv] = useState(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [config, setConfig] = useState(null);
    const [showModelList, setShowModelList] = useState(false);

    useEffect(() => {
        PrismService.getConfig()
            .then(setConfig)
            .catch(() => { });
    }, []);

    const loadConversations = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await IrisService.getConversations({
                page: 1,
                limit: 200,
                sort: "updatedAt",
                order: "desc",
            });
            const list = data.data || [];
            setConversations(list);
            // Auto-select the most recent conversation on first load
            if (list.length > 0 && !selectedId) {
                selectConversation(list[0].id);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadConversations();
    }, [loadConversations]);

    async function selectConversation(id) {
        if (id === selectedId) return;
        setSelectedId(id);
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
                <h1 className={styles.pageTitle}>Conversations</h1>
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
                        />
                    }
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
                            </div>
                        )
                    }
                >
                    <div className={styles.viewerBody}>
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

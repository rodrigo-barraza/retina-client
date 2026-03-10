"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { AlertCircle, MessageSquare, Settings, History } from "lucide-react";
import { IrisService } from "../../../services/IrisService";
import { PrismService } from "../../../services/PrismService";
import MessageList from "../../../components/MessageList";
import SettingsPanel from "../../../components/SettingsPanel";
import HistoryPanel from "../../../components/HistoryPanel";
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
  const [showSettings, setShowSettings] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= 768 : true,
  );
  const [showHistory, setShowHistory] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= 768 : true,
  );

  useEffect(() => {
    PrismService.getConfig()
      .then(setConfig)
      .catch(() => {});
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
        {/* Settings Sidebar */}
        <aside
          className={`${styles.settingsSidebar} ${!showSettings ? styles.sidebarHidden : ""}`}
        >
          <div className={styles.glassHeader}>Settings</div>
          {selectedConv?.settings ? (
            <SettingsPanel
              config={config}
              settings={selectedConv.settings}
              readOnly
            />
          ) : (
            <div className={styles.emptyPanel}>
              Select a conversation to view settings
            </div>
          )}
        </aside>

        <button
          className={`${styles.sidebarToggle} ${showHistory && !showSettings ? styles.mobileHidden : ""}`}
          onClick={() => {
            const next = !showSettings;
            setShowSettings(next);
            if (next && window.innerWidth < 768) setShowHistory(false);
          }}
          title={showSettings ? "Hide settings" : "Show settings"}
        >
          <Settings size={14} />
        </button>

        {/* Main Chat / Viewer */}
        <section className={styles.mainViewer}>
          <div className={styles.glassHeader}>
            <span className={styles.headerTitle}>{convTitle}</span>
            {selectedConv && (
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
            )}
          </div>
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
        </section>

        <button
          className={`${styles.sidebarToggle} ${showSettings && !showHistory ? styles.mobileHidden : ""}`}
          onClick={() => {
            const next = !showHistory;
            setShowHistory(next);
            if (next && window.innerWidth < 768) setShowSettings(false);
          }}
          title={showHistory ? "Hide history" : "Show history"}
        >
          <History size={14} />
        </button>

        {/* History Sidebar */}
        <aside
          className={`${styles.historySidebar} ${!showHistory ? styles.sidebarHidden : ""}`}
        >
          <div className={styles.glassHeader}>History</div>
          <HistoryPanel
            conversations={conversations}
            activeId={selectedId}
            onSelect={(conv) => selectConversation(conv.id)}
            readOnly
            showProject
            showUsername
          />
        </aside>
      </div>
    </div>
  );
}

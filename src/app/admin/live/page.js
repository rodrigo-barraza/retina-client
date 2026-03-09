"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Activity,
  AlertCircle,
  Loader,
  MessageSquare,
  Settings,
  History,
} from "lucide-react";
import { IrisService } from "../../../services/IrisService";
import { PrismService } from "../../../services/PrismService";
import MessageList from "../../../components/MessageList";
import SettingsPanel from "../../../components/SettingsPanel";
import HistoryPanel from "../../../components/HistoryPanel";
import StatsCard from "../../../components/StatsCard";
import styles from "./page.module.css";

const REFRESH_INTERVAL = 2000; // 2s

export default function LivePage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedConv, setSelectedConv] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [config, setConfig] = useState(null);
  const [showModelList, setShowModelList] = useState(false);
  const [showSettings, setShowSettings] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= 768 : true
  );
  const [showHistory, setShowHistory] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= 768 : true
  );
  const intervalRef = useRef(null);
  const lastFingerprintRef = useRef("");
  const autoSelectedRef = useRef(false);
  const viewerBodyRef = useRef(null);
  const [fingerprint, setFingerprint] = useState("");

  useEffect(() => {
    PrismService.getConfig().then(setConfig).catch(() => {});
  }, []);

  async function loadLive() {
    try {
      const result = await IrisService.getLiveActivity(5);
      const convs = result?.conversations || [];

      // Only compare meaningful fields — NOT lastActivity which changes on every auto-save
      const fingerprint = convs.map((c) =>
        `${c.id}:${c.messageCount}:${c.isGenerating}`
      ).join("|");

      if (fingerprint !== lastFingerprintRef.current) {
        lastFingerprintRef.current = fingerprint;
        setData(result);
        setLastRefresh(new Date());
        setFingerprint(fingerprint);
      }

      // Auto-select the most recent live conversation on first load only
      if (convs.length > 0 && !autoSelectedRef.current) {
        autoSelectedRef.current = true;
        selectConversation(convs[0].id);
      }

      // Only clear error/loading if they were set
      setError((prev) => prev !== null ? null : prev);
      setLoading((prev) => prev ? false : prev);
    } catch (err) {
      setError(err.message);
      setLoading((prev) => prev ? false : prev);
    }
  }

  // Re-fetch selected conversation only when live fingerprint changes
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
            // Compare last message content to detect streaming updates
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

  useEffect(() => {
    loadLive();
    intervalRef.current = setInterval(loadLive, REFRESH_INTERVAL);
    return () => clearInterval(intervalRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll conversation viewer to bottom when a conversation is loaded
  useEffect(() => {
    if (!loadingDetail && selectedConv && viewerBodyRef.current) {
      const el = viewerBodyRef.current;
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, loadingDetail]);

  const conversations = useMemo(() => data?.conversations || [], [data]);
  const activeCount = data?.activeCount || 0;

  async function selectConversation(id) {
    if (id === selectedId) {
      setSelectedId(null);
      setSelectedConv(null);
      return;
    }
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

  // Memoize history items so HistoryPanel doesn't re-render on every poll
  const historyItems = useMemo(() => conversations.map((c) => ({
    id: c.id,
    title: c.title,
    project: c.project,
    updatedAt: c.lastActivity,
    messageCount: c.messageCount,
    isGenerating: c.isGenerating,
  })), [conversations]);

  const convTitle = selectedConv
    ? (selectedConv.title || "Untitled Conversation")
    : "Select a conversation";

  const uniqueModels = useMemo(() => [...new Set(
    (selectedConv?.messages || [])
      .filter((m) => m.role === "assistant" && m.model)
      .map((m) => m.model)
  )], [selectedConv]);

  const totalCost = useMemo(() =>
    (selectedConv?.messages || []).reduce((sum, m) => sum + (m.estimatedCost || 0), 0)
  , [selectedConv]);

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.titleRow}>
          <h1 className={styles.pageTitle}>Live Activity</h1>
          <span className={styles.liveDot}>
            <span className={styles.liveDotInner} />
            Live
          </span>
        </div>
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
          value={loading ? "..." : conversations.filter((c) => {
            const diff = Date.now() - new Date(c.lastActivity).getTime();
            return diff < 120000;
          }).length}
          subtitle="Updated in last 2 minutes"
          icon={MessageSquare}
          variant="accent"
          loading={loading}
        />
        <StatsCard
          label="Generating"
          value={loading ? "..." : conversations.filter((c) => c.isGenerating).length}
          subtitle="Currently streaming"
          icon={Loader}
          variant="info"
          loading={loading}
        />
      </div>

      {/* Chat-like 3-panel layout */}
      <div className={styles.chatContainer}>
        {/* Settings Sidebar */}
        <aside className={`${styles.settingsSidebar} ${!showSettings ? styles.sidebarHidden : ""}`}>
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

        {/* Main Viewer */}
        <section className={styles.mainViewer}>
          <div className={styles.glassHeader}>
            <span className={styles.headerTitle}>{convTitle}</span>
            {selectedConv && (
              <div className={styles.headerMeta}>
                <span className={styles.metaBadge}>{selectedConv.project}</span>
                <span>{selectedConv.messages?.length || 0} messages</span>
                {uniqueModels.length === 1 && (
                  <span>{uniqueModels[0]}</span>
                )}
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
                            <div key={m} className={styles.modelDropdownItem}>{m}</div>
                          ))}
                        </div>
                      </>
                    )}
                  </span>
                )}
                {totalCost > 0 && (
                  <span>${totalCost.toFixed(5)}</span>
                )}
                {selectedConv.isGenerating && (
                  <span className={styles.generatingBadge}>
                    <Loader size={12} className={styles.spinning} />
                    Generating
                  </span>
                )}
              </div>
            )}
          </div>
          <div className={styles.viewerBody} ref={viewerBodyRef}>
            {!selectedConv && !loadingDetail ? (
              <div className={styles.emptyViewer}>
                <MessageSquare
                  size={40}
                  style={{ opacity: 0.3, marginBottom: 12 }}
                />
                <div>Select a conversation from Live Activity</div>
              </div>
            ) : loadingDetail ? (
              <div className={styles.emptyViewer}>Loading conversation...</div>
            ) : (
              <MessageList
                messages={selectedConv.messages || []}
                readOnly
              />
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

        {/* Live Activity Sidebar */}
        <aside className={`${styles.historySidebar} ${!showHistory ? styles.sidebarHidden : ""}`}>
          <div className={styles.glassHeader}>Live Activity</div>
          <HistoryPanel
            conversations={historyItems}
            activeId={selectedId}
            onSelect={(conv) => selectConversation(conv.id)}
            readOnly
            showProject
          />
        </aside>
      </div>
    </div>
  );
}

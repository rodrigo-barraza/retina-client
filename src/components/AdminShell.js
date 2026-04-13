"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { X } from "lucide-react";
import IrisService from "../services/IrisService";

import NavigationSidebarComponent from "./NavigationSidebarComponent";
import DatePickerComponent from "./DatePickerComponent";
import { AdminHeaderProvider, useAdminHeader } from "./AdminHeaderContext";
import styles from "./AdminShell.module.css";

function AdminShellInner({ children }) {
  const [newCount, setNewCount] = useState(0);
  const [newTracesCount, setNewTracesCount] = useState(0);
  const [newRequestsCount, setNewRequestsCount] = useState(0);
  const [newMediaCount, setNewMediaCount] = useState(0);
  const [newTextCount, setNewTextCount] = useState(0);
  const [generatingCount, setGeneratingCount] = useState(0);
  const [systemStatus, setSystemStatus] = useState("connected");
  const pathname = usePathname();
  const router = useRouter();

  // Track conversations by ID → messageCount to detect both new convos and updates
  const knownConvsRef = useRef(null); // null = not initialized
  const knownSessionsRef = useRef(null);
  const knownRequestsRef = useRef(null);
  const knownMediaRef = useRef(null);
  const knownTextRef = useRef(null);
  const isOnConversationsRef = useRef(
    pathname.startsWith("/admin/conversations"),
  );
  const isOnSessionsRef = useRef(
    pathname.startsWith("/admin/traces"),
  );
  const isOnRequestsRef = useRef(
    pathname.startsWith("/admin/requests"),
  );
  const isOnMediaRef = useRef(
    pathname.startsWith("/admin/media"),
  );
  const isOnTextRef = useRef(
    pathname.startsWith("/admin/text"),
  );

  // Keep refs in sync with pathname
  useEffect(() => {
    const onConvs = pathname.startsWith("/admin/conversations");
    const onSessions = pathname.startsWith("/admin/traces");
    const onRequests = pathname.startsWith("/admin/requests");
    const onMedia = pathname.startsWith("/admin/media");
    const onText = pathname.startsWith("/admin/text");
    isOnConversationsRef.current = onConvs;
    isOnSessionsRef.current = onSessions;
    isOnRequestsRef.current = onRequests;
    isOnMediaRef.current = onMedia;
    isOnTextRef.current = onText;
    if (onConvs) setNewCount(0);
    if (onSessions) setNewTracesCount(0);
    if (onRequests) setNewRequestsCount(0);
    if (onMedia) setNewMediaCount(0);
    if (onText) setNewTextCount(0);
  }, [pathname]);

  // SSE subscription for real-time generatingCount across all projects
  // Minimum visual duration: keep the rainbow animation alive for at least 3s
  // so it's visible (Change Streams push transitions faster than old polling).
  const generatingTimerRef = useRef(null);
  useEffect(() => {
    const es = IrisService.subscribeConversationStats((data) => {
      const count = data.generatingCount || 0;
      if (count > 0) {
        // Clear any pending "stop generating" timer
        if (generatingTimerRef.current) {
          clearTimeout(generatingTimerRef.current);
          generatingTimerRef.current = null;
        }
        setGeneratingCount(count);
      } else {
        // Delay clearing to give the animation time to ramp up
        if (!generatingTimerRef.current) {
          generatingTimerRef.current = setTimeout(() => {
            setGeneratingCount(0);
            generatingTimerRef.current = null;
          }, 3000);
        }
      }
    });
    return () => {
      es.close();
      if (generatingTimerRef.current) clearTimeout(generatingTimerRef.current);
    };
  }, []);

  // ── Change Stream SSE: detect new conversations in real time ────
  // Falls back to polling if Change Streams aren't available.
  useEffect(() => {
    async function fetchSessions() {
      try {
        const data = await IrisService.getTraces({ page: 1, limit: 50 });
        const list = data.data || data.traces || [];
        const currentIds = new Set(list.map((s) => s.id));

        if (knownSessionsRef.current === null) {
          knownSessionsRef.current = currentIds;
        } else if (!isOnSessionsRef.current) {
          let newOnes = 0;
          for (const id of currentIds) {
            if (!knownSessionsRef.current.has(id)) newOnes++;
          }
          if (newOnes > 0) setNewTracesCount((prev) => prev + newOnes);
          knownSessionsRef.current = currentIds;
        } else {
          knownSessionsRef.current = currentIds;
        }
      } catch {
        // ignore
      }
    }

    async function fetchConversations() {
      try {
        const data = await IrisService.getConversations({
          page: 1,
          limit: 50,
          sort: "updatedAt",
          order: "desc",
        });
        const list = data.data || [];
        const currentMap = new Map();
        for (const c of list) {
          currentMap.set(c.id, c.messages?.length || c.messageCount || 0);
        }

        if (knownConvsRef.current === null) {
          knownConvsRef.current = currentMap;
        } else if (!isOnConversationsRef.current) {
          let changes = 0;
          for (const [id, msgCount] of currentMap) {
            const known = knownConvsRef.current.get(id);
            if (known === undefined) {
              changes++;
            } else if (msgCount > known) {
              changes++;
            }
          }
          if (changes > 0) {
            setNewCount((prev) => prev + changes);
          }
          knownConvsRef.current = currentMap;
        } else {
          knownConvsRef.current = currentMap;
        }
      } catch {
        // ignore
      }
    }

    async function fetchHealth() {
      try {
        const health = await IrisService.getHealth();
        setSystemStatus(health.mongo || "connected");
      } catch {
        setSystemStatus("disconnected");
      }
    }

    async function fetchRequests() {
      try {
        const data = await IrisService.getRequests({ limit: 50, sort: "timestamp", order: "desc" });
        const list = data.data || [];
        const currentIds = new Set(list.map((r) => r.requestId || r._id));

        if (knownRequestsRef.current === null) {
          knownRequestsRef.current = currentIds;
        } else if (!isOnRequestsRef.current) {
          let newOnes = 0;
          for (const id of currentIds) {
            if (!knownRequestsRef.current.has(id)) newOnes++;
          }
          if (newOnes > 0) setNewRequestsCount((prev) => prev + newOnes);
          knownRequestsRef.current = currentIds;
        } else {
          knownRequestsRef.current = currentIds;
        }
      } catch {
        // ignore
      }
    }

    async function fetchMedia() {
      try {
        const data = await IrisService.getMedia({ limit: 1 });
        const total = data.total || 0;

        if (knownMediaRef.current === null) {
          knownMediaRef.current = total;
        } else if (!isOnMediaRef.current && total > knownMediaRef.current) {
          setNewMediaCount((prev) => prev + (total - knownMediaRef.current));
          knownMediaRef.current = total;
        } else {
          knownMediaRef.current = total;
        }
      } catch {
        // ignore
      }
    }

    async function fetchText() {
      try {
        const data = await IrisService.getText({ limit: 1 });
        const total = data.total || 0;

        if (knownTextRef.current === null) {
          knownTextRef.current = total;
        } else if (!isOnTextRef.current && total > knownTextRef.current) {
          setNewTextCount((prev) => prev + (total - knownTextRef.current));
          knownTextRef.current = total;
        } else {
          knownTextRef.current = total;
        }
      } catch {
        // ignore
      }
    }

    // Initial loads
    fetchConversations();
    fetchSessions();
    fetchRequests();
    fetchMedia();
    fetchText();
    fetchHealth();

    // Health check on a long interval (doesn't need real-time)
    const healthInterval = setInterval(fetchHealth, 30000);

    // Subscribe to change stream SSE
    let pollInterval = null;
    const es = IrisService.subscribeCollectionChanges({
      onStatus: (data) => {
        if (!data.changeStreams) {
          // No Change Streams — fall back to polling
          if (!pollInterval) {
            pollInterval = setInterval(fetchConversations, 5000);
          }
        }
      },
      onChange: (event) => {
        if (event.collection === "conversations") {
          fetchConversations();
          fetchMedia();
          fetchText();
        }
        if (event.collection === "requests") {
          fetchRequests();
          fetchSessions(); // traces are derived from requests
        }
      },
    });

    return () => {
      es.close();
      clearInterval(healthInterval);
      if (pollInterval) clearInterval(pollInterval);
    };
  }, []);

  const handleNavClick = useCallback((href) => {
    if (href.startsWith("/admin/conversations")) setNewCount(0);
    if (href.startsWith("/admin/traces")) setNewTracesCount(0);
    if (href.startsWith("/admin/requests")) setNewRequestsCount(0);
    if (href.startsWith("/admin/media")) setNewMediaCount(0);
    if (href.startsWith("/admin/text")) setNewTextCount(0);
  }, []);

  const { controls, titleBadge, dateRange, setDateRange, sessionFilter, setSessionFilter } = useAdminHeader();

  const hasSessionFilter = !!sessionFilter;

  const handleClearSession = useCallback(() => {
    setSessionFilter(null);
    router.push("/admin/conversations");
  }, [setSessionFilter, router]);

  // Derive page title from pathname (first segment only)
  const pageTitle = (() => {
    const segment = pathname.replace("/admin", "").replace(/^\//, "");
    if (!segment) return "Dashboard";
    const first = segment.split("/")[0];
    // Convert "tool-requests" -> "Tool Requests"
    return first
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  })();

  return (
    <div className={styles.shell}>
      <NavigationSidebarComponent
        mode="admin"
        liveCount={newCount}
        tracesCount={newTracesCount}
        requestsCount={newRequestsCount}
        mediaCount={newMediaCount}
        textCount={newTextCount}
        systemStatus={systemStatus}
        isGenerating={generatingCount > 0}
        onNavClick={handleNavClick}
      />
      <div className={styles.mainArea}>
        <header className={styles.header}>
          <h1 className={styles.headerTitle}>
            {pageTitle}
            {titleBadge != null && (
              <span className={styles.titleCount}>: {titleBadge}</span>
            )}
          </h1>
          {hasSessionFilter && (
            <button
              type="button"
              className={styles.sessionBadge}
              onClick={handleClearSession}
              title="Clear session filter and show all conversations"
            >
              <span className={styles.sessionBadgeLabel}>Trace</span>
              <span className={styles.sessionBadgeId}>
                {sessionFilter.slice(0, 8)}
              </span>
              <X size={12} className={styles.sessionBadgeX} />
            </button>
          )}
          <div className={styles.headerDatePicker}>
            <DatePickerComponent
              from={dateRange.from}
              to={dateRange.to}
              onChange={setDateRange}
              disabled={hasSessionFilter}
            />
          </div>
          {controls && <div className={styles.headerControls}>{controls}</div>}
        </header>
        <div className={styles.main}>{children}</div>
      </div>
    </div>
  );
}

export default function AdminShell({ children }) {
  return (
    <AdminHeaderProvider>
      <AdminShellInner>{children}</AdminShellInner>
    </AdminHeaderProvider>
  );
}

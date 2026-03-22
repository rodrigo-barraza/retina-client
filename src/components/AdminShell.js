"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import IrisService from "../services/IrisService";

import NavigationSidebarComponent from "./NavigationSidebarComponent";
import { AdminHeaderProvider, useAdminHeader } from "./AdminHeaderContext";
import styles from "./AdminShell.module.css";

function AdminShellInner({ children }) {
  const [newCount, setNewCount] = useState(0);
  const [generatingCount, setGeneratingCount] = useState(0);
  const [systemStatus, setSystemStatus] = useState("connected");
  const pathname = usePathname();


  // Track conversations by ID → messageCount to detect both new convos and updates
  const knownConvsRef = useRef(null); // null = not initialized
  const isOnConversationsRef = useRef(pathname === "/admin/conversations");

  // Keep ref in sync with pathname
  useEffect(() => {
    isOnConversationsRef.current = pathname === "/admin/conversations";
    if (pathname === "/admin/conversations") {
      // Clear badge when navigating to conversations
      setNewCount(0);
    }
  }, [pathname]);

  // SSE subscription for real-time generatingCount across all projects
  useEffect(() => {
    const es = IrisService.subscribeConversationStats((data) => {
      setGeneratingCount(data.generatingCount || 0);
    });
    return () => es.close();
  }, []);

  useEffect(() => {
    async function poll() {
      try {
        const health = await IrisService.getHealth();
        setSystemStatus(health.mongo || "connected");

        // Fetch recent conversations to detect new ones and updates
        const data = await IrisService.getConversations({
          page: 1,
          limit: 50,
          sort: "updatedAt",
          order: "desc",
        });
        const list = data.data || [];

        // Build a map of id → messageCount
        const currentMap = new Map();
        for (const c of list) {
          currentMap.set(c.id, c.messages?.length || c.messageCount || 0);
        }

        if (knownConvsRef.current === null) {
          // First load — snapshot current state
          knownConvsRef.current = currentMap;
        } else if (!isOnConversationsRef.current) {
          // Only count changes when NOT on the conversations page
          let changes = 0;
          for (const [id, msgCount] of currentMap) {
            const known = knownConvsRef.current.get(id);
            if (known === undefined) {
              // Brand new conversation
              changes++;
            } else if (msgCount > known) {
              // Existing conversation got new messages
              changes++;
            }
          }
          if (changes > 0) {
            setNewCount((prev) => prev + changes);
          }
          // Update known state
          knownConvsRef.current = currentMap;
        } else {
          // On conversations page — keep known in sync but don't count
          knownConvsRef.current = currentMap;
        }
      } catch {
        setSystemStatus("disconnected");
      }
    }

    poll();
    const interval = setInterval(poll, 3000); // 3s
    return () => clearInterval(interval);
  }, []);

  const handleNavClick = useCallback((href) => {
    if (href === "/admin/conversations") {
      setNewCount(0);
    }
  }, []);

  const { controls } = useAdminHeader();

  // Derive page title from pathname (first segment only)
  const pageTitle = (() => {
    const segment = pathname.replace("/admin", "").replace(/^\//, "");
    if (!segment) return "Dashboard";
    const first = segment.split("/")[0];
    return first.charAt(0).toUpperCase() + first.slice(1);
  })();

  return (
    <div className={styles.shell}>
      <NavigationSidebarComponent
        mode="admin"
        liveCount={newCount}
        systemStatus={systemStatus}
        isGenerating={generatingCount > 0}
        onNavClick={handleNavClick}
      />
      <div className={styles.mainArea}>
        <header className={styles.header}>
          <h1 className={styles.headerTitle}>{pageTitle}</h1>
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

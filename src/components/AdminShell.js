"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import AdminSidebar from "./AdminSidebar";
import { IrisService } from "../services/IrisService";
import styles from "./AdminShell.module.css";

export default function AdminShell({ children }) {
  const [newCount, setNewCount] = useState(0);
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

  return (
    <div className={styles.shell}>
      <AdminSidebar
        liveCount={newCount}
        systemStatus={systemStatus}
        onNavClick={handleNavClick}
      />
      <main className={styles.main}>{children}</main>
    </div>
  );
}

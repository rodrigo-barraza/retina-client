"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FolderOpen,
  MessageSquare,
  ChevronDown,
  Loader,
  Cpu,
  Hash,
  Zap,
} from "lucide-react";
import IrisService from "../../../services/IrisService";
import PaginationComponent from "../../../components/PaginationComponent";
import ConversationsTableComponent from "../../../components/ConversationsTableComponent";
import ProjectBadgeComponent from "../../../components/ProjectBadgeComponent";
import UserBadgeComponent from "../../../components/UserBadgeComponent";
import CostBadgeComponent from "../../../components/CostBadgeComponent";
import ModalityIconComponent from "../../../components/ModalityIconComponent";
import { useAdminHeader } from "../../../components/AdminHeaderContext";
import { formatNumber } from "../../../utils/utilities";
import { DateTime } from "luxon";
import styles from "./page.module.css";

const PAGE_SIZE = 30;

/** Merge modalities from all conversations into a single object */
function mergeModalities(conversations) {
  const merged = {};
  for (const c of conversations) {
    if (!c.modalities) continue;
    for (const [key, val] of Object.entries(c.modalities)) {
      if (val) merged[key] = true;
    }
  }
  return Object.keys(merged).length > 0 ? merged : null;
}

/** Collect unique providers from all conversations */
function mergeProviders(conversations) {
  const set = new Set();
  for (const c of conversations) {
    const p = c.providers;
    if (Array.isArray(p)) p.forEach((v) => set.add(v));
    else if (p) set.add(p);
  }
  return [...set];
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState(new Set());

  const loadSessions = useCallback(async () => {
    try {
      const data = await IrisService.getSessions({
        page,
        limit: PAGE_SIZE,
        sort: "createdAt",
        order: "desc",
      });
      setSessions(data.data || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error("Failed to load sessions:", err);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    setLoading(true);
    loadSessions();
  }, [loadSessions]);

  const toggleExpand = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const { setControls } = useAdminHeader();

  useEffect(() => {
    setControls(
      <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
        {total} sessions
      </span>,
    );
  }, [setControls, total]);

  useEffect(() => {
    return () => setControls(null);
  }, [setControls]);

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
      <div className={styles.sessionList}>
        {sessions.map((session) => {
          const isExpanded = expandedIds.has(session.id);
          const convos = session.conversations || [];
          const ts = session.createdAt
            ? DateTime.fromISO(session.createdAt).toRelative()
            : "";
          const mergedModalities = mergeModalities(convos);
          const mergedProviders = mergeProviders(convos);
          const totalTokens =
            (session.totalInputTokens || 0) +
            (session.totalOutputTokens || 0);
          const models = session.models || [];

          return (
            <div key={session.id} className={styles.sessionCard}>
              {/* Clickable header */}
              <div
                className={styles.sessionHeader}
                onClick={() => toggleExpand(session.id)}
              >
                <div className={styles.sessionHeaderLeft}>
                  <FolderOpen size={16} className={styles.sessionIcon} />
                  <span className={styles.sessionId}>
                    {session.id.slice(0, 8)}
                  </span>
                  <span className={styles.sessionTimestamp}>{ts}</span>
                </div>
                <div className={styles.sessionHeaderRight}>
                  <ProjectBadgeComponent project={session.project} />
                  <UserBadgeComponent username={session.username} />

                  {mergedModalities && (
                    <ModalityIconComponent
                      modalities={mergedModalities}
                      size={12}
                    />
                  )}

                  {mergedProviders.length > 0 && (
                    <span className={styles.providerBadges}>
                      {mergedProviders.map((p) => (
                        <span key={p} className={styles.providerBadge}>
                          {p}
                        </span>
                      ))}
                    </span>
                  )}

                  {/* Stats badges */}
                  <span
                    className={`${styles.badge} ${styles.badgeConversations}`}
                  >
                    <MessageSquare size={10} />
                    {session.conversationCount || convos.length || 0}
                  </span>

                  {(session.requestCount || 0) > 0 && (
                    <span className={styles.statBadge}>
                      <Zap size={10} />
                      {session.requestCount} req
                    </span>
                  )}

                  {models.length > 0 && (
                    <span className={styles.statBadge}>
                      <Cpu size={10} />
                      {models.length === 1
                        ? models[0]
                        : `${models.length} models`}
                    </span>
                  )}

                  {totalTokens > 0 && (
                    <>
                      <span className={styles.statBadge}>
                        <Hash size={10} />
                        {formatNumber(session.totalInputTokens)} in
                      </span>
                      <span className={styles.statBadge}>
                        <Hash size={10} />
                        {formatNumber(session.totalOutputTokens)} out
                      </span>
                      <span className={styles.statBadge}>
                        <Hash size={10} />
                        {formatNumber(totalTokens)} total
                      </span>
                    </>
                  )}

                  <CostBadgeComponent cost={session.totalCost} />

                  <ChevronDown
                    size={14}
                    className={`${styles.chevron} ${isExpanded ? styles.chevronOpen : ""}`}
                  />
                </div>
              </div>

              {/* Expanded: show conversations table */}
              {isExpanded && (
                <div className={styles.conversationList}>
                  <ConversationsTableComponent
                    conversations={convos}
                    emptyText="No conversations linked"
                    compact
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      <PaginationComponent
        page={page}
        totalPages={totalPages}
        totalItems={total}
        onPageChange={setPage}
        limit={PAGE_SIZE}
      />
    </div>
  );
}

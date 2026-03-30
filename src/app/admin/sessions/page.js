"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { FolderOpen, Loader } from "lucide-react";
import IrisService from "../../../services/IrisService";
import PaginationComponent from "../../../components/PaginationComponent";
import SessionsTableComponent from "../../../components/SessionsTableComponent";
import { useAdminHeader } from "../../../components/AdminHeaderContext";

import styles from "./page.module.css";

const PAGE_SIZE = 30;
const POLL_INTERVAL = 1000; // 1s

export default function SessionsPage() {
  const [sessions, setSessions] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef(null);
  const initialLoadDone = useRef(false);

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
      if (!initialLoadDone.current) {
        initialLoadDone.current = true;
        setLoading(false);
      }
    }
  }, [page]);

  useEffect(() => {
    initialLoadDone.current = false;
    setLoading(true);
    loadSessions();
    intervalRef.current = setInterval(loadSessions, POLL_INTERVAL);
    return () => clearInterval(intervalRef.current);
  }, [loadSessions]);

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
      <SessionsTableComponent
        sessions={sessions}
        emptyText="No sessions"
      />

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

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { ArrowLeft, AlertCircle } from "lucide-react";
import Link from "next/link";
import { IrisService } from "../../../services/IrisService";
import WorkflowComponent from "../../../components/WorkflowComponent";
import styles from "./page.module.css";

export default function AdminWorkflowsPage() {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadWorkflows = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await IrisService.getWorkflows({
        page: 1,
        limit: 200,
        sort: "createdAt",
        order: "desc",
      });
      const list = data.data || [];
      setWorkflows(list);
      if (list.length > 0 && !selectedId) {
        selectWorkflow(list[0]._id);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadWorkflows();
  }, [loadWorkflows]);

  async function selectWorkflow(id) {
    if (id === selectedId) return;
    setSelectedId(id);
    setSelectedNodeId(null);
    setLoadingDetail(true);
    try {
      const wf = await IrisService.getWorkflow(id);
      setSelectedWorkflow(wf);
    } catch {
      setSelectedWorkflow(null);
    } finally {
      setLoadingDetail(false);
    }
  }

  // Use persisted nodeResults and nodeStatuses from the workflow document
  const nodeResults = useMemo(() => {
    return selectedWorkflow?.nodeResults || {};
  }, [selectedWorkflow]);

  const nodeStatuses = useMemo(() => {
    return selectedWorkflow?.nodeStatuses || {};
  }, [selectedWorkflow]);

  // Local node state for drag-to-rearrange (not persisted)
  const [localNodes, setLocalNodes] = useState([]);

  // Reset local nodes whenever the selected workflow changes
  useEffect(() => {
    setLocalNodes(selectedWorkflow?.nodes || []);
  }, [selectedWorkflow]);

  const handleUpdateNodePosition = useCallback((nodeId, position) => {
    setLocalNodes((prev) =>
      prev.map((n) => (n.id === nodeId ? { ...n, position } : n)),
    );
  }, []);

  // Download workflow as JSON file
  const handleDownloadWorkflow = useCallback(async (id) => {
    try {
      const wf = await IrisService.getWorkflow(id);
      if (!wf) return;
      const data = JSON.stringify(wf, null, 2);
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `workflow-${id}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("Workflow downloaded");
    } catch (err) {
      showToast(`Download failed: ${err.message}`, "error");
    }
  }, []);

  // Copy workflow JSON to clipboard
  const handleCopyWorkflow = useCallback(async (id) => {
    try {
      const wf = await IrisService.getWorkflow(id);
      if (!wf) return;
      const data = JSON.stringify(wf, null, 2);
      await navigator.clipboard.writeText(data);
      showToast("Workflow copied to clipboard");
    } catch (err) {
      showToast(`Copy failed: ${err.message}`, "error");
    }
  }, []);

  const nodeCount = localNodes.length;
  const connectionCount = selectedWorkflow?.connections?.length || 0;

  return (
    <div className={styles.page}>
      {/* Header — matches /workflows layout */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <Link href="/admin" className={styles.backBtn}>
            <ArrowLeft size={16} />
          </Link>
          <h1 className={styles.headerTitle}>Workflows</h1>
          <span className={styles.headerBadge}>
            {nodeCount} nodes · {connectionCount} connections
          </span>
        </div>
        <div className={styles.headerRight}>
          {error && (
            <span style={{ color: "var(--danger)", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
              <AlertCircle size={14} />
              {error}
            </span>
          )}
        </div>
      </header>

      {/* Body */}
      <div className={styles.body}>
        {loadingDetail && !selectedWorkflow ? (
          <div className={styles.emptyCanvas}>Loading workflow…</div>
        ) : (
          <WorkflowComponent
            readOnly
            admin
            nodes={localNodes}
            connections={selectedWorkflow?.connections || []}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
            onUpdateNodePosition={handleUpdateNodePosition}
            nodeResults={nodeResults}
            nodeStatuses={nodeStatuses}
            workflows={workflows}
            activeWorkflowId={selectedId}
            onLoadWorkflow={selectWorkflow}
            loading={loading}
            onDownloadWorkflow={handleDownloadWorkflow}
            onCopyWorkflow={handleCopyWorkflow}
          />
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`${styles.toast} ${styles[toast.type] || ""}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}

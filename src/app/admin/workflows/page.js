"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { ArrowLeft, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import IrisService from "../../../services/IrisService";
import WorkflowComponent from "../../../components/WorkflowComponent";
import WorkflowHeaderStatsComponent from "../../../components/WorkflowHeaderStatsComponent";
import SelectDropdown from "../../../components/SelectDropdown";
import styles from "./page.module.css";

export default function AdminWorkflowsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectFilter = searchParams.get("project") || null;
  const initialId = searchParams.get("id") || null;
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(initialId);
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [toast, setToast] = useState(null);
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    IrisService.getConversationFilters()
      .then((data) => setProjects(data.projects || []))
      .catch(() => { });
  }, []);

  const projectOptions = useMemo(() => [
    { value: "", label: "All Projects" },
    ...projects.map((p) => ({ value: p, label: p })),
  ], [projects]);

  const handleProjectChange = useCallback((val) => {
    const params = new URLSearchParams(searchParams.toString());
    if (val) {
      params.set("project", val);
    } else {
      params.delete("project");
    }
    router.replace(`/admin/workflows?${params.toString()}`);
  }, [searchParams, router]);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadWorkflows = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {
        page: 1,
        limit: 200,
        sort: "createdAt",
        order: "desc",
      };
      if (projectFilter) params.project = projectFilter;
      const data = await IrisService.getWorkflows(params);
      const list = data.data || [];
      setWorkflows(list);
      if (list.length > 0 && !selectedId && !initialId) {
        selectWorkflow(list[0]._id);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectFilter]);

  useEffect(() => {
    loadWorkflows();
  }, [loadWorkflows]);

  async function selectWorkflow(id) {
    if (id === selectedId) return;
    setSelectedId(id);
    setSelectedNodeId(null);
    // Update URL for deep-linking
    const params = new URLSearchParams(searchParams.toString());
    params.set("id", id);
    window.history.replaceState(null, "", `/admin/workflows?${params.toString()}`);
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

  // Auto-load workflow from URL param
  useEffect(() => {
    if (!initialId) return;
    selectWorkflow(initialId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialId]);

  // Use persisted nodeResults and nodeStatuses from the workflow document
  const nodeResults = useMemo(() => {
    return selectedWorkflow?.nodeResults || {};
  }, [selectedWorkflow]);

  // nodeStatuses are ephemeral runtime state — always empty for read-only view
  const nodeStatuses = useMemo(() => ({}), []);

  const edgeCount = useMemo(() => {
    const edges = selectedWorkflow?.edges || selectedWorkflow?.connections || [];
    return edges.length;
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

  return (
    <div className={styles.page}>
      {/* Header — matches /workflows layout */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <Link href="/admin" className={styles.backBtn}>
            <ArrowLeft size={16} />
          </Link>
          <h1 className={styles.headerTitle}>Workflows</h1>
          <SelectDropdown
            value={projectFilter || ""}
            options={projectOptions}
            onChange={handleProjectChange}
            placeholder="All Projects"
          />
          <WorkflowHeaderStatsComponent nodes={localNodes} edgeCount={edgeCount} />
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
            connections={selectedWorkflow?.edges || selectedWorkflow?.connections || []}
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

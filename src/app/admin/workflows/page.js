"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import IrisService from "../../../services/IrisService";
import WorkflowComponent from "../../../components/WorkflowComponent";
import WorkflowHeaderStatsComponent from "../../../components/WorkflowHeaderStatsComponent";
import SelectDropdown from "../../../components/SelectDropdown";
import { ErrorMessage } from "../../../components/StateMessageComponent";
import { useToast } from "../../../components/ToastComponent";
import { useAdminHeader } from "../../../components/AdminHeaderContext";
import useProjectFilter from "../../../hooks/useProjectFilter";
import { copyToClipboard } from "../../../utils/utilities";
import styles from "./page.module.css";

export default function AdminWorkflowsPage() {
  const { projectFilter, projectOptions, handleProjectChange } =
    useProjectFilter();
  const searchParams = useSearchParams();
  const initialId = searchParams.get("id") || null;
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(initialId);
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [toastElement, showToast] = useToast();

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
    window.history.replaceState(
      null,
      "",
      `/admin/workflows?${params.toString()}`,
    );
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
    const edges =
      selectedWorkflow?.edges || selectedWorkflow?.connections || [];
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
      await copyToClipboard(data);
      showToast("Workflow copied to clipboard");
    } catch (err) {
      showToast(`Copy failed: ${err.message}`, "error");
    }
  }, []);

  const { setControls } = useAdminHeader();

  // Inject controls into AdminShell header
  useEffect(() => {
    setControls(
      <>
        <SelectDropdown
          value={projectFilter || ""}
          options={projectOptions}
          onChange={handleProjectChange}
          placeholder="All Projects"
        />
        <WorkflowHeaderStatsComponent
          nodes={localNodes}
          edgeCount={edgeCount}
        />
        <ErrorMessage message={error} />
      </>,
    );
  }, [
    setControls,
    projectFilter,
    projectOptions,
    handleProjectChange,
    localNodes,
    edgeCount,
    error,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => setControls(null);
  }, [setControls]);

  return (
    <div className={styles.page}>
      {/* Body */}
      <div className={styles.body}>
        {loadingDetail && !selectedWorkflow ? (
          <div className={styles.emptyCanvas}>Loading workflow…</div>
        ) : (
          <WorkflowComponent
            readOnly
            admin
            nodes={localNodes}
            connections={
              selectedWorkflow?.edges || selectedWorkflow?.connections || []
            }
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

      {toastElement}
    </div>
  );
}

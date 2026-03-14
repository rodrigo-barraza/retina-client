"use client";

import { useState, useEffect, useCallback } from "react";
import { AlertCircle } from "lucide-react";
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
  }, []);

  useEffect(() => {
    loadWorkflows();
  }, [loadWorkflows]);

  async function selectWorkflow(id) {
    if (id === selectedId) return;
    setSelectedId(id);
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

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Workflows</h1>
        <p className={styles.pageSubtitle}>
          Lupos model chains — view the sequence of AI models used per reply
        </p>
      </div>

      {error && (
        <div className={styles.errorBanner}>
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      <div className={styles.layout}>
        {loadingDetail && !selectedWorkflow ? (
          <div className={styles.emptyCanvas}>Loading workflow…</div>
        ) : (
          <WorkflowComponent
            readOnly
            admin
            nodes={selectedWorkflow?.nodes || []}
            connections={selectedWorkflow?.connections || []}
            adminWorkflows={workflows}
            adminSelectedId={selectedId}
            onAdminSelectWorkflow={selectWorkflow}
            adminLoading={loading}
          />
        )}
      </div>
    </div>
  );
}

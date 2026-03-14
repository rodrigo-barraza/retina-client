"use client";

import { useState, useEffect, useCallback } from "react";
import { AlertCircle, GitBranch, Clock, User, Hash, Zap, X, ArrowRight } from "lucide-react";
import ProviderLogo from "../../../components/ProviderLogos";
import { IrisService } from "../../../services/IrisService";
import WorkflowViewer from "../../../components/WorkflowViewer";
import styles from "./page.module.css";

export default function AdminWorkflowsPage() {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [inspectedNode, setInspectedNode] = useState(null);

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
    setInspectedNode(null);
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

  function formatDuration(ms) {
    if (!ms) return "—";
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  function formatTime(isoString) {
    if (!isoString) return "";
    const d = new Date(isoString);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  }

  function handleNodeSelect(node) {
    setInspectedNode(node);
  }

  function getNodeLabel(id) {
    const nodes = selectedWorkflow?.nodes || [];
    const n = nodes.find((nd) => nd.id === id);
    return n ? (n.displayName || n.modelName || id) : id;
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
        {/* List panel */}
        <aside className={styles.listPanel}>
          <div className={styles.listHeader}>
            <span className={styles.listCount}>{workflows.length} workflows</span>
          </div>
          <div className={styles.listScroll}>
            {loading && workflows.length === 0 ? (
              <div className={styles.listEmpty}>Loading…</div>
            ) : workflows.length === 0 ? (
              <div className={styles.listEmpty}>No workflows yet</div>
            ) : (
              workflows.map((wf) => (
                <button
                  key={wf._id}
                  className={`${styles.listItem} ${selectedId === wf._id ? styles.listItemActive : ""}`}
                  onClick={() => selectWorkflow(wf._id)}
                >
                  <div className={styles.listItemTop}>
                    <span className={styles.listItemUser}>
                      <User size={11} />
                      {wf.userName || "unknown"}
                    </span>
                    <span className={styles.listItemTime}>
                      {formatTime(wf.createdAt)}
                    </span>
                  </div>
                  <div className={styles.listItemContent}>
                    {wf.userContent
                      ? wf.userContent.substring(0, 80) + (wf.userContent.length > 80 ? "…" : "")
                      : "No content"}
                  </div>
                  <div className={styles.listItemMeta}>
                    <span className={styles.metaTag}>
                      <Zap size={10} />
                      {wf.stepCount || 0} steps
                    </span>
                    <span className={styles.metaTag}>
                      <Clock size={10} />
                      {formatDuration(wf.totalDuration)}
                    </span>
                    {wf.channelName && wf.channelName !== "DM" && (
                      <span className={styles.metaTag}>
                        <Hash size={10} />
                        {wf.channelName}
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>

        {/* Canvas panel */}
        <div className={styles.canvasPanel}>
          {!selectedWorkflow && !loadingDetail ? (
            <div className={styles.emptyCanvas}>
              <GitBranch size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
              <div>Select a workflow to view</div>
            </div>
          ) : loadingDetail ? (
            <div className={styles.emptyCanvas}>Loading workflow…</div>
          ) : (
            <>
              <div className={styles.canvasHeader}>
                <span className={styles.canvasTitle}>
                  <User size={13} />
                  {selectedWorkflow.userName}
                </span>
                <span className={styles.canvasMeta}>
                  {selectedWorkflow.guildName !== "DM" && (
                    <span className={styles.metaBadge}>{selectedWorkflow.guildName}</span>
                  )}
                  <span className={styles.metaBadge}>
                    <Hash size={10} />
                    {selectedWorkflow.channelName || "DM"}
                  </span>
                  <span>
                    {selectedWorkflow.steps?.length || 0} steps · {formatDuration(selectedWorkflow.totalDuration)}
                  </span>
                </span>
              </div>
              {selectedWorkflow.userContent && (
                <div className={styles.userContentBar}>
                  &ldquo;{selectedWorkflow.userContent}&rdquo;
                </div>
              )}
              <div className={styles.canvasWrapper}>
                <WorkflowViewer
                  initialNodes={selectedWorkflow.nodes || []}
                  initialConnections={selectedWorkflow.connections || []}
                  readOnly
                  onNodeSelect={handleNodeSelect}
                />
              </div>
            </>
          )}
        </div>

        {/* Inspector pane */}
        {inspectedNode && (
          <aside className={styles.inspectorPanel}>
            <div className={styles.inspectorHeader}>
              <div className={styles.inspectorHeaderLeft}>
                <div className={styles.inspectorProviderIcon}>
                  <ProviderLogo provider={inspectedNode.provider} size={18} />
                </div>
                <div className={styles.inspectorHeaderInfo}>
                  <span className={styles.inspectorTitle}>
                    {inspectedNode.displayName || inspectedNode.modelName}
                  </span>
                  <span className={styles.inspectorSubtitle}>
                    {inspectedNode.provider}
                  </span>
                </div>
              </div>
              <button className={styles.inspectorCloseBtn} onClick={() => setInspectedNode(null)}>
                <X size={14} />
              </button>
            </div>

            <div className={styles.inspectorBody}>
              {/* Model Info */}
              <section className={styles.inspectorSection}>
                <label className={styles.inspectorLabel}>Model</label>
                <div className={styles.inspectorValue}>{inspectedNode.modelName}</div>
              </section>

              <section className={styles.inspectorSection}>
                <label className={styles.inspectorLabel}>Provider</label>
                <div className={styles.inspectorValue}>{inspectedNode.provider}</div>
              </section>

              {/* Step Metadata */}
              {inspectedNode.stepMeta && (
                <>
                  <section className={styles.inspectorSection}>
                    <label className={styles.inspectorLabel}>Duration</label>
                    <div className={styles.inspectorValue}>
                      {formatDuration(inspectedNode.stepMeta.duration)}
                    </div>
                  </section>

                  <section className={styles.inspectorSection}>
                    <label className={styles.inspectorLabel}>Step Order</label>
                    <div className={styles.inspectorValue}>
                      #{(inspectedNode.stepMeta.index ?? 0) + 1}
                    </div>
                  </section>

                  {inspectedNode.stepMeta.timestamp && (
                    <section className={styles.inspectorSection}>
                      <label className={styles.inspectorLabel}>Timestamp</label>
                      <div className={styles.inspectorValue}>
                        {new Date(inspectedNode.stepMeta.timestamp).toLocaleTimeString()}
                      </div>
                    </section>
                  )}
                </>
              )}

              {/* Modalities */}
              <section className={styles.inspectorSection}>
                <label className={styles.inspectorLabel}>Modalities</label>
                <div className={styles.inspectorModalities}>
                  <span className={styles.modalityGroup}>
                    <span className={styles.modalityLabel}>In:</span>
                    {(inspectedNode.inputTypes || []).map((t) => (
                      <span key={t} className={styles.modalityTag}>{t}</span>
                    ))}
                  </span>
                  <ArrowRight size={10} style={{ opacity: 0.3 }} />
                  <span className={styles.modalityGroup}>
                    <span className={styles.modalityLabel}>Out:</span>
                    {(inspectedNode.outputTypes || []).map((t) => (
                      <span key={t} className={styles.modalityTag}>{t}</span>
                    ))}
                  </span>
                </div>
              </section>

              {/* Connections */}
              {selectedWorkflow?.connections?.length > 0 && (
                <section className={styles.inspectorSection}>
                  <label className={styles.inspectorLabel}>Connections</label>
                  <div className={styles.inspectorConnections}>
                    {selectedWorkflow.connections
                      .filter((c) => c.sourceNodeId === inspectedNode.id || c.targetNodeId === inspectedNode.id)
                      .map((c) => {
                        const isSource = c.sourceNodeId === inspectedNode.id;
                        return (
                          <div key={c.id} className={styles.connectionRow}>
                            {isSource ? (
                              <>
                                <span className={styles.connectionModality}>{c.sourceModality}</span>
                                <ArrowRight size={10} style={{ opacity: 0.4 }} />
                                <span className={styles.connectionTarget}>{getNodeLabel(c.targetNodeId)}</span>
                              </>
                            ) : (
                              <>
                                <span className={styles.connectionTarget}>{getNodeLabel(c.sourceNodeId)}</span>
                                <ArrowRight size={10} style={{ opacity: 0.4 }} />
                                <span className={styles.connectionModality}>{c.targetModality}</span>
                              </>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </section>
              )}

              {/* Node ID */}
              <section className={styles.inspectorSection}>
                <label className={styles.inspectorLabel}>Node ID</label>
                <code className={styles.inspectorCode}>{inspectedNode.id}</code>
              </section>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

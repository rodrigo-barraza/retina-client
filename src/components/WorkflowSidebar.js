"use client";

import { useState, useMemo } from "react";
import {
    Search,
    X,
    Plus,
    Trash2,
    FolderOpen,
    Save,
    Type,
    Image,
    Volume2,
    Video,
    FileText,
    Hash,
    ChevronDown,
    ChevronRight,
    Package,
    Eye,
    Paperclip,
    User,
    Clock,
    Zap,
    MessageSquare,
} from "lucide-react";
import ProviderLogo, { PROVIDER_LABELS } from "./ProviderLogos";
import styles from "./WorkflowSidebar.module.css";

const MODALITY_ICONS = {
    text: { icon: Type, label: "Text", color: "#6366f1" },
    image: { icon: Image, label: "Image", color: "#10b981" },
    audio: { icon: Volume2, label: "Audio", color: "#f59e0b" },
    video: { icon: Video, label: "Video", color: "#f43f5e" },
    pdf: { icon: FileText, label: "PDF", color: "#64748b" },
    embedding: { icon: Hash, label: "Embedding", color: "#06b6d4" },
    conversation: { icon: MessageSquare, label: "Conversation", color: "#8b5cf6" },
};

/**
 * Group models by their primary modality pattern (e.g. "Text → Image").
 */
function groupModelsByModality(models) {
    const groups = {};

    for (const model of models) {
        const inputLabel = (model.inputTypes || []).map((t) => MODALITY_ICONS[t]?.label || t).join(", ") || "Any";
        const outputLabel = (model.outputTypes || []).map((t) => MODALITY_ICONS[t]?.label || t).join(", ") || "Any";
        const groupKey = `${inputLabel} → ${outputLabel}`;

        if (!groups[groupKey]) {
            groups[groupKey] = [];
        }
        groups[groupKey].push(model);
    }

    return groups;
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

export default function WorkflowSidebar({
    admin = false,
    models = [],
    workflows = [],
    activeWorkflowId,
    onAddNode,
    onAddAsset,
    onLoadWorkflow,
    onDeleteWorkflow,
    onNewWorkflow,
    onSaveWorkflow,
    workflowName,
    onWorkflowNameChange,
    adminWorkflows = [],
    adminSelectedId,
    onAdminSelectWorkflow,
    adminLoading = false,
}) {
    const [searchQuery, setSearchQuery] = useState("");
    const [collapsedGroups, setCollapsedGroups] = useState({});
    const [activeTab, setActiveTab] = useState("models"); // "models" | "saved"

    const filteredModels = useMemo(() => {
        if (!searchQuery.trim()) return models;
        const q = searchQuery.trim().toLowerCase();
        return models.filter((m) => {
            const name = m.display_name || m.label || m.name || "";
            const provider = PROVIDER_LABELS[m.provider] || m.provider || "";
            return name.toLowerCase().includes(q) || provider.toLowerCase().includes(q);
        });
    }, [models, searchQuery]);

    const groupedModels = useMemo(() => groupModelsByModality(filteredModels), [filteredModels]);

    const toggleGroup = (key) => {
        setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    /* ── Admin mode sidebar ── */
    if (admin) {
        return (
            <div className={styles.sidebar}>
                <div className={styles.adminHeader}>
                    <span className={styles.adminCount}>{adminWorkflows.length} workflows</span>
                </div>
                <div className={styles.adminScroll}>
                    {adminLoading && adminWorkflows.length === 0 ? (
                        <div className={styles.emptyState}>Loading…</div>
                    ) : adminWorkflows.length === 0 ? (
                        <div className={styles.emptyState}>
                            <FolderOpen size={24} />
                            <span>No workflows yet</span>
                        </div>
                    ) : (
                        adminWorkflows.map((wf) => (
                            <button
                                key={wf._id}
                                className={`${styles.adminItem} ${adminSelectedId === wf._id ? styles.adminItemActive : ""}`}
                                onClick={() => onAdminSelectWorkflow?.(wf._id)}
                            >
                                <div className={styles.adminItemTop}>
                                    <span className={styles.adminItemUser}>
                                        <User size={11} />
                                        {wf.userName || "unknown"}
                                    </span>
                                    <span className={styles.adminItemTime}>
                                        {formatTime(wf.createdAt)}
                                    </span>
                                </div>
                                <div className={styles.adminItemContent}>
                                    {wf.userContent
                                        ? wf.userContent.substring(0, 80) + (wf.userContent.length > 80 ? "…" : "")
                                        : "No content"}
                                </div>
                                <div className={styles.adminItemMeta}>
                                    <span className={styles.adminMetaTag}>
                                        <Zap size={10} />
                                        {wf.stepCount || 0} steps
                                    </span>
                                    <span className={styles.adminMetaTag}>
                                        <Clock size={10} />
                                        {formatDuration(wf.totalDuration)}
                                    </span>
                                    {wf.channelName && wf.channelName !== "DM" && (
                                        <span className={styles.adminMetaTag}>
                                            <Hash size={10} />
                                            {wf.channelName}
                                        </span>
                                    )}
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </div>
        );
    }

    /* ── Default (user) mode sidebar ── */
    return (
        <div className={styles.sidebar}>
            {/* Workflow name + actions */}
            <div className={styles.workflowHeader}>
                <input
                    type="text"
                    className={styles.workflowNameInput}
                    value={workflowName}
                    onChange={(e) => onWorkflowNameChange(e.target.value)}
                    placeholder="Untitled Workflow"
                />
                <div className={styles.workflowActions}>
                    <button
                        className={styles.actionBtn}
                        onClick={onNewWorkflow}
                        title="New Workflow"
                    >
                        <Plus size={14} />
                    </button>
                    <button
                        className={styles.actionBtn}
                        onClick={onSaveWorkflow}
                        title="Save Workflow"
                    >
                        <Save size={14} />
                    </button>
                </div>
            </div>

            {/* Tab bar */}
            <div className={styles.tabs}>
                <button
                    className={`${styles.tab} ${activeTab === "models" ? styles.tabActive : ""}`}
                    onClick={() => setActiveTab("models")}
                >
                    <Plus size={12} />
                    Models
                </button>
                <button
                    className={`${styles.tab} ${activeTab === "saved" ? styles.tabActive : ""}`}
                    onClick={() => setActiveTab("saved")}
                    suppressHydrationWarning
                >
                    <FolderOpen size={12} />
                    Saved{workflows.length > 0 ? ` (${workflows.length})` : ""}
                </button>
            </div>

            {activeTab === "models" && (
                <div className={styles.modelsPanel}>
                    {/* Asset buttons */}
                    <div className={styles.assetSection}>
                        <div className={styles.assetSectionLabel}>
                            <Package size={11} />
                            Assets
                        </div>
                        <div className={styles.assetButtons}>
                            <button
                                className={styles.assetBtn}
                                onClick={() => onAddAsset("text", "input")}
                                title="Add Text Input"
                            >
                                <Type size={12} style={{ color: "#6366f1" }} />
                                <span>Text Input</span>
                            </button>
                            <button
                                className={styles.assetBtn}
                                onClick={() => onAddAsset("file", "input")}
                                title="Add File Input"
                            >
                                <Paperclip size={12} style={{ color: "#8b5cf6" }} />
                                <span>File Input</span>
                            </button>
                            <button
                                className={styles.assetBtn}
                                onClick={() => onAddAsset("conversation", "input")}
                                title="Add Conversation Input"
                            >
                                <MessageSquare size={12} style={{ color: "#8b5cf6" }} />
                                <span>Conversation</span>
                            </button>
                            <button
                                className={styles.assetBtn}
                                onClick={() => onAddAsset("text", "viewer")}
                                title="Add Output Viewer"
                            >
                                <Eye size={12} style={{ color: "#a78bfa" }} />
                                <span>Output Viewer</span>
                            </button>
                        </div>
                    </div>

                    {/* Search */}
                    <div className={styles.searchWrapper}>
                        <Search size={13} className={styles.searchIcon} />
                        <input
                            type="text"
                            className={styles.searchInput}
                            placeholder="Search models…"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <button
                                className={styles.searchClear}
                                onClick={() => setSearchQuery("")}
                            >
                                <X size={12} />
                            </button>
                        )}
                    </div>

                    {/* Grouped model list */}
                    <div className={styles.modelList}>
                        {Object.entries(groupedModels).map(([groupKey, groupModels]) => (
                            <div key={groupKey} className={styles.modelGroup}>
                                <button
                                    className={styles.groupHeader}
                                    onClick={() => toggleGroup(groupKey)}
                                >
                                    {collapsedGroups[groupKey] ? (
                                        <ChevronRight size={12} />
                                    ) : (
                                        <ChevronDown size={12} />
                                    )}
                                    <span className={styles.groupLabel}>{groupKey}</span>
                                    <span className={styles.groupCount}>{groupModels.length}</span>
                                </button>
                                {!collapsedGroups[groupKey] && (
                                    <div className={styles.groupItems}>
                                        {groupModels.map((model) => (
                                            <button
                                                key={`${model.provider}-${model.name}`}
                                                className={styles.modelItem}
                                                onClick={() => onAddNode(model)}
                                                title={`Add ${model.display_name || model.name}`}
                                            >
                                                <ProviderLogo provider={model.provider} size={14} />
                                                <div className={styles.modelInfo}>
                                                    <span className={styles.modelName}>
                                                        {model.display_name || model.label || model.name}
                                                    </span>
                                                    <span className={styles.modelModalities}>
                                                        {(model.inputTypes || []).map((t) => {
                                                            const m = MODALITY_ICONS[t];
                                                            if (!m) return null;
                                                            const Icon = m.icon;
                                                            return (
                                                                <Icon
                                                                    key={`in-${t}`}
                                                                    size={10}
                                                                    style={{ color: m.color }}
                                                                />
                                                            );
                                                        })}
                                                        <span className={styles.arrow}>→</span>
                                                        {(model.outputTypes || []).map((t) => {
                                                            const m = MODALITY_ICONS[t];
                                                            if (!m) return null;
                                                            const Icon = m.icon;
                                                            return (
                                                                <Icon
                                                                    key={`out-${t}`}
                                                                    size={10}
                                                                    style={{ color: m.color }}
                                                                />
                                                            );
                                                        })}
                                                    </span>
                                                </div>
                                                <Plus size={12} className={styles.addIcon} />
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === "saved" && (
                <div className={styles.savedPanel}>
                    {workflows.length === 0 ? (
                        <div className={styles.emptyState}>
                            <FolderOpen size={24} />
                            <span>No saved workflows yet</span>
                        </div>
                    ) : (
                        <div className={styles.workflowList}>
                            {workflows.map((wf) => (
                                <div
                                    key={wf.id}
                                    className={`${styles.workflowItem} ${wf.id === activeWorkflowId ? styles.workflowItemActive : ""}`}
                                >
                                    <button
                                        className={styles.workflowItemContent}
                                        onClick={() => onLoadWorkflow(wf.id)}
                                    >
                                        <span className={styles.workflowItemName}>
                                            {wf.name || "Untitled Workflow"}
                                        </span>
                                        <span className={styles.workflowItemMeta}>
                                            {wf.nodes?.length || 0} nodes · {wf.connections?.length || 0} connections
                                        </span>
                                    </button>
                                    <button
                                        className={styles.deleteBtn}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDeleteWorkflow(wf.id);
                                        }}
                                        title="Delete workflow"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export { MODALITY_ICONS };

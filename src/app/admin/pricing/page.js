"use client";

import { useState, useEffect } from "react";
import {
    DollarSign,
    Activity,
    ArrowDownToLine,
    ArrowUpFromLine,
    AlertCircle,
} from "lucide-react";
import { IrisService } from "../../../services/IrisService";
import StatsCard from "../../../components/StatsCard";
import SortableTable from "../../../components/SortableTable";
import styles from "./page.module.css";

const ENDPOINT_LABELS = {
    "text-to-text": "Text → Text",
    "text-to-image": "Text → Image",
    "audio-to-text": "Audio → Text",
    "image-to-text": "Image → Text",
    "text-to-speech": "Text → Speech",
    "text-to-embedding": "Text → Embedding",
};

function formatNumber(n) {
    if (n === null || n === undefined) return "0";
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString();
}

function formatCost(n) {
    if (n === null || n === undefined || n === 0) return "$0.00";
    if (n >= 0.01) return `$${n.toFixed(4)}`;
    if (n >= 0.0001) return `$${n.toFixed(6)}`;
    return `$${n.toFixed(8)}`;
}

// Shared column renderers
const costRender = (row) => (
    <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
        {formatCost(row.totalCost)}
    </span>
);
const tokensInRender = (row) => formatNumber(row.totalInputTokens);
const tokensOutRender = (row) => formatNumber(row.totalOutputTokens);
const requestsRender = (row) => formatNumber(row.totalRequests);

export default function PricingPage() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        async function loadCosts() {
            try {
                setLoading(true);
                setError(null);
                const result = await IrisService.getCostStats();
                setData(result);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }
        loadCosts();
    }, []);

    const totals = data?.totals || {};

    // ── Column definitions ────────────────────────────────────

    const projectCols = [
        {
            key: "project",
            label: "Project",
            align: "left",
            renderSub: (row) => (
                <span
                    style={{
                        display: "inline-flex",
                        padding: "2px 6px",
                        borderRadius: 2,
                        fontSize: 10,
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        color: "var(--info)",
                        background: "var(--info-subtle)",
                    }}
                >
                    {row.provider}
                </span>
            ),
        },
        {
            key: "totalRequests",
            label: "Requests",
            render: requestsRender,
            renderSub: requestsRender,
        },
        {
            key: "totalInputTokens",
            label: "Tokens In",
            render: tokensInRender,
            renderSub: tokensInRender,
        },
        {
            key: "totalOutputTokens",
            label: "Tokens Out",
            render: tokensOutRender,
            renderSub: tokensOutRender,
        },
        {
            key: "totalCost",
            label: "Cost",
            render: costRender,
            renderSub: costRender,
        },
    ];

    const projectModalityCols = [
        {
            key: "project",
            label: "Project",
            align: "left",
            renderSub: (row) => (
                <span
                    style={{
                        display: "inline-flex",
                        padding: "2px 6px",
                        borderRadius: 2,
                        fontSize: 10,
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        color: "var(--accent-color)",
                        background: "var(--accent-subtle)",
                    }}
                >
                    {ENDPOINT_LABELS[row.endpoint] || row.endpoint}
                </span>
            ),
        },
        {
            key: "totalRequests",
            label: "Requests",
            render: requestsRender,
            renderSub: requestsRender,
        },
        {
            key: "totalInputTokens",
            label: "Tokens In",
            render: tokensInRender,
            renderSub: tokensInRender,
        },
        {
            key: "totalOutputTokens",
            label: "Tokens Out",
            render: tokensOutRender,
            renderSub: tokensOutRender,
        },
        {
            key: "totalCost",
            label: "Cost",
            render: costRender,
            renderSub: costRender,
        },
    ];

    const projectModelCols = [
        {
            key: "project",
            label: "Project",
            align: "left",
            renderSub: (row) => row.model || "—",
        },
        {
            key: "totalRequests",
            label: "Requests",
            render: requestsRender,
            renderSub: requestsRender,
        },
        {
            key: "totalInputTokens",
            label: "Tokens In",
            render: tokensInRender,
            renderSub: tokensInRender,
        },
        {
            key: "totalOutputTokens",
            label: "Tokens Out",
            render: tokensOutRender,
            renderSub: tokensOutRender,
        },
        {
            key: "totalCost",
            label: "Cost",
            render: costRender,
            renderSub: costRender,
        },
    ];

    const providerColumns = [
        {
            key: "provider",
            label: "Provider",
            align: "left",
        },
        { key: "totalRequests", label: "Requests", render: requestsRender },
        { key: "totalInputTokens", label: "Tokens In", render: tokensInRender },
        { key: "totalOutputTokens", label: "Tokens Out", render: tokensOutRender },
        { key: "totalCost", label: "Cost", render: costRender },
    ];

    const modalityColumns = [
        {
            key: "endpoint",
            label: "Modality",
            align: "left",
            render: (row) => (
                <span
                    style={{
                        display: "inline-flex",
                        padding: "2px 6px",
                        borderRadius: 2,
                        fontSize: 10,
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        color: "var(--accent-color)",
                        background: "var(--accent-subtle)",
                    }}
                >
                    {ENDPOINT_LABELS[row.endpoint] || row.endpoint}
                </span>
            ),
        },
        { key: "totalRequests", label: "Requests", render: requestsRender },
        { key: "totalInputTokens", label: "Tokens In", render: tokensInRender },
        { key: "totalOutputTokens", label: "Tokens Out", render: tokensOutRender },
        { key: "totalCost", label: "Cost", render: costRender },
    ];

    const modelColumns = [
        {
            key: "model",
            label: "Model",
            align: "left",
        },
        {
            key: "provider",
            label: "Provider",
            render: (row) => (
                <span
                    style={{
                        display: "inline-flex",
                        padding: "2px 6px",
                        borderRadius: 2,
                        fontSize: 10,
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        color: "var(--info)",
                        background: "var(--info-subtle)",
                    }}
                >
                    {row.provider}
                </span>
            ),
        },
        { key: "totalRequests", label: "Requests", render: requestsRender },
        { key: "totalInputTokens", label: "Tokens In", render: tokensInRender },
        { key: "totalOutputTokens", label: "Tokens Out", render: tokensOutRender },
        { key: "totalCost", label: "Cost", render: costRender },
    ];

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <h1 className={styles.pageTitle}>Pricing</h1>
                <p className={styles.pageSubtitle}>
                    Cost breakdown across all projects, providers, and modalities
                </p>
            </div>

            {error && (
                <div className={styles.errorBanner}>
                    <AlertCircle size={18} />
                    {error}
                </div>
            )}

            {/* Stats Row */}
            <div className={styles.statsGrid}>
                <StatsCard
                    label="Total Cost"
                    value={loading ? "..." : formatCost(totals.totalCost)}
                    subtitle="All-time estimated spend"
                    icon={DollarSign}
                    variant="warning"
                    loading={loading}
                />
                <StatsCard
                    label="Total Requests"
                    value={loading ? "..." : formatNumber(totals.totalRequests)}
                    subtitle="API calls made"
                    icon={Activity}
                    variant="accent"
                    loading={loading}
                />
                <StatsCard
                    label="Tokens In"
                    value={loading ? "..." : formatNumber(totals.totalInputTokens)}
                    subtitle="Total input tokens"
                    icon={ArrowDownToLine}
                    variant="info"
                    loading={loading}
                />
                <StatsCard
                    label="Tokens Out"
                    value={loading ? "..." : formatNumber(totals.totalOutputTokens)}
                    subtitle="Total output tokens"
                    icon={ArrowUpFromLine}
                    variant="success"
                    loading={loading}
                />
            </div>

            {/* Cost by Project Provider */}
            <div className={styles.section}>
                <SortableTable
                    title="Cost by Project Provider"
                    columns={projectCols}
                    data={data?.byProject || []}
                    getRowKey={(row) => row.project}
                    getSubRows={(row) => row.byProvider || []}
                    emptyText={loading ? "Loading..." : "No data yet"}
                />
            </div>

            {/* Cost by Project Modality */}
            <div className={styles.section}>
                <SortableTable
                    title="Cost by Project Modality"
                    columns={projectModalityCols}
                    data={data?.byProject || []}
                    getRowKey={(row) => `${row.project}-mod`}
                    getSubRows={(row) => row.byEndpoint || []}
                    emptyText={loading ? "Loading..." : "No data yet"}
                />
            </div>

            {/* Cost by Project Model */}
            <div className={styles.section}>
                <SortableTable
                    title="Cost by Project Model"
                    columns={projectModelCols}
                    data={data?.byProject || []}
                    getRowKey={(row) => `${row.project}-model`}
                    getSubRows={(row) => row.byModel || []}
                    emptyText={loading ? "Loading..." : "No data yet"}
                />
            </div>

            {/* Two-column: Provider + Modality */}
            <div className={styles.twoCol}>
                <div className={styles.section}>
                    <SortableTable
                        title="Cost by Provider"
                        columns={providerColumns}
                        data={data?.byProvider || []}
                        getRowKey={(row) => row.provider}
                        emptyText={loading ? "Loading..." : "No data yet"}
                    />
                </div>

                <div className={styles.section}>
                    <SortableTable
                        title="Cost by Modality"
                        columns={modalityColumns}
                        data={data?.byEndpoint || []}
                        getRowKey={(row) => row.endpoint}
                        emptyText={loading ? "Loading..." : "No data yet"}
                    />
                </div>
            </div>

            {/* Cost by Model */}
            <div className={styles.section}>
                <SortableTable
                    title="Cost by Model"
                    columns={modelColumns}
                    data={data?.byModel || []}
                    getRowKey={(row) => `${row.model}-${row.provider}`}
                    emptyText={loading ? "Loading..." : "No data yet"}
                />
            </div>
        </div>
    );
}

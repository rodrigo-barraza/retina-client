"use client";

import { useState, useEffect, useCallback } from "react";
import { Download, X, ChevronUp, ChevronDown, AlertCircle } from "lucide-react";
import { IrisService } from "../../../services/IrisService";
import styles from "./page.module.css";

function formatNumber(n) {
    if (n === null || n === undefined) return "0";
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString();
}

function formatCost(n) {
    if (n === null || n === undefined) return "$0.00";
    return `$${n.toFixed(6)}`;
}

function formatLatency(ms) {
    if (ms === null || ms === undefined) return "-";
    if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.round(ms)}ms`;
}

const COLUMNS = [
    { key: "timestamp", label: "Time" },
    { key: "project", label: "Project" },
    { key: "endpoint", label: "Endpoint" },
    { key: "provider", label: "Provider" },
    { key: "model", label: "Model" },
    { key: "inputTokens", label: "In Tokens" },
    { key: "outputTokens", label: "Out Tokens" },
    { key: "estimatedCost", label: "Cost" },
    { key: "tokensPerSec", label: "Tok/s" },
    { key: "totalTime", label: "Latency" },
    { key: "success", label: "Status" },
];

export default function RequestsPage() {
    const [requests, setRequests] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [sort, setSort] = useState("timestamp");
    const [order, setOrder] = useState("desc");
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [filters, setFilters] = useState({
        project: "",
        provider: "",
        model: "",
        endpoint: "",
        success: "",
    });

    const LIMIT = 50;

    const loadRequests = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const params = { page, limit: LIMIT, sort, order };
            Object.entries(filters).forEach(([k, v]) => {
                if (v) params[k] = v;
            });

            const data = await IrisService.getRequests(params);
            setRequests(data.data || []);
            setTotal(data.total || 0);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [page, sort, order, filters]);

    useEffect(() => {
        loadRequests();
    }, [loadRequests]);

    function handleSort(key) {
        if (sort === key) {
            setOrder(order === "asc" ? "desc" : "asc");
        } else {
            setSort(key);
            setOrder("desc");
        }
        setPage(1);
    }

    function handleFilterChange(key, value) {
        setFilters((prev) => ({ ...prev, [key]: value }));
        setPage(1);
    }

    function clearFilters() {
        setFilters({
            project: "",
            provider: "",
            model: "",
            endpoint: "",
            success: "",
        });
        setPage(1);
    }

    function exportCSV() {
        const headers = COLUMNS.map((c) => c.label).join(",");
        const rows = requests.map((r) =>
            [
                r.timestamp || "",
                r.project || "",
                r.endpoint || "",
                r.provider || "",
                r.model || "",
                r.inputTokens || 0,
                r.outputTokens || 0,
                r.estimatedCost || 0,
                r.tokensPerSec ? Number(r.tokensPerSec).toFixed(1) : "",
                r.totalTime || 0,
                r.success ? "OK" : "ERR",
            ].join(","),
        );
        const csv = [headers, ...rows].join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `iris-requests-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    const totalPages = Math.ceil(total / LIMIT);

    function renderCellValue(col, request) {
        switch (col.key) {
            case "timestamp":
                return request.timestamp
                    ? new Date(request.timestamp).toLocaleString()
                    : "-";
            case "inputTokens":
            case "outputTokens":
                return formatNumber(request[col.key]);
            case "estimatedCost":
                return formatCost(request.estimatedCost);
            case "tokensPerSec": {
                const v = request.tokensPerSec;
                if (v === null || v === undefined) return "—";
                return `${Number(v).toFixed(1)}`;
            }
            case "totalTime":
                return formatLatency(request.totalTime);
            case "success":
                return (
                    <span
                        className={`${styles.badge} ${request.success ? styles.badgeSuccess : styles.badgeError}`}
                    >
                        {request.success ? "OK" : "ERR"}
                    </span>
                );
            case "provider":
                return (
                    <span className={`${styles.badge} ${styles.badgeProvider}`}>
                        {request.provider || "-"}
                    </span>
                );
            case "endpoint":
                return (
                    <span className={`${styles.badge} ${styles.badgeEndpoint}`}>
                        {request.endpoint || "-"}
                    </span>
                );
            default:
                return request[col.key] || "-";
        }
    }

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <h1 className={styles.pageTitle}>Requests</h1>
                <div className={styles.headerActions}>
                    <button className={styles.exportBtn} onClick={exportCSV}>
                        <Download size={14} /> Export CSV
                    </button>
                </div>
            </div>

            {error && (
                <div className={styles.errorBanner}>
                    <AlertCircle size={18} />
                    {error}
                </div>
            )}

            {/* Filters */}
            <div className={styles.filterBar}>
                <div className={styles.filterGroup}>
                    <label className={styles.filterLabel}>Project</label>
                    <input
                        className={styles.filterInput}
                        placeholder="Filter by project..."
                        value={filters.project}
                        onChange={(e) => handleFilterChange("project", e.target.value)}
                    />
                </div>
                <div className={styles.filterGroup}>
                    <label className={styles.filterLabel}>Provider</label>
                    <select
                        className={styles.filterSelect}
                        value={filters.provider}
                        onChange={(e) => handleFilterChange("provider", e.target.value)}
                    >
                        <option value="">All</option>
                        <option value="openai">OpenAI</option>
                        <option value="anthropic">Anthropic</option>
                        <option value="google">Google</option>
                        <option value="elevenlabs">ElevenLabs</option>
                    </select>
                </div>
                <div className={styles.filterGroup}>
                    <label className={styles.filterLabel}>Model</label>
                    <input
                        className={styles.filterInput}
                        placeholder="Filter by model..."
                        value={filters.model}
                        onChange={(e) => handleFilterChange("model", e.target.value)}
                    />
                </div>
                <div className={styles.filterGroup}>
                    <label className={styles.filterLabel}>Endpoint</label>
                    <select
                        className={styles.filterSelect}
                        value={filters.endpoint}
                        onChange={(e) => handleFilterChange("endpoint", e.target.value)}
                    >
                        <option value="">All</option>
                        <option value="/chat">/chat</option>
                        <option value="/voice">/voice</option>
                        <option value="/embed">/embed</option>
                    </select>
                </div>
                <div className={styles.filterGroup}>
                    <label className={styles.filterLabel}>Status</label>
                    <select
                        className={styles.filterSelect}
                        value={filters.success}
                        onChange={(e) => handleFilterChange("success", e.target.value)}
                    >
                        <option value="">All</option>
                        <option value="true">Success</option>
                        <option value="false">Error</option>
                    </select>
                </div>
                <button className={styles.clearBtn} onClick={clearFilters}>
                    Clear
                </button>
            </div>

            {/* Table */}
            <div className={styles.tableWrapper}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            {COLUMNS.map((col) => (
                                <th key={col.key} onClick={() => handleSort(col.key)}>
                                    {col.label}
                                    {sort === col.key ? (
                                        order === "asc" ? (
                                            <ChevronUp
                                                size={12}
                                                className={`${styles.sortIcon} ${styles.active}`}
                                            />
                                        ) : (
                                            <ChevronDown
                                                size={12}
                                                className={`${styles.sortIcon} ${styles.active}`}
                                            />
                                        )
                                    ) : (
                                        <ChevronDown size={12} className={styles.sortIcon} />
                                    )}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading && requests.length === 0 ? (
                            <tr>
                                <td colSpan={COLUMNS.length} className={styles.emptyState}>
                                    Loading...
                                </td>
                            </tr>
                        ) : requests.length === 0 ? (
                            <tr>
                                <td colSpan={COLUMNS.length} className={styles.emptyState}>
                                    No requests found
                                </td>
                            </tr>
                        ) : (
                            requests.map((req, i) => (
                                <tr
                                    key={req.requestId || i}
                                    onClick={() => setSelectedRequest(req)}
                                    className={
                                        selectedRequest?.requestId === req.requestId
                                            ? styles.selected
                                            : ""
                                    }
                                >
                                    {COLUMNS.map((col) => (
                                        <td key={col.key}>{renderCellValue(col, req)}</td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>

                {/* Pagination */}
                <div className={styles.pagination}>
                    <span className={styles.pageInfo}>
                        Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of{" "}
                        {total.toLocaleString()}
                    </span>
                    <div className={styles.pageButtons}>
                        <button
                            className={styles.pageBtn}
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page === 1}
                        >
                            Previous
                        </button>
                        <button
                            className={styles.pageBtn}
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={page >= totalPages}
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>

            {/* Detail Drawer */}
            {selectedRequest && (
                <>
                    <div
                        className={styles.drawerOverlay}
                        onClick={() => setSelectedRequest(null)}
                    />
                    <div className={styles.drawer}>
                        <div className={styles.drawerHeader}>
                            <span className={styles.drawerTitle}>Request Detail</span>
                            <button
                                className={styles.closeBtn}
                                onClick={() => setSelectedRequest(null)}
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <div className={styles.drawerBody}>
                            <div className={styles.detailSection}>
                                <div className={styles.detailSectionTitle}>General</div>
                                <div className={styles.detailGrid}>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Request ID</span>
                                        <span className={`${styles.detailValue} ${styles.mono}`}>
                                            {selectedRequest.requestId || "-"}
                                        </span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Timestamp</span>
                                        <span className={styles.detailValue}>
                                            {selectedRequest.timestamp
                                                ? new Date(selectedRequest.timestamp).toLocaleString()
                                                : "-"}
                                        </span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Project</span>
                                        <span className={styles.detailValue}>
                                            {selectedRequest.project || "-"}
                                        </span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Endpoint</span>
                                        <span className={styles.detailValue}>
                                            {selectedRequest.endpoint || "-"}
                                        </span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Provider</span>
                                        <span className={styles.detailValue}>
                                            {selectedRequest.provider || "-"}
                                        </span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Model</span>
                                        <span className={styles.detailValue}>
                                            {selectedRequest.model || "-"}
                                        </span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Status</span>
                                        <span
                                            className={`${styles.badge} ${selectedRequest.success ? styles.badgeSuccess : styles.badgeError}`}
                                        >
                                            {selectedRequest.success ? "Success" : "Error"}
                                        </span>
                                    </div>
                                    {selectedRequest.errorMessage && (
                                        <div className={styles.detailItem}>
                                            <span className={styles.detailLabel}>Error</span>
                                            <span
                                                className={styles.detailValue}
                                                style={{ color: "var(--danger)" }}
                                            >
                                                {selectedRequest.errorMessage}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className={styles.detailSection}>
                                <div className={styles.detailSectionTitle}>Usage</div>
                                <div className={styles.detailGrid}>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Input Tokens</span>
                                        <span className={styles.detailValue}>
                                            {formatNumber(selectedRequest.inputTokens)}
                                        </span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Output Tokens</span>
                                        <span className={styles.detailValue}>
                                            {formatNumber(selectedRequest.outputTokens)}
                                        </span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Estimated Cost</span>
                                        <span className={styles.detailValue}>
                                            {formatCost(selectedRequest.estimatedCost)}
                                        </span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Tokens/sec</span>
                                        <span className={styles.detailValue}>
                                            {selectedRequest.tokensPerSec?.toFixed(1) || "-"}
                                        </span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Input Chars</span>
                                        <span className={styles.detailValue}>
                                            {formatNumber(selectedRequest.inputCharacters)}
                                        </span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Output Chars</span>
                                        <span className={styles.detailValue}>
                                            {formatNumber(selectedRequest.outputCharacters)}
                                        </span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Messages</span>
                                        <span className={styles.detailValue}>
                                            {selectedRequest.messageCount || 0}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className={styles.detailSection}>
                                <div className={styles.detailSectionTitle}>Timing</div>
                                <div className={styles.detailGrid}>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>
                                            Time to Generation
                                        </span>
                                        <span className={styles.detailValue}>
                                            {formatLatency(selectedRequest.timeToGeneration)}
                                        </span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Generation Time</span>
                                        <span className={styles.detailValue}>
                                            {formatLatency(selectedRequest.generationTime)}
                                        </span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Total Time</span>
                                        <span className={styles.detailValue}>
                                            {formatLatency(selectedRequest.totalTime)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className={styles.detailSection}>
                                <div className={styles.detailSectionTitle}>Parameters</div>
                                <div className={styles.detailGrid}>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Temperature</span>
                                        <span className={styles.detailValue}>
                                            {selectedRequest.temperature ?? "-"}
                                        </span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Max Tokens</span>
                                        <span className={styles.detailValue}>
                                            {selectedRequest.maxTokens ?? "-"}
                                        </span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Top P</span>
                                        <span className={styles.detailValue}>
                                            {selectedRequest.topP ?? "-"}
                                        </span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Top K</span>
                                        <span className={styles.detailValue}>
                                            {selectedRequest.topK ?? "-"}
                                        </span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>
                                            Frequency Penalty
                                        </span>
                                        <span className={styles.detailValue}>
                                            {selectedRequest.frequencyPenalty ?? "-"}
                                        </span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Presence Penalty</span>
                                        <span className={styles.detailValue}>
                                            {selectedRequest.presencePenalty ?? "-"}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

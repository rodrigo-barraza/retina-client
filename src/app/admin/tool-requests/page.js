"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Download } from "lucide-react";
import ToolsApiService from "../../../services/ToolsApiService";
import JsonViewerComponent from "../../../components/JsonViewerComponent";
import TableComponent from "../../../components/TableComponent";
import PaginationComponent from "../../../components/PaginationComponent";
import { ErrorMessage } from "../../../components/StateMessageComponent";
import {
  FilterBarComponent,
  FilterGroupComponent,
  FilterInputComponent,
  FilterSelectComponent,
  FilterClearButton,
} from "../../../components/FilterBarComponent";
import ButtonComponent from "../../../components/ButtonComponent";
import RequestDetailsComponent from "../../../components/RequestDetailsComponent";
import { useAdminHeader } from "../../../components/AdminHeaderContext";
import {
  formatNumber,
  formatLatency,
  formatDateTime,
  buildDateRangeParams,
} from "../../../utils/utilities";
import { getToolRequestsColumns } from "./toolRequestsColumns";
import styles from "./page.module.css";

// ── Domain options (from ToolSchemaService TOOL_DOMAINS) ─────────
const DOMAIN_OPTIONS = [
  { value: "", label: "All" },
  { value: "Weather & Environment", label: "Weather" },
  { value: "Events", label: "Events" },
  { value: "Markets & Commodities", label: "Markets" },
  { value: "Trends", label: "Trends" },
  { value: "Products", label: "Products" },
  { value: "Finance", label: "Finance" },
  { value: "Knowledge", label: "Knowledge" },
  { value: "Movies & TV", label: "Movies & TV" },
  { value: "Health", label: "Health" },
  { value: "Transit", label: "Transit" },
  { value: "Utilities", label: "Utilities" },
  { value: "Compute", label: "Compute" },
  { value: "Maritime", label: "Maritime" },
  { value: "Energy", label: "Energy" },
  { value: "Agentic: File Operations", label: "File Ops" },
  { value: "Agentic: Search & Discovery", label: "Search" },
  { value: "Agentic: Web", label: "Web" },
  { value: "Agentic: Command Execution", label: "Command" },
  { value: "Agentic: Git", label: "Git" },
  { value: "Agentic: Browser", label: "Browser" },
  { value: "Communication", label: "Communication" },
];

export default function ToolRequestsPage() {
  const { setControls, setTitleBadge, dateRange } = useAdminHeader();
  const [toolCalls, setToolCalls] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sort, setSort] = useState("timestamp");
  const [order, setOrder] = useState("desc");
  const [selectedCall, setSelectedCall] = useState(null);
  const [filters, setFilters] = useState({
    toolName: "",
    domain: "",
    success: "",
    callerAgent: "",
  });

  const LIMIT = 50;

  const loadToolCalls = useCallback(async () => {
    try {
      const params = { limit: LIMIT, skip: (page - 1) * LIMIT };
      Object.entries(filters).forEach(([k, v]) => {
        if (v) params[k] = v;
      });
      // Date range
      const dateParams = buildDateRangeParams(dateRange);
      if (dateParams.since) params.since = dateParams.since;
      if (dateParams.until) params.until = dateParams.until;

      const data = await ToolsApiService.getToolCalls(params);
      setToolCalls(data.toolCalls || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, filters, dateRange]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setToolCalls([]);
    setTotal(0);
    loadToolCalls();
  }, [loadToolCalls]);

  function handleSort(key, dir) {
    setSort(key);
    setOrder(dir);
    setPage(1);
  }

  const handleFilterChange = useCallback((key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }, []);

  function clearFilters() {
    setFilters({
      toolName: "",
      domain: "",
      success: "",
      callerAgent: "",
    });
    setPage(1);
  }

  // ── Column definitions ─────────────────────────────────────────
  const totalDuration = useMemo(
    () => toolCalls.reduce((sum, tc) => sum + (tc.elapsedMs || 0), 0) || 1,
    [toolCalls],
  );

  const columns = useMemo(
    () => getToolRequestsColumns({ totalDuration }),
    [totalDuration],
  );

  // ── CSV Export ─────────────────────────────────────────────────
  const exportCSV = useCallback(() => {
    const headers = [
      "Timestamp", "Tool", "Domain", "Method", "Agent", "User",
      "Latency (ms)", "Status", "Error",
    ].join(",");
    const rows = toolCalls.map((tc) =>
      [
        tc.timestamp || "",
        tc.toolName || "",
        tc.domain || "",
        tc.method || "",
        tc.callerAgent || "",
        tc.callerUsername || "",
        tc.elapsedMs || 0,
        tc.success ? "OK" : "ERR",
        tc.errorMessage || "",
      ].join(","),
    );
    const csv = [headers, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tool-requests-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [toolCalls]);

  const totalPages = Math.ceil(total / LIMIT);

  // ── Build detail sections for the drawer ──────────────────────
  function buildDetailSections(tc) {
    if (!tc) return [];
    return [
      {
        title: "Overview",
        items: [
          { label: "Tool", value: tc.toolName },
          { label: "Domain", value: tc.domain },
          { label: "Method", value: tc.method },
          { label: "Path", value: tc.path, mono: true },
          { label: "Status Code", value: tc.status },
          {
            label: "Success",
            value: tc.success ? "✓ OK" : "✗ Error",
          },
          ...(tc.errorMessage
            ? [{ label: "Error", value: tc.errorMessage }]
            : []),
        ],
      },
      {
        title: "Performance",
        items: [
          {
            label: "Latency",
            value: tc.elapsedMs
              ? formatLatency(tc.elapsedMs / 1000)
              : "—",
          },
          {
            label: "Latency (raw)",
            value: tc.elapsedMs ? `${tc.elapsedMs.toFixed(2)} ms` : "—",
            mono: true,
          },
          {
            label: "Request Size",
            value: tc.inBytes > 0 ? `${(tc.inBytes / 1024).toFixed(1)} KB` : "—",
          },
          {
            label: "Response Size",
            value: tc.outBytes > 0 ? `${(tc.outBytes / 1024).toFixed(1)} KB` : "—",
          },
        ],
      },
      {
        title: "Caller Context",
        items: [
          { label: "Project", value: tc.callerProject || "—" },
          { label: "Username", value: tc.callerUsername || "—" },
          { label: "Agent", value: tc.callerAgent || "—" },
          { label: "Request ID", value: tc.callerRequestId || "—", mono: true },
          {
            label: "Conversation ID",
            value: tc.callerConversationId || "—",
            mono: true,
          },
          {
            label: "Iteration",
            value: tc.callerIteration != null ? `#${tc.callerIteration}` : "—",
          },
          { label: "Client IP", value: tc.clientIp || "—", mono: true },
        ],
      },
      {
        title: "Timing",
        items: [
          {
            label: "Timestamp",
            value: tc.timestamp ? formatDateTime(tc.timestamp) : "—",
          },
        ],
      },
    ];
  }

  // ── Header controls ────────────────────────────────────────────
  useEffect(() => {
    setControls(
      <>
        <ErrorMessage message={error} />
      </>,
    );
  }, [setControls, error]);

  useEffect(() => {
    return () => {
      setControls(null);
      setTitleBadge(null);
    };
  }, [setControls, setTitleBadge]);

  useEffect(() => {
    setTitleBadge(formatNumber(total));
  }, [setTitleBadge, total]);

  return (
    <div className={styles.page}>
      {/* Filters */}
      <FilterBarComponent>
        <FilterGroupComponent label="Tool">
          <FilterInputComponent
            placeholder="Filter by tool name..."
            value={filters.toolName}
            onChange={(val) => handleFilterChange("toolName", val)}
          />
        </FilterGroupComponent>
        <FilterGroupComponent label="Domain">
          <FilterSelectComponent
            value={filters.domain}
            onChange={(val) => handleFilterChange("domain", val)}
            options={DOMAIN_OPTIONS}
          />
        </FilterGroupComponent>
        <FilterGroupComponent label="Agent">
          <FilterInputComponent
            placeholder="Filter by agent..."
            value={filters.callerAgent}
            onChange={(val) => handleFilterChange("callerAgent", val)}
          />
        </FilterGroupComponent>
        <FilterGroupComponent label="Status">
          <FilterSelectComponent
            value={filters.success}
            onChange={(val) => handleFilterChange("success", val)}
            options={[
              { value: "", label: "All" },
              { value: "true", label: "Success" },
              { value: "false", label: "Error" },
            ]}
          />
        </FilterGroupComponent>

        <FilterClearButton onClick={clearFilters} />
        <ButtonComponent
          variant="secondary"
          icon={Download}
          onClick={exportCSV}
          size="small"
        >
          Export CSV
        </ButtonComponent>
      </FilterBarComponent>

      {/* Table */}
      <div className={styles.tableWrapper}>
        <TableComponent
          columns={columns}
          data={toolCalls}
          sortKey={sort}
          sortDir={order}
          onSort={handleSort}
          onRowClick={(tc) => setSelectedCall(tc)}
          getRowKey={(tc, i) => tc._id || i}
          emptyText={loading ? "Loading..." : "No tool calls found"}
          maxHeight={null}
          storageKey="tool-requests"
        />

        {/* Pagination */}
        <PaginationComponent
          page={page}
          totalPages={totalPages}
          totalItems={total}
          onPageChange={setPage}
          limit={LIMIT}
        />
      </div>

      {/* Detail drawer */}
      <RequestDetailsComponent
        open={!!selectedCall}
        onClose={() => setSelectedCall(null)}
        title="Tool Call Detail"
        sections={buildDetailSections(selectedCall)}
      >
        {selectedCall && (
          <>
            {selectedCall.args && Object.keys(selectedCall.args).length > 0 && (
              <div className={styles.detailSection}>
                <JsonViewerComponent
                  data={selectedCall.args}
                  label="Arguments"
                  maxHeight="300px"
                />
              </div>
            )}
            {selectedCall.result && Object.keys(selectedCall.result).length > 0 && (
              <div className={styles.detailSection}>
                <JsonViewerComponent
                  data={selectedCall.result}
                  label="Result (Sanitized)"
                  maxHeight="400px"
                />
              </div>
            )}
          </>
        )}
      </RequestDetailsComponent>
    </div>
  );
}

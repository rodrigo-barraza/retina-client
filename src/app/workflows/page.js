"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { ArrowLeft, Sun, Moon, Play, Square, Loader2, Download, Upload, Undo2 } from "lucide-react";
import Link from "next/link";
import { PrismService } from "../../services/PrismService";
import WorkflowService from "../../services/WorkflowService";
import { executeWorkflow } from "../../services/WorkflowExecutor";
import WorkflowComponent from "../../components/WorkflowComponent";
import { useTheme } from "../../components/ThemeProvider";
import styles from "./page.module.css";

const MODEL_SECTIONS = [
    "textToText",
    "textToImage",
    "textToSpeech",
    "imageToText",
    "audioToText",
    "embedding",
];

/**
 * Flatten all model groups from the config into a single array with unique
 * provider:name entries, tagged with provider and modalities.
 */
function flattenConfigModels(config) {
    if (!config) return [];
    const modelsMap = new Map();

    for (const section of MODEL_SECTIONS) {
        const providers = config[section]?.models || {};
        for (const [provider, models] of Object.entries(providers)) {
            for (const m of models) {
                const key = `${provider}:${m.name}`;
                if (!modelsMap.has(key)) {
                    modelsMap.set(key, { ...m, provider });
                } else {
                    // Merge modalities and data from other sections
                    const existing = modelsMap.get(key);
                    const mergedInput = [
                        ...new Set([...(existing.inputTypes || []), ...(m.inputTypes || [])]),
                    ];
                    const mergedOutput = [
                        ...new Set([...(existing.outputTypes || []), ...(m.outputTypes || [])]),
                    ];
                    modelsMap.set(key, {
                        ...existing,
                        inputTypes: mergedInput,
                        outputTypes: mergedOutput,
                        modelType: existing.modelType || m.modelType,
                        arena: { ...(existing.arena || {}), ...(m.arena || {}) },
                    });
                }
            }
        }
    }

    return [...modelsMap.values()];
}

/**
 * Build compound port IDs for a conversation input node.
 * Each message slot gets a text port, plus modality ports for non-assistant messages.
 * Format: "{messageIndex}.{modality}" e.g. "0.text", "0.image", "1.text"
 */
function buildConversationPorts(messages, supportedModalities = ["text"]) {
    const ports = [];
    for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        ports.push(`${i}.text`);
        // User and assistant messages get extra modality ports (image, audio, etc.)
        // System messages are text-only (system prompt)
        if (msg.role === "user" || msg.role === "assistant") {
            for (const mod of supportedModalities) {
                if (mod !== "text") {
                    ports.push(`${i}.${mod}`);
                }
            }
        }
    }
    return ports;
}

function generateNodeId() {
    return `node_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function generateConnectionId() {
    return `conn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

export default function WorkflowsPage() {
    const { theme, toggleTheme } = useTheme();
    const [_config, setConfig] = useState(null);
    const [allModels, setAllModels] = useState([]);
    const [savedWorkflows, setSavedWorkflows] = useState([]);
    const [toast, setToast] = useState(null);

    // Current workflow state
    const [workflowId, setWorkflowId] = useState(null);
    const [workflowName, setWorkflowName] = useState("Untitled Workflow");
    const [nodes, setNodes] = useState([]);
    const [connections, setConnections] = useState([]);

    // Execution state
    const [isRunning, setIsRunning] = useState(false);
    const importRef = useRef(null);
    const [nodeStatuses, setNodeStatuses] = useState({}); // nodeId → "running" | "done" | "error"
    const [nodeResults, setNodeResults] = useState({}); // nodeId → { text?, image?, audio? }
    const abortRef = useRef(false);

    // Undo history (100 states max)
    const undoStackRef = useRef([]);
    const [undoCount, setUndoCount] = useState(0); // trigger re-render when stack changes
    const skipNextSnapshotRef = useRef(false); // skip snapshot after undo restore

    // Selection state
    const [selectedNodeId, setSelectedNodeId] = useState(null);

    // Load config + saved workflows
    useEffect(() => {
        PrismService.getConfig()
            .then((cfg) => {
                setConfig(cfg);
                setAllModels(flattenConfigModels(cfg));
            })
            .catch(console.error);

        WorkflowService.getWorkflows()
            .then((wfs) => setSavedWorkflows(wfs.map((w) => ({ ...w, id: w._id || w.id }))))
            .catch(console.error);
    }, []);

    // Import conversation from homepage (sessionStorage handoff)
    useEffect(() => {
        const raw = sessionStorage.getItem("workflow_import_conversation");
        if (!raw) return;
        sessionStorage.removeItem("workflow_import_conversation");
        try {
            const data = JSON.parse(raw);
            if (data.messages && data.messages.length > 0) {
                const importedNode = {
                    id: generateNodeId(),
                    modelName: data.model || "",
                    provider: data.provider || "",
                    displayName: data.model || "Imported Conversation",
                    inputTypes: ["text"],
                    outputTypes: ["text"],
                    supportsSystemPrompt: true,
                    messages: data.messages,
                    position: { x: 200, y: 120 },
                };
                setNodes((prev) => [...prev, importedNode]);
                setWorkflowName(data.title ? `${data.title} (workflow)` : "Imported Conversation");
                showToast(`Imported conversation with ${data.messages.length} messages`);
            }
        } catch (err) {
            console.error("Failed to import conversation:", err);
        }
    }, []);

    const showToast = (message, type = "success") => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    // Keep a ref with the latest state so pushUndo never goes stale
    const currentStateRef = useRef({ workflowId: null, workflowName: "Untitled Workflow", nodes: [], connections: [] });
    useEffect(() => {
        currentStateRef.current = { workflowId, workflowName, nodes, connections };
    }, [workflowId, workflowName, nodes, connections]);

    // Push current state to undo stack (stable ref — no dependency issues)
    const pushUndo = useCallback(() => {
        const { workflowId: wId, workflowName: wName, nodes: n, connections: c } = currentStateRef.current;
        const snapshot = {
            workflowId: wId,
            workflowName: wName,
            nodes: JSON.parse(JSON.stringify(n)),
            connections: JSON.parse(JSON.stringify(c)),
        };
        undoStackRef.current.push(snapshot);
        if (undoStackRef.current.length > 100) {
            undoStackRef.current.shift();
        }
        setUndoCount(undoStackRef.current.length);
    }, []);

    // Undo last action
    const handleUndo = useCallback(() => {
        if (undoStackRef.current.length === 0) return;
        const snapshot = undoStackRef.current.pop();
        setUndoCount(undoStackRef.current.length);
        skipNextSnapshotRef.current = true;
        setWorkflowId(snapshot.workflowId);
        setWorkflowName(snapshot.workflowName);
        setNodes(snapshot.nodes);
        setConnections(snapshot.connections);
    }, []);

    // Ctrl+Z keyboard shortcut
    useEffect(() => {
        const handler = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
                e.preventDefault();
                handleUndo();
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [handleUndo]);

    // Filter models to only those with clear modalities
    const modelsWithModalities = useMemo(() => {
        return allModels.filter(
            (m) =>
                (m.inputTypes && m.inputTypes.length > 0) ||
                (m.outputTypes && m.outputTypes.length > 0),
        );
    }, [allModels]);

    // Add a new asset node (input asset, output viewer, or model)
    const handleAddAsset = useCallback(
        (modality, type) => {
            pushUndo();

            // Model node
            if (modality === "model") {
                const defaultModel = modelsWithModalities[0];
                const isConversation = defaultModel?.modelType === "conversation";
                const newNode = {
                    id: generateNodeId(),
                    modelName: defaultModel?.name || "select-model",
                    provider: defaultModel?.provider || "",
                    displayName: defaultModel?.display_name || defaultModel?.label || defaultModel?.name || "Select a Model",
                    modelType: defaultModel?.modelType || "conversation",
                    inputTypes: isConversation ? ["conversation"] : (defaultModel?.inputTypes || []),
                    rawInputTypes: defaultModel?.inputTypes || [],
                    outputTypes: defaultModel?.outputTypes || [],
                    supportsSystemPrompt: defaultModel?.supportsSystemPrompt !== false,
                    messages: [
                        { role: "system", content: "" },
                        { role: "user", content: "" },
                    ],
                    position: {
                        x: 80 + nodes.length * 60 + Math.random() * 40,
                        y: 80 + nodes.length * 40 + Math.random() * 40,
                    },
                };
                setNodes((prev) => [...prev, newNode]);
                return;
            }

            const isViewer = type === "viewer";
            const isFile = modality === "file";
            const isConversation = modality === "conversation";
            const defaultMessages = isConversation ? [
                { role: "system", content: "" },
                { role: "user", content: "" },
            ] : undefined;
            const defaultModalities = ["text"];
            const newNode = {
                id: generateNodeId(),
                nodeType: type, // "input" or "viewer"
                modality: isFile ? null : modality,
                content: isConversation ? undefined : "",
                contentType: isViewer ? modality : undefined,
                // Conversation input nodes carry structured messages
                ...(isConversation ? {
                    messages: defaultMessages,
                    supportedModalities: defaultModalities,
                } : {}),
                // File input nodes start with no output ports until a file is loaded
                inputTypes: isViewer
                    ? ["text", "image", "audio"]
                    : isConversation
                        ? []
                        : [],
                outputTypes: isViewer
                    ? ["text", "image", "audio"]
                    : isFile
                        ? []
                        : isConversation
                            ? ["conversation"]
                            : [modality],
                position: {
                    x: 80 + nodes.length * 60 + Math.random() * 40,
                    y: 80 + nodes.length * 40 + Math.random() * 40,
                },
            };
            setNodes((prev) => [...prev, newNode]);
        },
        [nodes.length, modelsWithModalities],
    );

    // Update content of an asset node
    const handleUpdateNodeContent = useCallback((nodeId, content) => {
        setNodes((prev) =>
            prev.map((n) => (n.id === nodeId ? { ...n, content } : n)),
        );
    }, []);

    /**
     * Update a file input node's content and dynamically adjust its modality.
     * If the new modality differs, remove any incompatible outgoing connections.
     * When content is cleared (removed), reset modality and outputTypes and remove all outgoing connections.
     */
    const handleUpdateFileInput = useCallback(async (nodeId, content, mimeType) => {
        pushUndo();
        let newModality = null;
        if (content && mimeType) {
            if (mimeType.startsWith("image/")) newModality = "image";
            else if (mimeType.startsWith("audio/")) newModality = "audio";
            else if (mimeType.startsWith("video/")) newModality = "video";
            else if (mimeType === "application/pdf") newModality = "pdf";
            else newModality = "text";
        }

        setNodes((prev) =>
            prev.map((n) => {
                if (n.id !== nodeId || n.nodeType !== "input") return n;
                return {
                    ...n,
                    content: content || "",
                    modality: newModality,
                    outputTypes: newModality ? [newModality] : [],
                };
            }),
        );

        // Remove incompatible outgoing connections
        setConnections((prev) =>
            prev.filter((c) => {
                if (c.sourceNodeId !== nodeId) return true;
                // If file was removed, drop all outgoing connections
                if (!newModality) return false;
                // Keep only if the connection modality matches the new modality
                return c.sourceModality === newModality;
            }),
        );

        // Base64 data URLs are kept in-memory until save — Prism backend
        // handles the upload to MinIO when the workflow is persisted.
    }, []);

    // Update config of a model node (systemPrompt, staticInputs, etc.)
    const handleUpdateNodeConfig = useCallback((nodeId, key, value) => {
        setNodes((prev) =>
            prev.map((n) => {
                if (n.id !== nodeId) return n;
                const updated = { ...n, [key]: value };
                // Regenerate compound ports when messages change on conversation input nodes
                if (key === "messages" && n.nodeType === "input" && n.modality === "conversation") {
                    updated.inputTypes = buildConversationPorts(value, n.supportedModalities || ["text"]);
                }
                return updated;
            }),
        );
    }, []);

    // Run the workflow
    const handleRunWorkflow = useCallback(async () => {
        setIsRunning(true);
        setNodeStatuses({});
        setNodeResults({});
        abortRef.current = false;

        // Clear viewer node content from previous runs
        setNodes((prev) =>
            prev.map((n) =>
                n.nodeType === "viewer"
                    ? { ...n, content: null, contentType: null, receivedOutputs: {} }
                    : n,
            ),
        );

        try {
            const { conversationIds } = await executeWorkflow(nodes, connections, {
                onNodeStart: (nodeId) => {
                    if (abortRef.current) return;
                    setNodeStatuses((prev) => ({ ...prev, [nodeId]: "running" }));
                },
                onNodeComplete: (nodeId, outputs) => {
                    if (abortRef.current) return;
                    setNodeStatuses((prev) => ({ ...prev, [nodeId]: "done" }));
                    setNodeResults((prev) => ({ ...prev, [nodeId]: outputs }));

                    // Update viewer nodes with ALL received content
                    setNodes((prev) =>
                        prev.map((n) => {
                            if (n.id !== nodeId || n.nodeType !== "viewer") return n;
                            // Store all outputs on the viewer node
                            const receivedOutputs = {};
                            let firstContent = null;
                            let firstType = null;
                            for (const [type, data] of Object.entries(outputs)) {
                                if (data) {
                                    receivedOutputs[type] = data;
                                    if (!firstContent) {
                                        firstContent = data;
                                        firstType = type;
                                    }
                                }
                            }
                            return {
                                ...n,
                                content: firstContent,
                                contentType: firstType,
                                receivedOutputs,
                            };
                        }),
                    );
                },
                onNodeError: (nodeId, error) => {
                    if (abortRef.current) return;
                    setNodeStatuses((prev) => ({ ...prev, [nodeId]: "error" }));
                    setNodeResults((prev) => ({ ...prev, [nodeId]: { error: error.message } }));
                },
                onViewerPartial: (viewerNodeId, partialOutputs) => {
                    if (abortRef.current) return;
                    // Show viewer as running while it receives partial data
                    setNodeStatuses((prev) => {
                        if (prev[viewerNodeId] === "done") return prev;
                        return { ...prev, [viewerNodeId]: "running" };
                    });
                    // Incrementally update the viewer's received outputs
                    setNodes((prev) =>
                        prev.map((n) => {
                            if (n.id !== viewerNodeId || n.nodeType !== "viewer") return n;
                            const receivedOutputs = { ...(n.receivedOutputs || {}), ...partialOutputs };
                            const firstEntry = Object.entries(receivedOutputs).find(([, v]) => v);
                            return {
                                ...n,
                                content: firstEntry ? firstEntry[1] : null,
                                contentType: firstEntry ? firstEntry[0] : null,
                                receivedOutputs,
                            };
                        }),
                    );
                },
                onNodeContentUpdate: (nodeId, newContent) => {
                    setNodes((prev) =>
                        prev.map((n) => {
                            if (n.id !== nodeId) return n;
                            return { ...n, content: newContent };
                        }),
                    );
                },
                workflowId,
            });

            // Link generated conversations to this workflow
            if (workflowId && conversationIds?.length > 0) {
                PrismService.patchWorkflowConversations(workflowId, conversationIds)
                    .catch((err) => console.error("Failed to link conversations to workflow:", err));
            }
        } catch (err) {
            showToast(`Execution failed: ${err.message}`, "error");
        } finally {
            setIsRunning(false);
        }
    }, [nodes, connections, workflowId]);

    const handleStopWorkflow = useCallback(() => {
        abortRef.current = true;
        setIsRunning(false);
    }, []);

    // Update node position (drag)
    const handleUpdateNodePosition = useCallback((nodeId, position) => {
        setNodes((prev) =>
            prev.map((n) => (n.id === nodeId ? { ...n, position } : n)),
        );
    }, []);

    // Delete a node and its connections
    const handleDeleteNode = useCallback((nodeId) => {
        pushUndo();
        setNodes((prev) => prev.filter((n) => n.id !== nodeId));
        setConnections((prev) =>
            prev.filter(
                (c) => c.sourceNodeId !== nodeId && c.targetNodeId !== nodeId,
            ),
        );
    }, []);

    // Add a connection
    const handleAddConnection = useCallback((conn) => {
        pushUndo();
        setConnections((prev) => [
            ...prev,
            { ...conn, id: generateConnectionId() },
        ]);

        // If source is a conversation input, sync its modalities with the downstream model
        setNodes((prev) => {
            const sourceNode = prev.find((n) => n.id === conn.sourceNodeId);
            const targetNode = prev.find((n) => n.id === conn.targetNodeId);

            // Auto-populate viewer if source node already has results
            if (targetNode?.nodeType === "viewer") {
                const existingResults = nodeResults[conn.sourceNodeId];
                if (existingResults && existingResults[conn.sourceModality]) {
                    const data = existingResults[conn.sourceModality];
                    return prev.map((n) => {
                        if (n.id !== conn.targetNodeId) return n;
                        const receivedOutputs = { ...(n.receivedOutputs || {}), [conn.targetModality]: data };
                        return {
                            ...n,
                            content: data,
                            contentType: conn.targetModality,
                            receivedOutputs,
                        };
                    });
                }
            }

            if (sourceNode?.nodeType === "input" && sourceNode?.modality === "conversation" && targetNode && !targetNode.nodeType) {
                const rawInputs = (targetNode.rawInputTypes || targetNode.inputTypes || []).filter((t) => t !== "conversation");
                const messages = sourceNode.messages || [{ role: "system", content: "" }, { role: "user", content: "" }];
                const newPorts = new Set(buildConversationPorts(messages, rawInputs));
                // Remove connections to conversation input ports that no longer exist
                setConnections((prevConns) =>
                    prevConns.filter((c) => {
                        if (c.targetNodeId !== conn.sourceNodeId) return true;
                        return newPorts.has(c.targetModality);
                    })
                );
                return prev.map((n) =>
                    n.id === conn.sourceNodeId
                        ? { ...n, supportedModalities: rawInputs, inputTypes: [...newPorts] }
                        : n
                );
            }
            return prev;
        });
    }, [nodeResults]);

    // Delete a connection
    const handleDeleteConnection = useCallback((connId) => {
        pushUndo();

        // Find the connection before removing it
        setConnections((prev) => {
            const deleted = prev.find((c) => c.id === connId);
            const remaining = prev.filter((c) => c.id !== connId);

            if (deleted) {
                // Handle viewer disconnection
                setNodes((prevNodes) => {
                    const targetNode = prevNodes.find((n) => n.id === deleted.targetNodeId);
                    if (targetNode?.nodeType === "viewer") {
                        const receivedOutputs = { ...(targetNode.receivedOutputs || {}) };
                        delete receivedOutputs[deleted.targetModality];
                        const viewerStillConnected = remaining.filter((c) => c.targetNodeId === deleted.targetNodeId);
                        const firstEntry = Object.entries(receivedOutputs).find(([, v]) => v);
                        return prevNodes.map((n) =>
                            n.id === deleted.targetNodeId
                                ? {
                                    ...n,
                                    content: firstEntry ? firstEntry[1] : null,
                                    contentType: firstEntry ? firstEntry[0] : null,
                                    receivedOutputs: viewerStillConnected.length > 0 ? receivedOutputs : {},
                                }
                                : n
                        );
                    }
                    return prevNodes;
                });

                // Handle conversation input disconnection — reset ports
                const sourceStillConnected = remaining.some(
                    (c) => c.sourceNodeId === deleted.sourceNodeId && c.sourceModality === "conversation"
                );
                if (!sourceStillConnected) {
                    setNodes((prevNodes) => {
                        const sourceNode = prevNodes.find((n) => n.id === deleted.sourceNodeId);
                        if (sourceNode?.nodeType === "input" && sourceNode?.modality === "conversation") {
                            return prevNodes.map((n) =>
                                n.id === deleted.sourceNodeId
                                    ? { ...n, supportedModalities: ["text"], inputTypes: [] }
                                    : n
                            );
                        }
                        return prevNodes;
                    });
                }
            }

            return remaining;
        });
    }, []);

    // Save current workflow
    const handleSaveWorkflow = useCallback(async () => {
        try {
            const workflow = {
                id: workflowId,
                name: workflowName || "Untitled Workflow",
                nodes,
                connections,
                nodeResults,
                nodeStatuses,
            };
            const saved = await WorkflowService.saveWorkflow(workflow);
            const newId = saved.id || saved._id;
            setWorkflowId(newId);
            const wfs = await WorkflowService.getWorkflows();
            setSavedWorkflows(wfs.map((w) => ({ ...w, id: w._id || w.id })));
            showToast("Workflow saved");
        } catch (err) {
            showToast(`Failed to save: ${err.message}`, "error");
        }
    }, [workflowId, workflowName, nodes, connections, nodeResults, nodeStatuses]);

    // Load a saved workflow
    const handleLoadWorkflow = useCallback(async (id) => {
        pushUndo();
        try {
            const wf = await WorkflowService.getWorkflow(id);
            if (!wf) return;
            setWorkflowId(wf._id || wf.id);
            setWorkflowName(wf.name || "Untitled Workflow");
            setNodes(wf.nodes || []);
            setConnections(wf.connections || []);
            setNodeResults(wf.nodeResults || {});
            setNodeStatuses(wf.nodeStatuses || {});
            showToast("Workflow loaded");
        } catch (err) {
            showToast(`Failed to load: ${err.message}`, "error");
        }
    }, []);

    // Delete a saved workflow
    const handleDeleteWorkflow = useCallback(
        async (id) => {
            try {
                await WorkflowService.deleteWorkflow(id);
                const wfs = await WorkflowService.getWorkflows();
                setSavedWorkflows(wfs.map((w) => ({ ...w, id: w._id || w.id })));
                if (workflowId === id) {
                    setWorkflowId(null);
                    setWorkflowName("Untitled Workflow");
                    setNodes([]);
                    setConnections([]);
                    setNodeResults({});
                    setNodeStatuses({});
                }
                showToast("Workflow deleted");
            } catch (err) {
                showToast(`Failed to delete: ${err.message}`, "error");
            }
        },
        [workflowId],
    );

    // Change the model on an existing node
    const handleChangeModel = useCallback(
        (nodeId, newModel) => {
            const isConversation = newModel.modelType === "conversation";
            setNodes((prev) =>
                prev.map((n) => {
                    if (n.id !== nodeId || n.nodeType) return n;
                    return {
                        ...n,
                        modelName: newModel.name,
                        provider: newModel.provider,
                        displayName: newModel.display_name || newModel.label || newModel.name,
                        modelType: newModel.modelType,
                        inputTypes: isConversation ? ["conversation"] : (newModel.inputTypes || []),
                        rawInputTypes: newModel.inputTypes || [],
                        outputTypes: newModel.outputTypes || [],
                        supportsSystemPrompt: newModel.supportsSystemPrompt !== false,
                    };
                }),
            );

            // Remove connections whose modalities are no longer valid
            const newInputTypes = isConversation
                ? new Set(["conversation"])
                : new Set(newModel.inputTypes || []);
            const newOutputTypes = new Set(newModel.outputTypes || []);
            setConnections((prev) =>
                prev.filter((c) => {
                    if (c.targetNodeId === nodeId && !newInputTypes.has(c.targetModality)) return false;
                    if (c.sourceNodeId === nodeId && !newOutputTypes.has(c.sourceModality)) return false;
                    return true;
                }),
            );
        },
        [],
    );

    // New workflow
    const handleNewWorkflow = useCallback(() => {
        pushUndo();
        setWorkflowId(null);
        setWorkflowName("Untitled Workflow");
        setNodes([]);
        setConnections([]);
        setNodeResults({});
        setNodeStatuses({});
        setSelectedNodeId(null);
    }, [pushUndo]);

    // Duplicate a node (copy-paste)
    const handleDuplicateNode = useCallback((nodeData) => {
        pushUndo();
        const newNode = {
            ...JSON.parse(JSON.stringify(nodeData)),
            id: generateNodeId(),
            position: {
                x: (nodeData.position?.x || 0) + 40,
                y: (nodeData.position?.y || 0) + 40,
            },
        };
        // Strip runtime state
        delete newNode.receivedOutputs;
        setNodes((prev) => [...prev, newNode]);
        setSelectedNodeId(newNode.id);
    }, []);

    return (
        <div className={styles.page}>
            {/* Header */}
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <Link href="/" className={styles.backBtn}>
                        <ArrowLeft size={16} />
                    </Link>
                    <h1 className={styles.headerTitle}>Workflows</h1>
                    <span className={styles.headerBadge}>
                        {nodes.length} nodes · {connections.length} connections
                    </span>
                </div>
                <div className={styles.headerRight}>
                    <button
                        className={styles.headerActionBtn}
                        onClick={() => {
                            const data = JSON.stringify({ nodes, connections }, null, 2);
                            const blob = new Blob([data], { type: "application/json" });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = `workflow-${Date.now()}.json`;
                            a.click();
                            URL.revokeObjectURL(url);
                        }}
                        title="Export workflow"
                    >
                        <Download size={14} />
                    </button>
                    <button
                        className={styles.headerActionBtn}
                        onClick={() => importRef.current?.click()}
                        title="Import workflow"
                    >
                        <Upload size={14} />
                    </button>
                    <button
                        className={styles.headerActionBtn}
                        onClick={handleUndo}
                        disabled={undoCount === 0}
                        title={`Undo (Ctrl+Z) · ${undoCount} states`}
                    >
                        <Undo2 size={14} />
                    </button>
                    <input
                        ref={importRef}
                        type="file"
                        accept=".json"
                        style={{ display: "none" }}
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = () => {
                                try {
                                    const data = JSON.parse(reader.result);
                                    if (data.nodes && data.connections) {
                                        setNodes(data.nodes);
                                        setConnections(data.connections);
                                    }
                                } catch {
                                    // invalid JSON
                                }
                            };
                            reader.readAsText(file);
                            e.target.value = "";
                        }}
                    />
                    {isRunning ? (
                        <button className={`${styles.runBtn} ${styles.runBtnStop}`} onClick={handleStopWorkflow}>
                            <Square size={14} />
                            Stop
                        </button>
                    ) : (
                        <button
                            className={styles.runBtn}
                            onClick={handleRunWorkflow}
                            disabled={nodes.length === 0}
                        >
                            <Play size={14} />
                            Run
                        </button>
                    )}
                    {isRunning && <Loader2 size={16} className={styles.spinner} />}
                    <button className={styles.themeToggle} onClick={toggleTheme}>
                        {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
                    </button>
                </div>
            </header>

            {/* Body */}
            <div className={styles.body}>
                <WorkflowComponent
                    nodes={nodes}
                    connections={connections}
                    selectedNodeId={selectedNodeId}
                    onSelectNode={setSelectedNodeId}
                    nodeStatuses={nodeStatuses}
                    nodeResults={nodeResults}
                    onUpdateNodePosition={handleUpdateNodePosition}
                    onDeleteNode={handleDeleteNode}
                    onAddConnection={handleAddConnection}
                    onDeleteConnection={handleDeleteConnection}
                    onUpdateNodeContent={handleUpdateNodeContent}
                    onUpdateNodeConfig={handleUpdateNodeConfig}
                    onUpdateFileInput={handleUpdateFileInput}
                    workflows={savedWorkflows}
                    activeWorkflowId={workflowId}
                    onLoadWorkflow={handleLoadWorkflow}
                    onDeleteWorkflow={handleDeleteWorkflow}
                    onAddAsset={handleAddAsset}
                    onNewWorkflow={handleNewWorkflow}
                    onSaveWorkflow={handleSaveWorkflow}
                    workflowName={workflowName}
                    onWorkflowNameChange={setWorkflowName}
                    onDownloadWorkflow={async (id) => {
                        try {
                            const wf = await WorkflowService.getWorkflow(id);
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
                    }}
                    onCopyWorkflow={async (id) => {
                        try {
                            const wf = await WorkflowService.getWorkflow(id);
                            if (!wf) return;
                            await navigator.clipboard.writeText(JSON.stringify(wf, null, 2));
                            showToast("Workflow copied to clipboard");
                        } catch (err) {
                            showToast(`Copy failed: ${err.message}`, "error");
                        }
                    }}
                    allModels={modelsWithModalities}
                    onChangeModel={handleChangeModel}
                    onDuplicateNode={handleDuplicateNode}
                />
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

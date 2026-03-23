"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import styles from "../app/page.module.css";
import PrismService from "../services/PrismService";
import SunService from "../services/SunService";
import { prepareDisplayMessages } from "./MessageList";
import StorageService from "../services/StorageService";
import {
    Send,
    Zap,
    ChevronDown,
    ChevronRight,
    CheckCircle2,
    AlertCircle,
    Loader2,
} from "lucide-react";
import NavigationSidebarComponent from "../components/NavigationSidebarComponent";
import SettingsPanel from "../components/SettingsPanel";
import ParametersPanelComponent from "../components/ParametersPanelComponent";
import CustomToolsPanel from "../components/CustomToolsPanel";
import ChatArea from "../components/ChatArea";
import HistoryPanel from "../components/HistoryPanel";
import ThreePanelLayout from "../components/ThreePanelLayout";
import consoleStyles from "../components/ConsoleComponent.module.css";

export default function HomePage({ initialConversationId = null }) {
    const router = useRouter();
    const [config, setConfig] = useState(null);
    const [inferenceMode, _setInferenceMode] = useState(() =>
        StorageService.get("inferenceMode", "async"),
    );
    const [conversations, setConversations] = useState([]);

    const [activeId, setActiveId] = useState(initialConversationId || null);
    const [title, setTitle] = useState("New Conversation");
    const [messages, setMessages] = useState([]);

    const [settings, setSettings] = useState({
        provider: "",
        model: "",
        systemPrompt: "You are a helpful AI assistant",
        temperature: 1.0,
        maxTokens: 2048,
        topP: 1,
        topK: 0,
        frequencyPenalty: 0,
        presencePenalty: 0,
        stopSequences: "",
        thinkingEnabled: false,
        reasoningEffort: "high",
        thinkingLevel: "high",
        thinkingBudget: "",
        webSearchEnabled: false,
        verbosity: "",
        reasoningSummary: "",
    });

    const [isGenerating, setIsGenerating] = useState(false);
    const [isGeneratingImage, setIsGeneratingImage] = useState(false);
    const [newChatKey, setNewChatKey] = useState(0);
    const [showModelList, setShowModelList] = useState(false);
    const [showSystemPromptModal, setShowSystemPromptModal] = useState(false);
    const skipSystemPromptSave = useRef(false);
    const [workflows, setWorkflows] = useState([]);
    const [favoriteKeys, setFavoriteKeys] = useState([]);
    const [convFavoriteKeys, setConvFavoriteKeys] = useState([]);
    const [originalMessageCount, setOriginalMessageCount] = useState(0);
    const [originalTotalCost, setOriginalTotalCost] = useState(0);

    // ── Function Calling state ──────────────────────────────────
    const [leftTab, setLeftTab] = useState("settings");

    // Determine if the selected model supports Function Calling
    const selectedModelSupportsFc = useMemo(() => {
        const providerModels = config?.textToText?.models?.[settings.provider] || [];
        const modelDef = providerModels.find((m) => m.name === settings.model);
        return modelDef?.tools?.includes("Function Calling") ?? false;
    }, [config, settings.provider, settings.model]);

    // Reset to Settings tab when the model doesn't support FC
    useEffect(() => {
        if (!selectedModelSupportsFc && leftTab === "tools") {
            setLeftTab("settings");
        }
    }, [selectedModelSupportsFc, leftTab]);
    const [customTools, setCustomTools] = useState([]);
    const [disabledBuiltIns, setDisabledBuiltIns] = useState(new Set());
    const [offlineTools, setOfflineTools] = useState(() => new Set());
    const [toolActivity, setToolActivity] = useState([]);
    const [showToolPanel, setShowToolPanel] = useState(false);
    const abortRef = useRef(null);

    // Helper to update URL bar without triggering Next.js navigation.
    // Uses History.prototype.replaceState to bypass Next.js's patching of window.history.
    const updateUrl = (id) => {
        const targetPath = id ? `/conversations/${id}` : "/";
        if (window.location.pathname !== targetPath) {
            History.prototype.replaceState.call(window.history, {}, "", targetPath);
        }
    };

    const uniqueModels = useMemo(
        () => [
            ...new Set(
                messages
                    .filter((m) => m.role === "assistant" && m.model)
                    .map((m) => m.model),
            ),
        ],
        [messages],
    );

    const totalCost = useMemo(
        () => messages.reduce((sum, m) => sum + (m.estimatedCost || 0), 0),
        [messages],
    );

    // Auto-save system prompt on edit (debounced)
    useEffect(() => {
        if (!activeId || messages.length === 0) return;
        if (skipSystemPromptSave.current) {
            skipSystemPromptSave.current = false;
            return;
        }
        const timer = setTimeout(() => {
            const { systemPrompt, ...modelSettings } = settings;
            PrismService.patchConversation(activeId, {
                systemPrompt,
                settings: modelSettings,
            }).catch((err) => console.error("Failed to save system prompt:", err));
        }, 500);
        return () => clearTimeout(timer);
    }, [settings.systemPrompt]);

    // Fetch workflows that include this conversation
    useEffect(() => {
        if (!activeId) {
            setWorkflows([]);
            return;
        }
        PrismService.getConversationWorkflows(activeId)
            .then(setWorkflows)
            .catch(() => setWorkflows([]));
    }, [activeId]);

    useEffect(() => {
        PrismService.getConfig()
            .then((cfg) => {
                setConfig(cfg);

                // Try to restore last-used provider/model from localStorage
                const savedProvider = StorageService.get("lastProvider");
                const savedModel = StorageService.get("lastModel");
                const savedValid =
                    savedProvider &&
                    cfg.providerList?.includes(savedProvider) &&
                    ((cfg.textToText?.models?.[savedProvider] || []).some(
                        (m) => m.name === savedModel,
                    ) ||
                        (cfg.textToImage?.models?.[savedProvider] || []).some(
                            (m) => m.name === savedModel,
                        ));

                const prov = savedValid ? savedProvider : cfg.providerList?.[0] || "";
                const mod = savedValid
                    ? savedModel
                    : cfg.textToText?.defaults?.[prov] ||
                    cfg.textToText?.models?.[prov]?.[0]?.name ||
                    "";

                const modelDef =
                    (cfg.textToText?.models?.[prov] || []).find((m) => m.name === mod) ||
                    (cfg.textToImage?.models?.[prov] || []).find((m) => m.name === mod);
                const temp = modelDef?.defaultTemperature ?? 1.0;
                setSettings((s) => ({
                    ...s,
                    provider: prov,
                    model: mod,
                    temperature: temp,
                }));
            })
            .catch(console.error);

        // Load history
        loadConversations();

        // Load favorite models
        PrismService.getFavorites("model")
            .then((favs) => setFavoriteKeys(favs.map((f) => f.key)))
            .catch(() => {});

        // Load favorite conversations
        PrismService.getFavorites("conversation")
            .then((favs) => setConvFavoriteKeys(favs.map((f) => f.key)))
            .catch(() => {});
    }, []);

    // ── Function Calling infrastructure ────────────────────────
    const MAX_TOOL_ITERATIONS = 25;

    /**
     * Truncate a tool result to avoid blowing up the model's context window.
     * Caps arrays at 10 items and the serialized JSON at ~8 000 chars.
     * The full result is still stored in the DB and shown in the UI;
     * this only affects what gets re-sent to the model.
     */
    function truncateToolResult(result, maxChars = 8000) {
        if (!result || typeof result !== "object") return result;

        // If result has a known array wrapper, cap items at 10
        const trimmed = { ...result };
        const ARRAY_KEYS = ["events", "products", "trends", "articles", "earnings", "predictions", "commodities"];
        for (const key of ARRAY_KEYS) {
            if (Array.isArray(trimmed[key]) && trimmed[key].length > 10) {
                const total = trimmed[key].length;
                trimmed[key] = trimmed[key].slice(0, 10);
                trimmed[`_${key}Truncated`] = `Showing 10 of ${total}`;
            }
        }

        // Also handle top-level arrays (e.g. tides, earthquakes)
        if (Array.isArray(result) && result.length > 10) {
            const sliced = result.slice(0, 10);
            sliced.push({ _truncated: `Showing 10 of ${result.length}` });
            const str = JSON.stringify(sliced);
            return str.length > maxChars ? str.slice(0, maxChars) + '…}' : sliced;
        }

        const str = JSON.stringify(trimmed);
        if (str.length <= maxChars) return trimmed;
        return str.slice(0, maxChars) + '…}';
    }


    const FC_SYSTEM_PROMPT = `You are a helpful AI assistant with access to real-time data APIs. You have tools for weather, air quality, earthquakes, solar activity, aurora forecasts, sunrise/sunset times, tides, wildfires, ISS tracking, local events, commodity/market prices, trending topics, and product search.

Guidelines:
- When asked about weather, events, prices, trends, or similar data, ALWAYS use the appropriate tool to fetch real-time data. Never guess or make up data.
- You may call multiple tools in a single response if the question requires data from multiple sources.
- Present data clearly with relevant formatting — use tables, bullet points, and emojis where appropriate.
- When data includes numbers, format them appropriately (currencies, percentages, temperatures).
- If a tool returns an error, inform the user and suggest alternatives.
- Be conversational and helpful, not just a data dump.
- For questions that don't require API data, respond naturally without tool calls.
- The current local date/time is: ${new Date().toLocaleString()}`;

    const sanitizeName = (name) =>
        name
            .replace(/[^a-zA-Z0-9_.:/-]/g, "_")
            .replace(/^[^a-zA-Z_]/, "_$&")
            .slice(0, 128);

    const allToolSchemas = useMemo(() => {
        const builtIn = SunService.getToolSchemas().filter(
            (t) => !disabledBuiltIns.has(t.name) && !offlineTools.has(t.name),
        );
        const custom = customTools
            .filter((t) => t.enabled)
            .map((t) => ({
                name: sanitizeName(t.name),
                description: t.description,
                parameters: {
                    type: "object",
                    properties: Object.fromEntries(
                        (t.parameters || []).map((p) => [
                            p.name,
                            {
                                type: p.type || "string",
                                description: p.description || "",
                                ...(p.enum?.length ? { enum: p.enum } : {}),
                            },
                        ]),
                    ),
                    required: (t.parameters || [])
                        .filter((p) => p.required)
                        .map((p) => p.name),
                },
            }));
        return [...builtIn, ...custom];
    }, [customTools, disabledBuiltIns, offlineTools]);

    const customToolMap = useMemo(() => {
        const map = new Map();
        for (const t of customTools) {
            if (t.enabled) map.set(sanitizeName(t.name), t);
        }
        return map;
    }, [customTools]);

    const loadCustomTools = useCallback(async () => {
        try {
            const tools = await PrismService.getCustomTools();
            setCustomTools(tools);
        } catch (err) {
            console.error("Failed to load custom tools:", err);
        }
    }, []);

    // Load custom tools on mount
    useEffect(() => {
        loadCustomTools();
    }, [loadCustomTools]);

    // Check API health on mount
    useEffect(() => {
        SunService.checkApiHealth()
            .then(({ offline }) => setOfflineTools(offline))
            .catch(console.error);
    }, []);

    const handleToggleBuiltIn = useCallback((toolName) => {
        setDisabledBuiltIns((prev) => {
            const next = new Set(prev);
            if (next.has(toolName)) next.delete(toolName);
            else next.add(toolName);
            return next;
        });
    }, []);

    function renderToolName(name) {
        return name
            .replace(/^get_/, "")
            .replace(/_/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase());
    }

    // Load conversation from URL path on mount
    const urlLoadedRef = useRef(false);
    useEffect(() => {
        if (initialConversationId && !urlLoadedRef.current) {
            urlLoadedRef.current = true;
            PrismService.getConversation(initialConversationId)
                .then((full) => {
                    setActiveId(full.id);
                    setTitle(full.title);
                    const displayMessages = prepareDisplayMessages(full.messages);
                    setMessages(displayMessages);
                    setOriginalMessageCount(displayMessages.length);
                    setOriginalTotalCost(full.totalCost || displayMessages.reduce((s, m) => s + (m.estimatedCost || 0), 0));
                    skipSystemPromptSave.current = true;

                    // Detect if conversation used function calling
                    const hadToolCalls = (full.messages || []).some(
                        (m) => m.role === "tool" || m.toolCalls?.length > 0,
                    );

                    let restoredSettings = full.settings || {};
                    if (!restoredSettings.provider && full.messages?.length) {
                        const lastAssistant = [...(full.messages || [])]
                            .reverse()
                            .find((m) => m.role === "assistant");
                        if (lastAssistant) {
                            restoredSettings = {
                                ...restoredSettings,
                                provider: lastAssistant.provider || "",
                                model: lastAssistant.model || "",
                            };
                        }
                    }

                    setSettings((s) => ({
                        ...s,
                        ...restoredSettings,
                        systemPrompt: full.systemPrompt || "You are a helpful AI assistant.",
                        ...(hadToolCalls && { functionCallingEnabled: true }),
                    }));
                })
                .catch(() => {
                    setActiveId(null);
                    updateUrl(null);
                });
        }
    }, [initialConversationId]);



    const loadConversations = async () => {
        try {
            const hist = await PrismService.getConversations();
            setConversations(hist);
        } catch (err) {
            console.error(err);
        }
    };

    const handleNewChat = () => {
        setActiveId(null);
        updateUrl(null);
        setTitle("New Conversation");
        setMessages([]);
        setOriginalMessageCount(0);
        setOriginalTotalCost(0);
        setToolActivity([]);
        setShowToolPanel(false);
        skipSystemPromptSave.current = true;
        setSettings((s) => ({
            ...s,
            systemPrompt: "You are a helpful AI assistant.",
        }));
    };

    // Explicit "New Conversation" button action — also resets the welcome flow
    const handleNewChatClick = () => {
        handleNewChat();
        setNewChatKey((k) => k + 1);
    };

    // Persist provider/model to localStorage
    useEffect(() => {
        if (settings.provider)
            StorageService.set("lastProvider", settings.provider);
        if (settings.model) StorageService.set("lastModel", settings.model);
    }, [settings.provider, settings.model]);

    // Persist inference mode to localStorage
    useEffect(() => {
        StorageService.set("inferenceMode", inferenceMode);
    }, [inferenceMode]);

    const handleSelectConversation = async (conv) => {
        if (conv.id === activeId) return;
        try {
            const full = await PrismService.getConversation(conv.id);
            setActiveId(full.id);
            updateUrl(full.id);
            setTitle(full.title);
            const displayMessages = prepareDisplayMessages(full.messages);
            setMessages(displayMessages);
            setOriginalMessageCount(displayMessages.length);
            setOriginalTotalCost(full.totalCost || displayMessages.reduce((s, m) => s + (m.estimatedCost || 0), 0));
            skipSystemPromptSave.current = true;

            // Detect if conversation used function calling
            const hadToolCalls = (full.messages || []).some(
                (m) => m.role === "tool" || m.toolCalls?.length > 0,
            );

            // Restore settings — use saved settings, or fall back to
            // provider/model from the last assistant message (for older conversations).
            let restoredSettings = full.settings || {};
            if (!restoredSettings.provider && full.messages?.length) {
                const lastAssistant = [...(full.messages || [])]
                    .reverse()
                    .find((m) => m.role === "assistant");
                if (lastAssistant) {
                    restoredSettings = {
                        ...restoredSettings,
                        provider: lastAssistant.provider || "",
                        model: lastAssistant.model || "",
                    };
                }
            }

            setSettings((s) => ({
                ...s,
                ...restoredSettings,
                systemPrompt: full.systemPrompt || "You are a helpful AI assistant.",
                ...(hadToolCalls && { functionCallingEnabled: true }),
            }));
        } catch (err) {
            console.error(err);
        }
    };

    const handleDeleteConversation = async (id) => {
        try {
            await PrismService.deleteConversation(id);
            if (activeId === id) handleNewChat();
            loadConversations();
        } catch (err) {
            console.error(err);
        }
    };

    const handleDeleteMessage = async (index) => {
        if (isGenerating) return;
        const updatedMessages = [...messages];
        updatedMessages.splice(index, 1);
        setMessages(updatedMessages);

        if (activeId) {
            try {
                await PrismService.patchConversation(activeId, {
                    messages: updatedMessages,
                });
                loadConversations();
            } catch (err) {
                console.error("Failed to save after deletion:", err);
            }
        }
    };



    const handleRerunTurn = async (userMsgIndex) => {
        if (isGenerating) return;
        if (isTranscriptionModel) return; // Transcription models don't support rerun

        const userMsg = messages[userMsgIndex];
        if (!userMsg || userMsg.role !== "user") return;

        // --- TTS rerun branch ---
        if (isTTSModel) {
            const nextMsg = messages[userMsgIndex + 1];
            const hadAssistantAfter = nextMsg && nextMsg.role === "assistant";

            let newMessages;
            if (hadAssistantAfter) {
                newMessages = [
                    ...messages.slice(0, userMsgIndex + 1),
                    ...messages.slice(userMsgIndex + 2),
                ];
            } else {
                newMessages = [...messages];
            }

            setMessages(newMessages);
            setIsGenerating(true);

            try {
                const currentId = activeId;
                const currentTitle = title;

                const defaultVoice =
                    config?.textToSpeech?.defaultVoices?.[settings.provider] || undefined;
                const requestStart = performance.now();

                const result = await PrismService.generateSpeech({
                    provider: settings.provider,
                    text: userMsg.content,
                    voice: settings.voice || defaultVoice,
                    model: settings.model,
                });

                const totalTime = (performance.now() - requestStart) / 1000;

                const ttsModels =
                    config?.textToSpeech?.models?.[settings.provider] || [];
                const ttsModelDef = ttsModels.find((m) => m.name === settings.model);
                const charCount = userMsg.content.length;
                let estimatedCost = null;
                if (ttsModelDef?.pricing?.perCharacter) {
                    estimatedCost = charCount * ttsModelDef.pricing.perCharacter;
                } else if (ttsModelDef?.pricing?.inputPerMillion) {
                    const estimatedTokens = Math.ceil(charCount / 4);
                    estimatedCost =
                        (estimatedTokens / 1_000_000) * ttsModelDef.pricing.inputPerMillion;
                }

                const rerunVoice = settings.voice || defaultVoice || "";

                const assistantMsg = {
                    role: "assistant",
                    content: "",
                    audio: result.audioDataUrl,
                    timestamp: new Date().toISOString(),
                    provider: settings.provider,
                    model: settings.model,
                    voice: rerunVoice,
                    totalTime,
                    usage: { characters: charCount },
                    estimatedCost,
                };

                // Insert at the position right after the user message
                const finalMessages = [...newMessages];
                finalMessages.splice(userMsgIndex + 1, 0, assistantMsg);
                setMessages(finalMessages);

                try {
                    const { systemPrompt, ...modelSettings } = settings;
                    await PrismService.patchConversation(currentId, {
                        title: currentTitle,
                        messages: finalMessages,
                        systemPrompt,
                        settings: modelSettings,
                    });
                    loadConversations();
                } catch (saveErr) {
                    console.error("Save failed:", saveErr);
                }
            } catch (error) {
                console.error(error);
                setMessages((prev) => [
                    ...prev,
                    { role: "system", content: "Error: " + error.message },
                ]);
            } finally {
                setIsGenerating(false);
            }
            return;
        }

        // userMsg already declared above

        // Collect all messages up to and including this user message
        const historyUpToUser = messages.slice(0, userMsgIndex + 1);

        // Check if the next message is an assistant response — remove it if so
        const nextMsg = messages[userMsgIndex + 1];
        const hadAssistantAfter = nextMsg && nextMsg.role === "assistant";

        // Build newMessages: everything up to user msg, then everything after the assistant (if any)
        let newMessages;
        if (hadAssistantAfter) {
            newMessages = [...historyUpToUser, ...messages.slice(userMsgIndex + 2)];
        } else {
            newMessages = [...historyUpToUser, ...messages.slice(userMsgIndex + 1)];
        }

        // We want to re-generate right after the user message, so the new AI message
        // goes at position userMsgIndex + 1. For the API call, send history up to user msg.
        setMessages(newMessages);
        setIsGenerating(true);
        setToolActivity([]);

        // ── Function Calling rerun branch ────────────────────────────
        if (settings.functionCallingEnabled) {
            try {
                const currentId = activeId;
                const _currentTitle = title;
                const systemPromptText = settings.systemPrompt || FC_SYSTEM_PROMPT;
                const currentMessages = [...historyUpToUser];
                let iterations = 0;
                let hasCalledTools = false;

                while (iterations < MAX_TOOL_ITERATIONS) {
                    iterations++;
                    let streamedText = "";
                    const pendingToolCalls = [];

                    // Insert placeholder so the blinking cursor shows immediately
                    setMessages((prev) => {
                        const cleaned = prev.filter((m) => !(m.role === "assistant" && !m.content?.trim() && !m.toolCalls?.length));
                        return [...cleaned, { role: "assistant", content: "", provider: settings.provider, model: settings.model }];
                    });

                    await new Promise((resolve, reject) => {
                        const payload = {
                            provider: settings.provider,
                            model: settings.model,
                            messages: [
                                { role: "system", content: systemPromptText },
                                ...currentMessages
                                    .filter((m) => m.role !== "assistant" || m.content?.trim() || m.toolCalls?.length)
                                    .flatMap((m) => {
                                        // Expand assistant messages with toolCalls into
                                        // [assistant(tool_calls), tool(result1), tool(result2), ...]
                                        // per the OpenAI Chat Completions spec
                                        if (m.role === "assistant" && m.toolCalls?.length > 0) {
                                            const assistantMsg = {
                                                role: "assistant",
                                                content: m.content?.trim() || null,
                                                toolCalls: m.toolCalls.map((tc) => ({
                                                    id: tc.id,
                                                    name: tc.name,
                                                    args: tc.args,
                                                    ...(tc.thoughtSignature ? { thoughtSignature: tc.thoughtSignature } : {}),
                                                })),
                                            };
                                            const toolMsgs = m.toolCalls
                                                .filter((tc) => tc.result !== undefined)
                                                .map((tc) => ({
                                                    role: "tool",
                                                    name: tc.name,
                                                    tool_call_id: tc.id,
                                                    content: typeof tc.result === "string" ? tc.result : JSON.stringify(tc.result),
                                                }));
                                            return [assistantMsg, ...toolMsgs];
                                        }
                                        return [{
                                            role: m.role,
                                            ...(m.content?.trim() ? { content: m.content } : { content: " " }),
                                            ...(m.images?.length > 0 ? { images: m.images } : {}),
                                            ...(m.role === "tool" ? { name: m.name, tool_call_id: m.tool_call_id } : {}),
                                        }];
                                    }),
                            ],
                            // Local models (LM Studio, Ollama) should stop receiving tools
                            // after their first tool round to force a text response.
                            // Cloud providers handle multi-step tool calling natively.
                            ...((settings.provider === "lm-studio" || settings.provider === "ollama")
                                ? (!hasCalledTools ? { tools: allToolSchemas } : {})
                                : { tools: allToolSchemas }),
                            maxTokens: settings.maxTokens,
                            temperature: settings.temperature,
                            conversationId: currentId,
                        };

                        abortRef.current = PrismService.streamText(payload, {
                            onChunk: (chunk) => {
                                streamedText += chunk;
                                setMessages((prev) => {
                                    const updated = [...prev];
                                    const lastMsg = updated[updated.length - 1];
                                    if (lastMsg?.role === "assistant" && !lastMsg.toolCalls?.length) {
                                        lastMsg.content = streamedText;
                                    } else {
                                        updated.push({ role: "assistant", content: streamedText });
                                    }
                                    return updated;
                                });
                            },
                            onToolCall: (toolCall) => {
                                pendingToolCalls.push(toolCall);
                                setToolActivity((prev) => [
                                    ...prev,
                                    {
                                        id: toolCall.id || `tc-${Date.now()}-${Math.random()}`,
                                        name: toolCall.name,
                                        args: toolCall.args,
                                        status: "calling",
                                        timestamp: Date.now(),
                                    },
                                ]);
                                setShowToolPanel(true);
                            },
                            onDone: () => resolve(),
                            onError: (err) => reject(err),
                            onThinking: () => {},
                        });
                    });

                    if (pendingToolCalls.length > 0) {
                        const results = await Promise.all(
                            pendingToolCalls.map(async (tc) => {
                                const customDef = customToolMap.get(tc.name);
                                if (customDef) {
                                    return {
                                        name: tc.name,
                                        id: tc.id,
                                        result: await SunService.executeCustomTool(customDef, tc.args),
                                    };
                                }
                                return {
                                    name: tc.name,
                                    id: tc.id,
                                    result: await SunService.executeTool(tc.name, tc.args),
                                };
                            }),
                        );

                        setToolActivity((prev) =>
                            prev.map((activity) => {
                                const result = results.find(
                                    (r) =>
                                        (r.id && r.id === activity.id) ||
                                        (!r.id && r.name === activity.name && activity.status === "calling"),
                                );
                                if (result) {
                                    return {
                                        ...activity,
                                        status: result.result?.error ? "error" : "done",
                                        result: result.result,
                                    };
                                }
                                return activity;
                            }),
                        );

                        // Persist tool result messages to the conversation
                        const toolResultMessages = results.map((result) => ({
                            role: "tool",
                            name: result.name,
                            tool_call_id: result.id,
                            content: JSON.stringify(result.result),
                            timestamp: new Date().toISOString(),
                        }));
                        PrismService.appendMessages(currentId, toolResultMessages).catch((err) =>
                            console.error("Failed to append tool results:", err),
                        );

                        const assistantMsg = {
                            role: "assistant",
                            content: streamedText || "",
                            toolCalls: pendingToolCalls.map((tc) => {
                                const match = results.find((r) => r.id === tc.id);
                                return {
                                    id: tc.id,
                                    name: tc.name,
                                    args: tc.args,
                                    thoughtSignature: tc.thoughtSignature || undefined,
                                    result: match ? match.result : null,
                                };
                            }),
                        };
                        currentMessages.push(assistantMsg);

                        for (const result of results) {
                            currentMessages.push({
                                role: "tool",
                                name: result.name,
                                tool_call_id: result.id,
                                content: JSON.stringify(truncateToolResult(result.result)),
                            });
                        }

                        hasCalledTools = true;

                        streamedText = "";
                        setMessages((prev) => {
                            const updated = [...prev];
                            const lastIdx = updated.findLastIndex((m) => m.role === "assistant");
                            if (lastIdx >= 0) {
                                updated[lastIdx] = assistantMsg;
                            } else {
                                updated.push(assistantMsg);
                            }
                            return updated;
                        });
                        continue;
                    }

                    // No tool calls — terminal state (text response or empty)
                    if (streamedText) {
                        currentMessages.push({ role: "assistant", content: streamedText });
                    } else if (iterations > 1) {
                        console.warn("[FC] Model returned empty response after tool results");
                    }
                    break;
                }

                setMessages(
                    currentMessages
                        .filter(
                            (m) =>
                                m.role !== "tool" &&
                                m.role !== "system" &&
                                !(m.role === "assistant" && !m.content?.trim() && !m.toolCalls?.length),
                        ),
                );
                loadConversations();
            } catch (error) {
                console.error(error);
                setMessages((prev) => [
                    ...prev,
                    { role: "system", content: "Error: " + error.message },
                ]);
            } finally {
                setIsGenerating(false);
                abortRef.current = null;
            }
            return;
        }

        // ── Normal text rerun branch ─────────────────────────────────
        try {
            const _currentId = activeId;
            const _currentTitle = title;

            const systemMsg = settings.systemPrompt
                ? [{ role: "system", content: settings.systemPrompt }]
                : [];
            const payloadMessages = [...systemMsg, ...historyUpToUser].map((m) => ({
                role: m.role,
                content: m.content,
                ...(m.images ? { images: m.images } : {}),
            }));
            const stopArray = settings.stopSequences
                ? settings.stopSequences
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean)
                : undefined;

            const currentModels =
                config?.textToText?.models?.[settings.provider] || [];
            const selectedModelDef = currentModels.find(
                (m) => m.name === settings.model,
            );

            const payload = {
                provider: settings.provider,
                model: settings.model,
                messages: payloadMessages,
                temperature: settings.temperature,
                maxTokens: settings.maxTokens,
                topP: settings.topP,
                topK: settings.topK,
                frequencyPenalty: settings.frequencyPenalty,
                presencePenalty: settings.presencePenalty,
                stopSequences: stopArray?.length ? stopArray : undefined,
                ...(selectedModelDef?.responsesAPI
                    ? {
                        reasoningEffort: settings.reasoningEffort || "high",
                        ...(settings.reasoningSummary
                            ? { reasoningSummary: settings.reasoningSummary }
                            : {}),
                    }
                    : {}),
                ...(!selectedModelDef?.responsesAPI && settings.thinkingEnabled
                    ? {
                        thinkingEnabled: true,
                        reasoningEffort: settings.reasoningEffort,
                        thinkingLevel: settings.thinkingLevel,
                        thinkingBudget: settings.thinkingBudget || undefined,
                    }
                    : {}),
                ...(settings.webSearchEnabled ? { webSearch: true } : {}),
                ...(settings.webSearchEnabled && selectedModelDef?.webFetch
                    ? { webFetch: true }
                    : {}),
                ...(settings.codeExecutionEnabled ? { codeExecution: true } : {}),
                ...(settings.urlContextEnabled ? { urlContext: true } : {}),
                ...(settings.verbosity ? { verbosity: settings.verbosity } : {}),
            };

            await new Promise((resolve, reject) => {
                let streamedText = "";
                let streamedThinking = "";
                let streamedImages = [];
                const codeBlocks = [];
                const insertIndex = userMsgIndex + 1;

                const placeholderMsg = {
                    role: "assistant",
                    content: "",
                    thinking: "",
                    timestamp: new Date().toISOString(),
                    provider: settings.provider,
                    model: settings.model,
                };

                // Insert placeholder at the correct position
                setMessages((prev) => {
                    const updated = [...prev];
                    updated.splice(insertIndex, 0, placeholderMsg);
                    return updated;
                });

                PrismService.streamText(payload, {
                    onStatus: (message) => {
                        setMessages((prev) => {
                            const updated = [...prev];
                            updated[insertIndex] = {
                                ...updated[insertIndex],
                                status: message,
                            };
                            return updated;
                        });
                    },
                    onChunk: (content) => {
                        streamedText += content;
                        setMessages((prev) => {
                            const updated = [...prev];
                            updated[insertIndex] = {
                                ...updated[insertIndex],
                                content: streamedText,
                                status: undefined,
                            };
                            return updated;
                        });
                    },
                    onThinking: (content) => {
                        streamedThinking += content;
                        setMessages((prev) => {
                            const updated = [...prev];
                            updated[insertIndex] = {
                                ...updated[insertIndex],
                                thinking: streamedThinking,
                            };
                            return updated;
                        });
                    },
                    onImage: (data, mimeType) => {
                        setIsGeneratingImage(true);
                        const dataUrl = `data:${mimeType};base64,${data}`;
                        streamedImages = [...streamedImages, dataUrl];
                        setMessages((prev) => {
                            const updated = [...prev];
                            updated[insertIndex] = {
                                ...updated[insertIndex],
                                images: streamedImages,
                            };
                            return updated;
                        });
                    },
                    onExecutableCode: (code, language) => {
                        const lang = language || "python";
                        streamedText += `\n\n\`\`\`exec-${lang}\n${code}\n\`\`\`\n\n`;
                        codeBlocks.push({ type: "code", code, language: lang });
                        setMessages((prev) => {
                            const updated = [...prev];
                            updated[insertIndex] = {
                                ...updated[insertIndex],
                                content: streamedText,
                            };
                            return updated;
                        });
                    },
                    onCodeExecutionResult: (output, outcome) => {
                        streamedText += `\n\n\`\`\`execresult-python\n${output}\n\`\`\`\n\n`;
                        codeBlocks.push({ type: "result", output, outcome });
                        setMessages((prev) => {
                            const updated = [...prev];
                            updated[insertIndex] = {
                                ...updated[insertIndex],
                                content: streamedText,
                            };
                            return updated;
                        });
                    },
                    onWebSearchResult: (results) => {
                        if (results && results.length > 0) {
                            const citations = results
                                .map((r) => `[${r.title}](${r.url})`)
                                .join(" · ");
                            streamedText += `\n\n> **Sources:** ${citations}\n\n`;
                            setMessages((prev) => {
                                const updated = [...prev];
                                updated[insertIndex] = {
                                    ...updated[insertIndex],
                                    content: streamedText,
                                };
                                return updated;
                            });
                        }
                    },
                    onDone: async (data) => {
                        const finalMsg = {
                            role: "assistant",
                            content: streamedText,
                            thinking: streamedThinking || undefined,
                            ...(streamedImages.length > 0 ? { images: streamedImages } : {}),
                            timestamp: placeholderMsg.timestamp,
                            provider: settings.provider,
                            model: settings.model,
                            usage: data.usage,
                            totalTime: data.totalTime,
                            tokensPerSec: data.tokensPerSec,
                            estimatedCost: data.estimatedCost,
                        };

                        setMessages((prev) => {
                            const updated = [...prev];
                            updated[insertIndex] = finalMsg;
                            return updated;
                        });

                        loadConversations();
                        resolve();
                    },
                    onError: (err) => {
                        reject(err);
                    },
                });
            });
        } catch (error) {
            console.error(error);
            setMessages((prev) => [
                ...prev,
                { role: "system", content: "Error: " + error.message },
            ]);
        } finally {
            setIsGenerating(false);
            setIsGeneratingImage(false);
        }
    };

    // Check if current model is an audio-to-text (transcription) model
    // Only true if the model is in audioToText but NOT in textToText or textToImage
    // (some models like Gemini 3 Flash share the same name across sections)
    const isTranscriptionModel = (() => {
        const atModels = config?.audioToText?.models?.[settings.provider] || [];
        if (!atModels.some((m) => m.name === settings.model)) return false;
        const ttModels = config?.textToText?.models?.[settings.provider] || [];
        const tiModels = config?.textToImage?.models?.[settings.provider] || [];
        return !ttModels.some((m) => m.name === settings.model) &&
            !tiModels.some((m) => m.name === settings.model);
    })();

    // Check if current model is a text-to-speech (TTS) model
    // Only true if the model is in textToSpeech but NOT in textToText or textToImage
    const isTTSModel = (() => {
        const ttsModels = config?.textToSpeech?.models?.[settings.provider] || [];
        if (!ttsModels.some((m) => m.name === settings.model)) return false;
        const ttModels = config?.textToText?.models?.[settings.provider] || [];
        const tiModels = config?.textToImage?.models?.[settings.provider] || [];
        return !ttModels.some((m) => m.name === settings.model) &&
            !tiModels.some((m) => m.name === settings.model);
    })();

    const handleSend = async (content, images = []) => {
        // --- TTS branch ---
        if (isTTSModel) {
            if (!content.trim()) {
                setMessages((prev) => [
                    ...prev,
                    {
                        role: "system",
                        content: "Error: Please enter text to convert to speech.",
                    },
                ]);
                return;
            }

            setIsGenerating(true);

            try {
                let currentId = activeId;
                let currentTitle = title;

                if (!currentId) {
                    currentTitle = content.slice(0, 40) || "Speech Generation";
                    setTitle(currentTitle);
                    currentId = crypto.randomUUID();
                    setActiveId(currentId);
                    updateUrl(currentId);
                }

                const userMsg = {
                    role: "user",
                    content,
                    timestamp: new Date().toISOString(),
                };
                setMessages((prev) => [...prev, userMsg]);

                const { systemPrompt } = settings;

                const defaultVoice =
                    config?.textToSpeech?.defaultVoices?.[settings.provider] || undefined;
                const requestStart = performance.now();

                const result = await PrismService.generateSpeech({
                    provider: settings.provider,
                    text: content,
                    voice: settings.voice || defaultVoice,
                    model: settings.model,
                    // Server-side conversation accumulation
                    conversationId: currentId,
                    conversationMeta: { title: currentTitle, systemPrompt },
                });

                const totalTime = (performance.now() - requestStart) / 1000;

                // Estimate cost from character count and model pricing
                const ttsModels =
                    config?.textToSpeech?.models?.[settings.provider] || [];
                const ttsModelDef = ttsModels.find((m) => m.name === settings.model);
                const charCount = content.length;
                let estimatedCost = null;
                if (ttsModelDef?.pricing?.perCharacter) {
                    estimatedCost = charCount * ttsModelDef.pricing.perCharacter;
                } else if (ttsModelDef?.pricing?.inputPerMillion) {
                    const estimatedTokens = Math.ceil(charCount / 4);
                    estimatedCost =
                        (estimatedTokens / 1_000_000) * ttsModelDef.pricing.inputPerMillion;
                }

                const usedVoice = settings.voice || defaultVoice || "";

                const assistantMsg = {
                    role: "assistant",
                    content: "",
                    audio: result.audioDataUrl,
                    timestamp: new Date().toISOString(),
                    provider: settings.provider,
                    model: settings.model,
                    voice: usedVoice,
                    totalTime,
                    usage: { characters: charCount },
                    estimatedCost,
                };

                setMessages((prev) => [...prev, assistantMsg]);
                loadConversations();
            } catch (error) {
                console.error(error);
                setMessages((prev) => [
                    ...prev,
                    { role: "system", content: "Error: " + error.message },
                ]);
            } finally {
                setIsGenerating(false);
            }
            return;
        }

        // --- Audio transcription branch ---
        if (isTranscriptionModel) {
            const audioFiles = images.filter((dataUrl) => {
                const match = dataUrl.match(/^data:([^;]+);/);
                return match && match[1].startsWith("audio/");
            });

            if (audioFiles.length === 0) {
                setMessages((prev) => [
                    ...prev,
                    {
                        role: "system",
                        content: "Error: Please attach an audio file to transcribe.",
                    },
                ]);
                return;
            }

            setIsGenerating(true);

            try {
                let currentId = activeId;
                let currentTitle = title;

                if (!currentId) {
                    currentTitle = "Audio Transcription";
                    setTitle(currentTitle);
                    currentId = crypto.randomUUID();
                    setActiveId(currentId);
                    updateUrl(currentId);
                }

                const { systemPrompt } = settings;
                const conversationMeta = { title: currentTitle, systemPrompt };

                for (const audioDataUrl of audioFiles) {
                    const userMsg = {
                        role: "user",
                        content: content || "Transcribe this audio",
                        timestamp: new Date().toISOString(),
                        images: [audioDataUrl],
                    };

                    setMessages((prev) => [...prev, userMsg]);

                    const result = await PrismService.transcribeAudio({
                        provider: settings.provider,
                        audio: audioDataUrl,
                        model: settings.model,
                        ...(content ? { prompt: content } : {}),
                        // Server-side conversation accumulation
                        conversationId: currentId,
                        conversationMeta,
                    });

                    const assistantMsg = {
                        role: "assistant",
                        content: result.text,
                        timestamp: new Date().toISOString(),
                        provider: settings.provider,
                        model: settings.model,
                        usage: result.usage || null,
                        totalTime: result.totalTime || null,
                        estimatedCost: result.estimatedCost || null,
                    };

                    setMessages((prev) => [...prev, assistantMsg]);
                }

                loadConversations();
            } catch (error) {
                console.error(error);
                setMessages((prev) => [
                    ...prev,
                    { role: "system", content: "Error: " + error.message },
                ]);
            } finally {
                setIsGenerating(false);
            }
            return;
        }

        // --- Normal text generation branch ---
        const userMsg = {
            role: "user",
            content,
            timestamp: new Date().toISOString(),
            ...(images.length > 0 ? { images } : {}),
        };
        const newMessages = [...messages, userMsg];
        setMessages(newMessages);
        setIsGenerating(true);
        setToolActivity([]);

        // ── Function Calling branch ──────────────────────────────
        if (settings.functionCallingEnabled) {
            try {
                let currentId = activeId;
                let currentTitle = title;

                if (!currentId) {
                    currentTitle =
                        content.substring(0, 30) + (content.length > 30 ? "..." : "");
                    setTitle(currentTitle);
                    currentId = crypto.randomUUID();
                    setActiveId(currentId);
                    updateUrl(currentId);
                }

                const systemPromptText = settings.systemPrompt || FC_SYSTEM_PROMPT;
                const currentMessages = [...newMessages];
                let iterations = 0;
                // For local providers: after the first tool round, omit tools to force text
                let hasCalledTools = false;

                while (iterations < MAX_TOOL_ITERATIONS) {
                    iterations++;
                    let streamedText = "";
                    const pendingToolCalls = [];

                    // Insert placeholder so the blinking cursor shows immediately
                    setMessages((prev) => {
                        const cleaned = prev.filter((m) => !(m.role === "assistant" && !m.content?.trim() && !m.toolCalls?.length));
                        return [...cleaned, { role: "assistant", content: "", provider: settings.provider, model: settings.model }];
                    });

                    await new Promise((resolve, reject) => {
                        const payload = {
                            provider: settings.provider,
                            model: settings.model,
                            messages: [
                                { role: "system", content: systemPromptText },
                                ...currentMessages
                                    .filter((m) => m.role !== "assistant" || m.content?.trim() || m.toolCalls?.length)
                                    .flatMap((m) => {
                                        // Expand assistant messages with toolCalls into
                                        // [assistant(tool_calls), tool(result1), tool(result2), ...]
                                        // per the OpenAI Chat Completions spec
                                        if (m.role === "assistant" && m.toolCalls?.length > 0) {
                                            const assistantMsg = {
                                                role: "assistant",
                                                content: m.content?.trim() || null,
                                                toolCalls: m.toolCalls.map((tc) => ({
                                                    id: tc.id,
                                                    name: tc.name,
                                                    args: tc.args,
                                                    ...(tc.thoughtSignature ? { thoughtSignature: tc.thoughtSignature } : {}),
                                                })),
                                            };
                                            const toolMsgs = m.toolCalls
                                                .filter((tc) => tc.result !== undefined)
                                                .map((tc) => ({
                                                    role: "tool",
                                                    name: tc.name,
                                                    tool_call_id: tc.id,
                                                    content: typeof tc.result === "string" ? tc.result : JSON.stringify(tc.result),
                                                }));
                                            return [assistantMsg, ...toolMsgs];
                                        }
                                        return [{
                                            role: m.role,
                                            ...(m.content?.trim() ? { content: m.content } : { content: " " }),
                                            ...(m.images?.length > 0 ? { images: m.images } : {}),
                                            ...(m.role === "tool" ? { name: m.name, tool_call_id: m.tool_call_id } : {}),
                                        }];
                                    }),
                            ],
                            // Local models (LM Studio, Ollama) should stop receiving tools
                            // after their first tool round to force a text response.
                            // Cloud providers handle multi-step tool calling natively.
                            ...((settings.provider === "lm-studio" || settings.provider === "ollama")
                                ? (!hasCalledTools ? { tools: allToolSchemas } : {})
                                : { tools: allToolSchemas }),
                            maxTokens: settings.maxTokens,
                            temperature: settings.temperature,
                            conversationId: currentId,
                        };

                        if (iterations === 1) {
                            payload.conversationMeta = {
                                title: currentTitle,
                                systemPrompt: systemPromptText,
                            };
                        }

                        abortRef.current = PrismService.streamText(payload, {
                            onChunk: (chunk) => {
                                streamedText += chunk;
                                setMessages((prev) => {
                                    const updated = [...prev];
                                    const lastMsg = updated[updated.length - 1];
                                    if (lastMsg?.role === "assistant" && !lastMsg.toolCalls?.length) {
                                        lastMsg.content = streamedText;
                                    } else {
                                        updated.push({ role: "assistant", content: streamedText });
                                    }
                                    return updated;
                                });
                            },
                            onToolCall: (toolCall) => {
                                pendingToolCalls.push(toolCall);
                                setToolActivity((prev) => [
                                    ...prev,
                                    {
                                        id: toolCall.id || `tc-${Date.now()}-${Math.random()}`,
                                        name: toolCall.name,
                                        args: toolCall.args,
                                        status: "calling",
                                        timestamp: Date.now(),
                                    },
                                ]);
                                setShowToolPanel(true);
                            },
                            onDone: () => resolve(),
                            onError: (err) => reject(err),
                            onThinking: () => {},
                        });
                    });

                    if (pendingToolCalls.length > 0) {
                        const results = await Promise.all(
                            pendingToolCalls.map(async (tc) => {
                                const customDef = customToolMap.get(tc.name);
                                if (customDef) {
                                    return {
                                        name: tc.name,
                                        id: tc.id,
                                        result: await SunService.executeCustomTool(customDef, tc.args),
                                    };
                                }
                                return {
                                    name: tc.name,
                                    id: tc.id,
                                    result: await SunService.executeTool(tc.name, tc.args),
                                };
                            }),
                        );

                        setToolActivity((prev) =>
                            prev.map((activity) => {
                                const result = results.find(
                                    (r) =>
                                        (r.id && r.id === activity.id) ||
                                        (!r.id && r.name === activity.name && activity.status === "calling"),
                                );
                                if (result) {
                                    return {
                                        ...activity,
                                        status: result.result?.error ? "error" : "done",
                                        result: result.result,
                                    };
                                }
                                return activity;
                            }),
                        );

                        // Persist tool result messages to the conversation
                        const toolResultMessages = results.map((result) => ({
                            role: "tool",
                            name: result.name,
                            tool_call_id: result.id,
                            content: JSON.stringify(result.result),
                            timestamp: new Date().toISOString(),
                        }));
                        PrismService.appendMessages(currentId, toolResultMessages).catch((err) =>
                            console.error("Failed to append tool results:", err),
                        );

                        const assistantMsg = {
                            role: "assistant",
                            content: streamedText || "",
                            toolCalls: pendingToolCalls.map((tc) => {
                                const match = results.find((r) => r.id === tc.id);
                                return {
                                    id: tc.id,
                                    name: tc.name,
                                    args: tc.args,
                                    thoughtSignature: tc.thoughtSignature || undefined,
                                    result: match ? match.result : null,
                                };
                            }),
                        };
                        currentMessages.push(assistantMsg);

                        for (const result of results) {
                            currentMessages.push({
                                role: "tool",
                                name: result.name,
                                tool_call_id: result.id,
                                content: JSON.stringify(truncateToolResult(result.result)),
                            });
                        }

                        hasCalledTools = true;

                        streamedText = "";
                        setMessages((prev) => {
                            const updated = [...prev];
                            const lastIdx = updated.findLastIndex((m) => m.role === "assistant");
                            if (lastIdx >= 0) {
                                updated[lastIdx] = assistantMsg;
                            } else {
                                updated.push(assistantMsg);
                            }
                            return updated;
                        });
                        continue;
                    }

                    // No tool calls — terminal state (text response or empty)
                    if (streamedText) {
                        currentMessages.push({ role: "assistant", content: streamedText });
                    } else if (iterations > 1) {
                        console.warn("[FC] Model returned empty response after tool results");
                    }
                    break;
                }

                setMessages(
                    currentMessages
                        .filter(
                            (m) =>
                                m.role !== "tool" &&
                                m.role !== "system" &&
                                !(m.role === "assistant" && !m.content?.trim() && !m.toolCalls?.length),
                        ),
                );
                loadConversations();
            } catch (error) {
                console.error(error);
                setMessages((prev) => [
                    ...prev,
                    { role: "system", content: "Error: " + error.message },
                ]);
            } finally {
                setIsGenerating(false);
                abortRef.current = null;
            }
            return;
        }

        try {
            let currentId = activeId;
            let currentTitle = title;

            if (!currentId) {
                currentTitle =
                    content.substring(0, 30) + (content.length > 30 ? "..." : "");
                setTitle(currentTitle);
                currentId = crypto.randomUUID();
                setActiveId(currentId);
                updateUrl(currentId);
            }

            const { systemPrompt } = settings;

            const systemMsg = settings.systemPrompt
                ? [{ role: "system", content: settings.systemPrompt }]
                : [];
            const payloadMessages = [...systemMsg, ...newMessages].map((m) => ({
                role: m.role,
                content: m.content,
                ...(m.images ? { images: m.images } : {}),
            }));
            const stopArray = settings.stopSequences
                ? settings.stopSequences
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean)
                : undefined;

            const currentModels =
                config?.textToText?.models?.[settings.provider] || [];
            const selectedModelDef = currentModels.find(
                (m) => m.name === settings.model,
            );

            const payload = {
                provider: settings.provider,
                model: settings.model,
                messages: payloadMessages,
                temperature: settings.temperature,
                maxTokens: settings.maxTokens,
                topP: settings.topP,
                topK: settings.topK,
                frequencyPenalty: settings.frequencyPenalty,
                presencePenalty: settings.presencePenalty,
                stopSequences: stopArray?.length ? stopArray : undefined,
                ...(selectedModelDef?.responsesAPI
                    ? {
                        reasoningEffort: settings.reasoningEffort || "high",
                        ...(settings.reasoningSummary
                            ? { reasoningSummary: settings.reasoningSummary }
                            : {}),
                    }
                    : {}),
                ...(!selectedModelDef?.responsesAPI && settings.thinkingEnabled
                    ? {
                        thinkingEnabled: true,
                        reasoningEffort: settings.reasoningEffort,
                        thinkingLevel: settings.thinkingLevel,
                        thinkingBudget: settings.thinkingBudget || undefined,
                    }
                    : {}),
                ...(settings.webSearchEnabled ? { webSearch: true } : {}),
                ...(settings.webSearchEnabled && selectedModelDef?.webFetch
                    ? { webFetch: true }
                    : {}),
                ...(settings.codeExecutionEnabled ? { codeExecution: true } : {}),
                ...(settings.urlContextEnabled ? { urlContext: true } : {}),
                ...(settings.verbosity ? { verbosity: settings.verbosity } : {}),
                // Server-side conversation accumulation
                conversationId: currentId,
                conversationMeta: { title: currentTitle, systemPrompt },
            };

            // Use WebSocket streaming for real-time text generation
            await new Promise((resolve, reject) => {
                let streamedText = "";
                let streamedThinking = "";
                let streamedImages = [];
                const codeBlocks = [];

                // Add placeholder AI message
                const placeholderMsg = {
                    role: "assistant",
                    content: "",
                    thinking: "",
                    timestamp: new Date().toISOString(),
                    provider: settings.provider,
                    model: settings.model,
                };
                const msgsWithPlaceholder = [...newMessages, placeholderMsg];
                setMessages(msgsWithPlaceholder);

                PrismService.streamText(payload, {
                    onStatus: (message) => {
                        setMessages((prev) => {
                            const updated = [...prev];
                            updated[updated.length - 1] = {
                                ...updated[updated.length - 1],
                                status: message,
                            };
                            return updated;
                        });
                    },
                    onChunk: (content) => {
                        streamedText += content;
                        setMessages((prev) => {
                            const updated = [...prev];
                            updated[updated.length - 1] = {
                                ...updated[updated.length - 1],
                                content: streamedText,
                                status: undefined,
                            };
                            return updated;
                        });
                    },
                    onThinking: (content) => {
                        streamedThinking += content;
                        setMessages((prev) => {
                            const updated = [...prev];
                            updated[updated.length - 1] = {
                                ...updated[updated.length - 1],
                                thinking: streamedThinking,
                            };
                            return updated;
                        });
                    },
                    onImage: (data, mimeType) => {
                        setIsGeneratingImage(true);
                        const dataUrl = `data:${mimeType};base64,${data}`;
                        streamedImages = [...streamedImages, dataUrl];
                        setMessages((prev) => {
                            const updated = [...prev];
                            updated[updated.length - 1] = {
                                ...updated[updated.length - 1],
                                images: streamedImages,
                            };
                            return updated;
                        });
                    },
                    onExecutableCode: (code, language) => {
                        const lang = language || "python";
                        streamedText += `\n\n\`\`\`exec-${lang}\n${code}\n\`\`\`\n\n`;
                        codeBlocks.push({ type: "code", code, language: lang });
                        setMessages((prev) => {
                            const updated = [...prev];
                            updated[updated.length - 1] = {
                                ...updated[updated.length - 1],
                                content: streamedText,
                            };
                            return updated;
                        });
                    },
                    onCodeExecutionResult: (output, outcome) => {
                        streamedText += `\n\n\`\`\`execresult-python\n${output}\n\`\`\`\n\n`;
                        codeBlocks.push({ type: "result", output, outcome });
                        setMessages((prev) => {
                            const updated = [...prev];
                            updated[updated.length - 1] = {
                                ...updated[updated.length - 1],
                                content: streamedText,
                            };
                            return updated;
                        });
                    },
                    onWebSearchResult: (results) => {
                        if (results && results.length > 0) {
                            const citations = results
                                .map((r) => `[${r.title}](${r.url})`)
                                .join(" · ");
                            streamedText += `\n\n> **Sources:** ${citations}\n\n`;
                            setMessages((prev) => {
                                const updated = [...prev];
                                updated[updated.length - 1] = {
                                    ...updated[updated.length - 1],
                                    content: streamedText,
                                };
                                return updated;
                            });
                        }
                    },
                    onDone: async (data) => {
                        const finalMsg = {
                            role: "assistant",
                            content: streamedText,
                            thinking: streamedThinking || undefined,
                            ...(streamedImages.length > 0 ? { images: streamedImages } : {}),
                            timestamp: placeholderMsg.timestamp,
                            provider: settings.provider,
                            model: settings.model,
                            usage: data.usage,
                            totalTime: data.totalTime,
                            tokensPerSec: data.tokensPerSec,
                            estimatedCost: data.estimatedCost,
                        };
                        const updatedMessages = [...newMessages, finalMsg];
                        setMessages(updatedMessages);

                        loadConversations();
                        resolve();
                    },
                    onError: (err) => {
                        reject(err);
                    },
                });
            });
        } catch (error) {
            console.error(error);
            setMessages((prev) => [
                ...prev,
                { role: "system", content: "Error: " + error.message },
            ]);
        } finally {
            setIsGenerating(false);
            setIsGeneratingImage(false);
        }
    };

    return (
        <main className={styles.appContainer}>
            <ThreePanelLayout
                leftTitle={null}
                leftPanel={
                    <>
                        <div className={consoleStyles.tabBar}>
                            <button
                                className={`${consoleStyles.tab} ${leftTab === "settings" ? consoleStyles.tabActive : ""}`}
                                onClick={() => setLeftTab("settings")}
                            >
                                Settings
                            </button>
                            <button
                                className={`${consoleStyles.tab} ${leftTab === "tools" ? consoleStyles.tabActive : ""}${!selectedModelSupportsFc ? ` ${consoleStyles.tabDisabled}` : ""}`}
                                onClick={() => setLeftTab("tools")}
                            >
                                Tools
                                {settings.functionCallingEnabled && (
                                    <span className={consoleStyles.tabBadge}>{allToolSchemas.length}</span>
                                )}
                            </button>
                            <button
                                className={`${consoleStyles.tab} ${leftTab === "params" ? consoleStyles.tabActive : ""}`}
                                onClick={() => setLeftTab("params")}
                            >
                                Params
                            </button>
                        </div>
                        {leftTab === "settings" && (
                            <SettingsPanel
                                config={config}
                                settings={settings}
                                onChange={(updates) => setSettings((s) => ({ ...s, ...updates }))}
                                hasAssistantImages={messages.some(
                                    (m) => m.role === "assistant" && m.images?.length > 0,
                                )}
                                inferenceMode={inferenceMode}
                                onSystemPromptClick={() => setShowSystemPromptModal(true)}
                                showSystemPromptModal={showSystemPromptModal}
                                onCloseSystemPromptModal={() => setShowSystemPromptModal(false)}
                                workflows={workflows}
                            />
                        )}
                        {leftTab === "tools" && selectedModelSupportsFc && (
                            <CustomToolsPanel
                                tools={customTools}
                                onToolsChange={loadCustomTools}
                                builtInTools={SunService.getToolSchemas()}
                                disabledBuiltIns={disabledBuiltIns}
                                onToggleBuiltIn={handleToggleBuiltIn}
                                offlineTools={offlineTools}
                            />
                        )}
                        {leftTab === "params" && (
                            <ParametersPanelComponent
                                settings={settings}
                                onChange={(updates) => setSettings((s) => ({ ...s, ...updates }))}
                                config={config}
                            />
                        )}
                    </>
                }
                rightPanel={
                    <HistoryPanel
                        conversations={conversations}
                        activeId={activeId}
                        onSelect={handleSelectConversation}
                        onNew={handleNewChatClick}
                        onDelete={handleDeleteConversation}
                        favorites={convFavoriteKeys}
                        onToggleFavorite={async (convId) => {
                            if (convFavoriteKeys.includes(convId)) {
                                setConvFavoriteKeys((prev) => prev.filter((k) => k !== convId));
                                PrismService.removeFavorite("conversation", convId).catch(() => {});
                            } else {
                                setConvFavoriteKeys((prev) => [...prev, convId]);
                                const conv = conversations.find((c) => c.id === convId);
                                PrismService.addFavorite("conversation", convId, {
                                    title: conv?.title || "Untitled",
                                }).catch(() => {});
                            }
                        }}
                    />
                }
                headerTitle={title}
                navSidebar={<NavigationSidebarComponent mode="user" isGenerating={isGenerating} isGeneratingImage={isGeneratingImage} />}
                headerMeta={
                    messages.length > 0 ? (
                        <div className={styles.headerMeta}>
                            {(() => {
                                const deletedCount = originalMessageCount - messages.length;
                                return (
                                    <span className={deletedCount > 0 ? styles.metaTooltipWrapper : undefined}>
                                        {messages.length} messages
                                        {deletedCount > 0 && (
                                            <span className={styles.metaTooltip}>
                                                {deletedCount} deleted
                                            </span>
                                        )}
                                    </span>
                                );
                            })()}
                            {uniqueModels.length === 1 && <span>{uniqueModels[0]}</span>}
                            {uniqueModels.length > 1 && (
                                <span className={styles.modelDropdownWrapper}>
                                    <button
                                        className={styles.modelDropdownTrigger}
                                        onClick={() => setShowModelList((v) => !v)}
                                    >
                                        {uniqueModels.length} models
                                    </button>
                                    {showModelList && (
                                        <>
                                            <div
                                                className={styles.modelDropdownBackdrop}
                                                onClick={() => setShowModelList(false)}
                                            />
                                            <div className={styles.modelDropdown}>
                                                {uniqueModels.map((m) => (
                                                    <div key={m} className={styles.modelDropdownItem}>
                                                        {m}
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </span>
                            )}
                            {totalCost > 0 && (() => {
                                const costDiff = originalTotalCost - totalCost;
                                return (
                                    <span className={costDiff > 0.000001 ? styles.metaTooltipWrapper : undefined}>
                                        ${totalCost.toFixed(5)}
                                        {costDiff > 0.000001 && (
                                            <span className={styles.metaTooltip}>
                                                ${originalTotalCost.toFixed(5)} total
                                            </span>
                                        )}
                                    </span>
                                );
                            })()}
                        </div>
                    ) : null
                }
                headerControls={
                    <div className={styles.headerControls}>
                        {messages.length > 0 && (
                            <button
                                className={styles.modeToggle}
                                title="Send this conversation to a workflow"
                                onClick={() => {
                                    const convMessages = [];
                                    if (settings.systemPrompt) {
                                        convMessages.push({ role: "system", content: settings.systemPrompt });
                                    }
                                    messages.forEach((m) => {
                                        convMessages.push({
                                            role: m.role,
                                            content: m.content || "",
                                            ...(m.images?.length > 0 ? { images: m.images } : {}),
                                            ...(m.audio ? { audio: m.audio } : {}),
                                        });
                                    });
                                    sessionStorage.setItem(
                                        "workflow_import_conversation",
                                        JSON.stringify({
                                            messages: convMessages,
                                            provider: settings.provider,
                                            model: settings.model,
                                            title: title,
                                        }),
                                    );
                                    router.push("/workflows?import=conversation");
                                }}
                            >
                                <Send size={13} />
                                To Workflow
                            </button>
                        )}
                    </div>
                }
            >
                <ChatArea
                    messages={messages}
                    isGenerating={isGenerating}
                    newChatKey={newChatKey}
                    onSend={handleSend}
                    onDelete={handleDeleteMessage}

                    onRerun={handleRerunTurn}
                    config={config}
                    isTranscriptionModel={isTranscriptionModel}
                    isTTSModel={isTTSModel}
                    conversations={conversations}
                    favorites={favoriteKeys}
                    onToggleFavorite={async (key) => {
                        if (favoriteKeys.includes(key)) {
                            setFavoriteKeys((prev) => prev.filter((k) => k !== key));
                            PrismService.removeFavorite("model", key).catch(() => {});
                        } else {
                            setFavoriteKeys((prev) => [...prev, key]);
                            const [provider, ...rest] = key.split(":");
                            PrismService.addFavorite("model", key, { provider, name: rest.join(":") }).catch(() => {});
                        }
                    }}
                    onSelectModel={(provider, modelName) => {
                        const modelDef =
                            (config?.textToText?.models?.[provider] || []).find(
                                (m) => m.name === modelName,
                            ) ||
                            (config?.textToImage?.models?.[provider] || []).find(
                                (m) => m.name === modelName,
                            );
                        const temp = modelDef?.defaultTemperature ?? 1.0;
                        handleNewChat();
                        setSettings((s) => ({
                            ...s,
                            provider,
                            model: modelName,
                            temperature: temp,
                        }));
                    }}
                    supportedInputTypes={
                        isTranscriptionModel
                            ? ["audio"]
                            : isTTSModel
                                ? ["text"]
                                : (() => {
                                    const sections = ["textToText", "textToImage", "textToSpeech", "audioToText"];
                                    for (const section of sections) {
                                        const found = (config?.[section]?.models?.[settings.provider] || []).find(
                                            (m) => m.name === settings.model,
                                        );
                                        if (found?.inputTypes) return found.inputTypes;
                                    }
                                    return [];
                                })()
                    }
                    systemPrompt={settings.systemPrompt}
                    onSystemPromptClick={() => setShowSystemPromptModal(true)}
                    functionCallingEnabled={!!settings.functionCallingEnabled}
                    toolActivitySlot={
                        settings.functionCallingEnabled && toolActivity.length > 0 ? (
                            <div className={consoleStyles.toolPanel}>
                                <button
                                    className={consoleStyles.toolPanelHeader}
                                    onClick={() => setShowToolPanel(!showToolPanel)}
                                >
                                    <Zap size={14} className={consoleStyles.toolPanelIcon} />
                                    <span>
                                        Tool Activity ({toolActivity.filter((t) => t.status === "done").length}/
                                        {toolActivity.length})
                                    </span>
                                    {showToolPanel ? (
                                        <ChevronDown size={14} />
                                    ) : (
                                        <ChevronRight size={14} />
                                    )}
                                </button>
                                {showToolPanel && (
                                    <div className={consoleStyles.toolPanelBody}>
                                        {toolActivity.map((activity) => (
                                            <div key={activity.id} className={consoleStyles.toolActivityItem}>
                                                <span className={consoleStyles.toolStatusIcon}>
                                                    {activity.status === "calling" && (
                                                        <Loader2 size={12} className={consoleStyles.spinner} />
                                                    )}
                                                    {activity.status === "done" && (
                                                        <CheckCircle2 size={12} className={consoleStyles.toolSuccess} />
                                                    )}
                                                    {activity.status === "error" && (
                                                        <AlertCircle size={12} className={consoleStyles.toolError} />
                                                    )}
                                                </span>
                                                <span className={consoleStyles.toolName}>
                                                    {renderToolName(activity.name)}
                                                </span>
                                                {Object.keys(activity.args || {}).length > 0 && (
                                                    <span className={consoleStyles.toolArgs}>
                                                        ({Object.entries(activity.args)
                                                            .map(([k, v]) => `${k}: ${v}`)
                                                            .join(", ")})
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : null
                    }
                />
            </ThreePanelLayout>
        </main>
    );
}

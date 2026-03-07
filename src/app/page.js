"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./page.module.css";
import { PrismService } from "../services/PrismService";
import StorageService from "../services/StorageService";
import { useTheme } from "../components/ThemeProvider";
import { Sun, Moon } from "lucide-react";
import SettingsPanel from "../components/SettingsPanel";
import ChatArea from "../components/ChatArea";
import HistoryPanel from "../components/HistoryPanel";

export default function Home() {
    const { theme, toggleTheme } = useTheme();
    const [config, setConfig] = useState(null);
    const [conversations, setConversations] = useState([]);

    const [activeId, setActiveId] = useState(null);
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
    const skipSystemPromptSave = useRef(false);

    // Auto-save system prompt on edit (debounced)
    useEffect(() => {
        if (!activeId) return;
        if (skipSystemPromptSave.current) {
            skipSystemPromptSave.current = false;
            return;
        }
        const timer = setTimeout(() => {
            const { systemPrompt, ...modelSettings } = settings;
            PrismService.saveConversation(activeId, title, messages, systemPrompt, modelSettings)
                .catch((err) => console.error("Failed to save system prompt:", err));
        }, 500);
        return () => clearTimeout(timer);
    }, [settings.systemPrompt]);

    useEffect(() => {
        // Load config
        PrismService.getConfig()
            .then((cfg) => {
                setConfig(cfg);

                // Try to restore last-used provider/model from localStorage
                const savedProvider = StorageService.get("lastProvider");
                const savedModel = StorageService.get("lastModel");
                const savedValid = savedProvider
                    && cfg.providerList?.includes(savedProvider)
                    && (
                        (cfg.textToText?.models?.[savedProvider] || []).some((m) => m.name === savedModel)
                        || (cfg.textToImage?.models?.[savedProvider] || []).some((m) => m.name === savedModel)
                    );

                const prov = savedValid ? savedProvider : (cfg.providerList?.[0] || "");
                const mod = savedValid
                    ? savedModel
                    : (cfg.textToText?.defaults?.[prov] || cfg.textToText?.models?.[prov]?.[0]?.name || "");

                const modelDef = (cfg.textToText?.models?.[prov] || []).find((m) => m.name === mod)
                    || (cfg.textToImage?.models?.[prov] || []).find((m) => m.name === mod);
                const temp = modelDef?.defaultTemperature ?? 1.0;
                setSettings((s) => ({ ...s, provider: prov, model: mod, temperature: temp }));
            })
            .catch(console.error);

        // Load history
        loadConversations();
    }, []);

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
        setTitle("New Conversation");
        setMessages([]);
        skipSystemPromptSave.current = true;
        setSettings((s) => ({ ...s, systemPrompt: "You are a helpful AI assistant." }));
    };

    // Persist provider/model to localStorage
    useEffect(() => {
        if (settings.provider) StorageService.set("lastProvider", settings.provider);
        if (settings.model) StorageService.set("lastModel", settings.model);
    }, [settings.provider, settings.model]);

    const handleSelectConversation = async (conv) => {
        if (conv.id === activeId) return;
        try {
            const full = await PrismService.getConversation(conv.id);
            setActiveId(full.id);
            setTitle(full.title);
            setMessages(full.messages || []);
            skipSystemPromptSave.current = true;

            // Restore settings — use saved settings, or fall back to
            // provider/model from the last assistant message (for older conversations).
            let restoredSettings = full.settings || {};
            if (!restoredSettings.provider && full.messages?.length) {
                const lastAssistant = [...(full.messages || [])].reverse().find((m) => m.role === "assistant");
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
                const { systemPrompt, ...modelSettings } = settings;
                await PrismService.saveConversation(activeId, title, updatedMessages, systemPrompt, modelSettings);
            } catch (err) {
                console.error("Failed to save after deletion:", err);
            }
        }
    };

    const handleEditMessage = async (index, newContent) => {
        if (isGenerating) return;
        const updatedMessages = [...messages];
        updatedMessages[index] = { ...updatedMessages[index], content: newContent };
        setMessages(updatedMessages);

        if (activeId) {
            try {
                const { systemPrompt, ...modelSettings } = settings;
                await PrismService.saveConversation(activeId, title, updatedMessages, systemPrompt, modelSettings);
            } catch (err) {
                console.error("Failed to save after edit:", err);
            }
        }
    };

    const handleRerunTurn = async (userMsgIndex) => {
        if (isGenerating) return;

        const userMsg = messages[userMsgIndex];
        if (!userMsg || userMsg.role !== "user") return;

        // Collect all messages up to and including this user message
        const historyUpToUser = messages.slice(0, userMsgIndex + 1);

        // Check if the next message is an assistant response — remove it if so
        const nextMsg = messages[userMsgIndex + 1];
        const hadAssistantAfter = nextMsg && nextMsg.role === "assistant";

        // Build newMessages: everything up to user msg, then everything after the assistant (if any)
        let newMessages;
        if (hadAssistantAfter) {
            newMessages = [
                ...historyUpToUser,
                ...messages.slice(userMsgIndex + 2),
            ];
        } else {
            newMessages = [...historyUpToUser, ...messages.slice(userMsgIndex + 1)];
        }

        // We want to re-generate right after the user message, so the new AI message
        // goes at position userMsgIndex + 1. For the API call, send history up to user msg.
        setMessages(newMessages);
        setIsGenerating(true);

        try {
            let currentId = activeId;
            let currentTitle = title;

            const systemMsg = settings.systemPrompt
                ? [{ role: "system", content: settings.systemPrompt }]
                : [];
            const payloadMessages = [...systemMsg, ...historyUpToUser].map((m) => ({
                role: m.role,
                content: m.content,
                ...(m.images ? { images: m.images } : {}),
            }));
            const stopArray = settings.stopSequences
                ? settings.stopSequences.split(",").map((s) => s.trim()).filter(Boolean)
                : undefined;

            const currentModels = config?.textToText?.models?.[settings.provider] || [];
            const selectedModelDef = currentModels.find((m) => m.name === settings.model);

            const payload = {
                provider: settings.provider,
                model: settings.model,
                messages: payloadMessages,
                options: {
                    temperature: settings.temperature,
                    maxTokens: settings.maxTokens,
                    topP: settings.topP,
                    topK: settings.topK,
                    frequencyPenalty: settings.frequencyPenalty,
                    presencePenalty: settings.presencePenalty,
                    stopSequences: stopArray?.length ? stopArray : undefined,
                    ...(selectedModelDef?.responsesAPI ? {
                        reasoningEffort: settings.reasoningEffort || "high",
                        ...(settings.reasoningSummary ? { reasoningSummary: settings.reasoningSummary } : {}),
                    } : {}),
                    ...(!selectedModelDef?.responsesAPI && settings.thinkingEnabled ? {
                        reasoningEffort: settings.reasoningEffort,
                        thinkingLevel: settings.thinkingLevel,
                        thinkingBudget: settings.thinkingBudget || undefined,
                    } : {}),
                    ...(settings.webSearchEnabled ? { webSearch: true } : {}),
                    ...(settings.webSearchEnabled && selectedModelDef?.webFetch ? { webFetch: true } : {}),
                    ...(settings.codeExecutionEnabled ? { codeExecution: true } : {}),
                    ...(settings.urlContextEnabled ? { urlContext: true } : {}),
                    ...(settings.verbosity ? { verbosity: settings.verbosity } : {}),
                },
            };

            await new Promise((resolve, reject) => {
                let streamedText = "";
                let streamedThinking = "";
                let streamedImages = [];
                let codeBlocks = [];
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
                    onChunk: (content) => {
                        streamedText += content;
                        setMessages((prev) => {
                            const updated = [...prev];
                            updated[insertIndex] = {
                                ...updated[insertIndex],
                                content: streamedText,
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

                        // Save — use a callback to get the latest messages
                        setMessages((prev) => {
                            const finalMessages = [...prev];
                            (async () => {
                                try {
                                    const { systemPrompt, ...modelSettings } = settings;
                                    const saved = await PrismService.saveConversation(
                                        currentId,
                                        currentTitle,
                                        finalMessages,
                                        systemPrompt,
                                        modelSettings,
                                    );
                                    setActiveId(saved.id);
                                    loadConversations();
                                } catch (saveErr) {
                                    console.error("Save failed:", saveErr);
                                }
                            })();
                            return prev;
                        });

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
        }
    };

    const handleSend = async (content, images = []) => {
        const userMsg = { role: "user", content, timestamp: new Date().toISOString(), ...(images.length > 0 ? { images } : {}) };
        const newMessages = [...messages, userMsg];
        setMessages(newMessages);
        setIsGenerating(true);

        try {
            let currentId = activeId;
            let currentTitle = title;

            if (!currentId) {
                currentTitle =
                    content.substring(0, 30) + (content.length > 30 ? "..." : "");
                setTitle(currentTitle);
            }

            const systemMsg = settings.systemPrompt
                ? [{ role: "system", content: settings.systemPrompt }]
                : [];
            const payloadMessages = [...systemMsg, ...newMessages].map((m) => ({
                role: m.role,
                content: m.content,
                ...(m.images ? { images: m.images } : {}),
            }));
            const stopArray = settings.stopSequences
                ? settings.stopSequences.split(",").map((s) => s.trim()).filter(Boolean)
                : undefined;

            const currentModels = config?.textToText?.models?.[settings.provider] || [];
            const selectedModelDef = currentModels.find((m) => m.name === settings.model);

            const payload = {
                provider: settings.provider,
                model: settings.model,
                messages: payloadMessages,
                options: {
                    temperature: settings.temperature,
                    maxTokens: settings.maxTokens,
                    topP: settings.topP,
                    topK: settings.topK,
                    frequencyPenalty: settings.frequencyPenalty,
                    presencePenalty: settings.presencePenalty,
                    stopSequences: stopArray?.length ? stopArray : undefined,
                    ...(selectedModelDef?.responsesAPI ? {
                        reasoningEffort: settings.reasoningEffort || "high",
                        ...(settings.reasoningSummary ? { reasoningSummary: settings.reasoningSummary } : {}),
                    } : {}),
                    ...(!selectedModelDef?.responsesAPI && settings.thinkingEnabled ? {
                        reasoningEffort: settings.reasoningEffort,
                        thinkingLevel: settings.thinkingLevel,
                        thinkingBudget: settings.thinkingBudget || undefined,
                    } : {}),
                    ...(settings.webSearchEnabled ? { webSearch: true } : {}),
                    ...(settings.webSearchEnabled && selectedModelDef?.webFetch ? { webFetch: true } : {}),
                    ...(settings.codeExecutionEnabled ? { codeExecution: true } : {}),
                    ...(settings.urlContextEnabled ? { urlContext: true } : {}),
                    ...(settings.verbosity ? { verbosity: settings.verbosity } : {}),
                },
            };

            // Use WebSocket streaming for real-time text generation
            await new Promise((resolve, reject) => {
                let streamedText = "";
                let streamedThinking = "";
                let streamedImages = [];
                let codeBlocks = [];

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
                    onChunk: (content) => {
                        streamedText += content;
                        setMessages((prev) => {
                            const updated = [...prev];
                            updated[updated.length - 1] = {
                                ...updated[updated.length - 1],
                                content: streamedText,
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

                        try {
                            const { systemPrompt, ...modelSettings } = settings;
                            const saved = await PrismService.saveConversation(
                                currentId,
                                currentTitle,
                                updatedMessages,
                                systemPrompt,
                                modelSettings,
                            );
                            setActiveId(saved.id);
                            loadConversations();
                        } catch (saveErr) {
                            console.error("Save failed:", saveErr);
                        }
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
        }
    };

    return (
        <main className={styles.appContainer}>
            <aside className={styles.leftSidebar}>
                <div className={styles.glassHeader}>Settings</div>
                <SettingsPanel
                    config={config}
                    settings={settings}
                    onChange={(updates) => setSettings((s) => ({ ...s, ...updates }))}
                    hasAssistantImages={messages.some((m) => m.role === "assistant" && m.images?.length > 0)}
                />
            </aside>

            <section className={styles.mainChat}>
                <div className={styles.glassHeader}>
                    <span className={styles.headerTitle}>{title}</span>
                    <button
                        className={styles.themeToggle}
                        onClick={toggleTheme}
                        title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                    >
                        {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
                    </button>
                </div>
                <ChatArea
                    messages={messages}
                    isGenerating={isGenerating}
                    onSend={handleSend}
                    onDelete={handleDeleteMessage}
                    onEdit={handleEditMessage}
                    onRerun={handleRerunTurn}
                    config={config}
                    onSelectModel={(provider, modelName) => {
                        const modelDef = (config?.textToText?.models?.[provider] || []).find((m) => m.name === modelName)
                            || (config?.textToImage?.models?.[provider] || []).find((m) => m.name === modelName);
                        const temp = modelDef?.defaultTemperature ?? 1.0;
                        handleNewChat();
                        setSettings((s) => ({ ...s, provider, model: modelName, temperature: temp }));
                    }}
                    supportedInputTypes={
                        (config?.textToText?.models?.[settings.provider] || [])
                            .find((m) => m.name === settings.model)?.inputTypes || []
                    }
                />
            </section>

            <aside className={styles.rightSidebar}>
                <div className={styles.glassHeader}>History</div>
                <HistoryPanel
                    conversations={conversations}
                    activeId={activeId}
                    onSelect={handleSelectConversation}
                    onNew={handleNewChat}
                    onDelete={handleDeleteConversation}
                />
            </aside>
        </main>
    );
}

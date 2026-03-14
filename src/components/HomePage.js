"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "../app/page.module.css";
import { PrismService } from "../services/PrismService";
import StorageService from "../services/StorageService";
import { useTheme } from "../components/ThemeProvider";
import { Sun, Moon, Workflow, Send } from "lucide-react";
import SettingsPanel from "../components/SettingsPanel";
import ChatArea from "../components/ChatArea";
import HistoryPanel from "../components/HistoryPanel";
import ThreePanelLayout from "../components/ThreePanelLayout";

export default function HomePage({ initialConversationId = null }) {
    const { theme, toggleTheme } = useTheme();
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
    const [newChatKey, setNewChatKey] = useState(0);
    const [showModelList, setShowModelList] = useState(false);
    const [showSystemPromptModal, setShowSystemPromptModal] = useState(false);
    const skipSystemPromptSave = useRef(false);

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
            PrismService.saveConversation({
                id: activeId,
                title,
                messages,
                systemPrompt,
                settings: modelSettings,
            }).catch((err) => console.error("Failed to save system prompt:", err));
        }, 500);
        return () => clearTimeout(timer);
    }, [settings.systemPrompt]);

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
    }, []);

    // Load conversation from URL path on mount
    const urlLoadedRef = useRef(false);
    useEffect(() => {
        if (initialConversationId && !urlLoadedRef.current) {
            urlLoadedRef.current = true;
            PrismService.getConversation(initialConversationId)
                .then((full) => {
                    setActiveId(full.id);
                    setTitle(full.title);
                    setMessages(full.messages || []);
                    skipSystemPromptSave.current = true;

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
            setMessages(full.messages || []);
            skipSystemPromptSave.current = true;

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
                await PrismService.saveConversation({
                    id: activeId,
                    title,
                    messages: updatedMessages,
                    systemPrompt,
                    settings: modelSettings,
                });
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
                await PrismService.saveConversation({
                    id: activeId,
                    title,
                    messages: updatedMessages,
                    systemPrompt,
                    settings: modelSettings,
                });
            } catch (err) {
                console.error("Failed to save after edit:", err);
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
                    const saved = await PrismService.saveConversation({
                        id: currentId,
                        title: currentTitle,
                        messages: finalMessages,
                        systemPrompt,
                        settings: modelSettings,
                    });
                    setActiveId(saved.id);
                    updateUrl(saved.id);
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

        try {
            const currentId = activeId;
            const currentTitle = title;

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
                options: {
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
                },
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

                        // Save after updating messages — NOT inside setMessages to avoid double-fires
                        try {
                            const allMessages = [...newMessages];
                            allMessages[insertIndex] = finalMsg;
                            const { systemPrompt, ...modelSettings } = settings;
                            const saved = await PrismService.saveConversation({
                                id: currentId,
                                title: currentTitle,
                                messages: allMessages,
                                systemPrompt,
                                settings: modelSettings,
                            });
                            setActiveId(saved.id);
                            updateUrl(saved.id);
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
                }

                const userMsg = {
                    role: "user",
                    content,
                    timestamp: new Date().toISOString(),
                };
                setMessages((prev) => [...prev, userMsg]);

                // Start conversation shell (or reuse existing)
                const { systemPrompt, ...modelSettings } = settings;
                try {
                    const conversation = await PrismService.startConversation({
                        title: currentTitle,
                        systemPrompt,
                        settings: modelSettings,
                    });
                    currentId = conversation.id;
                    setActiveId(conversation.id);
                    updateUrl(conversation.id);
                    loadConversations();
                } catch (startErr) {
                    console.error("Start conversation failed:", startErr);
                }

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
                    userMessage: userMsg,
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

                // Finalize conversation metadata only (messages already saved server-side)
                try {
                    await PrismService.finalizeConversation({
                        id: currentId,
                        title: currentTitle,
                        systemPrompt,
                        settings: modelSettings,
                    });
                    loadConversations();
                } catch (saveErr) {
                    console.error("Finalize failed:", saveErr);
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
                }

                // Start conversation shell (or reuse existing)
                const { systemPrompt, ...modelSettings } = settings;
                try {
                    const conversation = await PrismService.startConversation({
                        title: currentTitle,
                        systemPrompt,
                        settings: modelSettings,
                    });
                    currentId = conversation.id;
                    setActiveId(conversation.id);
                    updateUrl(conversation.id);
                    loadConversations();
                } catch (startErr) {
                    console.error("Start conversation failed:", startErr);
                }

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
                        userMessage: userMsg,
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

                // Finalize conversation metadata only
                try {
                    await PrismService.finalizeConversation({
                        id: currentId,
                        title: currentTitle,
                        systemPrompt,
                        settings: modelSettings,
                    });
                    loadConversations();
                } catch (saveErr) {
                    console.error("Finalize failed:", saveErr);
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

        try {
            let currentId = activeId;
            let currentTitle = title;

            if (!currentId) {
                currentTitle =
                    content.substring(0, 30) + (content.length > 30 ? "..." : "");
                setTitle(currentTitle);
            }

            // Start conversation shell for new chats (existing ones already have an ID)
            const { systemPrompt, ...modelSettings } = settings;
            if (!currentId) {
                try {
                    const conversation = await PrismService.startConversation({
                        title: currentTitle,
                        systemPrompt,
                        settings: modelSettings,
                    });
                    currentId = conversation.id;
                    setActiveId(conversation.id);
                    updateUrl(conversation.id);
                    loadConversations();
                } catch (startErr) {
                    console.error("Start conversation failed:", startErr);
                }
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
                options: {
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
                },
                // Server-side conversation accumulation
                conversationId: currentId,
                userMessage: userMsg,
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

                        // Finalize conversation — update metadata only (messages already saved server-side)
                        try {
                            await PrismService.finalizeConversation({
                                id: currentId,
                                title: currentTitle,
                                systemPrompt,
                                settings: modelSettings,
                            });
                            loadConversations();
                        } catch (saveErr) {
                            console.error("Finalize failed:", saveErr);
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
            <ThreePanelLayout
                leftPanel={
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
                    />
                }
                rightPanel={
                    <HistoryPanel
                        conversations={conversations}
                        activeId={activeId}
                        onSelect={handleSelectConversation}
                        onNew={handleNewChatClick}
                        onDelete={handleDeleteConversation}
                    />
                }
                headerTitle={title}
                headerMeta={
                    messages.length > 0 ? (
                        <div className={styles.headerMeta}>
                            <span>{messages.length} messages</span>
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
                            {totalCost > 0 && <span>${totalCost.toFixed(5)}</span>}
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
                        <Link
                            href="/workflows"
                            className={styles.modeToggle}
                            title="Workflows"
                        >
                            <Workflow size={14} />
                            Workflows
                        </Link>
                        <button
                            className={styles.themeToggle}
                            onClick={toggleTheme}
                            title={
                                theme === "dark"
                                    ? "Switch to light mode"
                                    : "Switch to dark mode"
                            }
                        >
                            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
                        </button>
                    </div>
                }
            >
                <ChatArea
                    messages={messages}
                    isGenerating={isGenerating}
                    newChatKey={newChatKey}
                    onSend={handleSend}
                    onDelete={handleDeleteMessage}
                    onEdit={handleEditMessage}
                    onRerun={handleRerunTurn}
                    config={config}
                    isTranscriptionModel={isTranscriptionModel}
                    isTTSModel={isTTSModel}
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
                />
            </ThreePanelLayout>
        </main>
    );
}

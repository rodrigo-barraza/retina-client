"use client";

import { useEffect, useState } from "react";
import styles from "./page.module.css";
import { PrismService } from "../services/PrismService";
import SettingsPanel from "../components/SettingsPanel";
import ChatArea from "../components/ChatArea";
import HistoryPanel from "../components/HistoryPanel";

export default function Home() {
  const [config, setConfig] = useState(null);
  const [conversations, setConversations] = useState([]);

  const [activeId, setActiveId] = useState(null);
  const [title, setTitle] = useState("New Conversation");
  const [messages, setMessages] = useState([]);

  const [settings, setSettings] = useState({
    provider: "",
    model: "",
    systemPrompt: "You are a helpful AI assistant.",
    temperature: 0.7,
    maxTokens: 2048,
  });

  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    // Load config
    PrismService.getConfig()
      .then((cfg) => {
        setConfig(cfg);
        const prov = cfg.providerList?.[0] || "";
        const mod =
          cfg.textToText?.defaults?.[prov] ||
          cfg.textToText?.models?.[prov]?.[0]?.name ||
          "";
        setSettings((s) => ({ ...s, provider: prov, model: mod }));
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
  };

  const handleSelectConversation = async (conv) => {
    if (conv.id === activeId) return;
    try {
      const full = await PrismService.getConversation(conv.id);
      setActiveId(full.id);
      setTitle(full.title);
      setMessages(full.messages || []);
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
        await PrismService.saveConversation(activeId, title, updatedMessages);
      } catch (err) {
        console.error("Failed to save after deletion:", err);
      }
    }
  };

  const handleSend = async (content) => {
    const userMsg = { role: "user", content };
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

      const payloadMessages = [...systemMsg, ...newMessages].map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const payload = {
        provider: settings.provider,
        model: settings.model,
        messages: payloadMessages,
        options: {
          temperature: settings.temperature,
          maxTokens: settings.maxTokens,
        },
      };

      const generation = await PrismService.generateText(payload);

      const aiMsg = {
        role: "assistant",
        content: generation.text,
        provider: generation.provider,
        model: generation.model,
        usage: generation.usage,
        estimatedCost: generation.estimatedCost,
      };

      const updatedMessages = [...newMessages, aiMsg];
      setMessages(updatedMessages);

      const saved = await PrismService.saveConversation(
        currentId,
        currentTitle,
        updatedMessages,
      );
      setActiveId(saved.id);
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
  };

  return (
    <main className={styles.appContainer}>
      <aside className={styles.leftSidebar}>
        <div className={styles.glassHeader}>Settings</div>
        <SettingsPanel
          config={config}
          settings={settings}
          onChange={(updates) => setSettings((s) => ({ ...s, ...updates }))}
        />
      </aside>

      <section className={styles.mainChat}>
        <div className={styles.glassHeader}>{title}</div>
        <ChatArea
          messages={messages}
          isGenerating={isGenerating}
          onSend={handleSend}
          onDelete={handleDeleteMessage}
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

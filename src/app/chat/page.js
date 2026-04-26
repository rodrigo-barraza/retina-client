"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import AgentComponent from "../../components/AgentComponent";
import PrismService from "../../services/PrismService";
import styles from "./page.module.css";

const LS_ACTIVE_AGENT = "retina:activeAgent";

/** Synthetic "No Agent" entry — direct model chat with all tools. */
const NONE_AGENT = {
  id: "NONE",
  name: "No Agent",
  description: "Direct model conversation with all tools available.",
  project: "direct",
  toolCount: -1, // sentinel — rendered as "All tools" in picker
  custom: false,
  icon: "",
  color: "",
};

export default function AgentsPage() {
  return (
    <Suspense>
      <AgentsPageInner />
    </Suspense>
  );
}

function AgentsPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [agents, setAgents] = useState([]);
  // Always initialize to "CODING" for SSR/client parity — hydrate from
  // localStorage after mount to avoid hydration mismatch.
  const [localAgentId, setLocalAgentId] = useState("CODING");

  useEffect(() => {
    const stored = localStorage.getItem(LS_ACTIVE_AGENT);
    if (stored && stored !== "CODING") {
      setLocalAgentId(stored);
    }
  }, []);

  // Derive active agent: URL param takes priority over localStorage
  const activeAgentId = useMemo(() => {
    const fromUrl = searchParams.get("agent");
    return fromUrl || localAgentId;
  }, [searchParams, localAgentId]);

  const forceFc = searchParams.get("fc") === "true";
  const forceThinking = searchParams.get("thinking") === "true";

  // Fetch agent personas on mount — prepend "No Agent" synthetic entry
  useEffect(() => {
    PrismService.getAgentPersonas()
      .then((list) => setAgents([NONE_AGENT, ...list]))
      .catch(console.error);
  }, []);

  // Listen for agent:switch events from AgentComponent
  const handleAgentSwitch = useCallback(
    (e) => {
      const newId = e.detail?.agentId;
      if (newId && newId !== activeAgentId) {
        setLocalAgentId(newId);
        localStorage.setItem(LS_ACTIVE_AGENT, newId);
        router.replace(`/chat?agent=${encodeURIComponent(newId)}`, { scroll: false });
      }
    },
    [activeAgentId, router],
  );

  useEffect(() => {
    window.addEventListener("agent:switch", handleAgentSwitch);
    return () => window.removeEventListener("agent:switch", handleAgentSwitch);
  }, [handleAgentSwitch]);

  // Persist to localStorage on change
  useEffect(() => {
    localStorage.setItem(LS_ACTIVE_AGENT, activeAgentId);
  }, [activeAgentId]);

  return (
    <main className={styles.container}>
      <AgentComponent
        key={activeAgentId}
        agentId={activeAgentId}
        agents={agents}
        initialFcEnabled={forceFc}
        initialThinkingEnabled={forceThinking}
      />
    </main>
  );
}

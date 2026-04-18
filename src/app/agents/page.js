"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import AgentComponent from "../../components/AgentComponent";
import PrismService from "../../services/PrismService";
import styles from "./page.module.css";

const LS_ACTIVE_AGENT = "retina:activeAgent";

export default function AgentsPage() {
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

  // Fetch agent personas on mount
  useEffect(() => {
    PrismService.getAgentPersonas()
      .then((list) => setAgents(list))
      .catch(console.error);
  }, []);

  // Listen for agent:switch events from AgentComponent
  const handleAgentSwitch = useCallback(
    (e) => {
      const newId = e.detail?.agentId;
      if (newId && newId !== activeAgentId) {
        setLocalAgentId(newId);
        localStorage.setItem(LS_ACTIVE_AGENT, newId);
        router.replace(`/agents?agent=${encodeURIComponent(newId)}`, { scroll: false });
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
      />
    </main>
  );
}

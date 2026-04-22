"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import WorkspaceService from "../services/WorkspaceService.js";
import { LS_WORKSPACE_ID } from "../constants.js";

const WorkspaceContext = createContext({
  workspaces: [],
  currentWorkspaceId: null,
  setCurrentWorkspaceId: () => {},
  createWorkspace: async () => {},
  deleteWorkspace: async () => {},
  refreshWorkspaces: async () => {},
});

export function WorkspaceProvider({ children }) {
  const [workspaces, setWorkspaces] = useState([]);
  const [currentWorkspaceId, _setCurrentWorkspaceId] = useState(null);
  const [mounted, setMounted] = useState(false);

  const setCurrentWorkspaceId = useCallback((id) => {
    _setCurrentWorkspaceId(id);
    if (typeof window !== "undefined") {
      if (id) {
        localStorage.setItem(LS_WORKSPACE_ID, id);
      } else {
        localStorage.removeItem(LS_WORKSPACE_ID);
      }
    }
  }, []);

  const refreshWorkspaces = useCallback(async () => {
    try {
      const list = await WorkspaceService.list();
      setWorkspaces(list);
      return list;
    } catch {
      return [];
    }
  }, []);

  const createWorkspace = useCallback(async (name) => {
    const workspace = await WorkspaceService.create(name);
    setWorkspaces((prev) => [...prev, workspace]);
    setCurrentWorkspaceId(workspace.id);
    return workspace;
  }, [setCurrentWorkspaceId]);

  const deleteWorkspace = useCallback(async (id) => {
    await WorkspaceService.remove(id);
    setWorkspaces((prev) => prev.filter((w) => w.id !== id));
    if (currentWorkspaceId === id) {
      setCurrentWorkspaceId(null);
    }
  }, [currentWorkspaceId, setCurrentWorkspaceId]);

  // On mount: restore persisted workspace selection, load workspaces
  useEffect(() => {
    const stored = localStorage.getItem(LS_WORKSPACE_ID);
    if (stored) _setCurrentWorkspaceId(stored);
    setMounted(true);
    refreshWorkspaces();
  }, [refreshWorkspaces]);

  if (!mounted) {
    return (
      <WorkspaceContext.Provider value={{ workspaces: [], currentWorkspaceId: null, setCurrentWorkspaceId, createWorkspace, deleteWorkspace, refreshWorkspaces }}>
        {children}
      </WorkspaceContext.Provider>
    );
  }

  return (
    <WorkspaceContext.Provider value={{ workspaces, currentWorkspaceId, setCurrentWorkspaceId, createWorkspace, deleteWorkspace, refreshWorkspaces }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  return useContext(WorkspaceContext);
}

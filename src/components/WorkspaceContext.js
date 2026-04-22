"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import WorkspaceService from "../services/WorkspaceService.js";
import { LS_WORKSPACE_ROOT } from "../constants.js";

const WorkspaceContext = createContext({
  workspaces: [],
  currentWorkspace: null,
  setCurrentWorkspace: () => {},
  refreshWorkspaces: async () => {},
});

/**
 * WorkspaceProvider — manages workspace selection state.
 *
 * Workspaces are config-defined filesystem paths (from tools-api WORKSPACE_ROOTS).
 * The selected workspace root is stored in localStorage and sent to Prism
 * via the x-workspace-root header (see serviceHeaders.js).
 */
export function WorkspaceProvider({ children }) {
  const [workspaces, setWorkspaces] = useState([]);
  const [currentWorkspace, _setCurrentWorkspace] = useState(null);
  const [mounted, setMounted] = useState(false);

  /** Set the active workspace and persist to localStorage. */
  const setCurrentWorkspace = useCallback((workspace) => {
    _setCurrentWorkspace(workspace);
    if (typeof window !== "undefined") {
      if (workspace?.path) {
        localStorage.setItem(LS_WORKSPACE_ROOT, workspace.path);
      } else {
        localStorage.removeItem(LS_WORKSPACE_ROOT);
      }
    }
  }, []);

  const refreshWorkspaces = useCallback(async () => {
    try {
      const list = await WorkspaceService.list();
      setWorkspaces(list);

      // If the persisted workspace is in the list, restore it
      const storedPath = localStorage.getItem(LS_WORKSPACE_ROOT);
      if (storedPath && list.length > 0) {
        const match = list.find((w) => w.path === storedPath);
        if (match) {
          _setCurrentWorkspace(match);
        } else {
          // Persisted path no longer in config — fall back to first
          _setCurrentWorkspace(list[0]);
          localStorage.setItem(LS_WORKSPACE_ROOT, list[0].path);
        }
      } else if (list.length > 0 && !storedPath) {
        // No previous selection — default to first workspace
        _setCurrentWorkspace(list[0]);
        localStorage.setItem(LS_WORKSPACE_ROOT, list[0].path);
      }

      return list;
    } catch {
      return [];
    }
  }, []);

  // On mount: load workspaces from Prism (which proxies tools-api config)
  useEffect(() => {
    setMounted(true);
    refreshWorkspaces();
  }, [refreshWorkspaces]);

  if (!mounted) {
    return (
      <WorkspaceContext.Provider value={{ workspaces: [], currentWorkspace: null, setCurrentWorkspace, refreshWorkspaces }}>
        {children}
      </WorkspaceContext.Provider>
    );
  }

  return (
    <WorkspaceContext.Provider value={{ workspaces, currentWorkspace, setCurrentWorkspace, refreshWorkspaces }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  return useContext(WorkspaceContext);
}

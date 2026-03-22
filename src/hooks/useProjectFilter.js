"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import IrisService from "../services/IrisService";

const STORAGE_KEY = "admin:projectFilter";

/**
 * Reusable hook for admin project filtering.
 * Fetches available projects, builds dropdown options, and manages the
 * `?project=` URL search param. Persists the selection in localStorage
 * so it survives page navigations and reloads.
 *
 * @returns {{ projectFilter: string|null, projectOptions: Array, handleProjectChange: Function }}
 */
export default function useProjectFilter() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const hasRestoredRef = useRef(false);

  const urlProject = searchParams.get("project") || null;
  const [projects, setProjects] = useState([]);

  // On mount, restore from localStorage if no URL param is present
  useEffect(() => {
    if (hasRestoredRef.current) return;
    hasRestoredRef.current = true;

    if (!urlProject) {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const params = new URLSearchParams(searchParams.toString());
          params.set("project", saved);
          router.replace(`${pathname}?${params.toString()}`);
        }
      } catch { /* localStorage unavailable */ }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    IrisService.getConversationFilters()
      .then((data) => setProjects(data.projects || []))
      .catch(() => { });
  }, []);

  const projectOptions = useMemo(() => [
    { value: "", label: "All Projects" },
    ...projects.map((p) => ({ value: p, label: p })),
  ], [projects]);

  const handleProjectChange = useCallback((val) => {
    // Persist to localStorage
    try {
      if (val) {
        localStorage.setItem(STORAGE_KEY, val);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch { /* localStorage unavailable */ }

    const params = new URLSearchParams(searchParams.toString());
    if (val) {
      params.set("project", val);
    } else {
      params.delete("project");
    }
    router.replace(`${pathname}?${params.toString()}`);
  }, [searchParams, router, pathname]);

  return { projectFilter: urlProject, projectOptions, handleProjectChange };
}

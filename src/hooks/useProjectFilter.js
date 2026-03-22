"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import IrisService from "../services/IrisService";

/**
 * Reusable hook for admin project filtering.
 * Fetches available projects, builds dropdown options, and manages the
 * `?project=` URL search param.
 *
 * @returns {{ projectFilter: string|null, projectOptions: Array, handleProjectChange: Function }}
 */
export default function useProjectFilter() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const projectFilter = searchParams.get("project") || null;
  const [projects, setProjects] = useState([]);

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
    const params = new URLSearchParams(searchParams.toString());
    if (val) {
      params.set("project", val);
    } else {
      params.delete("project");
    }
    router.replace(`${pathname}?${params.toString()}`);
  }, [searchParams, router, pathname]);

  return { projectFilter, projectOptions, handleProjectChange };
}

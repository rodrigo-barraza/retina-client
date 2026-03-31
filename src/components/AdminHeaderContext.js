"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { usePathname } from "next/navigation";
import { LS_DATE_RANGE } from "../constants";

const AdminHeaderContext = createContext({
  controls: null,
  setControls: () => {},
  titleBadge: null,
  setTitleBadge: () => {},
  dateRange: { from: "", to: "" },
  setDateRange: () => {},
});

export function AdminHeaderProvider({ children }) {
  const pathname = usePathname();
  const [controls, setControlsState] = useState(null);
  const [titleBadge, setTitleBadgeState] = useState(null);
  const [dateRange, setDateRangeState] = useState({ from: "", to: "" });

  // Hydrate dateRange from localStorage after mount to avoid SSR mismatch
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LS_DATE_RANGE);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.from || parsed.to) setDateRangeState(parsed);
      }
    } catch {
      // ignore
    }
  }, []);
  const [prevPathname, setPrevPathname] = useState(pathname);

  // Render-phase derived state: clear stale controls and badge on route change.
  // React re-renders this provider immediately (before rendering children) when
  // own state is set during render, so the new page never sees the old page's
  // controls or badge — eliminating the cross-page flicker entirely.
  // Compare only the top-level route segment so sub-route navigations
  // (e.g. /admin/conversations → /admin/conversations/[id]) don't wipe the badge.
  const routeSegment = pathname.replace("/admin", "").split("/").filter(Boolean)[0] || "";
  const prevRouteSegment = prevPathname.replace("/admin", "").split("/").filter(Boolean)[0] || "";
  if (prevRouteSegment !== routeSegment) {
    setPrevPathname(pathname);
    if (controls !== null) setControlsState(null);
    if (titleBadge !== null) setTitleBadgeState(null);
  } else if (prevPathname !== pathname) {
    setPrevPathname(pathname);
  }

  // Persist to localStorage on change
  useEffect(() => {
    try {
      if (dateRange.from || dateRange.to) {
        localStorage.setItem(LS_DATE_RANGE, JSON.stringify(dateRange));
      } else {
        localStorage.removeItem(LS_DATE_RANGE);
      }
    } catch {
      // ignore
    }
  }, [dateRange]);

  const setControls = useCallback((node) => {
    setControlsState(node);
  }, []);

  const setTitleBadge = useCallback((val) => {
    setTitleBadgeState(val);
  }, []);

  const setDateRange = useCallback((val) => {
    setDateRangeState(val);
  }, []);

  return (
    <AdminHeaderContext.Provider value={{ controls, setControls, titleBadge, setTitleBadge, dateRange, setDateRange }}>
      {children}
    </AdminHeaderContext.Provider>
  );
}

export function useAdminHeader() {
  return useContext(AdminHeaderContext);
}

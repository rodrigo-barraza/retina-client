"use client";

import { createContext, useContext, useState, useCallback } from "react";

const AdminHeaderContext = createContext({
  controls: null,
  setControls: () => {},
});

export function AdminHeaderProvider({ children }) {
  const [controls, setControlsState] = useState(null);

  const setControls = useCallback((node) => {
    setControlsState(node);
  }, []);

  return (
    <AdminHeaderContext.Provider value={{ controls, setControls }}>
      {children}
    </AdminHeaderContext.Provider>
  );
}

export function useAdminHeader() {
  return useContext(AdminHeaderContext);
}

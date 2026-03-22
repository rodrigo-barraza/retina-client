"use client";

import { useEffect } from "react";
import SelectDropdown from "../../../components/SelectDropdown";
import { useAdminHeader } from "../../../components/AdminHeaderContext";
import useProjectFilter from "../../../hooks/useProjectFilter";
import ModelsPageComponent from "../../../components/ModelsPageComponent";

export default function AdminModelsPage() {
  const { projectFilter, projectOptions, handleProjectChange } = useProjectFilter();
  const { setControls } = useAdminHeader();

  useEffect(() => {
    setControls(
      <SelectDropdown
        value={projectFilter || ""}
        options={projectOptions}
        onChange={handleProjectChange}
        placeholder="All Projects"
      />
    );
  }, [setControls, projectFilter, projectOptions, handleProjectChange]);

  useEffect(() => {
    return () => setControls(null);
  }, [setControls]);

  return <ModelsPageComponent mode="admin" project={projectFilter} />;
}

"use client";

import { useEffect } from "react";
import SelectDropdown from "../../../components/SelectDropdown";
import { useAdminHeader } from "../../../components/AdminHeaderContext";
import useProjectFilter from "../../../hooks/useProjectFilter";
import MediaPageComponent from "../../../components/MediaPageComponent";

export default function AdminMediaPage() {
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

  return <MediaPageComponent mode="admin" project={projectFilter} />;
}

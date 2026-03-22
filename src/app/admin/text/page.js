"use client";

import { useEffect } from "react";
import SelectDropdown from "../../../components/SelectDropdown";
import { useAdminHeader } from "../../../components/AdminHeaderContext";
import useProjectFilter from "../../../hooks/useProjectFilter";
import TextPageComponent from "../../../components/TextPageComponent";

export default function AdminTextPage() {
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

  return <TextPageComponent mode="admin" project={projectFilter} />;
}

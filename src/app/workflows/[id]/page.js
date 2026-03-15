"use client";

import { use } from "react";
import WorkflowsPage from "../page";

export default function WorkflowByIdPage({ params }) {
  const { id } = use(params);
  return <WorkflowsPage initialWorkflowId={id} />;
}

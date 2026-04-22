/**
 * Shared base headers for all Prism-backed service requests.
 * Centralises Content-Type, x-project, and x-workspace-id injection
 * so PrismService, IrisService, and any future services stay in sync.
 */

import { PROJECT_NAME } from "../../config.js";

export function getBaseHeaders() {
  const headers = {
    "Content-Type": "application/json",
    "x-project": PROJECT_NAME,
  };

  // Include the active workspace ID if one is selected (client-side only)
  if (typeof window !== "undefined") {
    const workspaceId = localStorage.getItem("retina:workspace");
    if (workspaceId) {
      headers["x-workspace-id"] = workspaceId;
    }
  }

  return headers;
}

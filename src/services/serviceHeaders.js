/**
 * Shared base headers for all Prism-backed service requests.
 * Centralises Content-Type, x-project, and x-workspace-root injection
 * so PrismService, IrisService, and any future services stay in sync.
 */

import { PROJECT_NAME } from "../../config.js";

export function getBaseHeaders() {
  const headers = {
    "Content-Type": "application/json",
    "x-project": PROJECT_NAME,
  };

  // Include the active workspace root path if one is selected (client-side only)
  if (typeof window !== "undefined") {
    const workspaceRoot = localStorage.getItem("retina:workspace");
    if (workspaceRoot) {
      headers["x-workspace-root"] = workspaceRoot;
    }
  }

  return headers;
}

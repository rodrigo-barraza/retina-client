import { PRISM_URL } from "../../config.js";
import { getBaseHeaders } from "./serviceHeaders.js";

const API_BASE = PRISM_URL;

/**
 * WorkspaceService — fetches the list of configured workspace roots from Prism.
 *
 * Workspaces are config-defined filesystem paths (from tools-api WORKSPACE_ROOTS),
 * not user-created database records. The only operation is list().
 */
export default class WorkspaceService {
  static async list() {
    const res = await fetch(`${API_BASE}/workspaces`, {
      method: "GET",
      headers: getBaseHeaders(),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`WorkspaceService.list failed: ${res.status}`);
    return res.json();
  }
}

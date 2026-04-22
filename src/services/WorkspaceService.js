import { PRISM_URL } from "../../config.js";
import { getBaseHeaders } from "./serviceHeaders.js";

const API_BASE = PRISM_URL;

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

  static async create(name) {
    const res = await fetch(`${API_BASE}/workspaces`, {
      method: "POST",
      headers: getBaseHeaders(),
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error(`WorkspaceService.create failed: ${res.status}`);
    return res.json();
  }

  static async update(id, data) {
    const res = await fetch(`${API_BASE}/workspaces/${id}`, {
      method: "PUT",
      headers: getBaseHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`WorkspaceService.update failed: ${res.status}`);
    return res.json();
  }

  static async remove(id) {
    const res = await fetch(`${API_BASE}/workspaces/${id}`, {
      method: "DELETE",
      headers: getBaseHeaders(),
    });
    if (!res.ok) throw new Error(`WorkspaceService.remove failed: ${res.status}`);
    return res.json();
  }
}

"use client";

import { PrismService } from "./PrismService";

const WorkflowService = {
  /**
   * Get all saved workflows (metadata only).
   * @returns {Promise<Array>}
   */
  async getWorkflows() {
    try {
      return await PrismService.getWorkflows();
    } catch {
      return [];
    }
  },

  /**
   * Get a single workflow by ID (full document).
   * @param {string} id
   * @returns {Promise<object|null>}
   */
  async getWorkflow(id) {
    try {
      return await PrismService.getWorkflow(id);
    } catch {
      return null;
    }
  },

  /**
   * Save or update a workflow.
   * @param {object} workflow - { id?, name, nodes, connections, nodeResults?, nodeStatuses? }
   * @returns {Promise<object>} The saved workflow with id
   */
  async saveWorkflow(workflow) {
    if (workflow.id) {
      // Update existing
      const { id, ...data } = workflow;
      await PrismService.updateWorkflow(id, data);
      return workflow;
    }
    // Create new
    const result = await PrismService.saveWorkflow(workflow);
    return { ...workflow, id: result.id };
  },

  /**
   * Delete a workflow by ID.
   * @param {string} id
   */
  async deleteWorkflow(id) {
    await PrismService.deleteWorkflow(id);
  },
};

export default WorkflowService;

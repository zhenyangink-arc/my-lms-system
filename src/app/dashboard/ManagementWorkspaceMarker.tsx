"use client";

import { useEffect } from "react";

import type { ManagementWorkspace } from "./layouts/ManagementDashboardLayout";

export function ManagementWorkspaceMarker({
  workspace,
}: {
  workspace: ManagementWorkspace;
}) {
  useEffect(() => {
    document.documentElement.dataset.managementWorkspace = workspace;

    return () => {
      if (document.documentElement.dataset.managementWorkspace === workspace) {
        delete document.documentElement.dataset.managementWorkspace;
      }
    };
  }, [workspace]);

  return null;
}

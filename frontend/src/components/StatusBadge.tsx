import React from "react";

const BADGE_MAP: Record<string, string> = {
  PASSED: "badge-passed",
  FAILED: "badge-failed",
  SKIPPED: "badge-skipped",
  ERROR: "badge-error",
  IN_PROGRESS: "badge-in-progress",
  STOPPED: "badge-stopped",
};

const LABEL_MAP: Record<string, string> = {
  PASSED: "Passed",
  FAILED: "Failed",
  SKIPPED: "Skipped",
  ERROR: "Error",
  IN_PROGRESS: "In Progress",
  STOPPED: "Stopped",
};

export const StatusBadge: React.FC<{ status: string }> = ({ status }) => (
  <span className={`badge ${BADGE_MAP[status] || "badge-stopped"}`}>
    <span className="badge-dot" />
    {LABEL_MAP[status] || status}
  </span>
);

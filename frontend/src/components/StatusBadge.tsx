import React from "react";

const STATUS_COLORS: Record<string, string> = {
  PASSED: "#4caf50",
  FAILED: "#f44336",
  SKIPPED: "#ff9800",
  ERROR: "#e91e63",
  IN_PROGRESS: "#2196f3",
  STOPPED: "#9e9e9e",
};

export const StatusBadge: React.FC<{ status: string }> = ({ status }) => (
  <span
    style={{
      backgroundColor: STATUS_COLORS[status] || "#9e9e9e",
      color: "#fff",
      padding: "2px 10px",
      borderRadius: 12,
      fontSize: 12,
      fontWeight: 600,
    }}
  >
    {status}
  </span>
);

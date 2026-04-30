import React from "react";
import { DefectType } from "../types";

const DEFECT_COLORS: Record<DefectType, string> = {
  PRODUCT_BUG: "#f44336",
  AUTOMATION_BUG: "#ff9800",
  SYSTEM_ISSUE: "#9c27b0",
  NO_DEFECT: "#4caf50",
  TO_INVESTIGATE: "#607d8b",
};

const DEFECT_LABELS: Record<DefectType, string> = {
  PRODUCT_BUG: "Product Bug",
  AUTOMATION_BUG: "Automation Bug",
  SYSTEM_ISSUE: "System Issue",
  NO_DEFECT: "No Defect",
  TO_INVESTIGATE: "To Investigate",
};

interface AnalysisBadgeProps {
  defectType: DefectType;
  confidence?: number;
}

export const AnalysisBadge: React.FC<AnalysisBadgeProps> = ({ defectType, confidence }) => (
  <span
    title={confidence !== undefined ? `Confidence: ${(confidence * 100).toFixed(0)}%` : undefined}
    style={{
      backgroundColor: DEFECT_COLORS[defectType] || "#9e9e9e",
      color: "#fff",
      padding: "2px 8px",
      borderRadius: 12,
      fontSize: 11,
      fontWeight: 600,
      cursor: confidence !== undefined ? "help" : "default",
    }}
  >
    {DEFECT_LABELS[defectType] || defectType}
  </span>
);

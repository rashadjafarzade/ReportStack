import React from "react";
import { DefectType } from "../types";

const BADGE_MAP: Record<DefectType, string> = {
  PRODUCT_BUG: "badge-defect badge-product-bug",
  AUTOMATION_BUG: "badge-defect badge-automation-bug",
  SYSTEM_ISSUE: "badge-defect badge-system-issue",
  NO_DEFECT: "badge-defect badge-no-defect",
  TO_INVESTIGATE: "badge-defect badge-to-investigate",
};

const LABEL_MAP: Record<DefectType, string> = {
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
    className={BADGE_MAP[defectType] || "badge-defect badge-to-investigate"}
    title={confidence !== undefined ? `Confidence: ${(confidence * 100).toFixed(0)}%` : undefined}
  >
    {LABEL_MAP[defectType] || defectType}
  </span>
);

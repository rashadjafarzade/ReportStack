import React, { useEffect, useState } from "react";
import { getItemAnalyses, overrideAnalysis } from "../api/analyses";
import { FailureAnalysis, DefectType } from "../types";
import { AnalysisBadge } from "./AnalysisBadge";

const DEFECT_TYPES: DefectType[] = [
  "PRODUCT_BUG",
  "AUTOMATION_BUG",
  "SYSTEM_ISSUE",
  "NO_DEFECT",
  "TO_INVESTIGATE",
];

const DEFECT_LABELS: Record<DefectType, string> = {
  PRODUCT_BUG: "Product Bug",
  AUTOMATION_BUG: "Automation Bug",
  SYSTEM_ISSUE: "System Issue",
  NO_DEFECT: "No Defect",
  TO_INVESTIGATE: "To Investigate",
};

interface AnalysisPanelProps {
  launchId: number;
  itemId: number;
}

export const AnalysisPanel: React.FC<AnalysisPanelProps> = ({ launchId, itemId }) => {
  const [analyses, setAnalyses] = useState<FailureAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [overrideMode, setOverrideMode] = useState(false);
  const [overrideType, setOverrideType] = useState<DefectType>("PRODUCT_BUG");
  const [overrideReason, setOverrideReason] = useState("");

  const loadAnalyses = () => {
    setLoading(true);
    getItemAnalyses(launchId, itemId)
      .then((res) => setAnalyses(res.data))
      .finally(() => setLoading(false));
  };

  useEffect(loadAnalyses, [launchId, itemId]);

  const latest = analyses.find((a) => !a.overridden_by);

  const handleOverride = async () => {
    if (!latest) return;
    await overrideAnalysis(launchId, itemId, latest.id, {
      defect_type: overrideType,
      reasoning: overrideReason || undefined,
    });
    setOverrideMode(false);
    setOverrideReason("");
    loadAnalyses();
  };

  if (loading) {
    return (
      <div className="loading-center" style={{ padding: "var(--space-6)" }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!latest) {
    return (
      <div className="empty-state" style={{ padding: "var(--space-8)" }}>
        <div className="empty-state-icon">&#129302;</div>
        <div className="empty-state-title">No Analysis Available</div>
        <div className="empty-state-description">
          Click "Analyze Failures" in the summary above to trigger AI analysis.
        </div>
      </div>
    );
  }

  const confPct = (latest.confidence * 100).toFixed(0);
  const confClass = latest.confidence > 0.7 ? "high" : latest.confidence > 0.4 ? "medium" : "low";

  return (
    <div className="analysis-card">
      <div className="analysis-header">
        <div className="flex items-center gap-3">
          <AnalysisBadge defectType={latest.defect_type} confidence={latest.confidence} />
          <div className="confidence-bar">
            <div className="confidence-track">
              <div
                className={`confidence-fill ${confClass}`}
                style={{ width: `${confPct}%` }}
              />
            </div>
            <span className="confidence-label">{confPct}%</span>
          </div>
        </div>
        <span className="analysis-source">
          {latest.source === "AI_AUTO" ? (
            <>&#9889; AI &middot; {latest.model_name || "unknown"}</>
          ) : (
            <>&#9998; Manual</>
          )}
        </span>
      </div>

      {latest.reasoning && (
        <div className="analysis-reasoning">{latest.reasoning}</div>
      )}

      {!overrideMode ? (
        <button
          className="btn btn-secondary btn-sm mt-4"
          onClick={() => setOverrideMode(true)}
        >
          Override Classification
        </button>
      ) : (
        <div className="override-form">
          <div className="mb-2">
            <select
              className="select"
              value={overrideType}
              onChange={(e) => setOverrideType(e.target.value as DefectType)}
            >
              {DEFECT_TYPES.map((dt) => (
                <option key={dt} value={dt}>
                  {DEFECT_LABELS[dt]}
                </option>
              ))}
            </select>
          </div>
          <div className="mb-4">
            <input
              className="input"
              type="text"
              placeholder="Reason for override (optional)"
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <button className="btn btn-primary btn-sm" onClick={handleOverride}>
              Save Override
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setOverrideMode(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

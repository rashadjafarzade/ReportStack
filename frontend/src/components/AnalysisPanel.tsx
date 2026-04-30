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

  if (loading) return <div style={{ color: "#999", padding: 12 }}>Loading analysis...</div>;
  if (!latest) return <div style={{ color: "#999", padding: 12 }}>No analysis available.</div>;

  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <AnalysisBadge defectType={latest.defect_type} confidence={latest.confidence} />
        <span style={{ fontSize: 12, color: "#666" }}>
          {latest.source === "AI_AUTO" ? `AI (${latest.model_name || "unknown"})` : "Manual"}
        </span>
      </div>

      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>Confidence</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 120,
              height: 6,
              backgroundColor: "#e0e0e0",
              borderRadius: 3,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${latest.confidence * 100}%`,
                height: "100%",
                backgroundColor: latest.confidence > 0.7 ? "#4caf50" : latest.confidence > 0.4 ? "#ff9800" : "#f44336",
              }}
            />
          </div>
          <span style={{ fontSize: 12, color: "#666" }}>{(latest.confidence * 100).toFixed(0)}%</span>
        </div>
      </div>

      {latest.reasoning && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>Reasoning</div>
          <div style={{ fontSize: 13, color: "#444", lineHeight: 1.5 }}>{latest.reasoning}</div>
        </div>
      )}

      {!overrideMode ? (
        <button
          onClick={() => setOverrideMode(true)}
          style={{ fontSize: 12, padding: "4px 12px" }}
        >
          Override
        </button>
      ) : (
        <div style={{ border: "1px solid #ddd", borderRadius: 4, padding: 12, marginTop: 8 }}>
          <div style={{ marginBottom: 8 }}>
            <select
              value={overrideType}
              onChange={(e) => setOverrideType(e.target.value as DefectType)}
              style={{ padding: "4px 8px", fontSize: 12 }}
            >
              {DEFECT_TYPES.map((dt) => (
                <option key={dt} value={dt}>
                  {dt.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: 8 }}>
            <input
              type="text"
              placeholder="Reason (optional)"
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              style={{ width: "100%", padding: "4px 8px", fontSize: 12, boxSizing: "border-box" }}
            />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleOverride} style={{ fontSize: 12, padding: "4px 12px" }}>
              Save
            </button>
            <button onClick={() => setOverrideMode(false)} style={{ fontSize: 12, padding: "4px 12px" }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

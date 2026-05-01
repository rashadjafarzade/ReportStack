import React, { useEffect, useState } from "react";
import { getAnalysisSummary, triggerLaunchAnalysis } from "../api/analyses";
import { LaunchAnalysisSummary as SummaryType } from "../types";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";

const CHART_COLORS: Record<string, string> = {
  "Product Bug": "var(--color-product-bug)",
  "Automation Bug": "var(--color-automation-bug)",
  "System Issue": "var(--color-system-issue)",
  "No Defect": "var(--color-no-defect)",
  "To Investigate": "var(--color-to-investigate)",
};

// Recharts needs hex values not CSS vars at render time
const CHART_HEX: Record<string, string> = {
  "Product Bug": "#ef4444",
  "Automation Bug": "#f59e0b",
  "System Issue": "#8b5cf6",
  "No Defect": "#10b981",
  "To Investigate": "#64748b",
};

interface Props {
  launchId: number;
}

export const LaunchAnalysisSummaryChart: React.FC<Props> = ({ launchId }) => {
  const [summary, setSummary] = useState<SummaryType | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const loadSummary = () => {
    getAnalysisSummary(launchId).then((res) => setSummary(res.data));
  };

  useEffect(loadSummary, [launchId]);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      await triggerLaunchAnalysis(launchId);
      setTimeout(loadSummary, 3000);
    } finally {
      setAnalyzing(false);
    }
  };

  if (!summary) return null;

  const data = [
    { name: "Product Bug", value: summary.product_bug },
    { name: "Automation Bug", value: summary.automation_bug },
    { name: "System Issue", value: summary.system_issue },
    { name: "No Defect", value: summary.no_defect },
    { name: "To Investigate", value: summary.to_investigate },
  ].filter((d) => d.value > 0);

  return (
    <div className="card mb-6">
      <div className="card-header">
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 18 }}>&#129302;</span>
          <h3 className="card-title">AI Failure Analysis</h3>
        </div>
        <button
          className={`btn ${analyzing ? "btn-secondary" : "btn-primary"} btn-sm`}
          onClick={handleAnalyze}
          disabled={analyzing}
        >
          {analyzing ? (
            <>
              <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
              Analyzing...
            </>
          ) : (
            "Analyze Failures"
          )}
        </button>
      </div>
      <div className="card-body">
        {summary.total_analyzed === 0 ? (
          <div className="empty-state" style={{ padding: "var(--space-6)" }}>
            <div className="empty-state-title">No failures analyzed yet</div>
            <div className="empty-state-description">
              Click "Analyze Failures" to classify test failures using AI.
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-6">
            <div style={{ width: 240, height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    outerRadius={75}
                    innerRadius={45}
                    dataKey="value"
                    paddingAngle={2}
                    stroke="none"
                  >
                    {data.map((entry) => (
                      <Cell key={entry.name} fill={CHART_HEX[entry.name] || "#9e9e9e"} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-surface)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "var(--radius-md)",
                      fontSize: "var(--text-sm)",
                      boxShadow: "var(--shadow-md)",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ flex: 1 }}>
              <div className="text-sm text-secondary mb-4">
                <strong style={{ color: "var(--color-text)", fontSize: "var(--text-lg)" }}>
                  {summary.total_analyzed}
                </strong>{" "}
                failures analyzed
              </div>
              <div className="flex flex-col gap-2">
                {data.map((d) => (
                  <div key={d.name} className="flex items-center gap-2">
                    <span
                      className="stats-legend-dot"
                      style={{ background: CHART_HEX[d.name] }}
                    />
                    <span className="text-sm" style={{ flex: 1 }}>{d.name}</span>
                    <span className="font-semibold text-sm">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

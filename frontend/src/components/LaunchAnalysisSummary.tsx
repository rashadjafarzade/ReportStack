import React, { useEffect, useState } from "react";
import { getAnalysisSummary, triggerLaunchAnalysis } from "../api/analyses";
import { LaunchAnalysisSummary as SummaryType } from "../types";
import { PieChart, Pie, Cell, Tooltip, Legend } from "recharts";

const COLORS: Record<string, string> = {
  "Product Bug": "#f44336",
  "Automation Bug": "#ff9800",
  "System Issue": "#9c27b0",
  "No Defect": "#4caf50",
  "To Investigate": "#607d8b",
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
    <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 16, marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>AI Failure Analysis</h3>
        <button
          onClick={handleAnalyze}
          disabled={analyzing}
          style={{ padding: "6px 16px", fontSize: 13 }}
        >
          {analyzing ? "Analyzing..." : "Analyze Failures"}
        </button>
      </div>

      {summary.total_analyzed === 0 ? (
        <div style={{ color: "#999", fontSize: 14 }}>
          No failures analyzed yet. Click "Analyze Failures" to start.
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <PieChart width={220} height={180}>
            <Pie data={data} cx={105} cy={85} outerRadius={65} dataKey="value" label>
              {data.map((entry) => (
                <Cell key={entry.name} fill={COLORS[entry.name] || "#9e9e9e"} />
              ))}
            </Pie>
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
          <div style={{ fontSize: 13 }}>
            <div>Total analyzed: <strong>{summary.total_analyzed}</strong></div>
          </div>
        </div>
      )}
    </div>
  );
};

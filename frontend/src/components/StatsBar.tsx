import React from "react";
import { Launch } from "../types";

export const StatsBar: React.FC<{ launch: Launch }> = ({ launch }) => {
  const total = launch.total || 1;
  const segments = [
    { count: launch.passed, color: "#4caf50", label: "Passed" },
    { count: launch.failed, color: "#f44336", label: "Failed" },
    { count: launch.skipped, color: "#ff9800", label: "Skipped" },
  ];

  return (
    <div>
      <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", marginBottom: 4 }}>
        {segments.map((s) => (
          <div
            key={s.label}
            style={{ width: `${(s.count / total) * 100}%`, backgroundColor: s.color }}
            title={`${s.label}: ${s.count}`}
          />
        ))}
      </div>
      <div style={{ display: "flex", gap: 12, fontSize: 12, color: "#666" }}>
        {segments.map((s) => (
          <span key={s.label}>
            <span style={{ color: s.color, fontWeight: 600 }}>{s.count}</span> {s.label}
          </span>
        ))}
      </div>
    </div>
  );
};

import React from "react";
import { Launch } from "../types";

export const StatsBar: React.FC<{ launch: Launch; showLegend?: boolean }> = ({ launch, showLegend = true }) => {
  const total = launch.total || 1;
  const segments = [
    { count: launch.passed, cls: "passed", label: "Passed", color: "var(--color-passed)" },
    { count: launch.failed, cls: "failed", label: "Failed", color: "var(--color-failed)" },
    { count: launch.skipped, cls: "skipped", label: "Skipped", color: "var(--color-skipped)" },
  ];

  return (
    <div>
      <div className="stats-bar">
        {segments.map((s) => (
          <div
            key={s.label}
            className={`stats-bar-segment ${s.cls}`}
            style={{ width: `${(s.count / total) * 100}%` }}
            title={`${s.label}: ${s.count}`}
          />
        ))}
      </div>
      {showLegend && (
        <div className="stats-legend">
          {segments.map((s) => (
            <span key={s.label} className="stats-legend-item">
              <span className="stats-legend-dot" style={{ background: s.color }} />
              <span className="stats-legend-count">{s.count}</span>
              {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

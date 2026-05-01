import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getTestHistory, TestHistoryEntry } from "../api/history";

const STATUS_COLORS: Record<string, string> = {
  PASSED: "#10b981",
  FAILED: "#ef4444",
  SKIPPED: "#f59e0b",
  ERROR: "#f43f5e",
};

const DEFECT_ABBR: Record<string, string> = {
  PRODUCT_BUG: "PB",
  AUTOMATION_BUG: "AB",
  SYSTEM_ISSUE: "SI",
  NO_DEFECT: "ND",
  TO_INVESTIGATE: "TI",
};

const DEFECT_COLORS: Record<string, string> = {
  PRODUCT_BUG: "#ef4444",
  AUTOMATION_BUG: "#f59e0b",
  SYSTEM_ISSUE: "#3b82f6",
  NO_DEFECT: "#22c55e",
  TO_INVESTIGATE: "#6b7280",
};

interface HistoryStripProps {
  testName: string;
  currentItemId: number;
}

const MAX_VISIBLE = 12;

const HistoryStrip: React.FC<HistoryStripProps> = ({ testName, currentItemId }) => {
  const [history, setHistory] = useState<TestHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setLoading(true);
    getTestHistory(testName, 30)
      .then(res => setHistory(Array.isArray(res.data) ? res.data : []))
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, [testName]);

  if (loading) return null;
  if (history.length <= 1) return null;

  const visible = expanded ? history : history.slice(0, MAX_VISIBLE);
  const hiddenCount = history.length - MAX_VISIBLE;

  return (
    <div className="history-strip">
      <div className="history-strip-label">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
        </svg>
        History Across All Launches
      </div>
      <div className="history-strip-items">
        {!expanded && hiddenCount > 0 && (
          <button className="history-strip-more" onClick={() => setExpanded(true)}>+{hiddenCount} More</button>
        )}
        {visible.map(h => {
          const isCurrent = h.id === currentItemId;
          const color = STATUS_COLORS[h.status] || "#6b7280";
          return (
            <Link
              key={h.id}
              to={`/launches/${h.launch_id}/items/${h.id}`}
              className={`history-strip-item ${isCurrent ? "current" : ""}`}
              title={`#${h.launch_number} ${h.launch_name} — ${h.status}${h.defect_type ? ` (${DEFECT_ABBR[h.defect_type] || h.defect_type})` : ""}`}
            >
              <span className="history-strip-num">#{h.launch_number}</span>
              <span className="history-strip-bar" style={{ background: color }} />
              {h.defect_type && (
                <span className="history-strip-defect" style={{ color: DEFECT_COLORS[h.defect_type] || "#6b7280" }}>
                  {DEFECT_ABBR[h.defect_type]}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default HistoryStrip;

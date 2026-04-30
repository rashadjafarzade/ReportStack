import React, { useEffect, useState } from "react";
import { getTestLogs } from "../api/logs";
import { TestLog, LogLevel } from "../types";
import { format } from "date-fns";

const LEVEL_COLORS: Record<LogLevel, string> = {
  TRACE: "#9e9e9e",
  DEBUG: "#2196f3",
  INFO: "#4caf50",
  WARN: "#ff9800",
  ERROR: "#f44336",
};

interface LogViewerProps {
  launchId: number;
  itemId: number;
}

export const LogViewer: React.FC<LogViewerProps> = ({ launchId, itemId }) => {
  const [logs, setLogs] = useState<TestLog[]>([]);
  const [levelFilter, setLevelFilter] = useState<LogLevel | "">("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getTestLogs(launchId, itemId, {
      level: levelFilter || undefined,
      page_size: 500,
    })
      .then((res) => setLogs(res.data))
      .finally(() => setLoading(false));
  }, [launchId, itemId, levelFilter]);

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <select
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value as LogLevel | "")}
          style={{ padding: "4px 8px", fontSize: 12 }}
        >
          <option value="">All Levels</option>
          <option value="TRACE">TRACE</option>
          <option value="DEBUG">DEBUG</option>
          <option value="INFO">INFO</option>
          <option value="WARN">WARN</option>
          <option value="ERROR">ERROR</option>
        </select>
      </div>
      <div
        style={{
          maxHeight: 400,
          overflow: "auto",
          backgroundColor: "#1e1e1e",
          borderRadius: 4,
          padding: 12,
          fontFamily: "monospace",
          fontSize: 12,
          lineHeight: 1.6,
        }}
      >
        {loading && <div style={{ color: "#999" }}>Loading logs...</div>}
        {!loading && logs.length === 0 && (
          <div style={{ color: "#999" }}>No logs found.</div>
        )}
        {logs.map((log) => (
          <div key={log.id} style={{ display: "flex", gap: 8 }}>
            <span style={{ color: "#888", whiteSpace: "nowrap" }}>
              {format(new Date(log.timestamp), "HH:mm:ss.SSS")}
            </span>
            <span
              style={{
                color: LEVEL_COLORS[log.level],
                fontWeight: 600,
                minWidth: 44,
              }}
            >
              {log.level}
            </span>
            {log.step_name && (
              <span style={{ color: "#b39ddb" }}>[{log.step_name}]</span>
            )}
            <span style={{ color: "#e0e0e0", wordBreak: "break-all" }}>
              {log.message}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

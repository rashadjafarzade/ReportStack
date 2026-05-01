import React, { useEffect, useState } from "react";
import { getTestLogs } from "../api/logs";
import { TestLog, LogLevel } from "../types";
import { format } from "date-fns";

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
    <div className="log-viewer">
      <div className="log-viewer-toolbar">
        <select
          className="select"
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value as LogLevel | "")}
          style={{ background: "#21262d", color: "#c9d1d9", borderColor: "#30363d", fontSize: "var(--text-xs)" }}
        >
          <option value="">All Levels</option>
          <option value="TRACE">TRACE</option>
          <option value="DEBUG">DEBUG</option>
          <option value="INFO">INFO</option>
          <option value="WARN">WARN</option>
          <option value="ERROR">ERROR</option>
        </select>
        <span style={{ fontSize: "var(--text-xs)", color: "#484f58" }}>
          {logs.length} entries
        </span>
      </div>
      <div className="log-viewer-body">
        {loading && (
          <div className="loading-center" style={{ padding: "var(--space-6)" }}>
            <div className="spinner" style={{ borderColor: "#30363d", borderTopColor: "#58a6ff" }} />
          </div>
        )}
        {!loading && logs.length === 0 && (
          <div style={{ textAlign: "center", padding: "var(--space-8)", color: "#484f58" }}>
            No logs found
          </div>
        )}
        {logs.map((log) => (
          <div key={log.id} className="log-line">
            <span className="log-timestamp">
              {format(new Date(log.timestamp), "HH:mm:ss.SSS")}
            </span>
            <span className={`log-level ${log.level.toLowerCase()}`}>
              {log.level}
            </span>
            {log.step_name && (
              <span className="log-step">[{log.step_name}]</span>
            )}
            <span className="log-message">{log.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

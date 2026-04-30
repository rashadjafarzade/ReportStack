import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getLaunch, getTestItems } from "../api/launches";
import { getItemAnalyses } from "../api/analyses";
import { Launch, TestItem, TestStatus, FailureAnalysis } from "../types";
import { StatusBadge } from "../components/StatusBadge";
import { StatsBar } from "../components/StatsBar";
import { LogViewer } from "../components/LogViewer";
import { ScreenshotViewer } from "../components/ScreenshotViewer";
import { AnalysisPanel } from "../components/AnalysisPanel";
import { AnalysisBadge } from "../components/AnalysisBadge";
import { LaunchAnalysisSummaryChart } from "../components/LaunchAnalysisSummary";
import { format } from "date-fns";
import { PieChart, Pie, Cell, Legend, Tooltip } from "recharts";

const COLORS: Record<string, string> = {
  PASSED: "#4caf50",
  FAILED: "#f44336",
  SKIPPED: "#ff9800",
  ERROR: "#e91e63",
};

type TabType = "error" | "logs" | "screenshots" | "analysis";

const LaunchDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [launch, setLaunch] = useState<Launch | null>(null);
  const [items, setItems] = useState<TestItem[]>([]);
  const [filter, setFilter] = useState<TestStatus | "">("");
  const [expandedItem, setExpandedItem] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("error");
  const [itemAnalyses, setItemAnalyses] = useState<Record<number, FailureAnalysis | null>>({});

  useEffect(() => {
    if (!id) return;
    getLaunch(Number(id)).then((res) => setLaunch(res.data));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    getTestItems(Number(id), filter || undefined).then((res) => setItems(res.data));
  }, [id, filter]);

  // Load latest analysis for each failed/error item
  useEffect(() => {
    if (!id || items.length === 0) return;
    const failedItems = items.filter((i) => i.status === "FAILED" || i.status === "ERROR");
    failedItems.forEach((item) => {
      getItemAnalyses(Number(id), item.id).then((res) => {
        const latest = res.data.find((a) => !a.overridden_by) || null;
        setItemAnalyses((prev) => ({ ...prev, [item.id]: latest }));
      });
    });
  }, [id, items]);

  if (!launch) return <div>Loading...</div>;

  const pieData = [
    { name: "Passed", value: launch.passed },
    { name: "Failed", value: launch.failed },
    { name: "Skipped", value: launch.skipped },
  ].filter((d) => d.value > 0);

  const tabStyle = (tab: TabType): React.CSSProperties => ({
    padding: "6px 16px",
    fontSize: 13,
    cursor: "pointer",
    borderBottom: activeTab === tab ? "2px solid #1976d2" : "2px solid transparent",
    color: activeTab === tab ? "#1976d2" : "#666",
    fontWeight: activeTab === tab ? 600 : 400,
    background: "none",
    border: "none",
    borderBottomWidth: 2,
    borderBottomStyle: "solid",
    borderBottomColor: activeTab === tab ? "#1976d2" : "transparent",
  });

  const handleRowClick = (item: TestItem) => {
    if (expandedItem === item.id) {
      setExpandedItem(null);
    } else {
      setExpandedItem(item.id);
      setActiveTab(item.error_message ? "error" : "logs");
    }
  };

  return (
    <div>
      <Link to="/" style={{ color: "#1976d2", textDecoration: "none", fontSize: 14 }}>
        &larr; Back to Launches
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 16 }}>
        <h1 style={{ margin: 0 }}>{launch.name}</h1>
        <StatusBadge status={launch.status} />
      </div>

      {launch.description && <p style={{ color: "#666" }}>{launch.description}</p>}

      <div style={{ display: "flex", gap: 40, marginTop: 24, marginBottom: 24 }}>
        <div style={{ flex: 1 }}>
          <h3>Summary</h3>
          <StatsBar launch={launch} />
          <div style={{ marginTop: 16, fontSize: 14, color: "#666" }}>
            <div>Started: {format(new Date(launch.start_time), "MMM d, yyyy HH:mm:ss")}</div>
            {launch.end_time && (
              <div>Finished: {format(new Date(launch.end_time), "MMM d, yyyy HH:mm:ss")}</div>
            )}
            <div>Total tests: {launch.total}</div>
          </div>
        </div>
        <div>
          <PieChart width={250} height={200}>
            <Pie data={pieData} cx={120} cy={100} outerRadius={70} dataKey="value" label>
              {pieData.map((entry) => (
                <Cell key={entry.name} fill={COLORS[entry.name.toUpperCase()] || "#9e9e9e"} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </div>
      </div>

      <LaunchAnalysisSummaryChart launchId={launch.id} />

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <h3 style={{ margin: 0 }}>Test Results</h3>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as TestStatus | "")}
          style={{ padding: "4px 8px" }}
        >
          <option value="">All</option>
          <option value="PASSED">Passed</option>
          <option value="FAILED">Failed</option>
          <option value="SKIPPED">Skipped</option>
          <option value="ERROR">Error</option>
        </select>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #eee", textAlign: "left" }}>
            <th style={{ padding: "8px 12px" }}>Test Name</th>
            <th style={{ padding: "8px 12px" }}>Suite</th>
            <th style={{ padding: "8px 12px" }}>Status</th>
            <th style={{ padding: "8px 12px" }}>Defect</th>
            <th style={{ padding: "8px 12px" }}>Duration</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <React.Fragment key={item.id}>
              <tr
                style={{
                  borderBottom: "1px solid #f0f0f0",
                  cursor: "pointer",
                  backgroundColor: expandedItem === item.id ? "#f9f9f9" : "transparent",
                }}
                onClick={() => handleRowClick(item)}
              >
                <td style={{ padding: "10px 12px" }}>
                  {item.name}
                  <span style={{ color: "#999", marginLeft: 6 }}>
                    {expandedItem === item.id ? "\u25B2" : "\u25BC"}
                  </span>
                </td>
                <td style={{ padding: "10px 12px", color: "#666", fontSize: 13 }}>
                  {item.suite || "-"}
                </td>
                <td style={{ padding: "10px 12px" }}>
                  <StatusBadge status={item.status} />
                </td>
                <td style={{ padding: "10px 12px" }}>
                  {itemAnalyses[item.id] && (
                    <AnalysisBadge
                      defectType={itemAnalyses[item.id]!.defect_type}
                      confidence={itemAnalyses[item.id]!.confidence}
                    />
                  )}
                </td>
                <td style={{ padding: "10px 12px", fontSize: 13 }}>
                  {item.duration_ms != null ? `${item.duration_ms}ms` : "-"}
                </td>
              </tr>
              {expandedItem === item.id && (
                <tr>
                  <td colSpan={5} style={{ padding: 0 }}>
                    <div style={{ borderBottom: "1px solid #eee" }}>
                      <div style={{ display: "flex", borderBottom: "1px solid #eee", padding: "0 12px" }}>
                        {item.error_message && (
                          <button style={tabStyle("error")} onClick={() => setActiveTab("error")}>
                            Error
                          </button>
                        )}
                        <button style={tabStyle("logs")} onClick={() => setActiveTab("logs")}>
                          Logs
                        </button>
                        <button style={tabStyle("screenshots")} onClick={() => setActiveTab("screenshots")}>
                          Screenshots
                        </button>
                        {(item.status === "FAILED" || item.status === "ERROR") && (
                          <button style={tabStyle("analysis")} onClick={() => setActiveTab("analysis")}>
                            AI Analysis
                          </button>
                        )}
                      </div>
                      <div style={{ padding: "12px 24px" }}>
                        {activeTab === "error" && item.error_message && (
                          <div style={{ backgroundColor: "#fff5f5", padding: 12, borderRadius: 4 }}>
                            <div style={{ fontWeight: 600, color: "#d32f2f", marginBottom: 4 }}>
                              Error Message:
                            </div>
                            <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 13 }}>
                              {item.error_message}
                            </pre>
                            {item.stack_trace && (
                              <>
                                <div
                                  style={{
                                    fontWeight: 600,
                                    color: "#d32f2f",
                                    marginTop: 12,
                                    marginBottom: 4,
                                  }}
                                >
                                  Stack Trace:
                                </div>
                                <pre
                                  style={{
                                    margin: 0,
                                    whiteSpace: "pre-wrap",
                                    fontSize: 12,
                                    color: "#666",
                                  }}
                                >
                                  {item.stack_trace}
                                </pre>
                              </>
                            )}
                          </div>
                        )}
                        {activeTab === "logs" && (
                          <LogViewer launchId={launch.id} itemId={item.id} />
                        )}
                        {activeTab === "screenshots" && (
                          <ScreenshotViewer launchId={launch.id} itemId={item.id} />
                        )}
                        {activeTab === "analysis" && (
                          <AnalysisPanel launchId={launch.id} itemId={item.id} />
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>

      {items.length === 0 && (
        <div style={{ textAlign: "center", padding: 40, color: "#999" }}>No test items found.</div>
      )}
    </div>
  );
};

export default LaunchDetail;

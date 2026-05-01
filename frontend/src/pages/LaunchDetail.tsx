import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getLaunch, getTestItems } from "../api/launches";
import { getItemAnalyses } from "../api/analyses";
import { Launch, TestItem, TestStatus, FailureAnalysis } from "../types";
import { StatusBadge } from "../components/StatusBadge";
import { StatsBar } from "../components/StatsBar";
import { LogViewer } from "../components/LogViewer";
import { ScreenshotViewer } from "../components/ScreenshotViewer";
import { AnalysisBadge } from "../components/AnalysisBadge";
import { LaunchAnalysisSummaryChart } from "../components/LaunchAnalysisSummary";
import { DefectSelector } from "../components/DefectSelector";
import { format } from "date-fns";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

const PIE_COLORS: Record<string, string> = {
  Passed: "#10b981",
  Failed: "#ef4444",
  Skipped: "#f59e0b",
};

type TabType = "error" | "logs" | "screenshots";

const LaunchDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [launch, setLaunch] = useState<Launch | null>(null);
  const [items, setItems] = useState<TestItem[]>([]);
  const [filter, setFilter] = useState<TestStatus | "">("");
  const [expandedItem, setExpandedItem] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("error");
  const [itemAnalyses, setItemAnalyses] = useState<Record<number, FailureAnalysis | null>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getLaunch(Number(id)).then((res) => setLaunch(res.data));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getTestItems(Number(id), filter || undefined)
      .then((res) => setItems(res.data))
      .finally(() => setLoading(false));
  }, [id, filter]);

  const loadAnalyses = () => {
    if (!id || items.length === 0) return;
    const failedItems = items.filter((i) => i.status === "FAILED" || i.status === "ERROR");
    failedItems.forEach((item) => {
      getItemAnalyses(Number(id), item.id).then((res) => {
        const latest = res.data.find((a) => !a.overridden_by) || null;
        setItemAnalyses((prev) => ({ ...prev, [item.id]: latest }));
      });
    });
  };

  useEffect(() => { loadAnalyses(); }, [id, items]);

  if (!launch) {
    return (
      <div className="loading-center">
        <div className="spinner spinner-lg" />
        <span>Loading launch...</span>
      </div>
    );
  }

  const pieData = [
    { name: "Passed", value: launch.passed },
    { name: "Failed", value: launch.failed },
    { name: "Skipped", value: launch.skipped },
  ].filter((d) => d.value > 0);

  const handleRowClick = (item: TestItem) => {
    if (expandedItem === item.id) {
      setExpandedItem(null);
    } else {
      setExpandedItem(item.id);
      setActiveTab(item.error_message ? "error" : "logs");
    }
  };

  const passRate = launch.total > 0 ? ((launch.passed / launch.total) * 100).toFixed(1) : "0";
  const isFailed = (item: TestItem) => item.status === "FAILED" || item.status === "ERROR";

  return (
    <div>
      {/* Breadcrumb */}
      <div className="page-breadcrumb">
        <Link to="/">Dashboard</Link>
        <span className="page-breadcrumb-separator">/</span>
        <Link to="/launches">Launches</Link>
        <span className="page-breadcrumb-separator">/</span>
        <span>{launch.name}</span>
      </div>

      {/* Page Header */}
      <div className="page-header">
        <div className="page-title-row">
          <div className="flex items-center gap-4">
            <h1 className="page-title">{launch.name}</h1>
            <StatusBadge status={launch.status} />
          </div>
        </div>
        {launch.description && <p className="page-subtitle">{launch.description}</p>}
      </div>

      {/* Metric Cards */}
      <div className="metric-grid">
        <div className="metric-card">
          <div className="metric-card-icon" style={{ background: "var(--color-primary-light)", color: "var(--color-primary)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </div>
          <div className="metric-card-label">Total Tests</div>
          <div className="metric-card-value">{launch.total}</div>
        </div>
        <div className="metric-card">
          <div className="metric-card-icon" style={{ background: "var(--color-passed-bg)", color: "var(--color-passed)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <div className="metric-card-label">Passed</div>
          <div className="metric-card-value passed">{launch.passed}</div>
        </div>
        <div className="metric-card">
          <div className="metric-card-icon" style={{ background: "var(--color-failed-bg)", color: "var(--color-failed)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <div className="metric-card-label">Failed</div>
          <div className="metric-card-value failed">{launch.failed}</div>
        </div>
        <div className="metric-card">
          <div className="metric-card-icon" style={{ background: Number(passRate) >= 80 ? "var(--color-passed-bg)" : "var(--color-failed-bg)", color: Number(passRate) >= 80 ? "var(--color-passed)" : "var(--color-failed)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
          </div>
          <div className="metric-card-label">Pass Rate</div>
          <div className="metric-card-value" style={{ color: Number(passRate) >= 80 ? "var(--color-passed)" : "var(--color-failed)" }}>
            {passRate}%
          </div>
        </div>
      </div>

      {/* Summary Row: Stats + Pie */}
      <div className="flex gap-6 mb-6" style={{ flexWrap: "wrap" }}>
        <div className="card" style={{ flex: "1 1 400px" }}>
          <div className="card-header">
            <h3 className="card-title">Test Distribution</h3>
          </div>
          <div className="card-body">
            <StatsBar launch={launch} />
            <div className="mt-4 flex flex-col gap-1 text-sm text-secondary">
              <div>Started: {format(new Date(launch.start_time), "MMM d, yyyy HH:mm:ss")}</div>
              {launch.end_time && (
                <div>Finished: {format(new Date(launch.end_time), "MMM d, yyyy HH:mm:ss")}</div>
              )}
              <div>Skipped: {launch.skipped}</div>
            </div>
          </div>
        </div>
        <div className="card" style={{ flex: "0 0 260px" }}>
          <div className="card-body" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ResponsiveContainer width={220} height={180}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                  innerRadius={40}
                  dataKey="value"
                  paddingAngle={2}
                  stroke="none"
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={PIE_COLORS[entry.name] || "#9e9e9e"} />
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
        </div>
      </div>

      {/* AI Analysis Summary */}
      <LaunchAnalysisSummaryChart launchId={launch.id} />

      {/* Test Results Table */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Test Results</h3>
          <select
            className="select"
            value={filter}
            onChange={(e) => setFilter(e.target.value as TestStatus | "")}
          >
            <option value="">All Statuses</option>
            <option value="PASSED">Passed</option>
            <option value="FAILED">Failed</option>
            <option value="SKIPPED">Skipped</option>
            <option value="ERROR">Error</option>
          </select>
        </div>

        {loading ? (
          <div className="loading-center">
            <div className="spinner spinner-lg" />
          </div>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">&#128269;</div>
            <div className="empty-state-title">No Test Items</div>
            <div className="empty-state-description">
              No tests match the selected filter.
            </div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Test Name</th>
                <th style={{ width: 120 }}>Suite</th>
                <th style={{ width: 100 }}>Status</th>
                <th style={{ width: 130 }}>Defect</th>
                <th style={{ width: 90 }}>Duration</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <React.Fragment key={item.id}>
                  <tr
                    className={`row-clickable ${expandedItem === item.id ? "row-expanded" : ""}`}
                    onClick={() => handleRowClick(item)}
                  >
                    <td>
                      <div className="flex items-center">
                        <span className={`row-expand-icon ${expandedItem === item.id ? "expanded" : ""}`}>
                          &#9654;
                        </span>
                        <span className="cell-name">{item.name}</span>
                      </div>
                    </td>
                    <td className="cell-secondary">{item.suite || "-"}</td>
                    <td><StatusBadge status={item.status} /></td>
                    <td>
                      {itemAnalyses[item.id] && (
                        <AnalysisBadge
                          defectType={itemAnalyses[item.id]!.defect_type}
                          confidence={itemAnalyses[item.id]!.confidence}
                        />
                      )}
                    </td>
                    <td className="cell-mono cell-secondary">
                      {item.duration_ms != null ? `${item.duration_ms}ms` : "-"}
                    </td>
                  </tr>
                  {expandedItem === item.id && (
                    <tr>
                      <td colSpan={5} style={{ padding: 0 }}>
                        <div className="animate-slide-down">
                          <div className={isFailed(item) ? "test-detail-layout" : ""}>
                            {/* Left: Error/Logs/Screenshots */}
                            <div className={isFailed(item) ? "test-detail-main" : ""}>
                              <div className="tabs">
                                {item.error_message && (
                                  <button
                                    className={`tab ${activeTab === "error" ? "active" : ""}`}
                                    onClick={() => setActiveTab("error")}
                                  >
                                    Error
                                  </button>
                                )}
                                <button
                                  className={`tab ${activeTab === "logs" ? "active" : ""}`}
                                  onClick={() => setActiveTab("logs")}
                                >
                                  Logs
                                </button>
                                <button
                                  className={`tab ${activeTab === "screenshots" ? "active" : ""}`}
                                  onClick={() => setActiveTab("screenshots")}
                                >
                                  Screenshots
                                </button>
                              </div>
                              <div className="tab-content">
                                {activeTab === "error" && item.error_message && (
                                  <div className="error-panel">
                                    <div className="error-panel-label">Error Message</div>
                                    <pre>{item.error_message}</pre>
                                    {item.stack_trace && (
                                      <div className="stack-trace">
                                        <div className="error-panel-label">Stack Trace</div>
                                        <pre>{item.stack_trace}</pre>
                                      </div>
                                    )}
                                  </div>
                                )}
                                {activeTab === "logs" && (
                                  <LogViewer launchId={launch.id} itemId={item.id} />
                                )}
                                {activeTab === "screenshots" && (
                                  <ScreenshotViewer launchId={launch.id} itemId={item.id} />
                                )}
                              </div>
                            </div>

                            {/* Right: Defect Selector (only for failed/error tests) */}
                            {isFailed(item) && (
                              <div className="test-detail-sidebar">
                                <DefectSelector
                                  launchId={launch.id}
                                  itemId={item.id}
                                  onDefectChange={() => loadAnalyses()}
                                />
                              </div>
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
        )}
      </div>
    </div>
  );
};

export default LaunchDetail;

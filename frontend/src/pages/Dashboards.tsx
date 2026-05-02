import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { getDashboards, createDashboard, deleteDashboard, addWidget, removeWidget, Dashboard } from "../api/dashboards";
import { getLaunches } from "../api/launches";
import { getMostFailed, MostFailedTest } from "../api/history";
import { Launch } from "../types";
import { formatDistanceToNow } from "date-fns";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const COLORS = {
  passed: "#10b981",
  failed: "#ef4444",
  skipped: "#f59e0b",
};

const TOOLTIP_STYLE = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  fontSize: "13px",
  boxShadow: "0 4px 6px -1px rgba(0,0,0,0.07)",
};

const WIDGET_TYPES = [
  { type: "LAUNCH_STATS_AREA", title: "Launch Statistics Area" },
  { type: "LAUNCH_STATS_BAR", title: "Launch Statistics Bar" },
  { type: "OVERALL_STATS_PANEL", title: "Overall Statistics Panel" },
  { type: "OVERALL_STATS_DONUT", title: "Overall Statistics Donut" },
  { type: "LAUNCH_DURATION", title: "Launches Duration Chart" },
  { type: "FAILED_TREND", title: "Failed Cases Trend Chart" },
  { type: "PASS_RATE_PIE", title: "Passing Rate Summary" },
  { type: "LAUNCH_TABLE", title: "Launch Table" },
  { type: "MOST_FAILED", title: "Most Failed Test Cases" },
];

const Dashboards: React.FC = () => {
  const navigate = useNavigate();
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [launches, setLaunches] = useState<Launch[]>([]);
  const [mostFailed, setMostFailed] = useState<MostFailedTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [showAddWidget, setShowAddWidget] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2000); };

  const loadAll = useCallback(() => {
    setLoading(true);
    Promise.all([
      getDashboards(),
      getLaunches(1, 50),
      getMostFailed(20),
    ])
      .then(([dashRes, launchRes, failedRes]) => {
        const items = dashRes.data.items || [];
        setDashboards(items);
        setLaunches(launchRes.data.items || []);
        setMostFailed(failedRes.data || []);
        if (items.length > 0 && !selectedId) {
          setSelectedId(items[0].id);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const selected = useMemo(() => dashboards.find(d => d.id === selectedId) || null, [dashboards, selectedId]);

  const chartData = useMemo(() =>
    [...launches].reverse().map(l => ({
      name: `#${l.id}`,
      launchName: l.name,
      passed: l.passed,
      failed: l.failed,
      skipped: l.skipped,
      total: l.total,
      passRate: l.total > 0 ? Math.round((l.passed / l.total) * 100) : 0,
      duration: l.end_time && l.start_time
        ? Math.round((new Date(l.end_time).getTime() - new Date(l.start_time).getTime()) / 1000)
        : 0,
    }))
  , [launches]);

  const totals = useMemo(() => {
    const t = { total: 0, passed: 0, failed: 0, skipped: 0 };
    launches.forEach(l => { t.total += l.total; t.passed += l.passed; t.failed += l.failed; t.skipped += l.skipped; });
    return t;
  }, [launches]);

  const handleCreate = () => {
    if (!newName.trim()) return;
    createDashboard({ name: newName.trim() })
      .then(res => {
        setCreating(false);
        setNewName("");
        setSelectedId(res.data.id);
        loadAll();
        showToast("Dashboard created");
      });
  };

  const handleDelete = () => {
    if (!selectedId) return;
    deleteDashboard(selectedId).then(() => {
      setSelectedId(null);
      loadAll();
      showToast("Dashboard deleted");
    });
  };

  const handleAddWidget = (type: string, title: string) => {
    if (!selectedId) return;
    addWidget(selectedId, { widget_type: type, title }).then(() => {
      setShowAddWidget(false);
      loadAll();
    });
  };

  const handleRemoveWidget = (widgetId: number) => {
    if (!selectedId) return;
    removeWidget(selectedId, widgetId).then(() => loadAll());
  };

  const activeWidgetTypes = selected?.widgets.map(w => w.widget_type) || [];

  const renderWidget = (type: string) => {
    switch (type) {
      case "LAUNCH_STATS_AREA":
        return (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="gPassed" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={COLORS.passed} stopOpacity={0.3} /><stop offset="95%" stopColor={COLORS.passed} stopOpacity={0} /></linearGradient>
                <linearGradient id="gFailed" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={COLORS.failed} stopOpacity={0.3} /><stop offset="95%" stopColor={COLORS.failed} stopOpacity={0} /></linearGradient>
                <linearGradient id="gSkipped" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={COLORS.skipped} stopOpacity={0.3} /><stop offset="95%" stopColor={COLORS.skipped} stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend iconType="circle" />
              <Area type="monotone" dataKey="passed" stroke={COLORS.passed} fill="url(#gPassed)" strokeWidth={2} name="Passed" />
              <Area type="monotone" dataKey="failed" stroke={COLORS.failed} fill="url(#gFailed)" strokeWidth={2} name="Failed" />
              <Area type="monotone" dataKey="skipped" stroke={COLORS.skipped} fill="url(#gSkipped)" strokeWidth={2} name="Skipped" />
            </AreaChart>
          </ResponsiveContainer>
        );
      case "LAUNCH_STATS_BAR":
        return (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend iconType="circle" />
              <Bar dataKey="passed" stackId="a" fill={COLORS.passed} name="Passed" />
              <Bar dataKey="failed" stackId="a" fill={COLORS.failed} name="Failed" />
              <Bar dataKey="skipped" stackId="a" fill={COLORS.skipped} name="Skipped" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );
      case "OVERALL_STATS_PANEL":
        return (
          <div className="dv-stats-panel">
            <div className="dv-stat-item dv-stat-total">
              <div className="dv-stat-value">{totals.total.toLocaleString()}</div>
              <div className="dv-stat-label">Total</div>
            </div>
            <div className="dv-stat-item">
              <div className="dv-stat-value" style={{ color: COLORS.passed }}>{totals.passed.toLocaleString()}</div>
              <div className="dv-stat-label"><span className="dv-stat-dot" style={{ background: COLORS.passed }} /> Passed</div>
            </div>
            <div className="dv-stat-item">
              <div className="dv-stat-value" style={{ color: COLORS.failed }}>{totals.failed.toLocaleString()}</div>
              <div className="dv-stat-label"><span className="dv-stat-dot" style={{ background: COLORS.failed }} /> Failed</div>
            </div>
            <div className="dv-stat-item">
              <div className="dv-stat-value" style={{ color: COLORS.skipped }}>{totals.skipped.toLocaleString()}</div>
              <div className="dv-stat-label"><span className="dv-stat-dot" style={{ background: COLORS.skipped }} /> Skipped</div>
            </div>
          </div>
        );
      case "OVERALL_STATS_DONUT": {
        const statusData = [
          { name: "Passed", value: totals.passed, color: COLORS.passed },
          { name: "Failed", value: totals.failed, color: COLORS.failed },
          { name: "Skipped", value: totals.skipped, color: COLORS.skipped },
        ].filter(d => d.value > 0);
        return (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={statusData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value" label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {statusData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend iconType="circle" />
            </PieChart>
          </ResponsiveContainer>
        );
      }
      case "LAUNCH_DURATION":
        return (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickFormatter={(v: any) => `${v}s`} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => [`${v}s`, "Duration"]} />
              <Line type="monotone" dataKey="duration" stroke="#1e40af" strokeWidth={2} dot={{ r: 3, fill: "#1e40af" }} />
            </LineChart>
          </ResponsiveContainer>
        );
      case "FAILED_TREND":
        return (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="gFailTrend" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={COLORS.failed} stopOpacity={0.25} /><stop offset="95%" stopColor={COLORS.failed} stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Area type="monotone" dataKey="failed" stroke={COLORS.failed} fill="url(#gFailTrend)" strokeWidth={2} name="Failed" />
            </AreaChart>
          </ResponsiveContainer>
        );
      case "PASS_RATE_PIE": {
        const passed = totals.passed;
        const notPassed = totals.total - totals.passed;
        const pieData = [
          { name: "Passed", value: passed, color: COLORS.passed },
          { name: "Not passed", value: notPassed, color: "#e2e8f0" },
        ].filter(d => d.value > 0);
        return (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={2} dataKey="value" label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend iconType="circle" />
            </PieChart>
          </ResponsiveContainer>
        );
      }
      case "LAUNCH_TABLE":
        return (
          <div style={{ maxHeight: 400, overflowY: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th style={{ width: 80 }}>Status</th>
                  <th style={{ width: 130 }}>Start time</th>
                  <th style={{ width: 60 }}>Total</th>
                  <th style={{ width: 60 }}>Pass</th>
                  <th style={{ width: 60 }}>Fail</th>
                  <th style={{ width: 60 }}>Skip</th>
                </tr>
              </thead>
              <tbody>
                {launches.slice(0, 20).map(l => (
                  <tr key={l.id} className="row-clickable" onClick={() => navigate(`/launches/${l.id}`)}>
                    <td>
                      <Link to={`/launches/${l.id}`} className="test-name" onClick={e => e.stopPropagation()}>
                        {l.name} #{l.id}
                      </Link>
                    </td>
                    <td>
                      <span className={`badge badge-${l.status.toLowerCase().replace("_", "-")}`}>
                        <span className="badge-dot" />{l.status}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                      {formatDistanceToNow(new Date(l.start_time), { addSuffix: true })}
                    </td>
                    <td style={{ fontWeight: 600 }}>{l.total}</td>
                    <td style={{ color: COLORS.passed, fontWeight: 600 }}>{l.passed}</td>
                    <td style={{ color: l.failed > 0 ? COLORS.failed : "var(--color-text-muted)", fontWeight: 600 }}>{l.failed}</td>
                    <td style={{ color: COLORS.skipped }}>{l.skipped}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      case "MOST_FAILED":
        return (
          <div style={{ maxHeight: 400, overflowY: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Test case</th>
                  <th style={{ width: 120 }}>Issues</th>
                  <th style={{ width: 100 }}>% of issues</th>
                  <th style={{ width: 120 }}>Last issue</th>
                </tr>
              </thead>
              <tbody>
                {mostFailed.map((t, i) => (
                  <tr key={i}>
                    <td style={{ fontSize: 13, fontWeight: 500 }}>{t.name}</td>
                    <td style={{ fontSize: 12 }}>
                      <span style={{ color: COLORS.failed, fontWeight: 600 }}>{t.failed_runs}</span>
                      <span style={{ color: "var(--color-text-muted)" }}> of {t.total_runs}</span>
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 40, height: 4, borderRadius: 2, background: "#e2e8f0", overflow: "hidden" }}>
                          <div style={{ width: `${Math.min(t.failure_rate, 100)}%`, height: "100%", borderRadius: 2, background: COLORS.failed }} />
                        </div>
                        <span style={{ fontSize: 12, fontFamily: "var(--font-mono)" }}>{t.failure_rate}%</span>
                      </div>
                    </td>
                    <td style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                      {t.last_failure ? formatDistanceToNow(new Date(t.last_failure), { addSuffix: true }) : "-"}
                    </td>
                  </tr>
                ))}
                {mostFailed.length === 0 && (
                  <tr><td colSpan={4} style={{ textAlign: "center", color: "var(--color-text-muted)", padding: 24 }}>No failed test cases found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        );
      default:
        return <div style={{ padding: 24, color: "var(--color-text-muted)", textAlign: "center" }}>Unknown widget type</div>;
    }
  };

  if (loading) {
    return <div className="loading-center"><div className="spinner spinner-lg" /></div>;
  }

  return (
    <div>
      {/* Toolbar: selector + actions */}
      <div className="dv-toolbar">
        <div className="dv-toolbar-left">
          <h1 className="page-title" style={{ margin: 0, fontSize: 18 }}>Dashboards</h1>
          {dashboards.length > 0 && (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
              <select
                className="select select-md"
                value={selectedId || ""}
                onChange={e => setSelectedId(Number(e.target.value))}
              >
                {dashboards.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </>
          )}
        </div>
        <div className="dv-toolbar-actions">
          {creating ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                className="input"
                placeholder="Dashboard name..."
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleCreate()}
                autoFocus
                style={{ width: 200 }}
              />
              <button className="btn btn-primary btn-sm" onClick={handleCreate} disabled={!newName.trim()}>Create</button>
              <button className="btn btn-secondary btn-sm" onClick={() => { setCreating(false); setNewName(""); }}>Cancel</button>
            </div>
          ) : (
            <>
              <button className="btn btn-secondary btn-sm" onClick={() => setCreating(true)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                New Dashboard
              </button>
              {selected && (
                <>
                  <button className="btn btn-primary btn-sm" onClick={() => setShowAddWidget(true)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                    Add widget
                  </button>
                  <button className="btn btn-ghost btn-sm" title="Delete dashboard" onClick={handleDelete} style={{ color: "var(--color-failed)" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /></svg>
                    Delete
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Add widget modal */}
      {showAddWidget && (
        <div className="dv-add-widget-overlay" onClick={() => setShowAddWidget(false)}>
          <div className="dv-add-widget-modal" onClick={e => e.stopPropagation()}>
            <div className="dv-add-widget-header">
              <h3>Add Widget</h3>
              <button className="icon-btn" onClick={() => setShowAddWidget(false)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
            <div className="dv-add-widget-list">
              {WIDGET_TYPES.map(wt => {
                const alreadyAdded = activeWidgetTypes.includes(wt.type);
                return (
                  <button
                    key={wt.type}
                    className={`dv-add-widget-item ${alreadyAdded ? "disabled" : ""}`}
                    disabled={alreadyAdded}
                    onClick={() => handleAddWidget(wt.type, wt.title)}
                  >
                    <span>{wt.title}</span>
                    {alreadyAdded && <span className="dv-add-widget-badge">Added</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {dashboards.length === 0 ? (
        <div className="empty-state" style={{ marginTop: 40 }}>
          <div className="empty-state-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" />
            </svg>
          </div>
          <div className="empty-state-title">No dashboards yet</div>
          <div style={{ color: "var(--color-text-muted)", fontSize: 13, marginTop: 4 }}>Create your first dashboard to start tracking metrics.</div>
        </div>
      ) : selected && selected.widgets.length === 0 ? (
        <div className="empty-state" style={{ marginTop: 40 }}>
          <div className="empty-state-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" />
            </svg>
          </div>
          <div className="empty-state-title">No widgets yet</div>
          <div style={{ color: "var(--color-text-muted)", fontSize: 13, marginTop: 4 }}>Click "Add widget" to start building your dashboard.</div>
        </div>
      ) : selected ? (
        <div className="dv-widget-grid">
          {selected.widgets.map(w => (
            <div key={w.id} className={`dv-widget ${w.widget_type === "LAUNCH_TABLE" || w.widget_type === "MOST_FAILED" ? "dv-widget-full" : ""}`}>
              <div className="dv-widget-header">
                <h4 className="dv-widget-title">{w.title}</h4>
                <button className="icon-btn" title="Remove widget" onClick={() => handleRemoveWidget(w.id)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              </div>
              <div className="dv-widget-body">
                {renderWidget(w.widget_type)}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {toast && (
        <div className="profile-toast">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          {toast}
        </div>
      )}
    </div>
  );
};

export default Dashboards;

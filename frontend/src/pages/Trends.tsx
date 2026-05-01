import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { getLaunches } from "../api/launches";
import { Launch } from "../types";
import { format } from "date-fns";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const STATUS_EMOJI: Record<string, string> = {
  PASSED: "✅", FAILED: "❌", IN_PROGRESS: "🔄", STOPPED: "⏹",
};

const TOOLTIP_STYLE = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  fontSize: "13px",
  boxShadow: "0 4px 6px -1px rgba(0,0,0,0.07)",
};

const Trends: React.FC = () => {
  const [launches, setLaunches] = useState<Launch[]>([]);
  const [loading, setLoading] = useState(true);
  const [nameFilter, setNameFilter] = useState("");
  const [limit, setLimit] = useState(20);

  useEffect(() => {
    setLoading(true);
    getLaunches(1, 100)
      .then(res => setLaunches(res.data.items || []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let list = launches;
    if (nameFilter) {
      const q = nameFilter.toLowerCase();
      list = list.filter(l => l.name.toLowerCase().includes(q));
    }
    return list.slice(0, limit);
  }, [launches, nameFilter, limit]);

  const chartData = useMemo(() =>
    [...filtered].reverse().map(l => ({
      name: `#${l.id}`,
      launchName: l.name,
      passRate: l.total > 0 ? Math.round((l.passed / l.total) * 100) : 0,
      passed: l.passed,
      failed: l.failed,
      skipped: l.skipped,
      total: l.total,
      duration: l.end_time && l.start_time
        ? Math.round((new Date(l.end_time).getTime() - new Date(l.start_time).getTime()) / 1000)
        : 0,
    }))
  , [filtered]);

  const avgPassRate = chartData.length > 0
    ? Math.round(chartData.reduce((s, d) => s + d.passRate, 0) / chartData.length)
    : 0;
  const totalTests = filtered.reduce((s, l) => s + l.total, 0);
  const totalFailed = filtered.reduce((s, l) => s + l.failed, 0);

  if (loading) {
    return <div className="loading-center"><div className="spinner spinner-lg" /></div>;
  }

  return (
    <div>
      <h1 className="page-title" style={{ margin: "0 0 4px" }}>Launch Trends</h1>
      <div style={{ color: "var(--color-text-muted)", fontSize: 13, marginBottom: 20 }}>
        Pass rate, test counts, and duration trends across launches.
      </div>

      {/* Filters */}
      <div className="filter-bar" style={{ marginBottom: 20 }}>
        <div className="search-input-wrap">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input className="input search-input" placeholder="Filter by launch name..." value={nameFilter} onChange={e => setNameFilter(e.target.value)} />
        </div>
        <select className="select select-md" value={limit} onChange={e => setLimit(Number(e.target.value))}>
          <option value={10}>Last 10</option>
          <option value={20}>Last 20</option>
          <option value={50}>Last 50</option>
          <option value={100}>All</option>
        </select>
      </div>

      {/* Summary metrics */}
      <div className="metric-grid" style={{ marginBottom: 24 }}>
        <div className="metric-card">
          <div className="metric-label">Avg Pass Rate</div>
          <div className="metric-value" style={{ color: avgPassRate >= 80 ? "var(--color-passed)" : avgPassRate >= 50 ? "var(--color-skipped)" : "var(--color-failed)" }}>
            {avgPassRate}%
          </div>
          <div className="metric-sub">across {chartData.length} launches</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Total Tests Run</div>
          <div className="metric-value">{totalTests.toLocaleString()}</div>
          <div className="metric-sub">{filtered.length} launches</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Total Failures</div>
          <div className="metric-value" style={{ color: "var(--color-failed)" }}>{totalFailed.toLocaleString()}</div>
          <div className="metric-sub">{totalTests > 0 ? Math.round((totalFailed / totalTests) * 100) : 0}% failure rate</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Launches</div>
          <div className="metric-value">{filtered.length}</div>
          <div className="metric-sub">of {launches.length} total</div>
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="empty-state"><div className="empty-state-title">No launches match your filter</div></div>
      ) : (
        <>
          {/* Pass Rate Trend */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header">
              <h3 className="card-title">Pass Rate Trend</h3>
            </div>
            <div className="card-body" style={{ padding: "0 16px 16px" }}>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="passGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fill: "#64748b", fontSize: 11 }} tickFormatter={v => `${v}%`} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => [`${v}%`, "Pass Rate"]} />
                  <Area type="monotone" dataKey="passRate" stroke="#10b981" strokeWidth={2} fill="url(#passGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Test Results Stacked Bar */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header">
              <h3 className="card-title">Test Results Distribution</h3>
            </div>
            <div className="card-body" style={{ padding: "0 16px 16px" }}>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend iconType="circle" />
                  <Bar dataKey="passed" stackId="a" fill="#10b981" name="Passed" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="failed" stackId="a" fill="#ef4444" name="Failed" />
                  <Bar dataKey="skipped" stackId="a" fill="#f59e0b" name="Skipped" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Duration Trend */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header">
              <h3 className="card-title">Launch Duration Trend</h3>
            </div>
            <div className="card-body" style={{ padding: "0 16px 16px" }}>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickFormatter={v => `${v}s`} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => [`${v}s`, "Duration"]} />
                  <Line type="monotone" dataKey="duration" stroke="#6366f1" strokeWidth={2} dot={{ r: 3, fill: "#6366f1" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Launch History Table */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Launch History</h3>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 60 }}>ID</th>
                  <th>Name</th>
                  <th style={{ width: 80 }}>Status</th>
                  <th style={{ width: 70 }}>Pass</th>
                  <th style={{ width: 70 }}>Fail</th>
                  <th style={{ width: 70 }}>Skip</th>
                  <th style={{ width: 90 }}>Pass Rate</th>
                  <th style={{ width: 150 }}>Started</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(l => {
                  const rate = l.total > 0 ? Math.round((l.passed / l.total) * 100) : 0;
                  return (
                    <tr key={l.id} className="row-clickable">
                      <td>
                        <Link to={`/launches/${l.id}`} className="test-name">#{l.id}</Link>
                      </td>
                      <td>
                        <Link to={`/launches/${l.id}`} style={{ textDecoration: "none", color: "var(--color-text)", fontWeight: 500 }}>{l.name}</Link>
                      </td>
                      <td>
                        <span className={`badge badge-${l.status.toLowerCase().replace("_", "-")}`}>
                          <span className="badge-dot" />
                          {l.status}
                        </span>
                      </td>
                      <td style={{ color: "var(--color-passed)", fontWeight: 600 }}>{l.passed}</td>
                      <td style={{ color: l.failed > 0 ? "var(--color-failed)" : "var(--color-text-muted)", fontWeight: 600 }}>{l.failed}</td>
                      <td style={{ color: "var(--color-skipped)" }}>{l.skipped}</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ width: 40, height: 4, borderRadius: 2, background: "#e2e8f0", overflow: "hidden" }}>
                            <div style={{ width: `${rate}%`, height: "100%", borderRadius: 2, background: rate >= 80 ? "#10b981" : rate >= 50 ? "#f59e0b" : "#ef4444" }} />
                          </div>
                          <span style={{ fontSize: 12, fontFamily: "var(--font-mono)" }}>{rate}%</span>
                        </div>
                      </td>
                      <td style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                        {format(new Date(l.start_time), "MMM d, HH:mm")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default Trends;

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getLaunches } from "../api/launches";
import { Launch } from "../types";
import { StatusBadge } from "../components/StatusBadge";
import { StatsBar } from "../components/StatsBar";
import { format } from "date-fns";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const Dashboard: React.FC = () => {
  const [launches, setLaunches] = useState<Launch[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLaunches(1, 20)
      .then((res) => {
        setLaunches(res.data.items);
        setTotal(res.data.total);
      })
      .finally(() => setLoading(false));
  }, []);

  const totalTests = launches.reduce((s, l) => s + l.total, 0);
  const totalPassed = launches.reduce((s, l) => s + l.passed, 0);
  const totalFailed = launches.reduce((s, l) => s + l.failed, 0);
  const totalSkipped = launches.reduce((s, l) => s + l.skipped, 0);
  const overallPassRate = totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(1) : "0";

  // Chart data — reversed so oldest is first
  const chartData = [...launches]
    .reverse()
    .map((l) => ({
      name: `#${l.id}`,
      passRate: l.total > 0 ? Math.round((l.passed / l.total) * 100) : 0,
      passed: l.passed,
      failed: l.failed,
      skipped: l.skipped,
    }));

  if (loading) {
    return (
      <div className="loading-center">
        <div className="spinner spinner-lg" />
        <span>Loading dashboard...</span>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-title-row">
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-subtitle">Overview of your test automation</p>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="metric-grid">
        <div className="metric-card">
          <div className="metric-card-icon" style={{ background: "var(--color-primary-light)", color: "var(--color-primary)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
              <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
              <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
              <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
            </svg>
          </div>
          <div className="metric-card-label">Total Launches</div>
          <div className="metric-card-value">{total}</div>
        </div>
        <div className="metric-card">
          <div className="metric-card-icon" style={{ background: "var(--color-passed-bg)", color: "var(--color-passed)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <div className="metric-card-label">Pass Rate</div>
          <div className="metric-card-value" style={{ color: Number(overallPassRate) >= 80 ? "var(--color-passed)" : "var(--color-failed)" }}>
            {overallPassRate}%
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-card-icon" style={{ background: "var(--color-failed-bg)", color: "var(--color-failed)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <div className="metric-card-label">Failed Tests</div>
          <div className="metric-card-value failed">{totalFailed}</div>
        </div>
        <div className="metric-card">
          <div className="metric-card-icon" style={{ background: "var(--color-skipped-bg)", color: "var(--color-skipped)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div className="metric-card-label">Total Tests</div>
          <div className="metric-card-value">{totalTests}</div>
        </div>
      </div>

      {/* Charts Row */}
      {chartData.length > 1 && (
        <div className="chart-grid">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Pass Rate Trend</h3>
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="passRateGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748b" }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "#64748b" }} tickFormatter={(v) => `${v}%`} />
                  <Tooltip
                    contentStyle={{
                      background: "#fff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      fontSize: "13px",
                      boxShadow: "0 4px 6px -1px rgba(0,0,0,0.07)",
                    }}
                    formatter={(value: any) => [`${value}%`, "Pass Rate"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="passRate"
                    stroke="#10b981"
                    strokeWidth={2}
                    fill="url(#passRateGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Test Results by Launch</h3>
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748b" }} />
                  <YAxis tick={{ fontSize: 12, fill: "#64748b" }} />
                  <Tooltip
                    contentStyle={{
                      background: "#fff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      fontSize: "13px",
                      boxShadow: "0 4px 6px -1px rgba(0,0,0,0.07)",
                    }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: "12px" }} />
                  <Bar dataKey="passed" stackId="a" fill="#10b981" name="Passed" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="failed" stackId="a" fill="#ef4444" name="Failed" />
                  <Bar dataKey="skipped" stackId="a" fill="#f59e0b" name="Skipped" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Recent Launches Table */}
      <div className="card mt-6">
        <div className="card-header">
          <h3 className="card-title">Recent Launches</h3>
          <Link to="/launches" className="btn btn-secondary btn-sm">View All</Link>
        </div>
        {launches.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">&#128640;</div>
            <div className="empty-state-title">No Launches Yet</div>
            <div className="empty-state-description">
              Run your test suite with the pytest plugin to see launches here.
            </div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 60 }}>#</th>
                <th>Name</th>
                <th style={{ width: 110 }}>Status</th>
                <th style={{ width: 160 }}>Started</th>
                <th style={{ width: 220 }}>Results</th>
                <th style={{ width: 100 }}>Pass Rate</th>
              </tr>
            </thead>
            <tbody>
              {launches.slice(0, 8).map((launch) => {
                const rate = launch.total > 0 ? ((launch.passed / launch.total) * 100).toFixed(1) : "0";
                return (
                  <tr key={launch.id} className="row-clickable">
                    <td className="cell-secondary">{launch.id}</td>
                    <td className="cell-name">
                      <Link to={`/launches/${launch.id}`}>{launch.name}</Link>
                    </td>
                    <td>
                      <StatusBadge status={launch.status} />
                    </td>
                    <td className="cell-secondary">
                      {format(new Date(launch.start_time), "MMM d, yyyy HH:mm")}
                    </td>
                    <td>
                      <StatsBar launch={launch} showLegend={false} />
                    </td>
                    <td>
                      <span className="cell-mono font-semibold" style={{ color: Number(rate) >= 80 ? "var(--color-passed)" : "var(--color-failed)" }}>
                        {rate}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Dashboard;

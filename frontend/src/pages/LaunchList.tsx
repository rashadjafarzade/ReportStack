import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getLaunches } from "../api/launches";
import { Launch } from "../types";
import { StatusBadge } from "../components/StatusBadge";
import { StatsBar } from "../components/StatsBar";
import { format } from "date-fns";

const LaunchList: React.FC = () => {
  const [launches, setLaunches] = useState<Launch[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const pageSize = 20;

  useEffect(() => {
    setLoading(true);
    getLaunches(page, pageSize)
      .then((res) => {
        setLaunches(res.data.items);
        setTotal(res.data.total);
      })
      .finally(() => setLoading(false));
  }, [page]);

  // Poll when any launch is IN_PROGRESS
  const hasInProgress = launches.some(l => l.status === "IN_PROGRESS");
  useEffect(() => {
    if (!hasInProgress) return;
    const interval = setInterval(() => {
      getLaunches(page, pageSize).then(res => {
        setLaunches(res.data.items);
        setTotal(res.data.total);
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [hasInProgress, page]);

  const totalPages = Math.ceil(total / pageSize);

  // Aggregate stats
  const totalTests = launches.reduce((s, l) => s + l.total, 0);
  const totalPassed = launches.reduce((s, l) => s + l.passed, 0);
  const totalFailed = launches.reduce((s, l) => s + l.failed, 0);

  return (
    <div>
      <div className="page-header">
        <div className="page-title-row">
          <div>
            <h1 className="page-title">Launches</h1>
            <p className="page-subtitle">
              {total} launch{total !== 1 ? "es" : ""} recorded
            </p>
          </div>
        </div>
      </div>

      <div className="metric-grid">
        <div className="metric-card">
          <div className="metric-card-label">Total Launches</div>
          <div className="metric-card-value">{total}</div>
        </div>
        <div className="metric-card">
          <div className="metric-card-label">Total Tests</div>
          <div className="metric-card-value">{totalTests}</div>
        </div>
        <div className="metric-card">
          <div className="metric-card-label">Passed</div>
          <div className="metric-card-value passed">{totalPassed}</div>
        </div>
        <div className="metric-card">
          <div className="metric-card-label">Failed</div>
          <div className="metric-card-value failed">{totalFailed}</div>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="loading-center">
            <div className="spinner spinner-lg" />
            <span>Loading launches...</span>
          </div>
        ) : launches.length === 0 ? (
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
                <th style={{ width: 80 }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {launches.map((launch) => (
                <tr key={launch.id} className="row-clickable">
                  <td className="cell-secondary">{launch.id}</td>
                  <td className="cell-name">
                    <Link to={`/launches/${launch.id}`}>{launch.name}</Link>
                    {launch.tags && launch.tags.length > 0 && (
                      <div className="launch-tags">
                        {launch.tags.map(tag => (
                          <span key={tag} className="launch-tag">{tag}</span>
                        ))}
                      </div>
                    )}
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
                  <td className="cell-mono font-semibold">{launch.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button
            className="btn btn-secondary btn-sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </button>
          <span className="pagination-info">
            Page {page} of {totalPages}
          </span>
          <button
            className="btn btn-secondary btn-sm"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default LaunchList;

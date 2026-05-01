import React, { useEffect, useState, useCallback } from "react";
import { getDashboards, createDashboard, deleteDashboard, Dashboard } from "../api/dashboards";
import { format } from "date-fns";

const WIDGET_TYPE_LABELS: Record<string, string> = {
  LAUNCH_STATS: "Launch Stats",
  PASS_RATE_TREND: "Pass Rate Trend",
  DEFECT_BREAKDOWN: "Defect Breakdown",
  DURATION_TREND: "Duration Trend",
  FAILURE_TABLE: "Failure Table",
  SUITE_BREAKDOWN: "Suite Breakdown",
};

const Dashboards: React.FC = () => {
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    getDashboards()
      .then(res => setDashboards(res.data.items))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2000); };

  const handleCreate = () => {
    if (!newName.trim()) return;
    createDashboard({ name: newName.trim(), description: newDesc.trim() || undefined })
      .then(() => { setCreating(false); setNewName(""); setNewDesc(""); load(); showToast("Dashboard created"); });
  };

  const handleDelete = (id: number) => {
    deleteDashboard(id).then(() => { load(); showToast("Dashboard deleted"); });
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 className="page-title" style={{ margin: "0 0 4px" }}>Dashboards</h1>
          <div style={{ color: "var(--color-text-muted)", fontSize: 13 }}>Create and manage custom dashboards with widgets.</div>
        </div>
        {!creating && (
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            New Dashboard
          </button>
        )}
      </div>

      {creating && (
        <div className="card" style={{ marginBottom: 20, padding: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Dashboard name</label>
              <input className="input" placeholder="e.g. Sprint 42 Overview" value={newName} onChange={e => setNewName(e.target.value)} autoFocus style={{ width: "100%" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Description (optional)</label>
              <input className="input" placeholder="What is this dashboard for?" value={newDesc} onChange={e => setNewDesc(e.target.value)} style={{ width: "100%" }} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-primary" onClick={handleCreate} disabled={!newName.trim()}>Create</button>
              <button className="btn btn-secondary" onClick={() => { setCreating(false); setNewName(""); setNewDesc(""); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading-center"><div className="spinner spinner-lg" /></div>
      ) : dashboards.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
            </svg>
          </div>
          <div className="empty-state-title">No dashboards yet</div>
          <div style={{ color: "var(--color-text-muted)", fontSize: 13, marginTop: 4 }}>Create your first dashboard to start tracking metrics.</div>
        </div>
      ) : (
        <div className="dashboard-grid">
          {dashboards.map(d => (
            <div key={d.id} className="dashboard-card">
              <div className="dashboard-card-header">
                <div className="dashboard-card-title">{d.name}</div>
                <button className="icon-btn danger" title="Delete" onClick={() => handleDelete(d.id)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /></svg>
                </button>
              </div>
              {d.description && <div className="dashboard-card-desc">{d.description}</div>}
              <div className="dashboard-card-meta">
                <span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                  {d.owner}
                </span>
                <span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                  {format(new Date(d.created_at), "MMM d, yyyy")}
                </span>
                <span>{d.widgets.length} widget{d.widgets.length !== 1 ? "s" : ""}</span>
              </div>
              {d.widgets.length > 0 && (
                <div className="dashboard-card-widgets">
                  {d.widgets.map(w => (
                    <span key={w.id} className="dashboard-widget-tag">{WIDGET_TYPE_LABELS[w.widget_type] || w.title}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

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

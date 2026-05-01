import React, { useEffect, useState } from "react";
import { getItemDefects, createItemDefect, updateDefect, deleteDefect } from "../api/defects";
import { Defect, DefectStatus } from "../types";
import { format } from "date-fns";

interface DefectPanelProps {
  launchId: number;
  itemId: number;
}

const STATUS_COLORS: Record<DefectStatus, string> = {
  OPEN: "var(--color-failed)",
  IN_PROGRESS: "var(--color-in-progress)",
  FIXED: "var(--color-passed)",
  WONT_FIX: "var(--color-text-muted)",
  DUPLICATE: "var(--color-skipped)",
};

export const DefectPanel: React.FC<DefectPanelProps> = ({ launchId, itemId }) => {
  const [defects, setDefects] = useState<Defect[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [externalId, setExternalId] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadDefects = () => {
    setLoading(true);
    getItemDefects(launchId, itemId)
      .then((res) => setDefects(res.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadDefects();
  }, [launchId, itemId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!summary.trim()) return;
    setSubmitting(true);
    createItemDefect(launchId, itemId, {
      summary: summary.trim(),
      description: description.trim() || undefined,
      external_id: externalId.trim() || undefined,
      external_url: externalUrl.trim() || undefined,
    })
      .then(() => {
        setSummary("");
        setDescription("");
        setExternalId("");
        setExternalUrl("");
        setShowForm(false);
        loadDefects();
      })
      .finally(() => setSubmitting(false));
  };

  const handleStatusChange = (defectId: number, status: DefectStatus) => {
    updateDefect(defectId, { status }).then(() => loadDefects());
  };

  const handleDeleteDefect = (defectId: number) => {
    deleteDefect(defectId).then(() => loadDefects());
  };

  return (
    <div className="defect-panel">
      <div className="defect-toolbar">
        <span className="text-sm text-secondary">{defects.length} defect{defects.length !== 1 ? "s" : ""}</span>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ Link Defect"}
        </button>
      </div>

      {showForm && (
        <form className="defect-form" onSubmit={handleSubmit}>
          <input
            className="input"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Defect summary *"
          />
          <textarea
            className="input comment-textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            rows={2}
          />
          <div className="defect-form-row">
            <input
              className="input"
              value={externalId}
              onChange={(e) => setExternalId(e.target.value)}
              placeholder="Ticket ID (e.g. JIRA-123)"
            />
            <input
              className="input"
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
              placeholder="Ticket URL"
            />
          </div>
          <button className="btn btn-primary btn-sm" type="submit" disabled={submitting || !summary.trim()}>
            {submitting ? "Creating..." : "Create Defect"}
          </button>
        </form>
      )}

      {loading ? (
        <div className="loading-center" style={{ padding: "var(--space-6)" }}>
          <div className="spinner" />
        </div>
      ) : defects.length === 0 && !showForm ? (
        <div className="comment-empty">No defects linked to this test</div>
      ) : (
        <div className="defect-list">
          {defects.map((d) => (
            <div key={d.id} className="defect-item">
              <div className="defect-item-header">
                <div className="flex items-center gap-2">
                  <span
                    className="defect-status-dot"
                    style={{ background: STATUS_COLORS[d.status] }}
                  />
                  <span className="defect-summary">{d.summary}</span>
                  {d.external_id && (
                    d.external_url ? (
                      <a
                        href={d.external_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="defect-ticket"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {d.external_id}
                      </a>
                    ) : (
                      <span className="defect-ticket">{d.external_id}</span>
                    )
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <select
                    className="select defect-status-select"
                    value={d.status}
                    onChange={(e) => handleStatusChange(d.id, e.target.value as DefectStatus)}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <option value="OPEN">Open</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="FIXED">Fixed</option>
                    <option value="WONT_FIX">Won't Fix</option>
                    <option value="DUPLICATE">Duplicate</option>
                  </select>
                  <button
                    className="btn btn-ghost btn-sm comment-delete"
                    onClick={() => handleDeleteDefect(d.id)}
                    title="Delete"
                  >
                    &times;
                  </button>
                </div>
              </div>
              {d.description && <div className="defect-description">{d.description}</div>}
              <div className="defect-meta">
                {format(new Date(d.created_at), "MMM d, yyyy HH:mm")}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

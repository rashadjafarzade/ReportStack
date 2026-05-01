import React, { useEffect, useState, useRef } from "react";
import { getItemAnalyses, overrideAnalysis } from "../api/analyses";
import { getItemDefects, createItemDefect, deleteDefect } from "../api/defects";
import { getItemComments, createItemComment, deleteComment } from "../api/comments";
import { FailureAnalysis, DefectType, Defect, Comment } from "../types";
import { format } from "date-fns";

const DEFECT_TYPES: { value: DefectType; label: string; color: string }[] = [
  { value: "PRODUCT_BUG", label: "Product Bug", color: "#ec3900" },
  { value: "AUTOMATION_BUG", label: "Automation Bug", color: "#f7d63e" },
  { value: "SYSTEM_ISSUE", label: "System Issue", color: "#0274d1" },
  { value: "NO_DEFECT", label: "No Defect", color: "#1dc9a0" },
  { value: "TO_INVESTIGATE", label: "To Investigate", color: "#6c757d" },
];

interface DefectSelectorProps {
  launchId: number;
  itemId: number;
  onDefectChange?: (defectType: DefectType | null) => void;
}

export const DefectSelector: React.FC<DefectSelectorProps> = ({ launchId, itemId, onDefectChange }) => {
  const [analyses, setAnalyses] = useState<FailureAnalysis[]>([]);
  const [selectedType, setSelectedType] = useState<DefectType | null>(null);
  const [defects, setDefects] = useState<Defect[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [linkMode, setLinkMode] = useState(false);
  const [ticketId, setTicketId] = useState("");
  const [ticketUrl, setTicketUrl] = useState("");

  const loadAll = () => {
    setLoading(true);
    Promise.all([
      getItemAnalyses(launchId, itemId).then((r) => r.data),
      getItemDefects(launchId, itemId).then((r) => r.data),
      getItemComments(launchId, itemId).then((r) => r.data),
    ])
      .then(([a, d, c]) => {
        setAnalyses(a);
        setDefects(d);
        setComments(c);
        const latest = a.find((x: FailureAnalysis) => !x.overridden_by);
        if (latest) setSelectedType(latest.defect_type);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadAll(); }, [launchId, itemId]);

  const latest = analyses.find((a) => !a.overridden_by);
  const suggestions = analyses
    .filter((a) => !a.overridden_by && a.source === "AI_AUTO")
    .sort((a, b) => b.confidence - a.confidence);

  const handleApply = async () => {
    if (!selectedType) return;
    setSubmitting(true);

    if (latest && selectedType !== latest.defect_type) {
      await overrideAnalysis(launchId, itemId, latest.id, {
        defect_type: selectedType,
        reasoning: "Manual classification",
      });
    }

    if (commentText.trim()) {
      await createItemComment(launchId, itemId, {
        author: "QA Engineer",
        text: commentText.trim(),
      });
    }

    setCommentText("");
    onDefectChange?.(selectedType);
    loadAll();
    setSubmitting(false);
  };

  const handleLinkIssue = async () => {
    if (!ticketId.trim()) return;
    setSubmitting(true);
    const defectType = DEFECT_TYPES.find((d) => d.value === selectedType);
    await createItemDefect(launchId, itemId, {
      summary: defectType ? defectType.label : "Linked Issue",
      external_id: ticketId.trim(),
      external_url: ticketUrl.trim() || undefined,
    });
    setTicketId("");
    setTicketUrl("");
    setLinkMode(false);
    loadAll();
    setSubmitting(false);
  };

  const handleDeleteDefect = (id: number) => {
    deleteDefect(id).then(() => loadAll());
  };

  const handleDeleteComment = (id: number) => {
    deleteComment(id).then(() => loadAll());
  };

  if (loading) {
    return (
      <div className="loading-center" style={{ padding: "var(--space-4)" }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="defect-selector">
      {/* Defect Type Selection */}
      <div className="defect-selector-section">
        <div className="defect-selector-label">Select defect</div>
        <div className="defect-type-list">
          {DEFECT_TYPES.map((dt) => (
            <button
              key={dt.value}
              className={`defect-type-option ${selectedType === dt.value ? "selected" : ""}`}
              onClick={() => setSelectedType(dt.value)}
            >
              <span className="defect-type-dot" style={{ background: dt.color }} />
              <span className="defect-type-name">{dt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* AI Analyzer Suggestions */}
      {suggestions.length > 0 && (
        <div className="defect-selector-section">
          <div className="defect-selector-label">Analyzer Suggestions</div>
          <div className="analyzer-suggestions">
            {suggestions.map((s) => {
              const pct = Math.round(s.confidence * 100);
              const dt = DEFECT_TYPES.find((d) => d.value === s.defect_type);
              return (
                <button
                  key={s.id}
                  className={`analyzer-suggestion ${selectedType === s.defect_type ? "selected" : ""}`}
                  onClick={() => setSelectedType(s.defect_type)}
                >
                  <span className="defect-type-dot" style={{ background: dt?.color || "#6c757d" }} />
                  <span className="analyzer-suggestion-label">{dt?.label}</span>
                  <span className="analyzer-suggestion-confidence">{pct}%</span>
                  <span className="analyzer-suggestion-tag">Analyzer Suggestion</span>
                </button>
              );
            })}
          </div>
          {latest?.reasoning && (
            <div className="analyzer-reasoning">
              <span className="analyzer-reasoning-label">AI Reasoning:</span> {latest.reasoning}
            </div>
          )}
        </div>
      )}

      {/* Linked Issues */}
      {defects.length > 0 && (
        <div className="defect-selector-section">
          <div className="defect-selector-label">Linked Issues</div>
          <div className="linked-issues">
            {defects.map((d) => (
              <div key={d.id} className="linked-issue">
                <div className="flex items-center gap-2">
                  {d.external_url ? (
                    <a href={d.external_url} target="_blank" rel="noopener noreferrer" className="linked-issue-id">
                      {d.external_id || d.summary}
                    </a>
                  ) : (
                    <span className="linked-issue-id">{d.external_id || d.summary}</span>
                  )}
                  {d.description && <span className="text-sm text-secondary">{d.description}</span>}
                </div>
                <button className="btn btn-ghost btn-sm comment-delete" onClick={() => handleDeleteDefect(d.id)}>&times;</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comment Input */}
      <div className="defect-selector-section">
        <div className="defect-selector-label">Comment</div>
        <textarea
          className="input comment-textarea"
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder="Add a comment..."
          rows={2}
        />
      </div>

      {/* Previous Comments */}
      {comments.length > 0 && (
        <div className="defect-selector-section">
          <div className="comment-list-compact">
            {comments.map((c) => (
              <div key={c.id} className="comment-compact">
                <div className="flex items-center gap-2">
                  <span className="comment-avatar-sm">{c.author.charAt(0).toUpperCase()}</span>
                  <span className="comment-author-sm">{c.author}</span>
                  <span className="comment-time">{format(new Date(c.created_at), "MMM d HH:mm")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="comment-text-sm">{c.text}</span>
                  <button className="btn btn-ghost btn-sm comment-delete" onClick={() => handleDeleteComment(c.id)}>&times;</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Link Issue Form */}
      {linkMode && (
        <div className="defect-selector-section link-issue-form">
          <div className="defect-form-row">
            <input
              className="input"
              value={ticketId}
              onChange={(e) => setTicketId(e.target.value)}
              placeholder="Ticket ID (e.g. JIRA-123)"
            />
            <input
              className="input"
              value={ticketUrl}
              onChange={(e) => setTicketUrl(e.target.value)}
              placeholder="URL (optional)"
            />
            <button className="btn btn-primary btn-sm" onClick={handleLinkIssue} disabled={!ticketId.trim()}>
              Link
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setLinkMode(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="defect-selector-actions">
        <div className="flex gap-2">
          <button className="btn btn-ghost btn-sm" onClick={() => setLinkMode(!linkMode)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            Link Issue
          </button>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-primary btn-sm" onClick={handleApply} disabled={submitting}>
            {submitting ? "Applying..." : "Apply"}
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { getLaunch, getTestItems } from "../api/launches";
import { getTestLogs } from "../api/logs";
import { getTestAttachments, getAttachmentUrl } from "../api/attachments";
import { getItemAnalyses, overrideAnalysis } from "../api/analyses";
import { getItemDefects } from "../api/defects";
import { Launch, TestItem, TestLog, Attachment, FailureAnalysis, Defect, DefectType } from "../types";
import HistoryStrip from "../components/HistoryStrip";
import { format } from "date-fns";

const DEFECT_TYPES: { value: DefectType; label: string; color: string }[] = [
  { value: "PRODUCT_BUG", label: "Product Bug", color: "#ef4444" },
  { value: "AUTOMATION_BUG", label: "Automation Bug", color: "#f59e0b" },
  { value: "SYSTEM_ISSUE", label: "System Issue", color: "#3b82f6" },
  { value: "NO_DEFECT", label: "No Defect", color: "#22c55e" },
  { value: "TO_INVESTIGATE", label: "To Investigate", color: "#6b7280" },
];

const LEVEL_COLORS: Record<string, string> = {
  ERROR: "#ef4444", WARN: "#f59e0b", INFO: "#3b82f6", DEBUG: "#8b5cf6", TRACE: "#94a3b8",
};

function fmtDuration(ms: number | null): string {
  if (ms == null || ms === 0) return "—";
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(2)}s`;
  const m = Math.floor(s / 60);
  const sec = Math.round(s - m * 60);
  return `${m}m ${sec}s`;
}

const StackTraceBlock: React.FC<{ text: string | null }> = ({ text }) => {
  if (!text) return <div style={{ padding: 24, textAlign: "center", color: "var(--color-text-muted)" }}>No stack trace recorded.</div>;
  const lines = text.split("\n").map((l, i) => {
    let cls = "";
    if (/^\s*at\s/.test(l)) cls = "sf-method";
    else if (/Error|Exception/.test(l) && !/^\s*at/.test(l)) cls = "sf-error";
    else if (/\.(java|py|ts|js):\d+/.test(l)) cls = "sf-file";
    return <div key={i} className={cls}>{l || "\u00a0"}</div>;
  });
  return <div className="rp-stack-block">{lines}</div>;
};

const MakeDecisionModal: React.FC<{
  test: TestItem;
  analyses: FailureAnalysis[];
  defects: Defect[];
  onClose: () => void;
  onApply: (type: DefectType, comment: string) => void;
}> = ({ test, analyses, defects, onClose, onApply }) => {
  const initialType = analyses[0]?.defect_type || "TO_INVESTIGATE";
  const [mode, setMode] = useState("manual");
  const [selectedType, setSelectedType] = useState<DefectType>(initialType as DefectType);
  const [comment, setComment] = useState("");
  const [ignoreAA, setIgnoreAA] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const aiSuggestions = analyses.filter(a => a.source === "AI_AUTO" && !a.overridden_by);

  return (
    <div className="rp-modal-overlay" onClick={onClose}>
      <div className="rp-modal" onClick={e => e.stopPropagation()}>
        <div className="rp-modal-head">
          <span style={{ fontSize: 14, color: "var(--color-text-muted)", fontWeight: 500 }}>Apply for:</span>
          <span className="rp-modal-title">{test.name}</span>
          <span className="rp-modal-subtitle">{test.suite} &middot; #{test.id}</span>
          <button className="rp-modal-close" onClick={onClose}>
            <kbd>Esc</kbd>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        <div className="rp-modal-body">
          <div className="rp-modal-pane">
            <div className="rp-mode-tabs">
              <button className={`rp-mode-tab ${mode === "manual" ? "active" : ""}`} onClick={() => setMode("manual")}>Manual</button>
              {aiSuggestions.map(s => {
                const id = `ai-${s.id}`;
                const dt = DEFECT_TYPES.find(d => d.value === s.defect_type);
                return (
                  <button key={id} className={`rp-mode-tab ${mode === id ? "active" : ""}`}
                    onClick={() => { setMode(id); setSelectedType(s.defect_type); }} title={s.reasoning || ""}>
                    <span className="rp-mode-tab-pct">{Math.round(s.confidence * 100)}%</span>
                    <span style={{ opacity: 0.85 }}>{dt?.label || "Analyzer"}</span>
                  </button>
                );
              })}
            </div>
            <div className="rp-modal-section-label">Select defect type</div>
            <div className="rp-defect-grid">
              <button className="rp-defect-pick" onClick={() => setIgnoreAA(v => !v)}
                style={{ background: ignoreAA ? "rgba(99,102,241,0.06)" : undefined, borderColor: ignoreAA ? "var(--color-primary)" : undefined }}>
                <span className="rp-defect-pick-dot" style={{ background: "transparent", border: "2px solid var(--color-text-muted)" }} />
                <span className="rp-defect-pick-flex">Ignore in Auto Analysis</span>
                {ignoreAA && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="rp-defect-pick-check"><polyline points="20 6 9 17 4 12" /></svg>}
              </button>
              {DEFECT_TYPES.map(dt => (
                <button key={dt.value} className={`rp-defect-pick ${selectedType === dt.value ? "selected" : ""}`} onClick={() => setSelectedType(dt.value)}>
                  <span className="rp-defect-pick-dot" style={{ background: dt.color }} />
                  <span className="rp-defect-pick-flex">{dt.label}</span>
                  {selectedType === dt.value && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="rp-defect-pick-check"><polyline points="20 6 9 17 4 12" /></svg>}
                </button>
              ))}
            </div>
          </div>
          <div className="rp-modal-pane">
            <div className="rp-modal-section-label">Comment</div>
            <textarea className="rp-comment-area" placeholder="Add a comment about this defect classification..." value={comment} onChange={e => setComment(e.target.value)} />
            {mode.startsWith("ai-") && (() => {
              const s = aiSuggestions.find(x => `ai-${x.id}` === mode);
              if (!s?.reasoning) return null;
              return (
                <div style={{ marginTop: 16 }}>
                  <div className="rp-modal-section-label">Analyzer Reasoning</div>
                  <div className="rp-link-issue-tip" style={{ borderStyle: "solid" }}>{s.reasoning}</div>
                </div>
              );
            })()}
            {defects.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div className="rp-modal-section-label">Linked Issues</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {defects.map(d => (
                    <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 12 }}>
                      <span style={{ fontFamily: "var(--font-mono)", color: "var(--color-primary)", fontWeight: 600 }}>{d.external_id || d.summary}</span>
                      <span style={{ color: "var(--color-text-secondary)" }}>{d.description || d.summary}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="rp-modal-foot">
          <div className="rp-modal-foot-spacer" />
          <button className="rp-modal-cancel" onClick={onClose}>Cancel</button>
          <button className="rp-modal-apply" onClick={() => { onApply(selectedType, comment.trim()); onClose(); }} disabled={!selectedType}>Apply</button>
        </div>
      </div>
    </div>
  );
};

const TestDetail: React.FC = () => {
  const { id: launchIdStr, itemId: itemIdStr } = useParams<{ id: string; itemId: string }>();
  const navigate = useNavigate();
  const launchId = Number(launchIdStr);
  const itemId = Number(itemIdStr);

  const [launch, setLaunch] = useState<Launch | null>(null);
  const [item, setItem] = useState<TestItem | null>(null);
  const [logs, setLogs] = useState<TestLog[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [analyses, setAnalyses] = useState<FailureAnalysis[]>([]);
  const [defects, setDefects] = useState<Defect[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("stack");
  const [logLevel, setLogLevel] = useState("ALL");
  const [decisionOpen, setDecisionOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getLaunch(launchId),
      getTestItems(launchId),
      getTestLogs(launchId, itemId),
      getTestAttachments(launchId, itemId),
      getItemAnalyses(launchId, itemId),
      getItemDefects(launchId, itemId),
    ]).then(([launchRes, itemsRes, logsRes, attachRes, analysesRes, defectsRes]) => {
      setLaunch(launchRes.data);
      const found = (itemsRes.data as TestItem[]).find(i => i.id === itemId);
      setItem(found || null);
      setLogs(Array.isArray(logsRes.data) ? logsRes.data : []);
      setAttachments(Array.isArray(attachRes.data) ? attachRes.data : []);
      setAnalyses(Array.isArray(analysesRes.data) ? analysesRes.data : []);
      setDefects(Array.isArray(defectsRes.data) ? defectsRes.data : []);
    }).finally(() => setLoading(false));
  }, [launchId, itemId]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: logs.length, ERROR: 0, WARN: 0, INFO: 0, DEBUG: 0, TRACE: 0 };
    logs.forEach(l => { c[l.level] = (c[l.level] || 0) + 1; });
    return c;
  }, [logs]);

  const filteredLogs = useMemo(() => {
    if (logLevel === "ALL") return logs;
    return logs.filter(l => l.level === logLevel);
  }, [logs, logLevel]);

  // Match attachments to their closest log by timestamp
  const logAttachments = useMemo(() => {
    const map: Record<number, Attachment[]> = {};
    if (!logs.length || !attachments.length) return map;
    attachments.forEach(a => {
      const aTime = new Date(a.uploaded_at).getTime();
      let closest = logs[0];
      let minDiff = Math.abs(new Date(logs[0].timestamp).getTime() - aTime);
      for (let i = 1; i < logs.length; i++) {
        const diff = Math.abs(new Date(logs[i].timestamp).getTime() - aTime);
        if (diff < minDiff) { minDiff = diff; closest = logs[i]; }
      }
      if (!map[closest.id]) map[closest.id] = [];
      map[closest.id].push(a);
    });
    return map;
  }, [logs, attachments]);

  const handleApplyDecision = useCallback((type: DefectType, comment: string) => {
    if (analyses.length > 0) {
      overrideAnalysis(launchId, itemId, analyses[0].id, { defect_type: type, reasoning: comment || undefined })
        .then(res => setAnalyses(prev => prev.map(a => a.id === analyses[0].id ? res.data : a)));
    }
  }, [analyses, launchId, itemId]);

  if (loading) {
    return <div className="loading-center"><div className="spinner spinner-lg" /><span>Loading test details...</span></div>;
  }
  if (!item || !launch) {
    return <div className="empty-state"><div className="empty-state-title">Test not found</div></div>;
  }

  const isFailed = item.status === "FAILED" || item.status === "ERROR";
  const classification = analyses[0]?.defect_type;
  const classificationLabel = DEFECT_TYPES.find(d => d.value === classification)?.label;

  return (
    <div>
      <div className="page-breadcrumb">
        <Link to="/">Dashboard</Link>
        <span className="page-breadcrumb-separator">/</span>
        <Link to="/launches">Launches</Link>
        <span className="page-breadcrumb-separator">/</span>
        <Link to={`/launches/${launchId}`}>{launch.name}</Link>
        <span className="page-breadcrumb-separator">/</span>
        {item.suite && <><span style={{ fontFamily: "var(--font-mono)" }}>{item.suite}</span><span className="page-breadcrumb-separator">/</span></>}
        <span style={{ color: "var(--color-text)", fontFamily: "var(--font-mono)" }}>{item.name}</span>
      </div>

      <div className="detail-header-row">
        <button className="back-btn" onClick={() => navigate(`/launches/${launchId}`)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
        </button>
        <div className="detail-title-block">
          <div className="detail-title-line">
            <h1 className="detail-title" style={{ fontFamily: "var(--font-mono)", fontSize: 22 }}>{item.name}</h1>
            <span className={`badge ${item.status === "PASSED" ? "badge-passed" : item.status === "FAILED" ? "badge-failed" : "badge-skipped"}`} style={{ padding: "5px 12px" }}>
              <span className="badge-dot" />
              {item.status}
            </span>
            {classification && (
              <span className="badge" style={{ background: DEFECT_TYPES.find(d => d.value === classification)?.color, color: "white", padding: "5px 12px" }}>
                {classificationLabel}
              </span>
            )}
          </div>
          <div className="detail-meta-row">
            <span className="detail-meta-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
              Duration <strong>{fmtDuration(item.duration_ms)}</strong>
            </span>
            <span className="detail-meta-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
              {format(new Date(item.start_time), "HH:mm:ss")}
              {item.end_time && <> &rarr; {format(new Date(item.end_time), "HH:mm:ss")}</>}
            </span>
            {item.suite && <span className="detail-meta-item">Suite <strong style={{ fontFamily: "var(--font-mono)" }}>{item.suite}</strong></span>}
          </div>
        </div>
      </div>

      {/* History strip */}
      <HistoryStrip testName={item.name} currentItemId={item.id} />

      {/* Action toolbar */}
      <div className="rp-toolbar" style={{ marginTop: 20 }}>
        <button className="rp-make-decision" onClick={() => setDecisionOpen(true)} disabled={!isFailed}
          title={isFailed ? "Classify this failure" : "Decisions only available for failed tests"}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
          Make decision
        </button>
        <div className="rp-toolbar-spacer" />
      </div>

      {/* Tabs */}
      <div className="rp-tabs">
        <button className={`rp-tab ${tab === "stack" ? "active" : ""}`} onClick={() => setTab("stack")}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
          Stack trace
        </button>
        <button className={`rp-tab ${tab === "logs" ? "active" : ""}`} onClick={() => setTab("logs")}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
          All logs <span className="rp-tab-count">{counts.ALL}</span>
        </button>
        <button className={`rp-tab ${tab === "attach" ? "active" : ""}`} onClick={() => setTab("attach")}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
          Attachments <span className="rp-tab-count">{attachments.length}</span>
        </button>
        <button className={`rp-tab ${tab === "details" ? "active" : ""}`} onClick={() => setTab("details")}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
          Item details
        </button>
      </div>

      {/* Tab content */}
      {tab === "stack" && <StackTraceBlock text={item.stack_trace || item.error_message} />}

      {tab === "logs" && (
        <>
          <div className="rp-log-filters">
            {[
              { id: "ALL", label: "All logs", count: counts.ALL, color: "#64748b" },
              { id: "ERROR", label: "Error", count: counts.ERROR || 0, color: LEVEL_COLORS.ERROR },
              { id: "WARN", label: "Warn", count: counts.WARN || 0, color: LEVEL_COLORS.WARN },
              { id: "INFO", label: "Info", count: counts.INFO || 0, color: LEVEL_COLORS.INFO },
              { id: "DEBUG", label: "Debug", count: counts.DEBUG || 0, color: LEVEL_COLORS.DEBUG },
              { id: "TRACE", label: "Trace", count: counts.TRACE || 0, color: LEVEL_COLORS.TRACE },
            ].map(f => (
              <button key={f.id} className={`rp-log-filter ${logLevel === f.id ? "active" : ""}`} onClick={() => setLogLevel(f.id)}>
                <span className="rp-log-filter-dot" style={{ background: logLevel === f.id ? "white" : f.color }} />
                {f.label}
                <span className="rp-log-filter-count">{f.count}</span>
              </button>
            ))}
          </div>
          <div className="rp-log-table">
            <div className="rp-log-table-head">
              <span>Log message</span>
              <span>Time</span>
            </div>
            {filteredLogs.length === 0 ? (
              <div style={{ padding: 32, textAlign: "center", color: "var(--color-text-muted)" }}>No log entries match this filter.</div>
            ) : filteredLogs.map(l => {
              const rowAttachments = logAttachments[l.id] || [];
              return (
                <div key={l.id} className="rp-log-row">
                  <div className="rp-log-message-cell">
                    <span className={`log-level ${l.level.toLowerCase()}`} style={{ flexShrink: 0 }}>{l.level}</span>
                    <div className="rp-log-message-content">
                      {l.step_name && <span className="rp-log-step-tag">[{l.step_name}]</span>} {l.message}
                      {rowAttachments.length > 0 && (
                        <div className="rp-log-attachments">
                          {rowAttachments.map(a => (
                            <a key={a.id} href={getAttachmentUrl(a.id)} target="_blank" rel="noopener noreferrer" className="rp-log-attachment">
                              {a.attachment_type === "SCREENSHOT" ? (
                                <img src={getAttachmentUrl(a.id)} alt={a.file_name} className="rp-log-attachment-img" />
                              ) : (
                                <div className="rp-log-attachment-file">
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                                </div>
                              )}
                              <span className="rp-log-attachment-name">{a.file_name}</span>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="rp-log-time-cell">
                    {format(new Date(l.timestamp), "HH:mm:ss.SSS")}
                    {rowAttachments.length > 0 && (
                      <div className="rp-log-attachment-badge">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                        {rowAttachments.length}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {tab === "attach" && (
        <div className="tab-card" style={{ borderTop: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)" }}>
          {attachments.length === 0 ? (
            <div style={{ padding: 48, textAlign: "center", color: "var(--color-text-muted)" }}>No attachments for this test.</div>
          ) : (
            <div className="attachment-grid">
              {attachments.map(a => (
                <a key={a.id} href={getAttachmentUrl(a.id)} target="_blank" rel="noopener noreferrer" className="attachment-card" style={{ textDecoration: "none" }}>
                  <div className="attachment-thumb">
                    {a.attachment_type === "SCREENSHOT" ? (
                      <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                    ) : a.attachment_type === "VIDEO" ? (
                      <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="14" height="12" rx="2" /><polygon points="22 8 16 12 22 16 22 8" fill="currentColor" /></svg>
                    ) : (
                      <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                    )}
                  </div>
                  <div className="attachment-meta">
                    <div className="attachment-meta-name">{a.file_name}</div>
                    <div className="attachment-meta-sub">{(a.file_size / 1024).toFixed(0)} KB</div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "details" && (
        <div className="rp-detail-grid">
          <span className="rp-detail-key">Test ID</span><span className="rp-detail-val">#{item.id}</span>
          <span className="rp-detail-key">Name</span><span className="rp-detail-val">{item.name}</span>
          <span className="rp-detail-key">Suite</span><span className="rp-detail-val">{item.suite || "—"}</span>
          <span className="rp-detail-key">Status</span><span className="rp-detail-val">{item.status}</span>
          <span className="rp-detail-key">Started</span><span className="rp-detail-val">{format(new Date(item.start_time), "MMM d, yyyy HH:mm:ss")}</span>
          <span className="rp-detail-key">Ended</span><span className="rp-detail-val">{item.end_time ? format(new Date(item.end_time), "MMM d, yyyy HH:mm:ss") : "—"}</span>
          <span className="rp-detail-key">Duration</span><span className="rp-detail-val">{fmtDuration(item.duration_ms)}</span>
          <span className="rp-detail-key">Defect</span><span className="rp-detail-val">{classificationLabel || "—"}</span>
          <span className="rp-detail-key">Linked issues</span>
          <span className="rp-detail-val">
            {defects.length === 0 ? "—" : defects.map(d => (
              <span key={d.id} style={{ color: "var(--color-primary)", marginRight: 12 }}>{d.external_id || d.summary}</span>
            ))}
          </span>
          {item.error_message && (
            <><span className="rp-detail-key">Error</span><span className="rp-detail-val" style={{ color: "var(--color-failed)" }}>{item.error_message}</span></>
          )}
        </div>
      )}

      {decisionOpen && (
        <MakeDecisionModal test={item} analyses={analyses} defects={defects} onClose={() => setDecisionOpen(false)} onApply={handleApplyDecision} />
      )}
    </div>
  );
};

export default TestDetail;

import React, { useEffect, useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { getLaunch, getTestItems } from "../api/launches";
import { getItemAnalyses, triggerLaunchAnalysis } from "../api/analyses";
import { getTestAttachments } from "../api/attachments";
import { Launch, TestItem, FailureAnalysis, Attachment } from "../types";
import { StatusBadge } from "../components/StatusBadge";
import { LogViewer } from "../components/LogViewer";
import { ScreenshotViewer } from "../components/ScreenshotViewer";
import { DefectSelector } from "../components/DefectSelector";
import { format } from "date-fns";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

// ===== Utility functions =====
function fmtDuration(ms: number | null | undefined): string {
  if (ms == null || ms === 0) return "\u2014";
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(2)}s`;
  const m = Math.floor(s / 60);
  const sec = Math.round(s - m * 60);
  return `${m}m ${sec}s`;
}

// ===== Defect type metadata =====
const DEFECT_META: Record<string, { label: string; color: string }> = {
  PRODUCT_BUG: { label: "Product Bug", color: "#ef4444" },
  AUTOMATION_BUG: { label: "Automation Bug", color: "#f59e0b" },
  SYSTEM_ISSUE: { label: "System Issue", color: "#3b82f6" },
  NO_DEFECT: { label: "No Defect", color: "#22c55e" },
  TO_INVESTIGATE: { label: "To Investigate", color: "#6b7280" },
};

// ===== ProgressRing =====
const ProgressRing: React.FC<{ value: number; size?: number; stroke?: number }> = ({ value, size = 92, stroke = 9 }) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  const color = value >= 80 ? "#22c55e" : value >= 60 ? "#f59e0b" : "#ef4444";
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} stroke="#e2e8f0" strokeWidth={stroke} fill="none" />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 600ms ease-out" }}
      />
      <text x="50%" y="50%" textAnchor="middle" dy="0.36em" fontSize={size * 0.22} fontWeight="700" fill="#0f172a">
        {value.toFixed(1)}%
      </text>
    </svg>
  );
};

// ===== MetricCard =====
const MetricCard: React.FC<{
  label: string; value: number | string; color: string; sub?: string; active?: boolean;
  onClick?: () => void;
  icon: React.ReactNode;
}> = ({ label, value, color, sub, active, onClick, icon }) => {
  const Tag = onClick ? "button" as const : "div" as const;
  const cls = `metric-card compact${onClick ? " metric-card-clickable" : ""}${active ? " metric-card-active" : ""}`;
  return (
    <Tag className={cls} onClick={onClick} style={onClick && active ? { borderColor: color } : undefined}>
      <div className="metric-card-top">
        <span className="metric-pill-icon" style={{ background: color + "15", color }}>{icon}</span>
        <span className="metric-card-label">{label}</span>
      </div>
      <div className="metric-card-value-row">
        <div className="metric-card-value" style={{ color }}>{value}</div>
        {sub && <span className="metric-card-delta">{sub}</span>}
      </div>
    </Tag>
  );
};

// ===== StatusIcon =====
const StatusIcon: React.FC<{ status: string }> = ({ status }) => {
  const cls = { PASSED: "passed", FAILED: "failed", SKIPPED: "skipped", ERROR: "error" }[status] || "error";
  const path: Record<string, React.ReactNode> = {
    PASSED: <polyline points="4 12 9 17 20 6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />,
    FAILED: <g strokeWidth="3" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></g>,
    SKIPPED: <g><circle cx="8" cy="12" r="1.2" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" /><circle cx="16" cy="12" r="1.2" fill="currentColor" stroke="none" /></g>,
    ERROR: <text x="12" y="17" textAnchor="middle" fontSize="14" fill="currentColor" stroke="none" fontWeight="700">!</text>,
  };
  return (
    <span className={`status-icon ${cls}`} title={status}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">{path[status]}</svg>
    </span>
  );
};

// ===== Stack trace highlighting =====
function highlightStack(text: string): React.ReactNode[] {
  return text.split("\n").map((l, i) => {
    const html = l
      .replace(/(File "[^"]+")/g, '<span class="sf-file">$1</span>')
      .replace(/(line \d+)/g, '<span class="sf-line">$1</span>')
      .replace(/(in [a-zA-Z_][a-zA-Z0-9_]*)/g, '<span class="sf-fn">$1</span>')
      .replace(/^( *)([A-Za-z]+(?:Error|Exception)[^:]*:)/, '$1<span class="sf-arrow">$2</span>');
    return <div key={i} dangerouslySetInnerHTML={{ __html: html || "&nbsp;" }} />;
  });
}

// ===== ExpandedRow =====
const ExpandedRow: React.FC<{
  item: TestItem;
  analysis: FailureAnalysis | null;
  launchId: number;
  onDefectChange: () => void;
}> = ({ item, analysis, launchId, onDefectChange }) => {
  const isFailed = item.status === "FAILED" || item.status === "ERROR";
  const [innerTab, setInnerTab] = useState<"error" | "logs" | "screenshots">(item.error_message ? "error" : "logs");

  return (
    <div className={isFailed ? "test-detail-layout" : ""}>
      <div className={isFailed ? "test-detail-main" : ""}>
        {item.error_message || item.stack_trace ? (
          <div className="expanded-panel" style={{ gridTemplateColumns: analysis ? "1.6fr 1fr" : "1fr" }}>
            <div>
              {item.error_message && (
                <>
                  <div className="panel-section-label">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                    Error message
                  </div>
                  <div className="error-block">{item.error_message}</div>
                </>
              )}
              {item.stack_trace && (
                <>
                  <div className="panel-section-label">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>
                    Stack trace
                  </div>
                  <div className="stack-block">{highlightStack(item.stack_trace)}</div>
                </>
              )}
            </div>
            {analysis && (
              <div>
                <div className="ai-card">
                  <div className="ai-card-head">
                    <span className="ai-pill">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.7 5.3L19 9l-5.3 1.7L12 16l-1.7-5.3L5 9l5.3-1.7z M19 14l.85 2.65L22 17.5l-2.15.85L19 21l-.85-2.65L16 17.5l2.15-.85z" /></svg>
                      AI Analysis
                    </span>
                    <span className="ai-confidence">{Math.round(analysis.confidence * 100)}% confidence</span>
                  </div>
                  <div className="h-stack">
                    <span className="badge-defect" style={{
                      background: DEFECT_META[analysis.defect_type]?.color || "#6b7280",
                      color: analysis.defect_type === "AUTOMATION_BUG" ? "#78350f" : "white",
                      padding: "3px 10px", borderRadius: 9999, fontSize: 11, fontWeight: 600
                    }}>
                      {DEFECT_META[analysis.defect_type]?.label || analysis.defect_type}
                    </span>
                  </div>
                  <div className="confidence-bar" style={{ marginTop: 12 }}>
                    <div className="confidence-track" style={{ width: "100%", height: 4, background: "#e2e8f0", borderRadius: 4 }}>
                      <div style={{
                        width: `${analysis.confidence * 100}%`, height: "100%", borderRadius: 4,
                        background: analysis.confidence >= 0.7 ? "#22c55e" : analysis.confidence >= 0.4 ? "#f59e0b" : "#ef4444",
                      }} />
                    </div>
                  </div>
                  {analysis.reasoning && <div className="ai-reasoning">{analysis.reasoning}</div>}
                </div>
                <div className="ai-card" style={{ marginTop: 12 }}>
                  <div className="panel-section-label" style={{ marginBottom: 8 }}>Test info</div>
                  <div className="kv-row"><span className="k">Suite</span><span className="v">{item.suite || "-"}</span></div>
                  <div className="kv-row"><span className="k">Duration</span><span className="v">{fmtDuration(item.duration_ms)}</span></div>
                  <div className="kv-row"><span className="k">Test ID</span><span className="v">#{item.id}</span></div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="tabs" style={{ padding: "0 var(--space-2)" }}>
              <button className={`tab ${innerTab === "logs" ? "active" : ""}`} onClick={() => setInnerTab("logs")}>Logs</button>
              <button className={`tab ${innerTab === "screenshots" ? "active" : ""}`} onClick={() => setInnerTab("screenshots")}>Screenshots</button>
            </div>
            <div style={{ padding: "var(--space-4)" }}>
              {innerTab === "logs" && <LogViewer launchId={launchId} itemId={item.id} />}
              {innerTab === "screenshots" && <ScreenshotViewer launchId={launchId} itemId={item.id} />}
            </div>
          </>
        )}
      </div>
      {isFailed && (
        <div className="test-detail-sidebar">
          <DefectSelector launchId={launchId} itemId={item.id} onDefectChange={onDefectChange} />
        </div>
      )}
    </div>
  );
};

// ===== TestsTab =====
const TestsTab: React.FC<{
  items: TestItem[];
  analyses: Record<number, FailureAnalysis | null>;
  launchId: number;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  loading: boolean;
  onDefectChange: () => void;
}> = ({ items, analyses, launchId, statusFilter, setStatusFilter, loading, onDefectChange }) => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [suiteFilter, setSuiteFilter] = useState("ALL");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selectedItem = selectedId ? items.find(i => i.id === selectedId) : null;
  const showRail = selectedItem && (selectedItem.status === "FAILED" || selectedItem.status === "ERROR");

  const suites = useMemo(() => Array.from(new Set(items.map((i) => i.suite).filter(Boolean))).sort(), [items]);

  const filtered = useMemo(() => items.filter((t) => {
    if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== "ALL" && t.status !== statusFilter) return false;
    if (suiteFilter !== "ALL" && t.suite !== suiteFilter) return false;
    return true;
  }), [items, search, statusFilter, suiteFilter]);

  const toggle = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  if (loading) {
    return <div className="tab-card" style={{ padding: 40, textAlign: "center" }}><div className="spinner spinner-lg" /></div>;
  }

  return (
    <div className={`tests-tab-layout ${showRail ? "with-rail" : ""}`}>
      <div className="tab-card tests-tab-main">
        <div className="filter-bar">
          <div className="search-input-wrap">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input className="input search-input" placeholder="Search test name..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="select select-md" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="ALL">All statuses</option>
            <option value="PASSED">Passed</option>
            <option value="FAILED">Failed</option>
            <option value="SKIPPED">Skipped</option>
            <option value="ERROR">Error</option>
          </select>
          <select className="select select-md" value={suiteFilter} onChange={(e) => setSuiteFilter(e.target.value)}>
            <option value="ALL">All suites</option>
            {suites.map((s) => <option key={s} value={s!}>{s}</option>)}
          </select>
          <span className="filter-count">{filtered.length} of {items.length}</span>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state" style={{ padding: 40 }}>
            <div className="empty-state-title">No tests match</div>
            <div className="empty-state-description">Try adjusting your filters.</div>
          </div>
        ) : (
          <table className="data-table tests-table">
            <thead>
              <tr>
                <th style={{ width: 60 }}></th>
                <th>Test name</th>
                <th style={{ width: 130 }}>Suite</th>
                <th style={{ width: 110 }}>Duration</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
                const isExpanded = expanded.has(t.id);
                const isSelected = selectedId === t.id;
                const rowCls = [
                  "row-clickable", "test-row",
                  isExpanded ? "row-expanded" : "",
                  isSelected ? "row-selected" : "",
                  t.status === "FAILED" ? "failed-row" : "",
                  t.status === "ERROR" ? "error-row" : "",
                ].filter(Boolean).join(" ");
                return (
                  <React.Fragment key={t.id}>
                    <tr className={rowCls} onClick={() => { setSelectedId(t.id === selectedId ? null : t.id); }}>
                      <td>
                        <div className="h-stack">
                          <span className={`row-expand-icon ${isExpanded ? "expanded" : ""}`} onClick={e => { e.stopPropagation(); toggle(t.id); }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                          </span>
                          <StatusIcon status={t.status} />
                        </div>
                      </td>
                      <td>
                        <span className="test-name" onClick={e => { e.stopPropagation(); navigate(`/launches/${launchId}/items/${t.id}`); }}>{t.name}</span>
                      </td>
                      <td>{t.suite ? <span className="suite-pill">{t.suite}</span> : "-"}</td>
                      <td className="cell-mono cell-secondary">{fmtDuration(t.duration_ms)}</td>
                      <td>
                        {t.error_message
                          ? <span className={t.status === "FAILED" ? "cell-error-preview" : "cell-secondary"} style={t.status !== "FAILED" ? { fontStyle: "italic", fontSize: 12 } : undefined}>{t.error_message}</span>
                          : <span className="cell-error-empty">{"\u2014"}</span>}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={5} className="expand-cell">
                          <div className="animate-slide-down">
                            <ExpandedRow item={t} analysis={analyses[t.id] || null} launchId={launchId} onDefectChange={onDefectChange} />
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {showRail && selectedItem && (
        <div className="tests-tab-rail">
          <div className="rail-header">
            <span className="rail-title">{selectedItem.name}</span>
            <button className="icon-btn" onClick={() => setSelectedId(null)} title="Close">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>
          <DefectSelector launchId={launchId} itemId={selectedItem.id} onDefectChange={onDefectChange} />
        </div>
      )}
    </div>
  );
};

// ===== AnalysisTab =====
const AnalysisTab: React.FC<{
  items: TestItem[];
  analyses: Record<number, FailureAnalysis | null>;
  launchId: number;
}> = ({ items, analyses, launchId }) => {
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);

  const analyzedFailures = useMemo(() =>
    items.filter((t) => analyses[t.id]),
    [items, analyses]
  );

  const counts: Record<string, number> = {};
  analyzedFailures.forEach((t) => {
    const a = analyses[t.id]!;
    counts[a.defect_type] = (counts[a.defect_type] || 0) + 1;
  });
  Object.keys(DEFECT_META).forEach((k) => { if (!(k in counts)) counts[k] = 0; });

  const donutData = Object.keys(DEFECT_META).map((k) => ({
    name: DEFECT_META[k].label,
    value: counts[k],
    color: DEFECT_META[k].color,
    type: k,
  }));
  const totalDefects = analyzedFailures.length;
  const visibleDonut = donutData.filter((d) => d.value > 0);

  const trigger = () => {
    if (analyzing) return;
    setAnalyzing(true);
    setProgress(0);
    triggerLaunchAnalysis(launchId).catch(() => {});
    let p = 0;
    const id = setInterval(() => {
      p += Math.random() * 18 + 6;
      if (p >= 100) {
        p = 100;
        clearInterval(id);
        setTimeout(() => { setAnalyzing(false); setProgress(0); }, 600);
      }
      setProgress(p);
    }, 220);
  };

  return (
    <div className="analysis-grid" style={{ paddingTop: 20 }}>
      <div className="donut-card">
        <h3 className="card-title">Defect distribution</h3>
        <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 12 }}>
          AI classification across {totalDefects} analyzed failures
        </div>
        <div style={{ position: "relative", height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={visibleDonut.length > 0 ? visibleDonut : [{ name: "None", value: 1, color: "#e2e8f0" }]} cx="50%" cy="50%" innerRadius={62} outerRadius={92} paddingAngle={3} dataKey="value" stroke="none" cornerRadius={4}>
                {(visibleDonut.length > 0 ? visibleDonut : [{ color: "#e2e8f0" }]).map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.07)" }} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", textAlign: "center", pointerEvents: "none" }}>
            <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1 }}>{totalDefects}</div>
            <div style={{ fontSize: 11, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 4 }}>Failures</div>
          </div>
        </div>
        <div className="donut-legend">
          {donutData.map((d) => (
            <div key={d.type} className="donut-legend-row" style={{ opacity: d.value === 0 ? 0.45 : 1 }}>
              <div className="donut-legend-dot" style={{ background: d.color }} />
              <div className="donut-legend-label">{d.name}</div>
              <div className="donut-legend-count">{d.value}</div>
              <div className="donut-legend-pct">{totalDefects > 0 ? Math.round((d.value / totalDefects) * 100) : 0}%</div>
            </div>
          ))}
        </div>
      </div>

      <div className="failures-list">
        <div className="failures-list-head">
          <div>
            <h3 className="card-title">Analyzed failures</h3>
            <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 2 }}>
              {analyzedFailures.length} classified
            </div>
          </div>
          <button className="btn btn-ai" onClick={trigger} disabled={analyzing}>
            {analyzing ? (
              <><span className="spinner" style={{ width: 14, height: 14, borderColor: "rgba(255,255,255,0.3)", borderTopColor: "#fff" }} /> Analyzing\u2026 {Math.round(progress)}%</>
            ) : (
              <><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5z M19 14l1 3 3 1-3 1-1 3-1-3-3-1 3-1z" /></svg> Trigger analysis</>
            )}
          </button>
        </div>
        {analyzedFailures.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--color-text-muted)" }}>No analyzed failures yet. Click "Trigger analysis" to start.</div>
        ) : analyzedFailures.map((t) => {
          const a = analyses[t.id]!;
          const meta = DEFECT_META[a.defect_type] || { label: a.defect_type, color: "#6b7280" };
          return (
            <div className="failure-item" key={t.id}>
              <div>
                <div className="failure-item-name">{t.name}</div>
                <div className="failure-item-suite">{t.suite} · {fmtDuration(t.duration_ms)}</div>
                {a.reasoning && <div className="failure-item-reasoning">{a.reasoning}</div>}
              </div>
              <div className="failure-item-side">
                <span className="badge-defect" style={{ background: meta.color, color: a.defect_type === "AUTOMATION_BUG" ? "#78350f" : "white" }}>{meta.label}</span>
                <div className="confidence-mini">
                  <div className="confidence-track" style={{ width: 60, height: 4, background: "#e2e8f0", borderRadius: 4 }}>
                    <div style={{
                      width: `${a.confidence * 100}%`, height: "100%", borderRadius: 4,
                      background: a.confidence >= 0.7 ? "#22c55e" : a.confidence >= 0.4 ? "#f59e0b" : "#ef4444",
                    }} />
                  </div>
                  <span className="confidence-mini-label">{Math.round(a.confidence * 100)}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ===== AttachmentsTab =====
const AttachmentIcon: React.FC<{ type: string }> = ({ type }) => {
  if (type === "SCREENSHOT") return (
    <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
  );
  if (type === "VIDEO") return (
    <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="14" height="12" rx="2" /><polygon points="22 8 16 12 22 16 22 8" fill="currentColor" /></svg>
  );
  return (
    <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="9" y1="13" x2="15" y2="13" /><line x1="9" y1="17" x2="13" y2="17" /></svg>
  );
};

const AttachmentsTab: React.FC<{ items: TestItem[]; launchId: number }> = ({ items, launchId }) => {
  const [attachments, setAttachments] = useState<(Attachment & { testName?: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const all: (Attachment & { testName?: string })[] = [];
      for (const item of items) {
        try {
          const res = await getTestAttachments(launchId, item.id);
          res.data.forEach((a: Attachment) => all.push({ ...a, testName: item.name }));
        } catch {}
      }
      setAttachments(all);
      setLoading(false);
    };
    load();
  }, [items, launchId]);

  if (loading) return <div className="tab-card" style={{ padding: 40, textAlign: "center" }}><div className="spinner spinner-lg" /></div>;

  if (attachments.length === 0) {
    return <div className="tab-card" style={{ padding: 40, textAlign: "center", color: "var(--color-text-muted)" }}>No attachments found for this launch.</div>;
  }

  const grouped: Record<string, typeof attachments> = {};
  attachments.forEach((a) => {
    const key = a.testName || "launch";
    grouped[key] = grouped[key] || [];
    grouped[key].push(a);
  });

  const fmtSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <div className="tab-card">
      <div className="filter-bar">
        <div style={{ fontSize: 14, fontWeight: 600 }}>Attachments</div>
        <span className="filter-count">{attachments.length} files</span>
      </div>
      {Object.keys(grouped).map((key) => (
        <div key={key}>
          <div style={{ padding: "16px 20px 4px", fontSize: 12, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600, fontFamily: "var(--font-mono)" }}>
            {key}
          </div>
          <div className="attachment-grid" style={{ paddingTop: 8 }}>
            {grouped[key].map((a) => (
              <a className="attachment-card" key={a.id} href={a.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                <div className="attachment-thumb"><AttachmentIcon type={a.attachment_type} /></div>
                <div className="attachment-meta">
                  <div className="attachment-meta-name">{a.file_name}</div>
                  <div className="attachment-meta-sub">{fmtSize(a.file_size)}</div>
                </div>
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

// ===== Main Page =====
type MainTab = "tests" | "analysis" | "attachments";

const LaunchDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [launch, setLaunch] = useState<Launch | null>(null);
  const [items, setItems] = useState<TestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<MainTab>("tests");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [itemAnalyses, setItemAnalyses] = useState<Record<number, FailureAnalysis | null>>({});

  useEffect(() => {
    if (!id) return;
    getLaunch(Number(id)).then((res) => setLaunch(res.data));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getTestItems(Number(id))
      .then((res) => setItems(res.data))
      .finally(() => setLoading(false));
  }, [id]);

  const loadAnalyses = () => {
    if (!id || items.length === 0) return;
    items.filter((i) => i.status === "FAILED" || i.status === "ERROR").forEach((item) => {
      getItemAnalyses(Number(id), item.id).then((res) => {
        const latest = res.data.find((a: FailureAnalysis) => !a.overridden_by) || null;
        setItemAnalyses((prev) => ({ ...prev, [item.id]: latest }));
      });
    });
  };

  useEffect(() => { loadAnalyses(); }, [items]);

  if (!launch) {
    return <div className="loading-center"><div className="spinner spinner-lg" /><span>Loading launch...</span></div>;
  }

  const passRate = launch.total > 0 ? (launch.passed / launch.total) * 100 : 0;

  const focusStatus = (status: string) => {
    setTab("tests");
    setStatusFilter((prev) => prev === status ? "ALL" : status);
  };

  const duration = launch.start_time && launch.end_time
    ? new Date(launch.end_time).getTime() - new Date(launch.start_time).getTime()
    : null;

  return (
    <div>
      <div className="page-breadcrumb">
        <Link to="/">Dashboard</Link>
        <span className="page-breadcrumb-separator">/</span>
        <Link to="/launches">Launches</Link>
        <span className="page-breadcrumb-separator">/</span>
        <span>Launch #{launch.id}</span>
      </div>

      <div className="detail-header-row">
        <button className="back-btn" aria-label="Back" onClick={() => navigate("/launches")}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
          </svg>
        </button>
        <div className="detail-title-block">
          <div className="detail-title-line">
            <h1 className="detail-title">Launch #{launch.id}: {launch.name}</h1>
            <StatusBadge status={launch.status} />
          </div>
          {launch.description && <p className="detail-description">{launch.description}</p>}
          <div className="detail-meta-row">
            <span className="detail-meta-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
              {format(new Date(launch.start_time), "MMM d, yyyy")}
            </span>
            <span className="detail-meta-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
              Started <strong>{format(new Date(launch.start_time), "HH:mm:ss")}</strong>
              {launch.end_time && <> · ended <strong>{format(new Date(launch.end_time), "HH:mm:ss")}</strong></>}
            </span>
            {duration != null && (
              <span className="detail-meta-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
                Duration <strong>{fmtDuration(duration)}</strong>
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="metrics-row" style={{ marginTop: 24 }}>
        <MetricCard label="Total tests" value={launch.total} color="#6366f1" sub={`${Array.from(new Set(items.map((i) => i.suite).filter(Boolean))).length} suites`}
          onClick={() => focusStatus("ALL")} active={tab === "tests" && statusFilter === "ALL"}
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11H5a2 2 0 0 0-2 2v7h18v-7a2 2 0 0 0-2-2h-4" /><rect x="9" y="3" width="6" height="11" rx="1" /></svg>}
        />
        <MetricCard label="Passed" value={launch.passed} color="#22c55e" sub={`${launch.total > 0 ? ((launch.passed / launch.total) * 100).toFixed(0) : 0}%`}
          onClick={() => focusStatus("PASSED")} active={tab === "tests" && statusFilter === "PASSED"}
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
        />
        <MetricCard label="Failed" value={launch.failed} color="#ef4444" sub="needs attention"
          onClick={() => focusStatus("FAILED")} active={tab === "tests" && statusFilter === "FAILED"}
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>}
        />
        <MetricCard label="Skipped" value={launch.skipped} color="#f59e0b" sub="feature-flagged"
          onClick={() => focusStatus("SKIPPED")} active={tab === "tests" && statusFilter === "SKIPPED"}
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 4 15 12 5 20 5 4" /><line x1="19" y1="5" x2="19" y2="19" /></svg>}
        />
        <div className="ring-card">
          <ProgressRing value={passRate} />
          <div className="ring-meta">
            <span className="ring-meta-label">Pass rate</span>
            <span className="ring-meta-value">{passRate.toFixed(1)}%</span>
            <span className="ring-meta-sub">{launch.passed} of {launch.total} succeeded</span>
          </div>
        </div>
      </div>

      <div className="tabs-container">
        <div className="tabs">
          {([
            ["tests", "Tests", launch.total],
            ["analysis", "Analysis", launch.failed],
            ["attachments", "Attachments", null],
          ] as [MainTab, string, number | null][]).map(([tid, label, count]) => (
            <button key={tid} className={`tab ${tab === tid ? "active" : ""}`} onClick={() => setTab(tid)}>
              {label}
              {count != null && (
                <span style={{ marginLeft: 6, padding: "1px 7px", borderRadius: 9999, background: tab === tid ? "var(--color-primary-light)" : "var(--color-bg)", color: tab === tid ? "var(--color-primary)" : "var(--color-text-muted)", fontSize: 11, fontWeight: 600, fontFamily: "var(--font-mono)" }}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {tab === "tests" && (
          <TestsTab items={items} analyses={itemAnalyses} launchId={launch.id} statusFilter={statusFilter} setStatusFilter={setStatusFilter} loading={loading} onDefectChange={loadAnalyses} />
        )}
        {tab === "analysis" && (
          <AnalysisTab items={items} analyses={itemAnalyses} launchId={launch.id} />
        )}
        {tab === "attachments" && (
          <AttachmentsTab items={items} launchId={launch.id} />
        )}
      </div>

      <div style={{ height: 40 }} />
    </div>
  );
};

export default LaunchDetail;

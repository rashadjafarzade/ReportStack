import React, { useState, useCallback, useEffect } from "react";
import "../styles/project-settings.css";

// ===== Tab definitions =====
const PS_TABS = [
  { id: "general",       label: "General",          icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" },
  { id: "integrations",  label: "Integrations",     icon: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" },
  { id: "notifications", label: "Notifications",    icon: "M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" },
  { id: "defects",       label: "Defect types",     icon: "M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01" },
  { id: "logs",          label: "Log types",        icon: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8" },
  { id: "analyzer",      label: "Analyzer",         icon: "M21 21l-4.35-4.35M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16z" },
  { id: "pattern",       label: "Pattern-analysis", icon: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" },
  { id: "demo",          label: "Demo data",        icon: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" },
  { id: "gates",         label: "Quality gates",    icon: "M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4 12 14.01l-3-3" },
];

const TIMEOUT_OPTIONS = ["1 hour", "6 hours", "12 hours", "1 day", "3 days", "1 week"];
const RETENTION_OPTIONS = ["3 days", "7 days", "14 days", "30 days", "90 days", "180 days", "1 year", "Forever"];

// ===== SVG Icon helpers =====
const TabIcon: React.FC<{ d: string }> = ({ d }) => (
  <svg className="ps-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const PlusIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
);

const EditIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
);

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /></svg>
);

const CloseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
);

const ChevronIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
);

const CheckIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
);

// ===== Modal wrapper =====
const ModalOverlay: React.FC<{ onClose: () => void; children: React.ReactNode }> = ({ onClose, children }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="ps-modal-overlay" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
};

const ModalHead: React.FC<{ title: string; onClose: () => void }> = ({ title, onClose }) => (
  <div className="ps-modal-head">
    <span className="ps-modal-title">{title}</span>
    <button className="ps-modal-close" onClick={onClose}>
      <kbd>Esc</kbd>
      <CloseIcon />
    </button>
  </div>
);

// ===== General Tab =====
interface GeneralValues {
  name: string;
  inactivity: string;
  keepLaunches: string;
  keepLogs: string;
  keepAttachments: string;
}

const DEFAULT_VALUES: GeneralValues = {
  name: "default_personal",
  inactivity: "1 day",
  keepLaunches: "90 days",
  keepLogs: "90 days",
  keepAttachments: "14 days",
};

const GeneralTab: React.FC<{ values: GeneralValues; setValues: (v: GeneralValues) => void; onSubmit: () => void; dirty: boolean }> = ({ values, setValues, onSubmit, dirty }) => (
  <div className="ps-panel">
    <div className="ps-panel-head">
      <h2 className="ps-panel-title">General</h2>
      <span className="ps-panel-subtitle">Project name & data retention</span>
    </div>

    <div className="ps-field">
      <label className="ps-field-label ps-field-required">Name</label>
      <div className="ps-field-control">
        <input className="ps-input" type="text" value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} />
        <div className="ps-help">A unique identifier for this project. Lowercase letters, numbers, dashes and underscores only.</div>
      </div>
    </div>

    <div className="ps-field">
      <label className="ps-field-label">Launch inactivity timeout</label>
      <div className="ps-field-control">
        <div className="ps-select-wrap">
          <select className="ps-select" value={values.inactivity} onChange={(e) => setValues({ ...values, inactivity: e.target.value })}>
            {TIMEOUT_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div className="ps-help">Schedule time for Job to interrupt inactive launches.</div>
      </div>
    </div>

    <div className="ps-field">
      <label className="ps-field-label">Keep launches</label>
      <div className="ps-field-control">
        <div className="ps-select-wrap">
          <select className="ps-select" value={values.keepLaunches} onChange={(e) => setValues({ ...values, keepLaunches: e.target.value })}>
            {RETENTION_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div className="ps-help">How long to keep old launches. A launch and all its descendants (suites, tests, steps, logs) will be deleted.</div>
      </div>
    </div>

    <div className="ps-field">
      <label className="ps-field-label">Keep logs</label>
      <div className="ps-field-control">
        <div className="ps-select-wrap">
          <select className="ps-select" value={values.keepLogs} onChange={(e) => setValues({ ...values, keepLogs: e.target.value })}>
            {RETENTION_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div className="ps-help">How long to keep old logs in launches. Related launches structure will be saved, in order to keep statistics.</div>
      </div>
    </div>

    <div className="ps-field">
      <label className="ps-field-label">Keep attachments</label>
      <div className="ps-field-control">
        <div className="ps-select-wrap">
          <select className="ps-select" value={values.keepAttachments} onChange={(e) => setValues({ ...values, keepAttachments: e.target.value })}>
            {RETENTION_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div className="ps-help">How long to keep attachments in system.</div>
      </div>
    </div>

    <div className="ps-actions">
      <button className="ps-btn-primary ps-btn" onClick={onSubmit} disabled={!dirty}>Submit</button>
    </div>
  </div>
);

// ===== Integrations Tab =====
interface Integration {
  id: string;
  name: string;
  version: string | null;
  logo: React.ReactNode;
  bg: string;
  connected: boolean;
  desc: string;
}

const Logos = {
  jira: (
    <svg viewBox="0 0 32 32" width="22" height="22">
      <defs><linearGradient id="jl1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2684ff" /><stop offset="1" stopColor="#0052cc" /></linearGradient></defs>
      <path fill="url(#jl1)" d="M16 2 4 14a3 3 0 0 0 0 4l4 4 8-8 8 8 4-4a3 3 0 0 0 0-4z" />
      <path fill="#2684ff" opacity=".7" d="M16 14 8 22a3 3 0 0 0 0 4l4 4 4-4z" />
    </svg>
  ),
  azure: (
    <svg viewBox="0 0 32 32" width="22" height="22">
      <path fill="#0078d4" d="M16 2 4 12v8l12 10 12-10v-8z" />
      <path fill="#fff" d="M16 8 9 13v6l7 5 7-5v-6z" opacity=".25" />
      <path fill="#fff" d="M16 12v9l-5-3.5z" opacity=".9" />
      <path fill="#fff" d="M16 12v9l5-3.5z" opacity=".6" />
    </svg>
  ),
  gitlab: (
    <svg viewBox="0 0 32 32" width="22" height="22">
      <path fill="#fc6d26" d="m16 28-6-18h12z" />
      <path fill="#e24329" d="M16 28 4 10l-2 6z" />
      <path fill="#fca326" d="M2 16 16 28 4 10z" opacity=".85" />
      <path fill="#e24329" d="M16 28 28 10l2 6z" />
      <path fill="#fca326" d="M30 16 16 28 28 10z" opacity=".85" />
      <path fill="#e24329" d="M4 10 7 2l3 8z" />
      <path fill="#e24329" d="M28 10l-3-8-3 8z" />
    </svg>
  ),
  monday: (
    <svg viewBox="0 0 32 32" width="22" height="22">
      <ellipse cx="6" cy="16" rx="3.2" ry="11" fill="#ff3d57" />
      <ellipse cx="16" cy="16" rx="3.2" ry="11" fill="#fdab3d" />
      <ellipse cx="26" cy="16" rx="3.2" ry="11" fill="#00ca72" />
    </svg>
  ),
  rally: (
    <svg viewBox="0 0 32 32" width="22" height="22">
      <rect x="2" y="2" width="28" height="28" rx="6" fill="#9b59b6" />
      <path fill="#fff" d="M10 9h6.5c2.8 0 4.5 1.7 4.5 4 0 1.9-1.1 3.3-2.9 3.8L22 23h-3.4l-3.6-5.7H13V23h-3z" />
      <path fill="#9b59b6" d="M13 11.5v3.4h3.2c1.2 0 1.9-.6 1.9-1.7s-.7-1.7-1.9-1.7z" />
    </svg>
  ),
  jama: (
    <svg viewBox="0 0 32 32" width="22" height="22">
      <rect x="2" y="2" width="28" height="28" rx="6" fill="#f97316" />
      <path fill="#fff" d="M9 8h3.4v10.5c0 1.6-.4 2.9-1.3 3.8s-2.1 1.4-3.6 1.4l-.5-2.6c.7 0 1.3-.2 1.6-.6.3-.4.4-1.1.4-2zM16 23l4.6-15h3.4L28.6 23h-3.4l-1-3.4h-4.6L18.6 23zm4.5-6h3l-1.5-5z" />
    </svg>
  ),
  email: (
    <svg viewBox="0 0 32 32" width="22" height="22">
      <rect x="3" y="6" width="26" height="20" rx="3" fill="#475569" />
      <path fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="m6 10 10 7 10-7" />
    </svg>
  ),
  sauce: (
    <svg viewBox="0 0 32 32" width="22" height="22">
      <circle cx="16" cy="16" r="14" fill="#e2231a" />
      <path fill="#fff" d="M11 22V11c0-1.1.9-2 2-2h6c1.1 0 2 .9 2 2v2h-3v-1h-4v9h4v-1h3v2c0 1.1-.9 2-2 2h-6c-1.1 0-2-.9-2-2z" />
    </svg>
  ),
  jiraServer: (
    <svg viewBox="0 0 32 32" width="22" height="22">
      <path fill="#0052cc" d="M16 2 4 14a3 3 0 0 0 0 4l4 4 8-8 8 8 4-4a3 3 0 0 0 0-4z" />
      <path fill="#2684ff" d="M16 14 8 22a3 3 0 0 0 0 4l4 4 4-4z" />
    </svg>
  ),
};

const INTEGRATIONS_DATA: Record<string, Integration[]> = {
  "Bug Tracking Systems": [
    { id: "jira-cloud", name: "Jira Cloud", version: "5.13.9", logo: Logos.jira, bg: "rgba(38,132,255,0.12)", connected: true, desc: "Post issues and link issues, get updates on their statuses from Jira Cloud." },
    { id: "azure", name: "Azure DevOps", version: "5.13.2", logo: Logos.azure, bg: "rgba(0,120,212,0.12)", connected: false, desc: "Post issues and link issues, get updates on their statuses from Azure DevOps." },
    { id: "gitlab", name: "GitLab", version: "5.13.1", logo: Logos.gitlab, bg: "rgba(252,109,38,0.12)", connected: false, desc: "Post issues and link issues, get updates on their statuses from GitLab." },
    { id: "jira-server", name: "Jira Server", version: "5.15.0", logo: Logos.jiraServer, bg: "rgba(0,82,204,0.12)", connected: false, desc: "Post issues and link issues, get updates on their statuses from Jira Server." },
    { id: "monday", name: "Monday", version: "1.1.1", logo: Logos.monday, bg: "rgba(255,61,87,0.10)", connected: false, desc: "Post issues and link issues, get updates on their statuses from Monday." },
    { id: "rally", name: "Rally", version: "5.13.1", logo: Logos.rally, bg: "rgba(155,89,182,0.12)", connected: false, desc: "Post issues and link issues, get updates on their statuses from Rally." },
    { id: "jama", name: "Jama", version: "1.0.4", logo: Logos.jama, bg: "rgba(249,115,22,0.12)", connected: false, desc: "Import test cases and link requirements from Jama." },
  ],
  "Notifications": [
    { id: "email", name: "Email Server", version: null, logo: Logos.email, bg: "rgba(71,85,105,0.12)", connected: true, desc: "Be informed about test result finish in real time and configure list of recipients." },
  ],
  "Other": [
    { id: "sauce", name: "Sauce Labs", version: "5.13.1", logo: Logos.sauce, bg: "rgba(226,35,26,0.10)", connected: false, desc: "Watch video of test executions right in the ReportStack application." },
  ],
};

const IntegrationCard: React.FC<{ item: Integration; onToggle: () => void }> = ({ item, onToggle }) => (
  <div className={`ps-int-card ${item.connected ? "connected" : ""}`} onClick={onToggle}>
    <div className="ps-int-card-head">
      <span className="ps-int-logo" style={{ background: item.bg }}>{item.logo}</span>
      <div style={{ minWidth: 0 }}>
        <div className="ps-int-name">{item.name}</div>
        {item.version && <div className="ps-int-version">version {item.version}</div>}
      </div>
    </div>
    <div className="ps-int-desc">{item.desc}</div>
    <div className="ps-int-foot">
      <span className={`ps-int-status ${item.connected ? "connected" : ""}`}>
        <span className="ps-int-status-dot" />
        {item.connected ? "Connected" : "Not connected"}
      </span>
      <span className="ps-int-spacer" />
      <button className={`ps-int-cfg-btn ${item.connected ? "connected" : ""}`} onClick={(e) => { e.stopPropagation(); onToggle(); }}>
        {item.connected ? "Configure" : "Connect"}
      </button>
    </div>
  </div>
);

const IntegrationsTab: React.FC = () => {
  const [data, setData] = useState(INTEGRATIONS_DATA);
  const toggle = (section: string, id: string) => {
    setData((prev) => ({
      ...prev,
      [section]: prev[section].map((i) => (i.id === id ? { ...i, connected: !i.connected } : i)),
    }));
  };
  const totalConnected = Object.values(data).flat().filter((i) => i.connected).length;
  const total = Object.values(data).flat().length;

  return (
    <div className="ps-panel">
      <div className="ps-panel-head">
        <h2 className="ps-panel-title">Integrations</h2>
        <span className="ps-panel-subtitle">{totalConnected} of {total} connected</span>
      </div>
      {Object.entries(data).map(([section, items]) => (
        <div key={section} className="ps-int-section">
          <div className="ps-int-section-head">
            <h3 className="ps-int-section-title">{section}</h3>
            <span className="ps-int-section-count">{items.length}</span>
          </div>
          <div className="ps-int-grid">
            {items.map((item) => (
              <IntegrationCard key={item.id} item={item} onToggle={() => toggle(section, item.id)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

// ===== Notifications Tab =====
interface NotificationRule {
  name: string;
  trigger: string;
  recipients: string;
  launchOwners: boolean;
  attributes: string[];
}

const ChannelLogos: Record<string, React.ReactNode> = {
  email: (
    <svg viewBox="0 0 32 32" width="18" height="18">
      <rect x="3" y="6" width="26" height="20" rx="3" fill="#475569" />
      <path fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="m6 10 10 7 10-7" />
    </svg>
  ),
  slack: (
    <svg viewBox="0 0 32 32" width="18" height="18">
      <rect x="13" y="2" width="6" height="14" rx="3" fill="#36c5f0" />
      <rect x="2" y="13" width="14" height="6" rx="3" fill="#2eb67d" />
      <rect x="16" y="16" width="14" height="6" rx="3" fill="#ecb22e" />
      <rect x="13" y="16" width="6" height="14" rx="3" fill="#e01e5a" />
    </svg>
  ),
  telegram: (
    <svg viewBox="0 0 32 32" width="18" height="18">
      <circle cx="16" cy="16" r="14" fill="#229ed9" />
      <path fill="#fff" d="m9 16 14-6c.7-.3 1.3.2 1 1l-2.4 11c-.2.8-.7 1-1.4.6l-3.7-2.7-1.8 1.8c-.2.2-.4.4-.8.4l.3-4 7.4-6.7c.3-.3 0-.5-.5-.2l-9.1 5.7-4-1.2c-.8-.3-.8-.9 0-1.2z" />
    </svg>
  ),
};

const CHANNEL_DEFS = [
  { id: "email", label: "email", desc: "Select email recipients list for every rule to send launch related notifications" },
  { id: "slack", label: "slack", desc: "Select Slack channel for every rule to send launch related notifications" },
  { id: "telegram", label: "telegram", desc: "Select Telegram channel for every rule to send launch related notifications" },
];

const TRIGGER_OPTIONS = [
  { id: "always", label: "Always" },
  { id: "more_10", label: "More than 10% of items have issues" },
  { id: "more_20", label: "More than 20% of items have issues" },
  { id: "to_invest", label: "Has 'To investigate' items" },
  { id: "failed", label: "Has failed items" },
];

const RuleModal: React.FC<{
  channel: string;
  onClose: () => void;
  onSave: (rule: NotificationRule) => void;
  initial?: NotificationRule;
}> = ({ channel, onClose, onSave, initial }) => {
  const [name, setName] = useState(initial?.name || "");
  const [trigger, setTrigger] = useState(initial?.trigger || "always");
  const [recipients, setRecipients] = useState(initial?.recipients || (channel === "email" ? "" : "#general"));
  const [launchOwners, setLaunchOwners] = useState(initial?.launchOwners ?? true);
  const [attributes, setAttributes] = useState<string[]>(initial?.attributes || []);

  const toggleAttr = (a: string) => setAttributes((prev) => prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]);
  const valid = name.trim() && recipients.trim();

  return (
    <ModalOverlay onClose={onClose}>
      <div className="ps-rule-modal">
        <ModalHead title={initial ? `Edit ${channel} rule` : `Create ${channel} rule`} onClose={onClose} />
        <div className="ps-rule-form">
          <div>
            <label>Rule name</label>
            <input type="text" placeholder="e.g. Notify QA leads on regression failures" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div>
            <label>Trigger</label>
            <select value={trigger} onChange={(e) => setTrigger(e.target.value)}>
              {TRIGGER_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label>{channel === "email" ? "Recipients (comma-separated)" : "Channel"}</label>
            <input type="text" placeholder={channel === "email" ? "alice@acme.com, bob@acme.com" : channel === "slack" ? "#qa-alerts" : "@qa_alerts_bot"} value={recipients} onChange={(e) => setRecipients(e.target.value)} />
          </div>
          <div>
            <label>Launch attributes (filter)</label>
            <div className="ps-checkbox-row">
              {["regression", "smoke", "nightly", "release", "ci"].map((a) => (
                <span key={a} className={`ps-checkbox-chip ${attributes.includes(a) ? "on" : ""}`} onClick={() => toggleAttr(a)}>
                  {attributes.includes(a) && <CheckIcon />}
                  {a}
                </span>
              ))}
            </div>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 500, cursor: "pointer", marginBottom: 0 }}>
            <input type="checkbox" checked={launchOwners} onChange={(e) => setLaunchOwners(e.target.checked)} style={{ width: "auto" }} />
            <span style={{ color: "var(--color-text)", fontSize: 13 }}>Notify launch owners by default</span>
          </label>
        </div>
        <div className="ps-modal-foot" style={{ justifyContent: "flex-end" }}>
          <button className="ps-modal-cancel" onClick={onClose}>Cancel</button>
          <button className="ps-modal-apply" disabled={!valid} onClick={() => onSave({ name: name.trim(), trigger, recipients: recipients.trim(), launchOwners, attributes })}>
            {initial ? "Save changes" : "Create rule"}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
};

const NotificationsTab: React.FC = () => {
  const [allOn, setAllOn] = useState(true);
  const [channels, setChannels] = useState<Record<string, { on: boolean; rules: NotificationRule[] }>>({
    email: { on: true, rules: [] },
    slack: { on: false, rules: [] },
    telegram: { on: false, rules: [] },
  });
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [creating, setCreating] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ channel: string; idx: number } | null>(null);

  const triggerLabel = (id: string) => TRIGGER_OPTIONS.find((t) => t.id === id)?.label || id;
  const setChannelOn = (id: string, on: boolean) => setChannels((c) => ({ ...c, [id]: { ...c[id], on } }));
  const addRule = (id: string, rule: NotificationRule) => setChannels((c) => ({ ...c, [id]: { ...c[id], rules: [...c[id].rules, rule] } }));
  const updateRule = (id: string, idx: number, rule: NotificationRule) => setChannels((c) => ({ ...c, [id]: { ...c[id], rules: c[id].rules.map((r, i) => (i === idx ? rule : r)) } }));
  const deleteRule = (id: string, idx: number) => setChannels((c) => ({ ...c, [id]: { ...c[id], rules: c[id].rules.filter((_, i) => i !== idx) } }));

  return (
    <div className="ps-panel">
      <div className="ps-panel-head">
        <h2 className="ps-panel-title">Notifications</h2>
        <span className="ps-panel-subtitle">Manage launch related notifications for Email, Slack, etc.</span>
      </div>

      <div className="ps-master-toggle">
        <div className="ps-master-toggle-text">
          <div className="ps-master-toggle-title">All notifications</div>
          <div className="ps-master-toggle-desc">Turn off to stop all notifications. When on, notifications are sent only through the channels enabled below.</div>
        </div>
        <span className={`ps-switch ${allOn ? "on" : ""}`} onClick={() => setAllOn((v) => !v)} />
      </div>

      {CHANNEL_DEFS.map((def) => {
        const ch = channels[def.id];
        const isCollapsed = collapsed[def.id];
        const ruleCount = ch.rules.length;
        return (
          <div key={def.id} className={`ps-channel ${isCollapsed ? "collapsed" : ""}`}>
            <div className="ps-channel-head" onClick={() => setCollapsed((c) => ({ ...c, [def.id]: !c[def.id] }))}>
              <span className="ps-channel-icon">{ChannelLogos[def.id]}</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="ps-channel-name">{def.label}</div>
                <div className="ps-channel-desc">{def.desc}</div>
              </div>
              <span className={`ps-channel-rules-count ${ruleCount > 0 ? "has-rules" : ""}`}>
                {ruleCount} rule{ruleCount !== 1 ? "s" : ""}
              </span>
              <span className={`ps-switch ${ch.on && allOn ? "on" : ""} ${!allOn ? "disabled" : ""}`} onClick={(e) => { e.stopPropagation(); if (allOn) setChannelOn(def.id, !ch.on); }} />
              <span className="ps-channel-chevron"><ChevronIcon /></span>
            </div>
            <div className="ps-channel-body">
              {ch.rules.length === 0 ? (
                <div className="ps-rules-empty">No {def.id} notification rules yet</div>
              ) : (
                ch.rules.map((r, i) => (
                  <div key={i} className="ps-rule">
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="ps-rule-name">{r.name}</div>
                      <div className="ps-rule-meta">
                        {triggerLabel(r.trigger)} &middot; sends to <strong>{r.recipients}</strong>
                        {r.attributes.length > 0 && <> &middot; {r.attributes.join(", ")}</>}
                      </div>
                    </div>
                    <button className="ps-rule-action" onClick={() => setEditing({ channel: def.id, idx: i })} title="Edit"><EditIcon /></button>
                    <button className="ps-rule-action danger" onClick={() => deleteRule(def.id, i)} title="Delete"><TrashIcon /></button>
                  </div>
                ))
              )}
              <button className="ps-create-rule-btn" onClick={() => setCreating(def.id)}>
                <PlusIcon /> Create Rule
              </button>
            </div>
          </div>
        );
      })}

      {creating && (
        <RuleModal channel={creating} onClose={() => setCreating(null)} onSave={(rule) => { addRule(creating, rule); setCreating(null); }} />
      )}
      {editing && (
        <RuleModal channel={editing.channel} initial={channels[editing.channel].rules[editing.idx]} onClose={() => setEditing(null)} onSave={(rule) => { updateRule(editing.channel, editing.idx, rule); setEditing(null); }} />
      )}
    </div>
  );
};

// ===== Defect Types Tab =====
interface DefectTypeItem {
  id: string;
  name: string;
  abbr: string;
  color: string;
  isDefault: boolean;
}

const DEFECT_GROUPS = [
  { id: "PB", title: "Product Bug Group", color: "#ef4444", baseName: "Product Bug", baseAbbr: "PB" },
  { id: "AB", title: "Automation Bug Group", color: "#f59e0b", baseName: "Automation Bug", baseAbbr: "AB" },
  { id: "SI", title: "System Issue Group", color: "#0ea5e9", baseName: "System Issue", baseAbbr: "SI" },
  { id: "ND", title: "No Defect Group", color: "#94a3b8", baseName: "No Defect", baseAbbr: "ND" },
  { id: "TI", title: "To Investigate Group", color: "#8b5cf6", baseName: "To Investigate", baseAbbr: "TI" },
];

const DT_PALETTE = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308",
  "#84cc16", "#22c55e", "#10b981", "#14b8a6",
  "#06b6d4", "#0ea5e9", "#3b82f6", "#6366f1",
  "#8b5cf6", "#a855f7", "#d946ef", "#ec4899",
  "#f43f5e", "#94a3b8", "#64748b", "#475569",
  "#7c2d12", "#365314", "#1e3a8a", "#581c87",
];

const MAX_PER_GROUP = 6;

const initialDefectTypes = (): Record<string, DefectTypeItem[]> => {
  const map: Record<string, DefectTypeItem[]> = {};
  DEFECT_GROUPS.forEach((g) => {
    map[g.id] = [{ id: `${g.id}-base`, name: g.baseName, abbr: g.baseAbbr, color: g.color, isDefault: true }];
  });
  return map;
};

const ColorSwatchPicker: React.FC<{ value: string; onChange: (c: string) => void }> = ({ value, onChange }) => (
  <div className="ps-color-grid">
    {DT_PALETTE.map((c) => (
      <span key={c} className={`ps-color-swatch ${c === value ? "selected" : ""}`} style={{ background: c }} onClick={() => onChange(c)} />
    ))}
  </div>
);

const DefectTypeModal: React.FC<{
  initial?: { name: string; abbr: string; color: string; group: string };
  lockGroup: string | null;
  onClose: () => void;
  onSave: (t: { name: string; abbr: string; color: string; group: string }) => void;
  existingAbbrs: string[];
}> = ({ initial, lockGroup, onClose, onSave, existingAbbrs }) => {
  const [name, setName] = useState(initial?.name || "");
  const [abbr, setAbbr] = useState(initial?.abbr || "");
  const [color, setColor] = useState(initial?.color || "#3b82f6");
  const [group, setGroup] = useState(initial?.group || lockGroup || "PB");

  const conflict = abbr.trim() && existingAbbrs.includes(abbr.trim().toUpperCase()) && abbr.trim().toUpperCase() !== initial?.abbr?.toUpperCase();
  const valid = name.trim() && abbr.trim().length >= 2 && abbr.trim().length <= 4 && !conflict;

  return (
    <ModalOverlay onClose={onClose}>
      <div className="ps-rule-modal">
        <ModalHead title={initial ? "Edit defect type" : "Create defect type"} onClose={onClose} />
        <div className="ps-rule-form">
          {!lockGroup && (
            <div>
              <label>Group</label>
              <select value={group} onChange={(e) => setGroup(e.target.value)} disabled={!!initial}>
                {DEFECT_GROUPS.map((g) => <option key={g.id} value={g.id}>{g.title.replace(" Group", "")}</option>)}
              </select>
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 100px", gap: 12 }}>
            <div>
              <label>Defect Type name</label>
              <input type="text" placeholder="e.g. Flaky network" value={name} onChange={(e) => setName(e.target.value)} maxLength={32} autoFocus />
            </div>
            <div>
              <label>Abbreviation</label>
              <input type="text" placeholder="FLK" value={abbr} onChange={(e) => setAbbr(e.target.value.toUpperCase())} maxLength={4} style={{ fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.04em" }} />
            </div>
          </div>
          {conflict && <div style={{ fontSize: 12, color: "#dc2626" }}>Abbreviation already in use.</div>}
          <div>
            <label>Color</label>
            <ColorSwatchPicker value={color} onChange={setColor} />
          </div>
          <div style={{ padding: 10, background: "var(--color-surface-secondary)", borderRadius: 6, fontSize: 12, color: "var(--color-text-secondary)" }}>
            Preview:&nbsp;
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, marginLeft: 4 }}>
              <span style={{ width: 10, height: 10, background: color, borderRadius: 3, display: "inline-block" }} />
              <strong style={{ color: "var(--color-text)" }}>{name || "Defect name"}</strong>
              <span className="ps-dt-abbr">{abbr || "ABC"}</span>
            </span>
          </div>
        </div>
        <div className="ps-modal-foot" style={{ justifyContent: "flex-end" }}>
          <button className="ps-modal-cancel" onClick={onClose}>Cancel</button>
          <button className="ps-modal-apply" disabled={!valid} onClick={() => onSave({ name: name.trim(), abbr: abbr.trim().toUpperCase(), color, group })}>
            {initial ? "Save changes" : "Create"}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
};

const DefectTypesTab: React.FC = () => {
  const [types, setTypes] = useState(initialDefectTypes);
  const [creating, setCreating] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ group: string; idx: number } | null>(null);

  const allAbbrs = Object.values(types).flat().map((t) => t.abbr.toUpperCase());

  const addType = (group: string, t: { name: string; abbr: string; color: string }) => {
    setTypes((prev) => ({ ...prev, [group]: [...prev[group], { ...t, id: `${group}-${Date.now()}`, isDefault: false }] }));
  };
  const updateType = (group: string, idx: number, t: { name: string; abbr: string; color: string }) => {
    setTypes((prev) => ({ ...prev, [group]: prev[group].map((x, i) => (i === idx ? { ...x, ...t } : x)) }));
  };
  const removeType = (group: string, idx: number) => {
    setTypes((prev) => ({ ...prev, [group]: prev[group].filter((_, i) => i !== idx) }));
  };

  return (
    <div className="ps-panel">
      <div className="ps-panel-head">
        <h2 className="ps-panel-title">Defect types</h2>
        <span className="ps-panel-subtitle">{Object.values(types).flat().length} types across 5 groups</span>
      </div>

      <div className="ps-dt-create-row">
        <button className="ps-btn-primary ps-btn" onClick={() => setCreating("any")}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><PlusIcon /> Create Defect Type</span>
        </button>
      </div>

      <div className="ps-dt-intro">
        Defect Types are a set of defects that are most likely to appear during tests execution. You can use default Defect Types or create your own to make it easier to analyze test execution results.
      </div>

      {DEFECT_GROUPS.map((g) => {
        const list = types[g.id];
        const atLimit = list.length >= MAX_PER_GROUP;
        return (
          <div key={g.id} className="ps-dt-group">
            <div className="ps-dt-group-head">
              <span className="ps-dt-group-color" style={{ background: g.color }} />
              <span className="ps-dt-group-title">{g.title}</span>
              <span className="ps-dt-group-count">{list.length}/{MAX_PER_GROUP}</span>
            </div>
            <div className="ps-dt-table-head">
              <span></span>
              <span>Defect Type name</span>
              <span>Abbreviation</span>
              <span style={{ textAlign: "right" }}>Action</span>
            </div>
            {list.map((t, i) => (
              <div key={t.id} className="ps-dt-row">
                <span className="ps-dt-color-swatch" style={{ background: t.color }} onClick={() => !t.isDefault && setEditing({ group: g.id, idx: i })} title={t.isDefault ? "Default color" : "Click to edit"} />
                <span className={`ps-dt-name ${t.isDefault ? "ps-dt-name-default" : ""}`}>{t.name}</span>
                <span><span className="ps-dt-abbr">{t.abbr}</span></span>
                <span className="ps-dt-actions">
                  <button className="ps-dt-action-btn" disabled={t.isDefault} onClick={() => setEditing({ group: g.id, idx: i })} title={t.isDefault ? "Default types can't be edited" : "Edit"}><EditIcon /></button>
                  <button className="ps-dt-action-btn danger" disabled={t.isDefault} onClick={() => removeType(g.id, i)} title={t.isDefault ? "Default types can't be deleted" : "Delete"}><TrashIcon /></button>
                </span>
              </div>
            ))}
            <div className="ps-dt-add-row">
              {atLimit ? (
                <span className="ps-dt-limit-msg">Maximum of {MAX_PER_GROUP} types per group reached.</span>
              ) : (
                <button className="ps-dt-add-btn" onClick={() => setCreating(g.id)}>
                  <PlusIcon /> Add subtype
                </button>
              )}
            </div>
          </div>
        );
      })}

      {creating && (
        <DefectTypeModal lockGroup={creating === "any" ? null : creating} existingAbbrs={allAbbrs} onClose={() => setCreating(null)} onSave={(t) => { addType(t.group, t); setCreating(null); }} />
      )}
      {editing && (
        <DefectTypeModal initial={{ ...types[editing.group][editing.idx], group: editing.group }} lockGroup={editing.group} existingAbbrs={allAbbrs} onClose={() => setEditing(null)} onSave={(t) => { updateType(editing.group, editing.idx, t); setEditing(null); }} />
      )}
    </div>
  );
};

// ===== Log Types Tab =====
interface LogTypeItem {
  id: string;
  name: string;
  level: number;
  color: string;
  bg: string;
  showInFilter: boolean;
  isDefault: boolean;
  example: string;
}

const DEFAULT_LOG_TYPES: LogTypeItem[] = [
  { id: "fatal", name: "fatal", level: 50000, color: "#dc2626", bg: "rgba(220,38,38,0.06)", showInFilter: true, isDefault: true, example: "java.lang.OutOfMemoryError: Java heap space" },
  { id: "error", name: "error", level: 40000, color: "#ef4444", bg: "rgba(239,68,68,0.06)", showInFilter: true, isDefault: true, example: "Element not found: locator='#submit-btn'" },
  { id: "warn", name: "warn", level: 30000, color: "#f59e0b", bg: "rgba(245,158,11,0.06)", showInFilter: true, isDefault: true, example: "Deprecated API usage detected in TestRunner.java:124" },
  { id: "info", name: "info", level: 20000, color: "#0ea5e9", bg: "rgba(14,165,233,0.06)", showInFilter: true, isDefault: true, example: "Test step started: 'Login with valid credentials'" },
  { id: "debug", name: "debug", level: 10000, color: "#64748b", bg: "rgba(100,116,139,0.06)", showInFilter: false, isDefault: true, example: "Resolved selector: button[data-test=\"submit\"]" },
  { id: "trace", name: "trace", level: 5000, color: "#94a3b8", bg: "rgba(148,163,184,0.05)", showInFilter: false, isDefault: true, example: "HTTP GET /api/launches/3 -> 200 OK (84ms)" },
];

const LogTypeModal: React.FC<{
  initial?: LogTypeItem;
  onClose: () => void;
  onSave: (lt: { name: string; level: number; color: string; bg: string; showInFilter: boolean }) => void;
  existingNames: string[];
}> = ({ initial, onClose, onSave, existingNames }) => {
  const [name, setName] = useState(initial?.name || "");
  const [level, setLevel] = useState(initial?.level || 25000);
  const [color, setColor] = useState(initial?.color || "#3b82f6");
  const [showInFilter, setShowInFilter] = useState(initial?.showInFilter ?? true);

  const lower = name.trim().toLowerCase();
  const conflict = lower && existingNames.includes(lower) && lower !== initial?.name?.toLowerCase();
  const valid = lower && lower.length <= 16 && !conflict && Number.isFinite(level);
  const bg = color + "10";

  return (
    <ModalOverlay onClose={onClose}>
      <div className="ps-rule-modal">
        <ModalHead title={initial ? "Edit log type" : "Create log type"} onClose={onClose} />
        <div className="ps-rule-form">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 130px", gap: 12 }}>
            <div>
              <label>Type name</label>
              <input type="text" placeholder="e.g. notice" value={name} onChange={(e) => setName(e.target.value.toLowerCase())} maxLength={16} autoFocus style={{ fontFamily: "var(--font-mono)" }} />
            </div>
            <div>
              <label>Log level</label>
              <input type="number" placeholder="25000" value={level} onChange={(e) => setLevel(+e.target.value)} step={1000} />
            </div>
          </div>
          {conflict && <div style={{ fontSize: 12, color: "#dc2626" }}>Type name already in use.</div>}
          <div>
            <label>Color</label>
            <ColorSwatchPicker value={color} onChange={setColor} />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: 0 }}>
            <span className={`ps-switch ${showInFilter ? "on" : ""}`} onClick={() => setShowInFilter((v) => !v)} />
            <span style={{ fontSize: 13, color: "var(--color-text)" }}>Show in log filter</span>
          </label>
          <div>
            <label>Preview</label>
            <div className="ps-lt-preview" style={{ "--lt-color": color, "--lt-bg": bg } as React.CSSProperties}>
              <span className="ps-lt-preview-time">12:04:38.211</span>
              <span className="ps-lt-preview-tag" style={{ background: color }}>{name || "type"}</span>
              <span>Log example</span>
            </div>
          </div>
        </div>
        <div className="ps-modal-foot" style={{ justifyContent: "flex-end" }}>
          <button className="ps-modal-cancel" onClick={onClose}>Cancel</button>
          <button className="ps-modal-apply" disabled={!valid} onClick={() => onSave({ name: lower, level, color, bg, showInFilter })}>
            {initial ? "Save changes" : "Create"}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
};

const LogTypesTab: React.FC = () => {
  const [logs, setLogs] = useState(DEFAULT_LOG_TYPES);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<{ idx: number } | null>(null);

  const sorted = [...logs].sort((a, b) => b.level - a.level);
  const addLog = (lt: { name: string; level: number; color: string; bg: string; showInFilter: boolean }) => setLogs((prev) => [...prev, { ...lt, id: `lt-${Date.now()}`, isDefault: false, example: "Custom log entry" }]);
  const updateLog = (idx: number, lt: { name: string; level: number; color: string; bg: string; showInFilter: boolean }) => setLogs((prev) => prev.map((x, i) => (i === idx ? { ...x, ...lt } : x)));
  const removeLog = (idx: number) => setLogs((prev) => prev.filter((_, i) => i !== idx));
  const toggleFilter = (idx: number) => setLogs((prev) => prev.map((x, i) => (i === idx ? { ...x, showInFilter: !x.showInFilter } : x)));

  return (
    <div className="ps-panel">
      <div className="ps-panel-head">
        <h2 className="ps-panel-title">Log types</h2>
        <span className="ps-panel-subtitle">{logs.length} configured</span>
      </div>

      <div className="ps-dt-create-row">
        <button className="ps-btn-primary ps-btn" onClick={() => setCreating(true)}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><PlusIcon /> Create log type</span>
        </button>
      </div>

      <div className="ps-dt-intro">
        Log types help visually highlight the importance of events at specific moments. Each log entry has a type. You can customize log types to fit your needs.
      </div>

      <div className="ps-lt-table">
        <div className="ps-lt-head">
          <span>Color</span>
          <span>Type name</span>
          <span>Log level</span>
          <span>Color palette preview</span>
          <span>Show in filter</span>
          <span style={{ textAlign: "right" }}>Action</span>
        </div>
        {sorted.map((lt) => {
          const idx = logs.findIndex((x) => x.id === lt.id);
          return (
            <div key={lt.id} className="ps-lt-row">
              <span className="ps-lt-color-cell">
                <span className="ps-dt-color-swatch" style={{ background: lt.color }} onClick={() => !lt.isDefault && setEditing({ idx })} title={lt.isDefault ? "Default color" : "Click to edit"} />
              </span>
              <span className="ps-lt-name" style={{ color: lt.color }}>{lt.name}</span>
              <span className="ps-lt-level">{lt.level.toLocaleString()}</span>
              <span className="ps-lt-preview" style={{ "--lt-color": lt.color, "--lt-bg": lt.bg } as React.CSSProperties}>
                <span className="ps-lt-preview-time">12:04:38.211</span>
                <span className="ps-lt-preview-tag" style={{ background: lt.color }}>{lt.name}</span>
                <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{lt.example}</span>
              </span>
              <span style={{ display: "flex", alignItems: "center" }}>
                <span className={`ps-switch ${lt.showInFilter ? "on" : ""}`} onClick={() => toggleFilter(idx)} />
              </span>
              <span className="ps-lt-actions">
                <button className="ps-dt-action-btn" disabled={lt.isDefault} onClick={() => setEditing({ idx })} title={lt.isDefault ? "Default types can't be edited" : "Edit"}><EditIcon /></button>
                <button className="ps-dt-action-btn danger" disabled={lt.isDefault} onClick={() => removeLog(idx)} title={lt.isDefault ? "Default types can't be deleted" : "Delete"}><TrashIcon /></button>
              </span>
            </div>
          );
        })}
      </div>

      {creating && (
        <LogTypeModal existingNames={logs.map((l) => l.name.toLowerCase())} onClose={() => setCreating(false)} onSave={(lt) => { addLog(lt); setCreating(false); }} />
      )}
      {editing && (
        <LogTypeModal initial={logs[editing.idx]} existingNames={logs.map((l) => l.name.toLowerCase())} onClose={() => setEditing(null)} onSave={(lt) => { updateLog(editing.idx, lt); setEditing(null); }} />
      )}
    </div>
  );
};

// ===== Analyzer Tab =====
const ANALYZER_SUBTABS = [
  { id: "index", label: "Index Settings" },
  { id: "auto", label: "Auto-Analysis" },
  { id: "similar", label: "Similar Items" },
  { id: "unique", label: "Unique Errors" },
];

const ANALYSIS_BASE_OPTIONS = [
  "Current launch only",
  "Current and all previous launches with the same name",
  "Current and previous launches with the same attributes",
  "All launches in the project",
];

const LOG_LINES_OPTIONS = ["3", "5", "10", "20", "50", "100", "All"];

const ConfirmModal: React.FC<{
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}> = ({ title, body, confirmLabel, danger, onClose, onConfirm }) => (
  <ModalOverlay onClose={onClose}>
    <div className="ps-confirm-modal">
      <ModalHead title={title} onClose={onClose} />
      <div className="ps-confirm-body">{body}</div>
      <div className="ps-modal-foot" style={{ justifyContent: "flex-end" }}>
        <button className="ps-modal-cancel" onClick={onClose}>Cancel</button>
        <button className="ps-modal-apply" style={danger ? { background: "#dc2626" } : {}} onClick={() => { onConfirm(); onClose(); }}>
          {confirmLabel}
        </button>
      </div>
    </div>
  </ModalOverlay>
);

const IndexSettingsPanel: React.FC<{ onToast: (msg: string) => void }> = ({ onToast }) => {
  const [confirm, setConfirm] = useState<string | null>(null);
  return (
    <>
      <div className="ps-section-intro">
        Each log entry along with its defect type is saved to the search engine as a separate document. All documents compose an Index. The more test results in the index, the more accurate the analysis will be.
      </div>
      <h3 className="ps-section-title">Actions with index</h3>
      <div className="ps-action-help">
        <strong>"Generate Index"</strong> removes all data from the search engine and rebuilds it based on all previous investigations.
        <br /><br />
        <strong>"Remove Index"</strong> deletes all investigation data from the search engine. To add new data, generate an index or investigate test results manually.
      </div>
      <div className="ps-action-row">
        <button className="ps-btn-primary ps-btn" onClick={() => setConfirm("generate")}>Generate Index</button>
        <button className="ps-btn" style={{ borderColor: "#fecaca", color: "#dc2626" }} onClick={() => setConfirm("remove")}>Remove Index</button>
      </div>
      {confirm === "generate" && (
        <ConfirmModal title="Generate index?" body={<>This will remove all current index data and rebuild it from scratch using your investigated test results.</>} confirmLabel="Generate" onClose={() => setConfirm(null)} onConfirm={() => onToast("Index generation started")} />
      )}
      {confirm === "remove" && (
        <ConfirmModal title="Remove index?" body={<>All index data with your investigations will be deleted. <strong>Auto-analysis will stop working</strong> until you generate a new index. This cannot be undone.</>} confirmLabel="Remove index" danger onClose={() => setConfirm(null)} onConfirm={() => onToast("Index removed")} />
      )}
    </>
  );
};

const AutoAnalysisPanel: React.FC<{ onToast: (msg: string) => void }> = ({ onToast }) => {
  const [enabled, setEnabled] = useState(true);
  const [base, setBase] = useState(ANALYSIS_BASE_OPTIONS[1]);
  const [minMatch, setMinMatch] = useState(95);
  const [logLines, setLogLines] = useState("All");
  const [match3plus, setMatch3plus] = useState(true);
  const [longestRetry, setLongestRetry] = useState(false);

  return (
    <>
      <div className="ps-section-intro">
        Auto-Analysis reduces the time spent on test execution investigation by analyzing test failures automatically using Machine Learning based on previous user-investigated results.
      </div>

      <div className="ps-master-toggle">
        <div className="ps-master-toggle-text">
          <div className="ps-master-toggle-title">Auto-Analysis</div>
          <div className="ps-master-toggle-desc">Active Auto-Analysis will start as soon as any launch is finished</div>
        </div>
        <span className={`ps-switch ${enabled ? "on" : ""}`} onClick={() => setEnabled((v) => !v)} />
      </div>

      <div className="ps-field">
        <label className="ps-field-label">Auto-Analysis based on</label>
        <div className="ps-field-control">
          <div className="ps-select-wrap">
            <select className="ps-select" value={base} onChange={(e) => setBase(e.target.value)} disabled={!enabled}>
              {ANALYSIS_BASE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div className="ps-help">Specify the launches that will be used as the base for Auto-Analysis.</div>
        </div>
      </div>

      <div className="ps-field">
        <label className="ps-field-label">Minimum should match</label>
        <div className="ps-field-control">
          <div className="ps-slider-wrap">
            <input type="range" className="ps-slider" min="50" max="100" value={minMatch} disabled={!enabled} onChange={(e) => setMinMatch(+e.target.value)} />
            <span className="ps-slider-value">{minMatch}%</span>
          </div>
          <div className="ps-help">Percent of words equality between analyzed log and particular log from the search engine.</div>
        </div>
      </div>

      <div className="ps-field">
        <label className="ps-field-label">Log lines considered</label>
        <div className="ps-field-control">
          <div className="ps-select-wrap">
            <select className="ps-select" value={logLines} onChange={(e) => setLogLines(e.target.value)} disabled={!enabled}>
              {LOG_LINES_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div className="ps-help">The number of first lines of log message that should be considered in the search engine.</div>
        </div>
      </div>

      <div style={{ marginTop: 8 }}>
        <div className="ps-checkbox-field">
          <span className={`ps-switch ${match3plus && enabled ? "on" : ""} ${!enabled ? "disabled" : ""}`} onClick={() => enabled && setMatch3plus((v) => !v)} />
          <div className="ps-checkbox-field-text">
            <div className="ps-checkbox-field-title">All logs with 3 or more rows should match</div>
            <div className="ps-checkbox-field-help">When an analyzed test item contains logs with 3 or more rows.</div>
          </div>
        </div>
        <div className="ps-checkbox-field">
          <span className={`ps-switch ${longestRetry && enabled ? "on" : ""} ${!enabled ? "disabled" : ""}`} onClick={() => enabled && setLongestRetry((v) => !v)} />
          <div className="ps-checkbox-field-text">
            <div className="ps-checkbox-field-title">Defect assignment based on the longest retry</div>
            <div className="ps-checkbox-field-help">Assigns the defect type based on the retry that has the highest number of passed nested steps.</div>
          </div>
        </div>
      </div>

      <div className="ps-actions">
        <button className="ps-btn-primary ps-btn" onClick={() => onToast("Auto-Analysis settings saved")}>Submit</button>
      </div>
    </>
  );
};

const SimilarItemsPanel: React.FC<{ onToast: (msg: string) => void }> = ({ onToast }) => {
  const [match, setMatch] = useState(95);
  return (
    <>
      <div className="ps-section-intro">
        Besides known issues with selected defect types, there could be issues with a similar reason marked as "To investigate". All these items are displayed in the "Similar To Investigate" section in the Defect editor modal.
      </div>
      <div className="ps-field">
        <label className="ps-field-label">Minimum should match</label>
        <div className="ps-field-control">
          <div className="ps-slider-wrap">
            <input type="range" className="ps-slider" min="50" max="100" value={match} onChange={(e) => setMatch(+e.target.value)} />
            <span className="ps-slider-value">{match}%</span>
          </div>
          <div className="ps-help">Percent of words equality between a log from the considered test item and a log from To Investigate item in the search engine.</div>
        </div>
      </div>
      <div className="ps-actions">
        <button className="ps-btn-primary ps-btn" onClick={() => onToast("Similar Items settings saved")}>Submit</button>
      </div>
    </>
  );
};

const UniqueErrorsPanel: React.FC<{ onToast: (msg: string) => void }> = ({ onToast }) => {
  const [enabled, setEnabled] = useState(true);
  const [mode, setMode] = useState("exclude_numbers");

  return (
    <>
      <div className="ps-section-intro">
        Unique error analysis detects all unique error logs in the launch and forms them into clusters with relevant failed test items.
      </div>

      <div className="ps-master-toggle">
        <div className="ps-master-toggle-text">
          <div className="ps-master-toggle-title">Auto-Unique Error</div>
          <div className="ps-master-toggle-desc">If active, analysis starts as soon as any launch is finished</div>
        </div>
        <span className={`ps-switch ${enabled ? "on" : ""}`} onClick={() => setEnabled((v) => !v)} />
      </div>

      <div className="ps-field">
        <label className="ps-field-label">Analyzed Error Logs</label>
        <div className="ps-field-control">
          <div className="ps-help" style={{ marginTop: 0, marginBottom: 12 }}>Logs can be analyzed with or without numbers.</div>
          <div className="ps-radio-row">
            <div className={`ps-radio ${mode === "exclude_numbers" ? "selected" : ""}`} onClick={() => setMode("exclude_numbers")}>
              <span className="ps-radio-dot" />
              <div>
                <div className="ps-radio-label">Exclude numbers from analyzed logs</div>
                <div className="ps-radio-help">Recommended -- collapses logs that differ only in IDs, ports, line numbers, etc. into the same cluster.</div>
              </div>
            </div>
            <div className={`ps-radio ${mode === "include_numbers" ? "selected" : ""}`} onClick={() => setMode("include_numbers")}>
              <span className="ps-radio-dot" />
              <div>
                <div className="ps-radio-label">Include numbers in analyzed logs</div>
                <div className="ps-radio-help">Stricter -- logs with different numeric values produce separate clusters.</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="ps-actions">
        <button className="ps-btn-primary ps-btn" onClick={() => onToast("Unique Errors settings saved")}>Submit</button>
      </div>
    </>
  );
};

const AnalyzerTab: React.FC<{ onToast: (msg: string) => void }> = ({ onToast }) => {
  const [sub, setSub] = useState("index");
  return (
    <div className="ps-panel">
      <div className="ps-panel-head">
        <h2 className="ps-panel-title">Analyzer</h2>
        <span className="ps-panel-subtitle">Index, Auto-Analysis, Similar Items & Unique Errors</span>
      </div>
      <nav className="ps-subtabs">
        {ANALYZER_SUBTABS.map((t) => (
          <button key={t.id} className={`ps-subtab ${sub === t.id ? "active" : ""}`} onClick={() => setSub(t.id)}>{t.label}</button>
        ))}
      </nav>
      {sub === "index" && <IndexSettingsPanel onToast={onToast} />}
      {sub === "auto" && <AutoAnalysisPanel onToast={onToast} />}
      {sub === "similar" && <SimilarItemsPanel onToast={onToast} />}
      {sub === "unique" && <UniqueErrorsPanel onToast={onToast} />}
    </div>
  );
};

// ===== Placeholder Panel =====
const PlaceholderPanel: React.FC<{ tab: typeof PS_TABS[number] }> = ({ tab }) => (
  <div className="ps-panel">
    <div className="ps-panel-head">
      <h2 className="ps-panel-title">{tab.label}</h2>
      <span className="ps-panel-subtitle">Coming soon</span>
    </div>
    <div className="ps-empty">
      <div className="ps-empty-icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={tab.icon} /></svg>
      </div>
      <div className="ps-empty-title">{tab.label} settings</div>
      <div>This section is not yet available. Switch to the <strong>General</strong> tab to interact.</div>
    </div>
  </div>
);

// ===== Main Settings Page =====
const Settings: React.FC = () => {
  const [active, setActive] = useState("general");
  const [values, setValues] = useState<GeneralValues>(DEFAULT_VALUES);
  const [saved, setSaved] = useState<GeneralValues>(DEFAULT_VALUES);
  const [toast, setToast] = useState<string | null>(null);

  const dirty = Object.keys(values).some((k) => values[k as keyof GeneralValues] !== saved[k as keyof GeneralValues]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }, []);

  const onSubmit = () => {
    setSaved(values);
    showToast("Settings saved");
  };

  const activeTab = PS_TABS.find((t) => t.id === active)!;

  return (
    <div>
      <div className="page-header">
        <div className="page-title-row" style={{ marginBottom: 4 }}>
          <h1 className="page-title" style={{ margin: 0 }}>Project Settings</h1>
        </div>
        <div style={{ color: "var(--color-text-muted)", fontSize: 13, marginBottom: 22 }}>
          default_personal &middot; configure retention, integrations & analyzer behavior
        </div>
      </div>

      <div className="ps-shell">
        <nav className="ps-tabs">
          {PS_TABS.map((t) => (
            <button key={t.id} className={`ps-tab ${active === t.id ? "active" : ""}`} onClick={() => setActive(t.id)}>
              <TabIcon d={t.icon} />
              {t.label}
            </button>
          ))}
        </nav>

        <div>
          {active === "general" && <GeneralTab values={values} setValues={setValues} onSubmit={onSubmit} dirty={dirty} />}
          {active === "integrations" && <IntegrationsTab />}
          {active === "notifications" && <NotificationsTab />}
          {active === "defects" && <DefectTypesTab />}
          {active === "logs" && <LogTypesTab />}
          {active === "analyzer" && <AnalyzerTab onToast={showToast} />}
          {!["general", "integrations", "notifications", "defects", "logs", "analyzer"].includes(active) && <PlaceholderPanel tab={activeTab} />}
        </div>
      </div>

      {toast && (
        <div className="ps-toast">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          {toast}
        </div>
      )}
    </div>
  );
};

export default Settings;

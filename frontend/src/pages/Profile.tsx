import React, { useState, useCallback } from "react";
import { useTheme } from "../context/ThemeContext";

const PROFILE_TABS = [
  { id: "keys", label: "API keys" },
  { id: "examples", label: "Configuration examples" },
];

// ---------- API Keys ----------
const ApiKeysPanel: React.FC<{ onToast: (msg: string) => void }> = ({ onToast }) => {
  const [keys, setKeys] = useState([
    { id: 1, name: "Default API key", value: "rs_live_8f3kQ2pL9xZmT4nB6cV7yH1aE5jW0sR8", created: "Auto-generated", lastUsed: "—", revealed: false },
  ]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const mask = (v: string) => v.slice(0, 11) + "•".repeat(20) + v.slice(-4);
  const toggleReveal = (id: number) => setKeys(prev => prev.map(k => k.id === id ? { ...k, revealed: !k.revealed } : k));
  const copy = (v: string) => { navigator.clipboard?.writeText(v); onToast("Copied to clipboard"); };
  const revoke = (id: number) => { setKeys(prev => prev.filter(k => k.id !== id)); onToast("API key revoked"); };
  const generate = () => {
    if (!newName.trim()) return;
    const v = "rs_live_" + Math.random().toString(36).slice(2, 14) + Math.random().toString(36).slice(2, 14);
    setKeys(prev => [...prev, { id: Date.now(), name: newName.trim(), value: v, created: "Just now", lastUsed: "—", revealed: true }]);
    setNewName("");
    setCreating(false);
    onToast("New API key generated");
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
          Use these keys to authenticate from your CI/CD pipeline.
        </div>
        {!creating && (
          <button className="pf-btn pf-btn-primary" onClick={() => setCreating(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            Generate API key
          </button>
        )}
      </div>
      {creating && (
        <div style={{ padding: 16, border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", marginBottom: 16, background: "var(--color-bg)" }}>
          <div className="pf-input-group">
            <label className="pf-input-label">Key name</label>
            <input className="pf-input" placeholder="e.g. CI Pipeline Token" value={newName} onChange={e => setNewName(e.target.value)} autoFocus />
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button className="pf-btn pf-btn-primary" onClick={generate} disabled={!newName.trim()}>Generate</button>
            <button className="pf-btn" onClick={() => { setCreating(false); setNewName(""); }}>Cancel</button>
          </div>
        </div>
      )}
      {keys.length === 0 ? (
        <div className="profile-empty">No API keys yet. Generate one to get started.</div>
      ) : keys.map(k => (
        <div className="api-key-row" key={k.id}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)" }}>{k.name}</span>
              <span className="api-key-meta">Created {k.created} &middot; Last used {k.lastUsed}</span>
            </div>
            <span className="api-key-mono">{k.revealed ? k.value : mask(k.value)}</span>
          </div>
          <div className="api-key-actions">
            <button className="icon-btn" title={k.revealed ? "Hide" : "Reveal"} onClick={() => toggleReveal(k.id)}>
              {k.revealed ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
              )}
            </button>
            <button className="icon-btn" title="Copy" onClick={() => copy(k.value)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
            </button>
            <button className="icon-btn danger" title="Revoke" onClick={() => revoke(k.id)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /></svg>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

// ---------- Configuration examples ----------
const ExamplesPanel: React.FC<{ onToast: (msg: string) => void }> = ({ onToast }) => {
  const [lang, setLang] = useState("python");
  const examples: Record<string, string> = {
    python: `# pytest plugin — install: pip install pytest-automation-reports
# pytest.ini or pyproject.toml
[reportstack]
endpoint = http://your-server:8000/api/v1
launch   = Regression Run

# run
$ pytest --ar-url=http://your-server:8000/api/v1 \\
         --ar-launch-name="Regression Run"`,
    js: `// npm install --save-dev @reportstack/playwright
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  reporter: [['@reportstack/playwright', {
    endpoint: 'http://your-server:8000/api/v1',
    launch:   'Regression Run',
  }]],
});`,
    curl: `# Create a launch via REST
$ curl -X POST http://your-server:8000/api/v1/launches/ \\
    -H "Content-Type: application/json" \\
    -d '{"name":"Regression Run"}'`,
  };

  const onCopy = () => {
    navigator.clipboard?.writeText(examples[lang] || "");
    onToast("Snippet copied");
  };

  return (
    <div>
      <div style={{ fontSize: 13, color: "var(--color-text-muted)", marginBottom: 16 }}>
        Drop these snippets into your test runner to start posting results to ReportStack.
      </div>
      <div className="code-tabs">
        {[
          { id: "python", label: "Python - pytest" },
          { id: "js", label: "Node - Playwright" },
          { id: "curl", label: "REST - curl" },
        ].map(t => (
          <button key={t.id} className={`code-tab ${lang === t.id ? "active" : ""}`} onClick={() => setLang(t.id)}>{t.label}</button>
        ))}
      </div>
      <div className="code-block">
        <button className="code-copy" onClick={onCopy}>Copy</button>
        <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{examples[lang]}</pre>
      </div>
    </div>
  );
};

// ---------- Page ----------
const Profile: React.FC = () => {
  const [tab, setTab] = useState("keys");
  const [toast, setToast] = useState<string | null>(null);
  const { theme, setTheme } = useTheme();

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }, []);

  return (
    <div>
      <h1 className="page-title" style={{ margin: "0 0 4px" }}>User Profile</h1>
      <div style={{ color: "var(--color-text-muted)", fontSize: 13, marginBottom: 24 }}>
        Manage your API keys and view integration configuration examples.
      </div>

      <div className="profile-shell">
        {/* Identity card */}
        <div className="profile-card">
          <div className="profile-avatar-row">
            <div className="profile-avatar-large">JD</div>
            <div className="profile-identity">
              <h2 className="profile-name">Jane Doe</h2>
              <div className="profile-role">Project Admin</div>
              <div className="profile-email">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
                jane@reportstack.local
              </div>
            </div>
          </div>
        </div>

        {/* Tabs card */}
        <div className="profile-card">
          <nav className="profile-tabs">
            {PROFILE_TABS.map(t => (
              <button key={t.id} className={`profile-tab ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>{t.label}</button>
            ))}
          </nav>
          {tab === "keys" && <ApiKeysPanel onToast={showToast} />}
          {tab === "examples" && <ExamplesPanel onToast={showToast} />}
        </div>

        {/* Preferences card */}
        <div className="profile-card">
          <div className="profile-card-head">
            <div>
              <div className="profile-card-title">Preferences</div>
              <div className="profile-card-subtitle">Personalize how ReportStack appears for you.</div>
            </div>
          </div>
          <div className="profile-field-row">
            <div className="profile-field-label">Theme</div>
            <div className="profile-field-value">Switch between light and dark surfaces.</div>
            <select className="pf-select" value={theme} onChange={e => setTheme(e.target.value as any)}>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </select>
          </div>
        </div>
      </div>

      {toast && (
        <div className="profile-toast">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          {toast}
        </div>
      )}
    </div>
  );
};

export default Profile;

import React, { useEffect, useState } from "react";
import { getSettings, updateSettings } from "../api/settings";
import { ProjectSettings } from "../types";

const Settings: React.FC = () => {
  const [settings, setSettings] = useState<ProjectSettings>({
    project_name: "ReportStack",
    description: "",
    default_launch_mode: "DEFAULT",
    auto_analysis_enabled: true,
    ai_model: "mistral:7b",
    notifications_enabled: false,
    retention_days: 90,
    max_attachment_size_mb: 20,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getSettings()
      .then((res) => setSettings(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = () => {
    setSaving(true);
    setSaved(false);
    updateSettings(settings)
      .then((res) => {
        setSettings(res.data);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      })
      .finally(() => setSaving(false));
  };

  if (loading) {
    return (
      <div className="loading-center">
        <div className="spinner spinner-lg" />
        <span>Loading settings...</span>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-title-row">
          <div>
            <h1 className="page-title">Project Settings</h1>
            <p className="page-subtitle">Configure your project preferences</p>
          </div>
          <div className="flex gap-2 items-center">
            {saved && <span className="text-sm" style={{ color: "var(--color-passed)" }}>Saved!</span>}
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </div>
      </div>

      {/* General */}
      <div className="card mb-6">
        <div className="card-header">
          <h3 className="card-title">General</h3>
        </div>
        <div className="card-body">
          <div className="settings-grid">
            <div className="settings-field">
              <label className="settings-label">Project Name</label>
              <input
                className="input"
                value={settings.project_name}
                onChange={(e) => setSettings({ ...settings, project_name: e.target.value })}
              />
            </div>
            <div className="settings-field">
              <label className="settings-label">Description</label>
              <textarea
                className="input comment-textarea"
                value={settings.description}
                onChange={(e) => setSettings({ ...settings, description: e.target.value })}
                rows={3}
                placeholder="Project description..."
              />
            </div>
          </div>
        </div>
      </div>

      {/* AI Analysis */}
      <div className="card mb-6">
        <div className="card-header">
          <h3 className="card-title">AI Analysis</h3>
        </div>
        <div className="card-body">
          <div className="settings-grid">
            <div className="settings-field">
              <label className="settings-label">Auto-Analysis</label>
              <div className="settings-toggle-row">
                <label className="settings-toggle">
                  <input
                    type="checkbox"
                    checked={settings.auto_analysis_enabled}
                    onChange={(e) => setSettings({ ...settings, auto_analysis_enabled: e.target.checked })}
                  />
                  <span className="settings-toggle-slider" />
                </label>
                <span className="text-sm text-secondary">
                  Automatically analyze failed tests when a launch finishes
                </span>
              </div>
            </div>
            <div className="settings-field">
              <label className="settings-label">AI Model</label>
              <select
                className="select"
                value={settings.ai_model}
                onChange={(e) => setSettings({ ...settings, ai_model: e.target.value })}
              >
                <option value="mistral:7b">Mistral 7B</option>
                <option value="llama3:8b">Llama 3 8B</option>
                <option value="codellama:7b">Code Llama 7B</option>
                <option value="gemma:7b">Gemma 7B</option>
              </select>
              <span className="settings-hint">Local Ollama model for failure classification</span>
            </div>
          </div>
        </div>
      </div>

      {/* Data Management */}
      <div className="card mb-6">
        <div className="card-header">
          <h3 className="card-title">Data Management</h3>
        </div>
        <div className="card-body">
          <div className="settings-grid">
            <div className="settings-field">
              <label className="settings-label">Data Retention (days)</label>
              <input
                className="input"
                type="number"
                min={1}
                max={365}
                value={settings.retention_days}
                onChange={(e) => setSettings({ ...settings, retention_days: Number(e.target.value) })}
                style={{ maxWidth: 120 }}
              />
              <span className="settings-hint">Launches older than this will be automatically cleaned up</span>
            </div>
            <div className="settings-field">
              <label className="settings-label">Max Attachment Size (MB)</label>
              <input
                className="input"
                type="number"
                min={1}
                max={100}
                value={settings.max_attachment_size_mb}
                onChange={(e) => setSettings({ ...settings, max_attachment_size_mb: Number(e.target.value) })}
                style={{ maxWidth: 120 }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="card mb-6">
        <div className="card-header">
          <h3 className="card-title">Notifications</h3>
        </div>
        <div className="card-body">
          <div className="settings-field">
            <div className="settings-toggle-row">
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={settings.notifications_enabled}
                  onChange={(e) => setSettings({ ...settings, notifications_enabled: e.target.checked })}
                />
                <span className="settings-toggle-slider" />
              </label>
              <span className="text-sm text-secondary">
                Enable email/Telegram notifications for launch results
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;

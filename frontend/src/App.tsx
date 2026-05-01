import React from "react";
import { BrowserRouter as Router, Routes, Route, NavLink, useLocation } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import LaunchList from "./pages/LaunchList";
import LaunchDetail from "./pages/LaunchDetail";
import Members from "./pages/Members";
import Settings from "./pages/Settings";
import "./styles/design-tokens.css";
import "./styles/components.css";
import "./styles/extras.css";
import "./index.css";
import "./App.css";

const SidebarIcon: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="sidebar-link-icon">{children}</span>
);

const Sidebar: React.FC = () => {
  const location = useLocation();

  return (
    <aside className="layout-sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">RS</div>
        <div className="sidebar-logo-text">ReportStack</div>
      </div>
      <nav className="sidebar-nav">
        <div className="sidebar-section-label">Navigation</div>
        <NavLink
          to="/"
          end
          className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
        >
          <SidebarIcon>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
          </SidebarIcon>
          Dashboard
        </NavLink>
        <NavLink
          to="/launches"
          className={({ isActive }) => `sidebar-link ${isActive || location.pathname.startsWith("/launches") ? "active" : ""}`}
        >
          <SidebarIcon>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </SidebarIcon>
          Launches
        </NavLink>

        <div className="sidebar-section-label">Project</div>
        <NavLink
          to="/members"
          className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
        >
          <SidebarIcon>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </SidebarIcon>
          Members
        </NavLink>
        <NavLink
          to="/settings"
          className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
        >
          <SidebarIcon>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </SidebarIcon>
          Settings
        </NavLink>

        <div className="sidebar-section-label">Tools</div>
        <a
          href="http://localhost:8000/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="sidebar-link"
        >
          <SidebarIcon>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </SidebarIcon>
          API Docs
        </a>
      </nav>
      <div className="sidebar-footer">
        <div className="sidebar-profile">
          <span className="sidebar-profile-avatar">JD</span>
          <span className="sidebar-profile-meta">
            <span className="sidebar-profile-name">Jane Doe</span>
            <span className="sidebar-profile-role">Project Admin</span>
          </span>
          <svg className="sidebar-profile-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
        <div className="sidebar-version">v1.0.0 · ReportStack</div>
      </div>
    </aside>
  );
};

function App() {
  return (
    <Router>
      <div className="layout">
        <Sidebar />
        <main className="layout-main">
          <div className="layout-content">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/launches" element={<LaunchList />} />
              <Route path="/launches/:id" element={<LaunchDetail />} />
              <Route path="/members" element={<Members />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </div>
        </main>
      </div>
    </Router>
  );
}

export default App;

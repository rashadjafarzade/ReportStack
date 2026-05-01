import React from "react";
import { BrowserRouter as Router, Routes, Route, NavLink, useLocation } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import LaunchList from "./pages/LaunchList";
import LaunchDetail from "./pages/LaunchDetail";
import "./styles/design-tokens.css";
import "./styles/components.css";
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
        <div className="sidebar-logo-icon">AR</div>
        <div className="sidebar-logo-text">AutoReports</div>
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
        <div className="sidebar-version">v1.0.0</div>
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
            </Routes>
          </div>
        </main>
      </div>
    </Router>
  );
}

export default App;

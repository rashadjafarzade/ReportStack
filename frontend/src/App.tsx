import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LaunchList from "./pages/LaunchList";
import LaunchDetail from "./pages/LaunchDetail";
import "./App.css";

function App() {
  return (
    <Router>
      <div className="App">
        <header className="App-header">
          <div className="header-content">
            <h2 style={{ margin: 0 }}>Automation Reports</h2>
          </div>
        </header>
        <main className="App-main">
          <Routes>
            <Route path="/" element={<LaunchList />} />
            <Route path="/launches/:id" element={<LaunchDetail />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;

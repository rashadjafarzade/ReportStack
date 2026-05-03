import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login, register } from "../api/auth";
import { useAuth } from "../context/AuthContext";
import logo from "../logo.svg";

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { setAuth } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = isRegister
        ? await register({ email, name, password })
        : await login(email, password);
      setAuth(res.data.access_token, res.data.user);
      navigate("/");
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      if (typeof detail === "string") {
        setError(detail);
      } else if (Array.isArray(detail)) {
        setError(detail.map((d: any) => d.msg || d).join("; "));
      } else if (err.message) {
        setError(err.message);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <img
            src={logo}
            alt="ReportStack"
            style={{ height: 44, width: "auto", display: "block", marginBottom: 12 }}
          />
          <p style={{ color: "var(--color-text-muted)", fontSize: 13, margin: 0 }}>
            {isRegister ? "Create your account" : "Sign in to your account"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {isRegister && (
            <div className="login-field">
              <label>Full name</label>
              <input
                className="input"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Firstname Lastname"
                required
              />
            </div>
          )}
          <div className="login-field">
            <label>Email</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              autoFocus
            />
          </div>
          <div className="login-field">
            <label>Password</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter password"
              required
              minLength={6}
            />
          </div>

          {error && <div className="login-error">{error}</div>}

          <button className="btn btn-primary" type="submit" disabled={submitting} style={{ width: "100%", marginTop: 4 }}>
            {submitting ? "Please wait..." : isRegister ? "Create Account" : "Sign In"}
          </button>
        </form>

        <div className="login-toggle">
          {isRegister ? (
            <>Already have an account? <button onClick={() => setIsRegister(false)}>Sign in</button></>
          ) : (
            <>Don't have an account? <button onClick={() => setIsRegister(true)}>Register</button></>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;

"use client";

import { supabase } from "@/app/lib/supabase";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let mounted = true;

    const redirectIfSignedIn = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (mounted && session) {
        router.replace("/dashboard");
      }
    };

    redirectIfSignedIn();

    return () => {
      mounted = false;
    };
  }, [router]);

  const handleLogin = async () => {
    const trimmedEmail = email.trim();

    if (!trimmedEmail || !password) {
      setStatus("idle");
      return setErrorMsg("Please fill in all fields.");
    }

    setErrorMsg("");
    setStatus("loading");

    const { error } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });

    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
    } else {
      router.replace("/dashboard");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleLogin();
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@300;400;500&display=swap');

        :root {
          --bg: #0f0f0f;
          --surface: #171717;
          --surface-2: #1f1f1f;
          --border: #2a2a2a;
          --border-hover: #3a3a3a;
          --text: #e8e6e1;
          --text-muted: #6b6b6b;
          --text-subtle: #4a4a4a;
          --accent: #c9a96e;
          --accent-dim: rgba(201,169,110,0.10);
          --accent-glow: rgba(201,169,110,0.06);
          --error: #e05c5c;
          --error-dim: rgba(224,92,92,0.10);
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }

        .login-root {
          min-height: 100vh;
          background: var(--bg);
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'DM Sans', sans-serif;
          color: var(--text);
          padding: 24px;
          position: relative;
          overflow: hidden;
        }

        .login-root::before {
          content: '';
          position: fixed;
          inset: 0;
          background-image:
            linear-gradient(var(--border) 1px, transparent 1px),
            linear-gradient(90deg, var(--border) 1px, transparent 1px);
          background-size: 48px 48px;
          opacity: 0.35;
          pointer-events: none;
        }

        .login-root::after {
          content: '';
          position: fixed;
          width: 520px;
          height: 520px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(201,169,110,0.07) 0%, transparent 70%);
          bottom: -120px;
          left: 50%;
          transform: translateX(-50%);
          pointer-events: none;
        }

        .card {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 400px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 20px;
          padding: 36px 32px 32px;
          animation: cardIn 0.4s cubic-bezier(0.22,1,0.36,1) both;
        }
        @keyframes cardIn {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .card-header {
          margin-bottom: 28px;
          animation: fadeUp 0.4s 0.05s cubic-bezier(0.22,1,0.36,1) both;
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .logo-mark {
          width: 42px;
          height: 42px;
          border-radius: 12px;
          background: var(--accent-dim);
          border: 1px solid rgba(201,169,110,0.2);
          display: grid;
          place-items: center;
          margin-bottom: 18px;
          color: var(--accent);
        }

        .card-title {
          font-family: 'Instrument Serif', serif;
          font-size: 26px;
          font-weight: 400;
          color: var(--text);
          line-height: 1.15;
          margin-bottom: 6px;
        }
        .card-title em { font-style: italic; color: var(--accent); }

        .card-sub {
          font-size: 13px;
          color: var(--text-muted);
          font-weight: 300;
          line-height: 1.5;
        }
        .card-sub a {
          color: var(--accent);
          text-decoration: none;
          font-weight: 400;
        }
        .card-sub a:hover { text-decoration: underline; }

        .form-body {
          display: flex;
          flex-direction: column;
          gap: 14px;
          animation: fadeUp 0.4s 0.12s cubic-bezier(0.22,1,0.36,1) both;
        }

        .field { display: flex; flex-direction: column; gap: 6px; }

        .field-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .field-label {
          font-size: 12px;
          font-weight: 500;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--text-muted);
        }

        .forgot-link {
          font-size: 12px;
          color: var(--text-subtle);
          text-decoration: none;
          transition: color 0.12s;
        }
        .forgot-link:hover { color: var(--accent); }

        .input-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }
        .input-wrap svg.input-icon {
          position: absolute;
          left: 13px;
          color: var(--text-subtle);
          pointer-events: none;
        }

        .field-input {
          width: 100%;
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 11px 42px 11px 38px;
          color: var(--text);
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          font-weight: 300;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .field-input::placeholder { color: var(--text-subtle); }
        .field-input:focus {
          border-color: rgba(201,169,110,0.4);
          box-shadow: 0 0 0 3px var(--accent-glow);
        }
        .field-input.has-error { border-color: rgba(224,92,92,0.45); }

        .toggle-btn {
          position: absolute;
          right: 11px;
          background: none;
          border: none;
          color: var(--text-subtle);
          cursor: pointer;
          padding: 4px;
          display: grid;
          place-items: center;
          border-radius: 6px;
          transition: color 0.12s;
        }
        .toggle-btn:hover { color: var(--text-muted); }

        .error-box {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          background: var(--error-dim);
          border: 1px solid rgba(224,92,92,0.2);
          border-radius: 10px;
          padding: 10px 12px;
          font-size: 13px;
          color: var(--error);
          line-height: 1.4;
          animation: fadeUp 0.2s ease both;
        }
        .error-box svg { flex-shrink: 0; margin-top: 1px; }

        .submit-btn {
          width: 100%;
          padding: 12px;
          border-radius: 10px;
          border: none;
          background: var(--accent);
          color: #0f0f0f;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: opacity 0.15s, transform 0.1s;
          margin-top: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .submit-btn:hover:not(:disabled) { opacity: 0.88; transform: scale(1.01); }
        .submit-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        .spinner {
          width: 15px;
          height: 15px;
          border: 2px solid rgba(0,0,0,0.2);
          border-top-color: #0f0f0f;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .divider {
          display: flex;
          align-items: center;
          gap: 10px;
          color: var(--text-subtle);
          font-size: 11px;
          margin: 4px 0;
        }
        .divider::before, .divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: var(--border);
        }

        .footer-note {
          font-size: 12px;
          color: var(--text-subtle);
          text-align: center;
          font-weight: 300;
          animation: fadeUp 0.4s 0.2s cubic-bezier(0.22,1,0.36,1) both;
        }
        .footer-note a {
          color: var(--accent);
          text-decoration: none;
          font-weight: 400;
        }
        .footer-note a:hover { text-decoration: underline; }
      `}</style>

      <div className="login-root">
        <div className="card">
          <div className="card-header">
            <div className="logo-mark">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 2C5.82 2 2 5.6 2 10c0 1.65.5 3.18 1.35 4.46L2 18l3.72-1.27A8.12 8.12 0 0010 18c4.18 0 8-3.6 8-8s-3.82-8-8-8z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
              </svg>
            </div>
            <h1 className="card-title">Welcome <em>back</em></h1>
            {/* <p className="card-sub">
              No account yet?{" "}
              <a href="/register">Create one for free</a>
            </p> */}
          </div>

          <div className="form-body">
            {/* Email */}
            <div className="field">
              <label className="field-label">Email</label>
              <div className="input-wrap">
                <svg className="input-icon" width="15" height="15" viewBox="0 0 15 15" fill="none">
                  <rect x="1" y="3" width="13" height="9" rx="2" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M1 5l6.5 4L14 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                <input
                  className={`field-input${errorMsg ? " has-error" : ""}`}
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setErrorMsg(""); }}
                  onKeyDown={handleKeyDown}
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password */}
            <div className="field">
              <div className="field-top">
                <label className="field-label">Password</label>
                <a href="/forgot-password" className="forgot-link">Forgot password?</a>
              </div>
              <div className="input-wrap">
                <svg className="input-icon" width="15" height="15" viewBox="0 0 15 15" fill="none">
                  <rect x="3" y="6" width="9" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M5 6V4.5a2.5 2.5 0 015 0V6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                <input
                  className={`field-input${errorMsg ? " has-error" : ""}`}
                  type={showPassword ? "text" : "password"}
                  placeholder="Your password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setErrorMsg(""); }}
                  onKeyDown={handleKeyDown}
                  autoComplete="current-password"
                />
                <button
                  className="toggle-btn"
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                      <path d="M1 7.5S3.5 3 7.5 3s6.5 4.5 6.5 4.5S11.5 12 7.5 12 1 7.5 1 7.5z" stroke="currentColor" strokeWidth="1.2"/>
                      <circle cx="7.5" cy="7.5" r="1.8" stroke="currentColor" strokeWidth="1.2"/>
                      <path d="M2 2l11 11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                    </svg>
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                      <path d="M1 7.5S3.5 3 7.5 3s6.5 4.5 6.5 4.5S11.5 12 7.5 12 1 7.5 1 7.5z" stroke="currentColor" strokeWidth="1.2"/>
                      <circle cx="7.5" cy="7.5" r="1.8" stroke="currentColor" strokeWidth="1.2"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Error */}
            {errorMsg && (
              <div className="error-box">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.3"/>
                  <path d="M7 4v3.5M7 9.5v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                </svg>
                {errorMsg}
              </div>
            )}

            {/* Submit */}
            <button
              className="submit-btn"
              type="button"
              onClick={handleLogin}
              disabled={status === "loading" || !email || !password}
            >
              {status === "loading" ? (
                <><div className="spinner" /> Signing in…</>
              ) : (
                "Sign in"
              )}
            </button>

            <div className="divider">or</div>

            <p className="footer-note">
              Don&apos;t have an account?{" "}
              <a href="/auth/register">Sign up free</a>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

"use client";

import { supabase } from "@/app/lib/supabase";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function Register() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const passwordStrength = (() => {
    if (!password) return 0;
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
  })();

  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong"][
    passwordStrength
  ];
  const strengthColor = ["", "#e05c5c", "#d4a843", "#7ec87e", "#5bb87e"][
    passwordStrength
  ];

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

  const handleRegister = async () => {
    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();

    setErrorMsg("");
    if (!trimmedName || !trimmedEmail || !password) {
      setStatus("idle");
      return setErrorMsg("Please fill in all fields.");
    }

    if (password !== confirmPassword) {
      setStatus("idle");
      return setErrorMsg("Passwords don't match.");
    }

    if (password.length < 8) {
      setStatus("idle");
      return setErrorMsg("Password must be at least 8 characters.");
    }

    setStatus("loading");
    const { data, error } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: {
        data: {
          full_name: trimmedName,
          name: trimmedName,
        },
        emailRedirectTo: `${window.location.origin}/auth/login`,
      },
    });

    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
    } else if (data.session) {
      router.replace("/dashboard");
    } else {
      setStatus("success");
      setEmail(trimmedEmail);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleRegister();
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
          --accent-dim: rgba(201, 169, 110, 0.10);
          --accent-glow: rgba(201, 169, 110, 0.06);
          --error: #e05c5c;
          --error-dim: rgba(224, 92, 92, 0.10);
          --radius: 13px;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }

        .reg-root {
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

        /* Subtle background grid */
        .reg-root::before {
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

        /* Warm glow blob */
        .reg-root::after {
          content: '';
          position: fixed;
          width: 480px;
          height: 480px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(201,169,110,0.07) 0%, transparent 70%);
          top: -100px;
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

        /* ── Header ── */
        .card-header {
          margin-bottom: 28px;
          animation: fadeUp 0.4s 0.05s cubic-bezier(0.22,1,0.36,1) both;
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .logo-mark {
          width: 64px;
          height: 64px;
          display: grid;
          place-items: center;
          margin-bottom: 18px;
        }

        .logo-image {
          width: 100%;
          height: 100%;
          object-fit: contain;
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

        /* ── Form ── */
        .form-body {
          display: flex;
          flex-direction: column;
          gap: 14px;
          animation: fadeUp 0.4s 0.12s cubic-bezier(0.22,1,0.36,1) both;
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .field-label {
          font-size: 12px;
          font-weight: 500;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--text-muted);
        }

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
          flex-shrink: 0;
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
        .field-input.has-error {
          border-color: rgba(224,92,92,0.45);
        }

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

        /* ── Strength meter ── */
        .strength-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 4px;
        }
        .strength-bars {
          display: flex;
          gap: 4px;
          flex: 1;
        }
        .strength-bar {
          flex: 1;
          height: 3px;
          border-radius: 2px;
          background: var(--border);
          transition: background 0.25s;
        }
        .strength-text {
          font-size: 11px;
          font-weight: 500;
          min-width: 36px;
          text-align: right;
          transition: color 0.25s;
        }

        /* ── Error message ── */
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

        /* ── Submit ── */
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

        /* spinner */
        .spinner {
          width: 15px;
          height: 15px;
          border: 2px solid rgba(0,0,0,0.2);
          border-top-color: #0f0f0f;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* ── Success state ── */
        .success-card {
          text-align: center;
          padding: 12px 0 4px;
          animation: fadeUp 0.3s ease both;
        }
        .success-icon {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: rgba(91,184,126,0.12);
          border: 1px solid rgba(91,184,126,0.25);
          display: grid;
          place-items: center;
          margin: 0 auto 18px;
          color: #5bb87e;
        }
        .success-card h3 {
          font-family: 'Instrument Serif', serif;
          font-size: 22px;
          font-weight: 400;
          margin-bottom: 8px;
        }
        .success-card p {
          font-size: 13px;
          color: var(--text-muted);
          line-height: 1.6;
          font-weight: 300;
        }

        /* ── Divider ── */
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

        .terms {
          font-size: 11px;
          color: var(--text-subtle);
          text-align: center;
          line-height: 1.6;
          font-weight: 300;
          animation: fadeUp 0.4s 0.2s cubic-bezier(0.22,1,0.36,1) both;
        }
        .terms a { color: var(--text-muted); text-decoration: underline; }
      `}</style>

      <div className="reg-root">
        <div className="card">
          {status === "success" ? (
            <div className="success-card">
              <div className="success-icon">
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                  <path
                    d="M4 11.5l5 5 9-9"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h3>Check your inbox</h3>
              <p>
                We sent a confirmation link to{" "}
                <strong style={{ color: "var(--text)", fontWeight: 400 }}>
                  {email}
                </strong>
                .
                <br />
                Click it to activate your account.
              </p>
            </div>
          ) : (
            <>
              <div className="card-header">
                <div className="logo-mark">
                  <Image
                    className="logo-image"
                    src="/neura-clark-logo.png"
                    alt="NeuraClark logo"
                    width={64}
                    height={64}
                    priority
                  />
                </div>
                <h1 className="card-title">
                  Create your <em>account</em>
                </h1>
                <p className="card-sub">
                  Already have one? <a href="/auth/login">Sign in instead</a>
                </p>
              </div>

              <div className="form-body">
                {/* Name */}
                <div className="field">
                  <label className="field-label">Name</label>
                  <div className="input-wrap">
                    <svg
                      className="input-icon"
                      width="15"
                      height="15"
                      viewBox="0 0 15 15"
                      fill="none"
                    >
                      <circle
                        cx="7.5"
                        cy="4.5"
                        r="2.5"
                        stroke="currentColor"
                        strokeWidth="1.2"
                      />
                      <path
                        d="M2.5 13c.7-2.4 2.45-3.6 5-3.6s4.3 1.2 5 3.6"
                        stroke="currentColor"
                        strokeWidth="1.2"
                        strokeLinecap="round"
                      />
                    </svg>
                    <input
                      className={`field-input${errorMsg ? " has-error" : ""}`}
                      type="text"
                      placeholder="Your name"
                      value={fullName}
                      onChange={(e) => {
                        setFullName(e.target.value);
                        setErrorMsg("");
                      }}
                      onKeyDown={handleKeyDown}
                      autoComplete="name"
                    />
                  </div>
                </div>

                {/* Email */}
                <div className="field">
                  <label className="field-label">Email</label>
                  <div className="input-wrap">
                    <svg
                      className="input-icon"
                      width="15"
                      height="15"
                      viewBox="0 0 15 15"
                      fill="none"
                    >
                      <rect
                        x="1"
                        y="3"
                        width="13"
                        height="9"
                        rx="2"
                        stroke="currentColor"
                        strokeWidth="1.2"
                      />
                      <path
                        d="M1 5l6.5 4L14 5"
                        stroke="currentColor"
                        strokeWidth="1.2"
                        strokeLinecap="round"
                      />
                    </svg>
                    <input
                      className={`field-input${errorMsg ? " has-error" : ""}`}
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setErrorMsg("");
                      }}
                      onKeyDown={handleKeyDown}
                      autoComplete="email"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="field">
                  <label className="field-label">Password</label>
                  <div className="input-wrap">
                    <svg
                      className="input-icon"
                      width="15"
                      height="15"
                      viewBox="0 0 15 15"
                      fill="none"
                    >
                      <rect
                        x="3"
                        y="6"
                        width="9"
                        height="7"
                        rx="1.5"
                        stroke="currentColor"
                        strokeWidth="1.2"
                      />
                      <path
                        d="M5 6V4.5a2.5 2.5 0 015 0V6"
                        stroke="currentColor"
                        strokeWidth="1.2"
                        strokeLinecap="round"
                      />
                    </svg>
                    <input
                      className={`field-input${errorMsg ? " has-error" : ""}`}
                      type={showPassword ? "text" : "password"}
                      placeholder="Min. 8 characters"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setErrorMsg("");
                      }}
                      onKeyDown={handleKeyDown}
                      autoComplete="new-password"
                    />
                    <button
                      className="toggle-btn"
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <svg
                          width="15"
                          height="15"
                          viewBox="0 0 15 15"
                          fill="none"
                        >
                          <path
                            d="M1 7.5S3.5 3 7.5 3s6.5 4.5 6.5 4.5S11.5 12 7.5 12 1 7.5 1 7.5z"
                            stroke="currentColor"
                            strokeWidth="1.2"
                          />
                          <circle
                            cx="7.5"
                            cy="7.5"
                            r="1.8"
                            stroke="currentColor"
                            strokeWidth="1.2"
                          />
                          <path
                            d="M2 2l11 11"
                            stroke="currentColor"
                            strokeWidth="1.2"
                            strokeLinecap="round"
                          />
                        </svg>
                      ) : (
                        <svg
                          width="15"
                          height="15"
                          viewBox="0 0 15 15"
                          fill="none"
                        >
                          <path
                            d="M1 7.5S3.5 3 7.5 3s6.5 4.5 6.5 4.5S11.5 12 7.5 12 1 7.5 1 7.5z"
                            stroke="currentColor"
                            strokeWidth="1.2"
                          />
                          <circle
                            cx="7.5"
                            cy="7.5"
                            r="1.8"
                            stroke="currentColor"
                            strokeWidth="1.2"
                          />
                        </svg>
                      )}
                    </button>
                  </div>
                  {password && (
                    <div className="strength-row">
                      <div className="strength-bars">
                        {[1, 2, 3, 4].map((i) => (
                          <div
                            key={i}
                            className="strength-bar"
                            style={{
                              background:
                                i <= passwordStrength
                                  ? strengthColor
                                  : undefined,
                            }}
                          />
                        ))}
                      </div>
                      <span
                        className="strength-text"
                        style={{ color: strengthColor }}
                      >
                        {strengthLabel}
                      </span>
                    </div>
                  )}
                </div>

                {/* Confirm password */}
                <div className="field">
                  <label className="field-label">Confirm Password</label>
                  <div className="input-wrap">
                    <svg
                      className="input-icon"
                      width="15"
                      height="15"
                      viewBox="0 0 15 15"
                      fill="none"
                    >
                      <rect
                        x="3"
                        y="6"
                        width="9"
                        height="7"
                        rx="1.5"
                        stroke="currentColor"
                        strokeWidth="1.2"
                      />
                      <path
                        d="M5 6V4.5a2.5 2.5 0 015 0V6"
                        stroke="currentColor"
                        strokeWidth="1.2"
                        strokeLinecap="round"
                      />
                    </svg>
                    <input
                      className={`field-input${errorMsg && confirmPassword && confirmPassword !== password ? " has-error" : ""}`}
                      type={showConfirm ? "text" : "password"}
                      placeholder="Repeat your password"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        setErrorMsg("");
                      }}
                      onKeyDown={handleKeyDown}
                      autoComplete="new-password"
                    />
                    <button
                      className="toggle-btn"
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      tabIndex={-1}
                    >
                      {showConfirm ? (
                        <svg
                          width="15"
                          height="15"
                          viewBox="0 0 15 15"
                          fill="none"
                        >
                          <path
                            d="M1 7.5S3.5 3 7.5 3s6.5 4.5 6.5 4.5S11.5 12 7.5 12 1 7.5 1 7.5z"
                            stroke="currentColor"
                            strokeWidth="1.2"
                          />
                          <circle
                            cx="7.5"
                            cy="7.5"
                            r="1.8"
                            stroke="currentColor"
                            strokeWidth="1.2"
                          />
                          <path
                            d="M2 2l11 11"
                            stroke="currentColor"
                            strokeWidth="1.2"
                            strokeLinecap="round"
                          />
                        </svg>
                      ) : (
                        <svg
                          width="15"
                          height="15"
                          viewBox="0 0 15 15"
                          fill="none"
                        >
                          <path
                            d="M1 7.5S3.5 3 7.5 3s6.5 4.5 6.5 4.5S11.5 12 7.5 12 1 7.5 1 7.5z"
                            stroke="currentColor"
                            strokeWidth="1.2"
                          />
                          <circle
                            cx="7.5"
                            cy="7.5"
                            r="1.8"
                            stroke="currentColor"
                            strokeWidth="1.2"
                          />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* Error */}
                {errorMsg && (
                  <div className="error-box">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <circle
                        cx="7"
                        cy="7"
                        r="6"
                        stroke="currentColor"
                        strokeWidth="1.3"
                      />
                      <path
                        d="M7 4v3.5M7 9.5v.5"
                        stroke="currentColor"
                        strokeWidth="1.3"
                        strokeLinecap="round"
                      />
                    </svg>
                    {errorMsg}
                  </div>
                )}

                {/* Submit */}
                <button
                  className="submit-btn"
                  type="button"
                  onClick={handleRegister}
                  disabled={
                    status === "loading" ||
                    !fullName ||
                    !email ||
                    !password ||
                    !confirmPassword
                  }
                >
                  {status === "loading" ? (
                    <>
                      <div className="spinner" /> Creating account…
                    </>
                  ) : (
                    "Create account"
                  )}
                </button>

                <div className="divider">or</div>

                <p className="terms">
                  By signing up you agree to our{" "}
                  <a href="/terms">Terms of Service</a> and{" "}
                  <a href="/privacy">Privacy Policy</a>.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

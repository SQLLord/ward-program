// src/pages/Login.jsx
import React, { useState, useEffect } from 'react'; // ✅ added useEffect
import { useNavigate, Navigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useError } from '../context/ErrorContext';

function Login() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy]         = useState(false);

  const { login, isAuthenticated, registerNavigate } = useAuth();
  const { showError } = useError();
  const navigate  = useNavigate();
  const location  = useLocation();
  registerNavigate(navigate);

  const sessionExpired = new URLSearchParams(location.search).get('expired') === 'true';
  const successMessage = location.state?.message; 

  // ── Reactive mobile detection (< 1024px = Tailwind's lg breakpoint) ───────
  // ✅ FIXED: was a static window.matchMedia call — never updated on resize
  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia('(max-width: 1023px)').matches
  );

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  if (isAuthenticated()) return <Navigate to="/admin" />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await login(email.trim(), password);
      navigate('/admin');
    } catch (err) {
      showError(err.message || 'Login failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900 px-4">
      {/* ── Card ── */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-100
                      dark:border-slate-700 w-full max-w-md p-8">

        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-5xl mb-2">⛪</div>
          <h1 className="text-2xl font-bold text-lds-blue dark:text-slate-100">Ward Programs</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Admin Login</p>
        </div>

        {/* ── Mobile Warning Banner ── */}
        {isMobile && (
          <div className="mb-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200
                          dark:border-amber-700 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
            <p className="font-semibold mb-1">💻 Desktop Required</p>
            <p>
              The program designer is built for desktop or laptop computers and is not
              supported on mobile devices. Please visit this page on a desktop browser to log in.
            </p>
          </div>
        )}

        
        {successMessage && (
          <div className="flex items-start gap-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 text-green-800 dark:text-green-300 px-4 py-3 rounded-lg mb-4 text-sm">
            <span className="text-lg leading-none mt-0.5">✅</span>
            <p>{successMessage}</p>
          </div>
        )}


        {/* Session Expired Banner */}
        {sessionExpired && (
          <div className="mb-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200
                          dark:border-red-700 px-4 py-3 text-sm text-red-700 dark:text-red-400
                          flex items-start gap-2">
            <span className="text-lg">⏰</span>
            <div>
              <p className="font-semibold">Session Expired</p>
              <p>Your session has expired. Please log in again.</p>
            </div>
          </div>
        )}

        {/* ── Form — hidden on mobile ── */}
        {!isMobile && (
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Email */}
            <div>
              <label className="label text-sm">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="input w-full"
                placeholder="Enter your email"
                required
                autoFocus
                maxLength={254}
                autoComplete="username"
              />
            </div>

            {/* Password */}
            <div>
              <label className="label text-sm">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input w-full"
                placeholder="Enter your password"
                required
                maxLength={128}
                autoComplete="current-password"

              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={busy}
              className="btn-primary w-full disabled:opacity-50"
            >
              {busy ? '🔄 Logging in...' : '🔐 Login'}
            </button>

          </form>
        )}

        {/* Footer */}
        <div className="mt-6 text-center text-xs text-gray-400 dark:text-slate-500 space-y-2">
          <p>Contact the Bishopric if you need access.</p>
          <Link to="/" className="text-lds-blue dark:text-blue-400 hover:underline">
            ← Back to Home
          </Link>
        </div>

      </div>
    </div>
  );
}

export default Login;
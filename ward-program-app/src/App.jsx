import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { ProgramProvider }    from './context/ProgramContext';
import { AuthProvider }       from './context/AuthContext';
import { UserProvider }       from './context/UserContext';
import { ErrorBoundary }      from './components/ErrorBoundary';
import { ErrorProvider }      from './context/ErrorContext';
import { ErrorDisplay }       from './components/ErrorDisplay';
import ProtectedRoute         from './components/ProtectedRoute';
import ProgramHome            from './pages/ProgramHome';
import ProgramViewer          from './pages/ProgramViewer';
import AdminDashboard         from './pages/AdminDashboard';
import ProgramBuilder         from './pages/ProgramBuilder';
import UserManager            from './pages/UserManager';
import Login                  from './pages/Login';
import { useAuth }            from './context/AuthContext';
import { useDarkMode, DarkModeProvider } from './hooks/useDarkMode.jsx'; // ← ADD DarkModeProvider
import ChangePassword from './pages/ChangePassword';
import WardDefaults from './pages/WardDefaults';
import ImageLibrary from './pages/ImageLibrary';


// ── NavBar ────────────────────────────────────────────────────────────────────
function NavBar() {
  const { user, logout }        = useAuth();
  const { isDark, toggleDark }  = useDarkMode();
  const navigate                = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef                 = useRef(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const handleNavClick    = () => setMenuOpen(false);
  const handleLogout      = () => { logout(); setMenuOpen(false); navigate('/'); };
  const handleToggleDark  = () => { toggleDark(); };

  return (
    <nav className="bg-lds-blue shadow-md px-4 py-3 flex justify-between items-center sticky top-0 z-40">
      {/* ── Left — Brand ──────────────────────────────────────────────────── */}
      <Link
        to="/"
        onClick={handleNavClick}
        className="text-white font-bold text-lg flex items-center gap-2 hover:opacity-80 transition"
      >
        ⛪ Ward Programs
      </Link>

      {/* ── Right — Hamburger ─────────────────────────────────────────────── */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen(prev => !prev)}
          className="flex flex-col justify-center items-center w-10 h-10 rounded-lg hover:bg-white hover:bg-opacity-20 transition gap-1.5"
          aria-label="Open menu"
        >
          {/* Hamburger icon — animates to X when open */}
          <span className={`block w-6 h-0.5 bg-white transition-all duration-200 ${menuOpen ? 'rotate-45 translate-y-2' : ''}`} />
          <span className={`block w-6 h-0.5 bg-white transition-all duration-200 ${menuOpen ? 'opacity-0' : ''}`} />
          <span className={`block w-6 h-0.5 bg-white transition-all duration-200 ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
        </button>

        {/* ── Dropdown Menu ──────────────────────────────────────────────── */}
        {menuOpen && (
          <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-100 dark:border-slate-700 overflow-hidden z-50">
            {user ? (
              <>
                {/* ── User Info ──────────────────────────────────────────── */}
                <div className="px-4 py-3 bg-gray-50 dark:bg-slate-700 border-b border-gray-100 dark:border-slate-600">
                  <p className="font-semibold text-gray-800 dark:text-slate-100 text-sm">
                    👤 {user.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                    {user.role === 'bishopric' ? '🔵 Bishopric' : '🟢 Editor'}
                    {user.calling ? ` — ${user.calling}` : ''}
                  </p>
                </div>

                {/* ── Navigation Links ───────────────────────────────────── */}
                <div className="py-1">
                  <Link to="/" onClick={handleNavClick}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition">
                    ⛪ <span>Ward Programs Home</span>
                  </Link>
                  <Link to="/admin" onClick={handleNavClick}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition">
                    🗂 <span>Program Dashboard</span>
                  </Link>
                  
                  {/* ── Image Library — editors and bishopric ── */}
                  <Link to="/admin/image-library" onClick={handleNavClick}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition">
                    🖼️ <span>Image Library</span>
                  </Link>

                  {user.role === 'bishopric' && (
                    <Link to="/users" onClick={handleNavClick}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition">
                      👥 <span>Manage Users</span>
                    </Link>
                  )}
                  {user.role === 'bishopric' && (
                    <Link to="/ward-defaults" onClick={handleNavClick}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition">
                      ⚙️ <span>Ward Defaults</span>
                    </Link>
                  )}
                </div>

                {/* ── Dark Mode Toggle ───────────────────────────────────── */}
                <div className="border-t border-gray-100 dark:border-slate-700 py-1">
                  <button onClick={handleToggleDark}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition w-full text-left">
                    {isDark ? '☀️' : '🌙'}
                    <span>{isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}</span>
                  </button>
                </div>

                {/* ── Change Password ─────────────────────────────────────────── */}
                <div className="border-t border-gray-100 dark:border-slate-700 py-1">
                  <Link
                    to="/change-password"
                    onClick={handleNavClick}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700
                              dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition"
                  >
                    🔑 <span>Change Password</span>
                  </Link>
                </div>

                {/* ── Logout ─────────────────────────────────────────────── */}
                <div className="border-t border-gray-100 dark:border-slate-700 py-1">
                  <button onClick={handleLogout}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition w-full text-left">
                    🚪 <span>Logout</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* ── Not logged in ──────────────────────────────────────── */}
                <div className="py-1">
                  <Link to="/" onClick={handleNavClick}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition">
                    ⛪ <span>Ward Programs Home</span>
                  </Link>
                  <Link to="/login" onClick={handleNavClick}
                    className="hidden sm:flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition">
                    🔐 <span>Login</span>
                  </Link>
                </div>

                {/* ── Dark Mode Toggle (not logged in) ───────────────────── */}
                <div className="border-t border-gray-100 dark:border-slate-700 py-1">
                  <button onClick={handleToggleDark}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition w-full text-left">
                    {isDark ? '☀️' : '🌙'}
                    <span>{isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}


// ── App ───────────────────────────────────────────────────────────────────────
function App() {
  return (
    <DarkModeProvider>                        {/* ← ADDED — outermost wrapper */}
      <ErrorBoundary>
        <AuthProvider>
          <UserProvider>
            <ProgramProvider>
              <ErrorProvider>
                <Router future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
                  <ErrorDisplay />
                  <NavBar />
                  <Routes>
                    {/* ✅ PUBLIC ROUTES */}
                    <Route path="/"            element={<ProgramHome />} />
                    <Route path="/view/:id"    element={<ProgramViewer />} />
                    <Route path="/login"       element={<Login />} />
                    {/* 🔒 PROTECTED ROUTES */}
                    <Route path="/admin"       element={<ProtectedRoute roles={['bishopric', 'editor']}><AdminDashboard /></ProtectedRoute>} />
                    <Route path="/builder/:id" element={<ProtectedRoute roles={['bishopric', 'editor']}><ProgramBuilder /></ProtectedRoute>} />
                    <Route path="/users"       element={<ProtectedRoute roles={['bishopric']}><UserManager /></ProtectedRoute>} />
                    <Route path="/builder"     element={<ProtectedRoute roles={['bishopric', 'editor']}><ProgramBuilder /></ProtectedRoute>} />
                    <Route path="/change-password" element={<ProtectedRoute roles={['bishopric', 'editor']}><ChangePassword /></ProtectedRoute>} />
                    <Route path="/ward-defaults" element={<ProtectedRoute roles={['bishopric']}><WardDefaults /></ProtectedRoute>} />
                    <Route path="/admin/image-library" element={<ProtectedRoute roles={['bishopric', 'editor']}><ImageLibrary /></ProtectedRoute>} />
                  </Routes>
                </Router>
              </ErrorProvider>
            </ProgramProvider>
          </UserProvider>
        </AuthProvider>
      </ErrorBoundary>
    </DarkModeProvider>                       
  );
}

export default App;
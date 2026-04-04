// src/pages/WardDefaults.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { formatPhoneNumber } from '../utils/formatters';
import { useProgramContext } from '../context/ProgramContext';
import PasswordStrength from '../components/PasswordStrength';
import { useError } from '../context/ErrorContext';

// ── Tiny drag-and-drop hook ───────────────────────────────────────────────────
function useDragList(items, setItems) {
  const dragIndex = useRef(null);
  const onDragStart = (i) => { dragIndex.current = i; };
  const onDragOver = (e, i) => {
    e.preventDefault();
    if (dragIndex.current === null || dragIndex.current === i) return;
    const next = [...items];
    const [moved] = next.splice(dragIndex.current, 1);
    next.splice(i, 0, moved);
    dragIndex.current = i;
    setItems(next);
  };
  const onDragEnd = () => { dragIndex.current = null; };
  return { onDragStart, onDragOver, onDragEnd };
}

// ── Empty row factories ───────────────────────────────────────────────────────
const newLeader = () => ({ _key: Date.now() + Math.random(), role: '', name: '', phone: '' });
const newSchedule = () => ({ _key: Date.now() + Math.random(), organization: '', day: '', meeting_time: '' });

// ── Component ─────────────────────────────────────────────────────────────────
export default function WardDefaults() {
  const navigate = useNavigate();
  const { invalidateWardDefaultsCache } = useProgramContext();
  const [tab, setTab] = useState('leadership');
  const [leadership, setLeadership] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirtyLeader, setDirtyLeader] = useState(false);
  const [dirtySchedule, setDirtySchedule] = useState(false);

  const [settings, setSettings] = useState({
      wardName: '',
      stakeName: '',
      hasViewPassword: false,
      announcementEmails: '',       // ← ADD
      announcementEnabled: true,    // ← ADD
  });

  const [viewPassword, setViewPassword] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [testPwd, setTestPwd] = useState('');
  const [testResult, setTestResult] = useState(null);
  const [dirtySettings, setDirtySettings] = useState(false);
  const [showViewPassword, setShowViewPassword] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [showTestPwd, setShowTestPwd] = useState(false);
  const { showToast } = useError();

  // ── Load on mount ─────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const [defaultsData, settingsData] = await Promise.all([
          api.get('/programs/ward-defaults'),
          api.get('/ward/settings'),
        ]);
        setLeadership(defaultsData.leadership.map(l => ({ ...l, _key: l.id })));
        setSchedules(defaultsData.schedules.map(s => ({ ...s, _key: s.id })));
        
        setSettings({
            wardName:            settingsData.wardName ?? '',
            stakeName:           settingsData.stakeName ?? '',
            hasViewPassword:     !!settingsData.hasViewPassword,
            announcementEmails:  settingsData.announcementEmails ?? '',   // ← ADD
            announcementEnabled: settingsData.announcementEnabled !== false, // ← ADD
            wardUrl:             settingsData.wardUrl ?? '', // ← ADD
        });

      } catch (err) {
        showToast('❌ Failed to load ward defaults.', 'error');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // ── Drag hooks ────────────────────────────────────────────────────────────
  const leaderDrag = useDragList(leadership, (next) => { setLeadership(next); setDirtyLeader(true); });
  const scheduleDrag = useDragList(schedules, (next) => { setSchedules(next); setDirtySchedule(true); });

  // ── Field helpers ─────────────────────────────────────────────────────────
  const updateLeader = (i, field, value) => {
    const next = [...leadership];
    next[i] = { ...next[i], [field]: value };
    setLeadership(next);
    setDirtyLeader(true);
  };
  const updateSchedule = (i, field, value) => {
    const next = [...schedules];
    next[i] = { ...next[i], [field]: value };
    setSchedules(next);
    setDirtySchedule(true);
  };
  const removeLeader = (i) => { setLeadership(leadership.filter((_, idx) => idx !== i)); setDirtyLeader(true); };
  const removeSchedule = (i) => { setSchedules(schedules.filter((_, idx) => idx !== i)); setDirtySchedule(true); };

  // ── Save ──────────────────────────────────────────────────────────────────
  const saveLeadership = async () => {
    setSaving(true);
    try {
      await api.put('/programs/ward-defaults/leadership', leadership);
      invalidateWardDefaultsCache();
      setDirtyLeader(false);
      showToast('✅ Ward leadership saved!');
    } catch (err) {
      showToast('❌ Failed to save leadership.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const saveSchedules = async () => {
    setSaving(true);
    try {
      await api.put('/programs/ward-defaults/schedules', schedules);
      invalidateWardDefaultsCache();
      setDirtySchedule(false);
      showToast('✅ Meeting schedules saved!');
    } catch (err) {
      showToast('❌ Failed to save schedules.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const saveSettings = async () => {
    
    const trimmedPwd = viewPassword.trim();
    const trimmedConfirm = confirmPwd.trim();
    if (trimmedPwd && trimmedConfirm) {
      if (trimmedPwd !== trimmedConfirm) { setPwdError('Passwords do not match.'); return; }
      if (trimmedPwd.length < 8) { setPwdError('Password must be at least 8 characters.'); return; }
    }
    setPwdError('');
    
    // ── Validate announcement email addresses ────────────────────────────────
    if (settings.announcementEmails?.trim()) {
      const emailList = settings.announcementEmails
        .split(',')
        .map(e => e.trim())
        .filter(Boolean);
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const invalidEmails = emailList.filter(e => !emailRegex.test(e));
      if (invalidEmails.length > 0) {
        showToast(`❌ Invalid email address(es): ${invalidEmails.join(', ')}`, 'error');
        return;
      }
    }

    setSaving(true);
    try {
      
        const result = await api.put('/ward/settings', {
            wardName:            settings.wardName,
            stakeName:           settings.stakeName,
            wardUrl:             settings.wardUrl?.trim() || null,
            viewPassword:        trimmedPwd || undefined,
            announcementEmails:  settings.announcementEmails ?? '',   // ← ADD
            announcementEnabled: settings.announcementEnabled,         // ← ADD
        });

      if (result.passwordChanged) {
        sessionStorage.removeItem('ward_view_unlocked');
      }
      setSettings(s => ({ ...s, hasViewPassword: !!result.hasViewPassword }));
      setViewPassword('');
      setConfirmPwd('');
      setTestPwd('');
      setTestResult(null);
      setDirtySettings(false);
      showToast('✅ Ward settings saved!');
    } catch (err) {
      showToast('❌ Failed to save settings.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const testPassword = async () => {
    if (!testPwd) return;
    try {
      await api.post('/auth/ward-unlock', { password: testPwd });
      setTestResult('success');
    } catch {
      setTestResult('fail');
    }
    setTimeout(() => setTestResult(null), 3000);
  };

  const isDirty = tab === 'leadership' ? dirtyLeader
    : tab === 'schedules' ? dirtySchedule
    : dirtySettings;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    // <div className="max-w-4xl mx-auto px-4 py-8">
    <div className="page-container">
      {/* ── Page Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-bold text-lds-blue dark:text-slate-100">
            ⚙️ Ward Defaults
          </h2>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Manage ward leadership, meeting schedules, and settings.
          </p>
        </div>
        <button
          onClick={() => navigate('/admin')}
          className="btn-secondary"
        >
          ← Back to Dashboard
        </button>
      </div>

      {/* ── Card wrapper ── */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-md border border-gray-100 dark:border-slate-700">

        {/* ── Tabs ── */}
        <div className="flex border-b border-gray-200 dark:border-slate-700 px-6">
          {[
            { key: 'leadership', label: '👥 Ward Leadership' },
            { key: 'schedules',  label: '🗓️ Meeting Schedules' },
            { key: 'settings',   label: '⚙️ Ward Settings' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-3 text-sm font-semibold border-b-2 transition ${
                tab === t.key
                  ? 'border-lds-blue text-lds-blue dark:text-slate-100 dark:border-slate-100'
                  : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Body ── */}
        <div className="px-6 py-5 min-h-[400px]">
          {loading ? (
            <div className="text-center py-12 text-gray-400 dark:text-slate-500">
              <div className="text-4xl mb-3">⏳</div>
              <p>Loading ward defaults...</p>
            </div>
          ) : (
            <>
              {/* ══ LEADERSHIP TAB ══════════════════════════════════════════ */}
              {tab === 'leadership' && (
                <>
                  <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
                    Drag rows to reorder. Changes apply to all programs using ward defaults.
                  </p>
                  {/* Column headers */}
                  <div className="grid grid-cols-[24px_1fr_1fr_1fr_36px] gap-2 mb-1 px-1">
                    <span />
                    {['Role', 'Name', 'Phone', ''].map(h => (
                      <span key={h} className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide">{h}</span>
                    ))}
                  </div>
                  {/* Rows */}
                  {leadership.map((l, i) => (
                    <div
                      key={l._key}
                      draggable
                      onDragStart={() => leaderDrag.onDragStart(i)}
                      onDragOver={e => leaderDrag.onDragOver(e, i)}
                      onDragEnd={leaderDrag.onDragEnd}
                      className="grid grid-cols-[24px_1fr_1fr_1fr_36px] gap-2 items-center mb-2
                                 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600
                                 rounded-lg px-2 py-2 cursor-grab hover:border-blue-300 dark:hover:border-slate-500 transition"
                    >
                      <span className="text-gray-300 dark:text-slate-500 text-lg select-none">⠿</span>
                      {['role', 'name', 'phone'].map(field => (
                        <input
                          key={field}
                          type={field === 'email' ? 'email' : 'text'}
                          value={l[field] ?? ''}
                          onChange={e => updateLeader(i, field,
                            field === 'phone' ? formatPhoneNumber(e.target.value) : e.target.value
                          )}
                          placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
                          className="input w-full text-sm"
                          maxLength={field === 'phone' ? 14 : undefined}
                        />
                      ))}
                      <button
                        onClick={() => removeLeader(i)}
                        className="text-red-400 hover:text-red-600 transition text-lg"
                        title="Remove"
                      >🗑️</button>
                    </div>
                  ))}
                  {leadership.length === 0 && (
                    <div className="text-center text-gray-400 dark:text-slate-500 py-8 border border-dashed border-gray-300 dark:border-slate-600 rounded-lg">
                      No leadership entries yet. Add one below.
                    </div>
                  )}
                  <button
                    className="btn-primary btn-small mt-3"
                    onClick={() => { setLeadership([...leadership, newLeader()]); setDirtyLeader(true); }}
                  >
                    ＋ Add Leadership Entry
                  </button>
                </>
              )}

              {/* ══ SCHEDULES TAB ═══════════════════════════════════════════ */}
              {tab === 'schedules' && (
                <>
                  <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
                    Drag rows to reorder. Changes apply to all programs using ward defaults.
                  </p>
                  {/* Column headers */}
                  <div className="grid grid-cols-[24px_1.5fr_1fr_1.5fr_36px] gap-2 mb-1 px-1">
                    <span />
                    {['Organization', 'Day', 'Time', ''].map(h => (
                      <span key={h} className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide">{h}</span>
                    ))}
                  </div>
                  {/* Rows */}
                  {schedules.map((s, i) => (
                    <div
                      key={s._key}
                      draggable
                      onDragStart={() => scheduleDrag.onDragStart(i)}
                      onDragOver={e => scheduleDrag.onDragOver(e, i)}
                      onDragEnd={scheduleDrag.onDragEnd}
                      className="grid grid-cols-[24px_1.5fr_1fr_1.5fr_36px] gap-2 items-center mb-2
                                 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600
                                 rounded-lg px-2 py-2 cursor-grab hover:border-blue-300 dark:hover:border-slate-500 transition"
                    >
                      <span className="text-gray-300 dark:text-slate-500 text-lg select-none">⠿</span>
                      
                      {[
                        { field: 'organization', placeholder: 'Organization', maxLength: 150 },
                        { field: 'day', placeholder: 'e.g. Sunday', maxLength: 20 },
                        { field: 'meeting_time', placeholder: 'e.g. 10:00 AM', maxLength: 20 },
                      ].map(({ field, placeholder, maxLength }) => (
                        <input
                          key={field}
                          type="text"
                          value={s[field] ?? ''}
                          onChange={e => updateSchedule(i, field, e.target.value)}
                          placeholder={placeholder}
                          className="input w-full text-sm"
                          maxLength={maxLength}
                        />

                      ))}
                      <button
                        onClick={() => removeSchedule(i)}
                        className="text-red-400 hover:text-red-600 transition text-lg"
                        title="Remove"
                      >🗑️</button>
                    </div>
                  ))}
                  {schedules.length === 0 && (
                    <div className="text-center text-gray-400 dark:text-slate-500 py-8 border border-dashed border-gray-300 dark:border-slate-600 rounded-lg">
                      No schedule entries yet. Add one below.
                    </div>
                  )}
                  <button
                    className="btn-primary btn-small mt-3"
                    onClick={() => { setSchedules([...schedules, newSchedule()]); setDirtySchedule(true); }}
                  >
                    ＋ Add Schedule Entry
                  </button>
                </>
              )}

              {/* ══ SETTINGS TAB ════════════════════════════════════════════ */}
              {tab === 'settings' && (
                <div className="space-y-6 max-w-lg">
                  <p className="text-sm text-gray-500 dark:text-slate-400">
                    Configure ward name and the member view password for ProgramHome.
                  </p>

                  {/* Ward Name */}
                  <div>
                    <label className="label font-semibold">⛪ Ward Name</label>
                    <input
                      type="text"
                      value={settings.wardName}
                      onChange={e => { setSettings(s => ({ ...s, wardName: e.target.value })); setDirtySettings(true); }}
                      placeholder="Enter your ward name"
                      className="input w-full mt-1"
                    />
                  </div>

                  {/* Stake Name */}
                  <div>
                    <label className="label font-semibold">
                      🏛️ Stake Name{' '}
                      <span className="text-gray-400 dark:text-slate-500 font-normal">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={settings.stakeName}
                      onChange={e => { setSettings(s => ({ ...s, stakeName: e.target.value })); setDirtySettings(true); }}
                      placeholder="e.g. Midland Texas Stake"
                      className="input w-full mt-1"
                    />
                  </div>

                  {/* Ward URL */}
                  <div>
                    <label className="label font-semibold">
                      🌐 Ward Website URL{' '}
                      <span className="text-gray-400 dark:text-slate-500 font-normal">(optional)</span>
                    </label>
                    <input
                      type="url"
                      value={settings.wardUrl ?? ''}
                      onChange={e => { setSettings(s => ({ ...s, wardUrl: e.target.value })); setDirtySettings(true); }}
                      placeholder="https://www.churchofjesuschrist.org/unit/..."
                      className="input w-full mt-1"
                    />
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                      Shown as a button on the public program page.
                    </p>
                  </div>

                  {/* View Password */}
                  <div className="border border-gray-200 dark:border-slate-600 rounded-xl p-4 bg-gray-50 dark:bg-slate-700">
                    <h5 className="font-semibold text-sm mb-1 dark:text-slate-100">🔒 Member View Password</h5>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mb-3">
                      {settings.hasViewPassword
                        ? 'A password is currently set. Enter a new one below to change it, or leave blank to keep the existing password.'
                        : 'No password is set. All content is visible to everyone. Set a password to protect member names.'}
                    </p>

                    {/* New Password */}
                    <label className="label text-sm">New Password</label>
                    <div className="relative mt-1 mb-1">
                      <input
                        type={showViewPassword ? 'text' : 'password'}
                        value={viewPassword}
                        onChange={e => { setViewPassword(e.target.value); setPwdError(''); setDirtySettings(true); }}
                        placeholder={settings.hasViewPassword ? 'Leave blank to keep current' : 'Set a new password'}
                        className="input w-full pr-10"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowViewPassword(p => !p)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400
                                   hover:text-gray-600 dark:hover:text-slate-300 text-sm"
                      >
                        {showViewPassword ? '🙈' : '👁️'}
                      </button>
                    </div>
                    <PasswordStrength password={viewPassword} />

                    {/* Confirm Password */}
                    <label className="label text-sm mt-3">Confirm Password</label>
                    <div className="relative mt-1">
                      <input
                        type={showConfirmPwd ? 'text' : 'password'}
                        value={confirmPwd}
                        onChange={e => { setConfirmPwd(e.target.value); setPwdError(''); setDirtySettings(true); }}
                        placeholder="Re-enter new password"
                        className="input w-full pr-10"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPwd(p => !p)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400
                                   hover:text-gray-600 dark:hover:text-slate-300 text-sm"
                      >
                        {showConfirmPwd ? '🙈' : '👁️'}
                      </button>
                    </div>
                    {/* Match indicator */}
                    {confirmPwd.length > 0 && (
                      <p className={`text-xs mt-1 ${
                        confirmPwd === viewPassword
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-500 dark:text-red-400'
                      }`}>
                        {confirmPwd === viewPassword ? '✅ Passwords match' : '❌ Passwords do not match'}
                      </p>
                    )}
                    {pwdError && <p className="text-red-500 dark:text-red-400 text-sm mt-2">{pwdError}</p>}

                    {/* Test Password */}
                    {settings.hasViewPassword && (
                      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-slate-600">
                        <label className="label text-sm">🧪 Test Current Password</label>
                        <div className="flex gap-2 mt-1">
                          <div className="relative flex-1">
                            <input
                              type={showTestPwd ? 'text' : 'password'}
                              value={testPwd}
                              onChange={e => { setTestPwd(e.target.value); setTestResult(null); }}
                              placeholder="Enter password to test"
                              className="input w-full pr-10"
                              onKeyDown={e => e.key === 'Enter' && testPassword()}
                            />
                            <button
                              type="button"
                              onClick={() => setShowTestPwd(p => !p)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400
                                         hover:text-gray-600 dark:hover:text-slate-300 text-sm"
                            >
                              {showTestPwd ? '🙈' : '👁️'}
                            </button>
                          </div>
                          <button onClick={testPassword} className="btn-secondary btn-small px-4">
                            Test
                          </button>
                        </div>
                        {testResult === 'success' && <p className="text-green-600 dark:text-green-400 text-sm mt-1">✅ Password is correct!</p>}
                        {testResult === 'fail' && <p className="text-red-500 dark:text-red-400 text-sm mt-1">❌ Incorrect password.</p>}
                      </div>
                    )}
                  </div>
                  {/* ── Announcement Requests ─────────────────────────────────────── */}
                  <div className="border border-gray-200 dark:border-slate-600 rounded-xl p-4 bg-gray-50 dark:bg-slate-700">
                      <h5 className="font-semibold text-sm mb-1 dark:text-slate-100">
                          📢 Announcement Requests
                      </h5>
                      <p className="text-xs text-gray-500 dark:text-slate-400 mb-3">
                          Allow ward members to submit announcement requests from the public program page.
                          Requests are sent by email to the addresses below.
                      </p>

                      {/* Enable toggle */}
                      <div className="flex items-center gap-3 mb-4">
                          <button
                              type="button"
                              onClick={() => {
                                  setSettings(s => ({ ...s, announcementEnabled: !s.announcementEnabled }));
                                  setDirtySettings(true);
                              }}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                  settings.announcementEnabled
                                      ? 'bg-green-500 dark:bg-green-600'
                                      : 'bg-gray-300 dark:bg-slate-600'
                              }`}
                          >
                              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                  settings.announcementEnabled ? 'translate-x-6' : 'translate-x-1'
                              }`} />
                          </button>
                          <span className="text-sm font-medium dark:text-slate-200">
                              {settings.announcementEnabled
                                  ? '✅ Announcement requests enabled'
                                  : '🚫 Announcement requests disabled'}
                          </span>
                      </div>

                      {/* Email addresses */}
                      <label className="label text-sm">
                          📧 Recipient Email Addresses
                          <span className="text-gray-400 dark:text-slate-500 font-normal ml-1">
                              (comma-separated)
                          </span>
                      </label>
                      <textarea
                          value={settings.announcementEmails ?? ''}
                          onChange={e => {
                              setSettings(s => ({ ...s, announcementEmails: e.target.value }));
                              setDirtySettings(true);
                          }}
                          placeholder="e.g. bishop@example.com, secretary@example.com"
                          rows={3}
                          className="input w-full mt-1 text-sm font-mono resize-none"
                      />
                      <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                          All addresses will receive a copy of each announcement request.
                      </p>
                  </div>
                </div>
                
              )}
            </>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200
                        dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 rounded-b-xl">
          <button className="btn-secondary" onClick={() => navigate('/admin')}>
            ← Back to Dashboard
          </button>
          
          <button
            className="btn-primary"
            disabled={saving || !isDirty}
            onClick={
              tab === 'leadership' ? saveLeadership :
              tab === 'schedules'  ? saveSchedules  :
              saveSettings
            }
          >
            {saving ? '💾 Saving...' : (
              tab === 'leadership' ? '💾 Save Leadership' :
              tab === 'schedules'  ? '💾 Save Schedules'  :
              '💾 Save Settings'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
// ProgramHome.jsx
import React, { useState, useRef, useEffect} from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useProgramContext } from '../context/ProgramContext';
import { useAuth } from '../context/AuthContext';
import HymnLink from '../components/HymnLink';
import { useWardUnlock } from '../hooks/useWardUnlock';
import LockedField from '../components/LockedField';
import UnlockModal from '../components/UnlockModal';
import { linkify } from '../utils/linkify';
import ChildrensHymnLink from '../components/ChildrensHymnLink'; // ← ADD
import AnnouncementRequestModal from '../components/AnnouncementRequestModal';
import { api, apiBase } from '../utils/api';
import { logger } from '../utils/logger';
import ContactUsModal from '../components/ContactUsModal';
import { buildDateTimeLabel, buildMapsLink, buildGoogleCalendarLink, downloadIcs } from '../utils/formatters';
import WardDisclaimer from '../components/WardDisclaimer';

// ── Helpers ──────────────────────────────────────────────────────────────────
const getTodayString = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatDateLabel = (dateStr) => {
  if (!dateStr) return '';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
};

// ── Sunday quick-jump helpers ─────────────────────────────────────────────────
const toDateString = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;


const getNearestSunday = () => {
  const d = new Date();
  const day = d.getDay(); // 0 = Sunday
  if (day !== 0) d.setDate(d.getDate() + (7 - day));
  return toDateString(d);
};

const getPrevSunday = () => {
  const d = new Date();
  const day = d.getDay();
  // If today is Sunday go back 7, otherwise go back to last Sunday
  d.setDate(d.getDate() - (day === 0 ? 7 : day));
  return toDateString(d);
};


// AFTER — always the Sunday AFTER the nearest one
const getNextSunday = () => {
  const d = new Date();
  const day = d.getDay();
  // Jump to nearest Sunday first, then add 7 more days
  const daysUntilSunday = day === 0 ? 7 : (7 - day);
  d.setDate(d.getDate() + daysUntilSunday + 7);
  return toDateString(d);
};




// ── Component ────────────────────────────────────────────────────────────────
function ProgramHome() {
  const { loadPublishedByDate, loadWardName, loadPublicSchedules } = useProgramContext();
    // Add new state at the top of ProgramHome
  const [publicSchedules, setPublicSchedules] = useState([]);
  const [wardName, setWardName] = useState('');
  const [stakeName, setStakeName] = useState('');
  const [wardUrl, setWardUrl] = useState('');
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  
  const [showAnnModal, setShowAnnModal]           = useState(false);
  const [announcementEnabled, setAnnouncementEnabled] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactEnabled, setContactEnabled]     = useState(false);
  
  useEffect(() => {
      api.get('/announcements/settings')
          .then(d => setAnnouncementEnabled(!!(d.announcementEnabled && d.hasEmails)))
          .catch(() => {}); // silent fail — button just won't show
  }, []);

  useEffect(() => {
      api.get('/contact/settings')
          .then(d => setContactEnabled(!!d.contactEnabled))
          .catch(() => {});
  }, []);


  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const [dayPrograms, setDayPrograms] = useState([]);
  const [loadingDay, setLoadingDay] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const FADE_DURATION = 200;

  const { isUnlocked, unlock, lock, minutesLeft, noPasswordSet } = useWardUnlock();
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const requestUnlock = () => setShowUnlockModal(true);
  

  const handleUnlock = async (password) => {
    const success = await unlock(password);
    if (success) setShowUnlockModal(false);
    return success;
  };


  // With this debounced version:
  const dateDebounceRef = useRef(null);
  const handleDateChange = (e) => {
    const val = e.target.value;
    clearTimeout(dateDebounceRef.current);
    dateDebounceRef.current = setTimeout(() => setSelectedDate(val), 300);
  };


  // ── Fetch programs whenever the selected date changes ────────────────────
  useEffect(() => {
    let cancelled = false;
    
    const fetchForDate = async () => {
      setLoadingDay(true);
      setVisible(false);
      try {
        const data = await loadPublishedByDate(selectedDate);
        if (!cancelled) {
          setDayPrograms(data);
          setActiveIndex(0);
          setLoadingDay(false);
          setTimeout(() => { if (!cancelled) setVisible(true); }, 50);
        }
      } catch (err) {
        logger.error('[ProgramHome] Failed to load programs for date:', err.message);
        if (!cancelled) {
          setDayPrograms([]);
          setLoadingDay(false);
          setVisible(true);
        }
      }
    };

    fetchForDate();
    return () => { cancelled = true; };
  }, [selectedDate, loadPublishedByDate]);

  // ── Fetch ward name once on mount ────────────────────────────────────────
  useEffect(() => {
    loadWardName().then(name => {
      setWardName(name.wardName);
      setStakeName(name.stakeName);
      setWardUrl(name.wardUrl);
    });
  }, [loadWardName]);

 
  //Fetch ward meeting schedules for public display
  useEffect(() => {
    loadPublicSchedules().then(schedules => setPublicSchedules(schedules));
  }, [loadPublicSchedules]);

  // ── Navigation with fade + scroll to top ────────────────────────────────
  const navigateToIndex = (newIndex) => {
    if (newIndex === activeIndex) return;
    setVisible(false);
    setTimeout(() => {
      setActiveIndex(newIndex);
      setVisible(true);
      window.scrollTo({ top: 0, behavior: 'smooth' }); // ✅ scroll to top on program change
    }, FADE_DURATION);
  };

  // ── Swipe support ────────────────────────────────────────────────────────
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);
  const SWIPE_THRESHOLD = 50;

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > SWIPE_THRESHOLD) {
      if (deltaX < 0) navigateToIndex(Math.min(dayPrograms.length - 1, activeIndex + 1));
      else navigateToIndex(Math.max(0, activeIndex - 1));
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  const activeProgram = dayPrograms[activeIndex];

  // ── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto px-4">

      {/* HEADER */}
      <div className="mb-6 flex justify-between items-center">
        <div>
          {/* ✅ Responsive title size — text-2xl on mobile, text-3xl on sm+ */}
          
          <h2 className="text-xl sm:text-3xl font-bold text-lds-blue dark:text-slate-100 
            line-clamp-2 leading-tight">
            ⛪ {activeProgram?.programName || 'Sacrament Meeting Program'}
          </h2>

          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            {wardName || 'Ward Programs'}
            {stakeName ? ` · ${stakeName}` : ''}
          </p>
        </div>
      </div>

      {/* DATE PICKER */}
      <div className="card mb-6">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">📅</span>
          <div className="flex-1">
            <label className="label text-sm font-semibold">Select Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={handleDateChange}
              className="input w-full"
            />
          </div>
        </div>

        {/* ✅ Sunday quick-jump buttons */}
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => setSelectedDate(getPrevSunday())}
            className="btn-secondary text-xs flex-1 py-1.5"
          >
            ← Last Sunday
          </button>
          <button
            onClick={() => setSelectedDate(getNearestSunday())}
            className="btn-primary text-xs flex-1 py-1.5"
          >
            This Sunday
          </button>
          <button
            onClick={() => setSelectedDate(getNextSunday())}
            className="btn-secondary text-xs flex-1 py-1.5"
          >
            Next Sunday →
          </button>
        </div>

        <p className="text-sm text-gray-500 dark:text-slate-400 mt-2">
          {formatDateLabel(selectedDate)}
          {' — '}
          {loadingDay ? 'Loading...' :
            dayPrograms.length === 0
              ? 'No programs for this day'
              : `${dayPrograms.length} program${dayPrograms.length > 1 ? 's' : ''} available`
          }
        </p>
      </div>
      
      {/* LOADING STATE */}
      {loadingDay && (
        <div className="card text-center py-12">
          <div className="text-4xl mb-3">⏳</div>
          <p className="text-gray-500 dark:text-slate-400">Loading program...</p>
        </div>
      )}

      {/* NO PROGRAMS STATE */}
      {!loadingDay && dayPrograms.length === 0 && (
        <div className="card text-center py-12">
          <div className="text-6xl mb-4">📅</div>
          <h3 className="text-xl font-bold mb-2 dark:text-slate-100">No Program Published</h3>
          <p className="text-gray-500 dark:text-slate-400 mb-2">
            There is no published program for {formatDateLabel(selectedDate)}.
          </p>
          <p className="text-gray-400 dark:text-slate-500 text-sm">
            Try selecting a different date above.
          </p>
          {isAuthenticated() && (
            <Link to="/builder/new" className="btn-primary mt-4 inline-block">
              ➕ Create a Program
            </Link>
          )}
        </div>
      )}

      {/* SCHEDULES IN EMPTY STATE */}
      {!loadingDay && dayPrograms.length === 0 && publicSchedules.length > 0 && (
        <div className="card mb-4">
          <h4 className="font-bold text-lg mb-3 dark:text-slate-100">🗓️ Meeting Schedules</h4>
          {publicSchedules.map((s, i) => (
            <p key={i} className="text-sm mb-1 dark:text-slate-300">
              <strong className="dark:text-slate-200">{s.organization}:</strong>{' '}
              {s.day} at {s.meeting_time ?? s.time}
              {s.location && ` — ${s.location}`}
            </p>
          ))}
        </div>
      )}

      {/* PROGRAM SLIDER (multiple programs for same day) */}
      {!loadingDay && dayPrograms.length > 1 && (
        <>
          <div className="flex items-center justify-between mb-3 gap-2">
            <button
              onClick={() => navigateToIndex(Math.max(0, activeIndex - 1))}
              disabled={activeIndex === 0}
              className="btn-secondary px-4 py-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← Prev
            </button>
            <div className="flex items-center gap-2">
              {dayPrograms.map((_, i) => (
                <button
                  key={i}
                  onClick={() => navigateToIndex(i)}
                  title={`Program ${i + 1}`}
                  className={`w-4 h-4 rounded-full transition-all ${ // ✅ was w-3 h-3
                    i === activeIndex
                      ? 'bg-lds-blue scale-125'
                      : 'bg-gray-300 dark:bg-slate-600 hover:bg-gray-400 dark:hover:bg-slate-500'
                  }`}
                />
              ))}
            </div>
            <button
              onClick={() => navigateToIndex(Math.min(dayPrograms.length - 1, activeIndex + 1))}
              disabled={activeIndex === dayPrograms.length - 1}
              className="btn-secondary px-4 py-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
          <p className="text-center text-xs text-gray-400 dark:text-slate-500 mb-3 md:hidden">
            👈 Swipe left or right to navigate programs 👉
          </p>
        </>
      )}

      
      {/* ── Fix 12: Admin warning — no ward password configured ─────────────── */}
      {noPasswordSet && isAuthenticated() && (
        <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/20
                        border border-amber-300 dark:border-amber-700
                        text-amber-800 dark:text-amber-300
                        px-4 py-3 rounded-lg mb-3 text-sm">
          <span className="text-lg leading-none mt-0.5">⚠️</span>
          <div>
            <p className="font-bold">No Ward Password Set</p>
            <p className="mt-0.5">
              Member contact info is publicly accessible because no ward view password
              has been configured.{' '}
              <Link to="/admin/ward-defaults" className="underline font-semibold">
                Set a password in Ward Defaults →
              </Link>
            </p>
          </div>
        </div>
      )}


      {/* UNLOCK STATUS BAR */}
      {!loadingDay && activeProgram && (
        <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between
          px-4 py-3 rounded-lg mb-3 text-sm gap-2 ${
          isUnlocked
            ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400'
            : 'bg-amber-100 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-400'
        }`}>
          <span>
            {isUnlocked
              ? `🔓 Member view unlocked — expires in ${minutesLeft} min`
              : '🔒 Some content is hidden. Tap any 🔒 to unlock.'}
          </span>

          {/* Unlock button */}
          {!isUnlocked && (
            <button
              onClick={requestUnlock}
              
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full
                text-xs font-semibold self-start sm:self-auto
                bg-amber-600 text-white
                dark:bg-amber-400 dark:text-slate-900
                hover:bg-amber-700 dark:hover:bg-amber-300
                active:scale-95 transition-all"

            >
              🔓 Unlock
            </button>
          )}

          {/* Lock button */}
          {isUnlocked && (
            <button
              onClick={lock}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full
                text-xs font-semibold self-start sm:self-auto
                bg-green-600 text-white
                dark:bg-green-500 dark:text-white
                hover:bg-green-700 dark:hover:bg-green-400
                active:scale-95 transition-all"
            >
              🔒 Lock
            </button>
          )}
        </div>
      )}

      {/* PROGRAM CONTENT */}
      {!loadingDay && activeProgram && (
        <div
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="select-none"
          style={{
            opacity: visible ? 1 : 0,
            transition: `opacity ${FADE_DURATION}ms ease-in-out`,
          }}
        >
          {dayPrograms.length > 1 && (
            <div className="text-center text-sm text-gray-500 dark:text-slate-400 mb-3">
              Showing program {activeIndex + 1} of {dayPrograms.length}
            </div>
          )}

          {/* COVER */}
          <div className="card mb-4 text-center">
            {(activeProgram.cover?.layout ?? []).length > 0 ? (
              activeProgram.cover.layout.map((block, i) => {
                const blockType = typeof block === 'string' ? block : block?.type;
                if (!blockType) return null;

                if (blockType === 'date') return (
                  <h3 key={i} className="text-xl font-bold text-lds-blue dark:text-slate-100 mb-2">
                    {formatDateLabel(activeProgram.date)}
                  </h3>
                );

                // image block intentionally skipped on public page

                
                if (blockType === 'quote') return block?.quoteText ? (
                  <blockquote key={i} className="italic text-gray-700 dark:text-slate-300 text-center px-4 mb-3">
                    "{block.quoteText}"
                    {block?.attributionText && (
                      <footer className="text-sm text-gray-500 dark:text-slate-400 mt-1 font-semibold not-italic">
                        — {block.attributionText}
                      </footer>
                    )}
                  </blockquote>
                ) : null;

                if (blockType === 'welcome') return block?.welcomeText ? (
                  <div key={i} className="my-3 px-4">
                    <div className="border-t-2 border-lds-blue mb-2" />
                    <p className="text-lg font-bold text-lds-blue dark:text-slate-100">{block.welcomeText}</p>
                    <div className="border-b-2 border-lds-blue mt-2" />
                  </div>
                ) : null;

                if (blockType === 'custom') return block?.customText ? (
                  <p key={i} className="text-sm text-gray-600 dark:text-slate-400 px-4 mb-2">
                    {block.customText}
                  </p>
                ) : null;

                return null;
              })
            ) : (
              /* Fallback — no layout blocks saved (older programs) */
              <>
                <h3 className="text-xl font-bold text-lds-blue dark:text-slate-100 mb-2">
                  {formatDateLabel(activeProgram.date)}
                </h3>
                {/* IMAGE REMOVED — not shown on public page */}
                {activeProgram.cover?.quote && (
                  <blockquote className="italic text-gray-700 dark:text-slate-300 text-center px-4">
                    "{activeProgram.cover.quote}"
                    {activeProgram.cover?.attribution && (
                      <footer className="text-sm text-gray-500 dark:text-slate-400 mt-1 font-semibold not-italic">
                        — {activeProgram.cover.attribution}
                      </footer>
                    )}
                  </blockquote>
                )}
              </>
            )}
          </div>

          {/* MEETING ORDER */}
          <div className="card mb-4">
            <h4 className="font-bold text-lg mb-3 dark:text-slate-100">📋 Meeting Order</h4>
            {activeProgram.meetingOrder?.meetingItems?.length > 0 ? (
              <div className="space-y-1">
                {activeProgram.meetingOrder.meetingItems.map((item, i) => {

                  // ── Opening / Sacrament / Closing Hymn ────────────────────
                  if (['openingHymn', 'sacramentHymn', 'closingHymn'].includes(item.type)) {
                    const labels = {
                      openingHymn:   'Opening Hymn',
                      sacramentHymn: 'Sacrament Hymn',
                      closingHymn:   'Closing Hymn',
                    };
                    return (
                      <div key={i}>
                        <p className="font-bold text-sm text-gray-800 dark:text-slate-100">
                          {labels[item.type]}
                        </p>
                        {(item.number || item.title) && (
                          <p className="text-sm text-gray-600 dark:text-slate-300 ml-3 mt-0.5">
                            Hymn {item.number ? `#${item.number}` : ''}
                            {item.title ? `: ${item.title}` : ''}
                            {item.number && item.title && (
                              <span className="ml-2">
                                <HymnLink number={item.number} title={item.title} />
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                    );
                  }

                  // ── Plain Hymn ─────────────────────────────────────────────
                  if (item.type === 'hymn') {
                    return (
                      <div key={i}>
                        <p className="font-bold text-sm text-gray-800 dark:text-slate-100">Hymn</p>
                        {(item.number || item.title) && (
                          <p className="text-sm text-gray-600 dark:text-slate-300 ml-3 mt-0.5">
                            Hymn {item.number ? `#${item.number}` : ''}
                            {item.title ? `: ${item.title}` : ''}
                            {item.number && item.title && (
                              <span className="ml-2">
                                <HymnLink number={item.number} title={item.title} />
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                    );
                  }

                  if (item.type === 'testimony') {
                    return (
                      <p key={i} className="text-sm italic text-center text-gray-500 dark:text-slate-400">
                        Bearing of Testimonies
                      </p>
                    );
                  }

                  // ── Children's Song ────────────────────────────────────────
                  if (item.type === 'childrensHymn') {
                    return (
                      <div key={i}>
                        <p className="font-bold text-sm text-gray-800 dark:text-slate-100">Children's Song</p>
                        {(item.number || item.title) && (
                          <p className="text-sm text-gray-600 dark:text-slate-300 ml-3 mt-0.5">
                            {item.number ? `#${item.number}` : ''}
                            {item.title ? `: ${item.title}` : ''}
                            {item.number && item.title && (
                              <span className="ml-2">
                                <ChildrensHymnLink number={item.number} title={item.title} />
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                    );
                  }

                  // ── Opening / Closing Prayer ───────────────────────────────
                  if (item.type === 'openingPrayer' || item.type === 'closingPrayer') {
                    return (
                      <div key={i}>
                        <p className="font-bold text-sm text-gray-800 dark:text-slate-100">
                          {item.type === 'openingPrayer' ? 'Opening Prayer' : 'Closing Prayer'}
                        </p>
                      </div>
                    );
                  }

                  // ── Sacrament Admin ────────────────────────────────────────
                  if (item.type === 'sacramentAdmin') {
                    return (
                      <p key={i} className="text-sm italic text-center text-gray-500 dark:text-slate-400">
                        Blessing and Passing of the Sacrament
                      </p>
                    );
                  }

                  // ── Speaker ────────────────────────────────────────────────
                  if (item.type === 'speaker') {
                    return (
                      <div key={i}>
                        <p className="font-bold text-sm text-gray-800 dark:text-slate-100">Speaker</p>
                        {item.topic && (
                          <p className="text-sm italic text-gray-500 dark:text-slate-400 ml-4 mt-0.5">
                            {item.topic}
                          </p>
                        )}
                      </div>
                    );
                  }

                  // ── Musical Number ─────────────────────────────────────────
                  if (item.type === 'musical') {
                    return (
                      <div key={i}>
                        <p className="font-bold text-sm text-gray-800 dark:text-slate-100">Musical Number</p>
                        {item.piece && (
                          <p className="text-sm text-gray-600 dark:text-slate-300 ml-3 mt-0.5">
                            {item.piece}
                          </p>
                        )}
                      </div>
                    );
                  }

                  // ── Announcements ──────────────────────────────────────────
                  if (item.type === 'announce') {
                    return (
                      <p key={i} className="text-sm italic text-center text-gray-500 dark:text-slate-400">
                        Announcements and Ward Business
                      </p>
                    );
                  }

                  // ── Baptism ────────────────────────────────────────────────
                  if (item.type === 'baptism') {
                    return (
                      <p key={i} className="font-bold text-sm text-gray-800 dark:text-slate-100">
                        Baptism
                      </p>
                    );
                  }

                  // ── Confirmation ───────────────────────────────────────────
                  if (item.type === 'confirmation') {
                    return (
                      <p key={i} className="font-bold text-sm text-gray-800 dark:text-slate-100">
                        Confirmation
                      </p>
                    );
                  }

                  // ── Custom Text ────────────────────────────────────────────
                  if (item.type === 'customText') {
                    return item.text?.trim() ? (
                      <p key={i} className="font-bold text-sm text-gray-800 dark:text-slate-100">
                        {item.text}
                      </p>
                    ) : (
                      <div key={i} className="h-4" />
                    );
                  }

                  return null;
                })}
              </div>
            ) : (
              <p className="text-gray-400 dark:text-slate-500 italic text-sm">No meeting items</p>
            )}
          </div>



          {/* ANNOUNCEMENTS */}
          {(() => {
            const publicAnn = activeProgram.announcements?.filter(a => a.isPublic !== false) ?? [];
            return publicAnn.length > 0 ? (
              <div className="card mb-4">
                <h4 className="font-bold text-lg mb-3 dark:text-slate-100">📢 Announcements</h4>
                {publicAnn.map((ann, i) => (
                  <div key={i} className="mb-4 last:mb-0 pb-4 last:pb-0 border-b border-gray-100 dark:border-slate-700 last:border-0">
                    <h5 className="font-bold dark:text-slate-100">{ann.title}</h5>

                    <div className="text-sm mt-0.5">
                      <LockedField
                        value={ann.description}
                        isUnlocked={isUnlocked}
                        onRequestUnlock={requestUnlock}
                        placeholder="Description — members only"
                        renderValue={(val) => linkify(val)}
                      />
                    </div>

                    {/* Date / Time */}
                    {(ann.date || ann.time) && (() => {
                      const dtLabel = buildDateTimeLabel(ann);
                      return dtLabel ? (
                        <p className="text-xs text-gray-600 dark:text-slate-300 mt-1">
                          {dtLabel}
                        </p>
                      ) : null;
                    })()}

                    {/* Location — tappable maps link */}
                    {ann.location && (
                      <p className="text-xs mt-1">
                        {buildMapsLink(ann.location) ? (
                          <a
                            href={buildMapsLink(ann.location)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400
                                      underline hover:text-blue-800 dark:hover:text-blue-300 transition"
                          >
                            📍 {ann.location}
                          </a>
                        ) : (
                          <span className="text-gray-600 dark:text-slate-300">📍 {ann.location}</span>
                        )}
                      </p>
                    )}

                    {/* Calendar links — only show when there's a date */}
                    {ann.date && (
                      <p className="text-xs mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <a
                          href={buildGoogleCalendarLink({
                            title:    ann.title,
                            date:     ann.date,
                            endDate:  ann.endDate,
                            time:     ann.isAllDay ? null : ann.time,
                            endTime:  ann.isAllDay ? null : ann.endTime,
                            location: ann.location,
                          })}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-0.5 text-blue-600 dark:text-blue-400
                                     underline hover:text-blue-800 dark:hover:text-blue-300 transition"
                        >
                          + Google Calendar
                        </a>
                        <span className="text-gray-300 dark:text-slate-600 select-none">|</span>
                        <button
                          type="button"
                          onClick={() => downloadIcs({
                            title:    ann.title,
                            date:     ann.date,
                            endDate:  ann.endDate,
                            time:     ann.isAllDay ? null : ann.time,
                            endTime:  ann.isAllDay ? null : ann.endTime,
                            location: ann.location,
                          })}
                          className="inline-flex items-center gap-0.5 text-blue-600 dark:text-blue-400
                                     underline hover:text-blue-800 dark:hover:text-blue-300
                                     transition bg-transparent border-0 p-0 cursor-pointer text-xs"
                        >
                          + Apple / Outlook
                        </button>
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : null;
          })()}

          {/* MEETING SCHEDULES */}
          
          {(() => {
            // Use program-specific schedules if customized,
            // otherwise fall back to public ward defaults
            const rows = activeProgram.schedules?.length > 0
              ? activeProgram.schedules
              : publicSchedules;

            return rows?.length > 0 && activeProgram.schedulesPublic !== false ? (
              <div className="card mb-4">
                <h4 className="font-bold text-lg mb-3 dark:text-slate-100">🗓️ Meeting Schedules</h4>
                {rows.map((s, i) => (
                  <p key={i} className="text-sm mb-1 dark:text-slate-300">
                    <strong className="dark:text-slate-200">{s.organization}:</strong>{' '}
                    {s.day} at {s.meeting_time ?? s.time}
                    {s.location && ` — ${s.location}`}
                  </p>
                ))}
              </div>
            ) : null;
          })()}


        </div>
      )}

      {/* UNLOCK MODAL */}
      {showUnlockModal && (
        <UnlockModal
          onUnlock={handleUnlock}
          onClose={() => setShowUnlockModal(false)}
        />
      )}

      {/* ANNOUNCEMENT REQUEST MODAL */}
      {showAnnModal && (
          <AnnouncementRequestModal onClose={() => setShowAnnModal(false)} />
      )}
      {/* CONTACT US MODAL */}
      {showContactModal && (
          <ContactUsModal
              onClose={() => setShowContactModal(false)}
              wardName={wardName}
          />
      )}
      <div className="mb-4 flex flex-wrap items-center justify-center gap-3">
          {wardUrl && (
            <a
              href={wardUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full
                         bg-lds-blue dark:bg-blue-600 text-white font-semibold
                         text-sm shadow hover:bg-opacity-90 dark:hover:bg-blue-500
             active:scale-95 transition-all"
            >
              🌐 Visit Ward Website
            </a>
          )}  
          {announcementEnabled && (
            <button
                  onClick={() => setShowAnnModal(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full
                            bg-lds-blue dark:bg-blue-600 text-white font-semibold
                            text-sm shadow hover:bg-opacity-90 dark:hover:bg-blue-500
                            active:scale-95 transition-all"
              >
                  📢 Submit Announcement Request
              </button>
          )}
        

          {contactEnabled && (
            <button
                onClick={() => setShowContactModal(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full
                          bg-lds-blue dark:bg-blue-600 text-white font-semibold
                          text-sm shadow hover:bg-opacity-90 dark:hover:bg-blue-500
                          active:scale-95 transition-all"
            >
                ✉️ Contact Us
            </button>
          )}

      </div>


      <WardDisclaimer wardName={wardName} stakeName={stakeName} />

    </div>
    
  );
}

export default ProgramHome;
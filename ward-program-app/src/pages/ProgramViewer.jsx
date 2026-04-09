// src/pages/ProgramViewer.jsx
import React, { useState, useEffect } from 'react';
import { Link, useParams }       from 'react-router-dom';
import { generateProgramPDF }    from '../utils/PDFGenerator';
import HymnLink                  from '../components/HymnLink';
import { api, apiBase }                   from '../utils/api';
import { useProgramContext }      from '../context/ProgramContext';
import { useError } from '../context/ErrorContext';
import ChildrensHymnLink from '../components/ChildrensHymnLink'; // ← ADD
import { logger } from '../utils/logger';
import { buildDateTimeLabel, buildMapsLink, } from '../utils/formatters';
import WardDisclaimer from '../components/WardDisclaimer';


function ProgramViewer() {
  const { id }                  = useParams();
  const { loadWardDefaults, loadWardName } = useProgramContext();
  const { showToast } = useError();
  const [program, setProgram]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [wardDefaults, setWardDefaults] = useState({ leadership: [], schedules: [] });
  const [notFound, setNotFound] = useState(false);
  const [showPrintTip, setShowPrintTip]   = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const PRINT_TIP_KEY = 'printTipDismissed_v1';
  const [wardName, setWardName] = useState('');
  const [stakeName, setStakeName] = useState('');


  useEffect(() => {
    
    
    const dismissed = localStorage.getItem(PRINT_TIP_KEY);
    if (dismissed === 'true') setDontShowAgain(true);

    const loadProgram = async () => {
      setLoading(true);
      try {
        const data = await api.get(`/programs/${id}`);

        setProgram(data);
      } catch (err) {
        logger.error('[ProgramViewer] Failed to load program:', err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    
    if (id) loadProgram();
  }, [id]);

  useEffect(() => {
    loadWardDefaults().then(d =>
      setWardDefaults(d ?? { leadership: [], schedules: [] })
    );
 }, [loadWardDefaults]);


  useEffect(() => {
      loadWardName().then(({ wardName, stakeName }) => {
          setWardName(wardName);
          setStakeName(stakeName);
      });
  }, [loadWardName]);



  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-500 dark:text-slate-400">
        <div className="text-5xl mb-4">⏳</div>
        <p className="text-lg">Loading program...</p>
      </div>
    );
  }

  // ── Not found state ────────────────────────────────────────────────────────
  if (notFound || !program) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="text-5xl mb-4">😕</div>
        <p className="text-lg text-gray-600 dark:text-slate-300 mb-4">Program not found</p>
        <Link to="/admin" className="btn-secondary">← Back to Dashboard</Link>
      </div>
    );
  }

  // ── PDF handlers ───────────────────────────────────────────────────────────
  const handleGeneratePDF = async () => {
    try {
      const pdf    = await generateProgramPDF(program, wardDefaults);
      const pdfBlob = pdf.output('blob');
      const pdfUrl  = URL.createObjectURL(pdfBlob);
      window.open(pdfUrl, '_blank');
      setTimeout(() => URL.revokeObjectURL(pdfUrl), 10_000);
    } catch (error) {
      logger.error('Error generating PDF:', error);
      showToast('❌ Error generating PDF. Please try again.', 'error');
    }
  };

  const handlePrintClick = () => {
    if (!dontShowAgain) { setShowPrintTip(true); } else { handleGeneratePDF(); }
  };

  const handleProceedToPrint = () => {
    if (dontShowAgain) localStorage.setItem(PRINT_TIP_KEY, 'true');
    setShowPrintTip(false);
    handleGeneratePDF();
  };

  // ── Data helpers ───────────────────────────────────────────────────────────
  const meetingOrder      = program.meetingOrder ?? { conducting: '', presiding: '', chorister: '', accompanist: '', meetingItems: [] };
  const announcements     = program.announcements ?? [];
  const useDefaultLeadership = program.useDefaultLeadership ?? (program.leadershipMode === 'default') ?? true;
  const leadership        = (!useDefaultLeadership && program.leadership?.length > 0) ? program.leadership : wardDefaults.leadership;
  const useDefaultSchedules  = program.useDefaultSchedules ?? (program.schedulesMode === 'default') ?? true;
  const schedules         = (!useDefaultSchedules && program.schedules?.length > 0) ? program.schedules : wardDefaults.schedules;
  const coverLayout       = program.cover?.layout ?? [];
  const formattedDate = new Date(program.date + 'T00:00:00').toLocaleDateString('en-US', {
          month: 'long', day: 'numeric', year: 'numeric',
        });


  // Add this helper above renderCoverBlocks():
  const getCoverImageSrc = () => {
    if (!program.cover) return null;
    // Library image — use authenticated serve endpoint
    if (program.cover.imageSource === 'library' && program.cover.imageId) {
      return `${apiBase}/api/images/${program.cover.imageId}/serve`;
    }
    // base64 (file upload) or external URL — use as-is
    return program.cover.image ?? program.cover.imageUrl ?? null;
  };
  // ── Cover layout renderer ──────────────────────────────────────────────────
  const renderCoverBlocks = () => {
    if (coverLayout.length === 0) {
      return (
        <>
          <h5 className="text-xl font-bold text-lds-blue dark:text-slate-100 mb-2">
            {formattedDate}
          </h5>
          {(program.cover?.image || program.cover?.imageId) && (
            <img src={getCoverImageSrc()} alt="Cover" className="w-full rounded mb-3" />
          )}
          {program.cover?.quote && (
            <blockquote className="italic text-gray-700 dark:text-slate-300 text-center px-4 mb-3">
              "{program.cover.quote}"
              {program.cover?.attribution && (
                <footer className="text-sm text-gray-500 dark:text-slate-400 mt-1 font-semibold not-italic">
                  — {program.cover.attribution}
                </footer>
              )}
            </blockquote>
          )}
        </>
      );
    }

    return coverLayout.map((block, i) => {
      const blockType = typeof block === 'string' ? block : block?.type;
      if (!blockType) return null;

      if (blockType === 'date') return (
        <h5 key={i} className="text-xl font-bold text-lds-blue dark:text-slate-100 mb-2">
          {formattedDate}
        </h5>
      );


        // coverLayout 'image' block:
        if (blockType === 'image') {
          const coverSrc = getCoverImageSrc();
          return coverSrc ? (
            <img
              key={i}
              src={coverSrc}
              alt="Cover"
              className="w-full rounded mb-3 object-cover"
            />
          ) : null;
        }




      
      if (blockType === 'quote') return block?.quoteText ? (
        <blockquote key={i} className="italic text-gray-600 dark:text-slate-400 text-center px-4 mb-3">
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
    });
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto px-4 py-6">

      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">
        <Link to="/admin" className="btn-secondary text-sm">← Back to Admin</Link>
        <button onClick={handlePrintClick} className="btn-primary">
          🖨️ Generate PDF
        </button>
      </div>

      {/* PDF TIP MODAL */}
      {showPrintTip && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-6 max-w-md w-full">

            <div className="text-center mb-4">
              <div className="text-4xl mb-2">📄</div>
              <h6 className="text-lg font-bold text-gray-800 dark:text-slate-100">PDF Generation</h6>
            </div>

            <p className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
              This will generate a PDF with perfect layout:
            </p>
            <ul className="text-sm text-gray-600 dark:text-slate-400 space-y-1 mb-4 ml-4 list-disc">
              <li>Opens in new tab for review</li>
              <li>No browser margin issues</li>
              <li>Consistent output every time</li>
              <li>Can save or print from PDF</li>
            </ul>

            <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
              The PDF opens in a new window. You can print or save it from there.
            </p>

            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-400 cursor-pointer mb-5">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="mr-1"
              />
              Don't show this again
            </label>

            <div className="flex gap-3">
              <button onClick={() => setShowPrintTip(false)} className="btn-secondary flex-1">
                Cancel
              </button>
              <button onClick={handleProceedToPrint} className="btn-primary flex-1">
                Generate PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COVER CARD */}
      <div className="card mb-4 text-center">
        <h6 className="text-2xl font-bold text-lds-blue dark:text-slate-100 mb-4">
          {program.programName || 'Sacrament Meeting Program'}
        </h6>
        {renderCoverBlocks()}
      </div>

      {/* MEETING ORDER CARD */}
      <div className="card mb-4">
        <h6 className="font-bold text-lg mb-3 text-gray-800 dark:text-slate-100">📋 Meeting Order</h6>

        {/* Presiding info */}
        <div className="space-y-1 mb-4">
          {[
            { label: 'Conducting',  val: meetingOrder.conducting  },
            { label: 'Presiding',   val: meetingOrder.presiding   },
            { label: 'Chorister',   val: meetingOrder.chorister   },
            { label: 'Accompanist', val: meetingOrder.accompanist },
          ].map(({ label, val }) => (
            <p key={label} className="text-sm dark:text-slate-300">
              <strong className="dark:text-slate-200">{label}:</strong>{' '}
              <span className={val ? '' : 'text-gray-400 dark:text-slate-500 italic'}>
                {val || 'TBA'}
              </span>
            </p>
          ))}
        </div>

        {/* Meeting items */}
        <div className="space-y-1 pt-3">
          {meetingOrder.meetingItems.map((item, i) => (
            <div key={i} className="text-sm py-1 dark:text-slate-300">
              {item.type === 'openingHymn' && (
                <div>
                  <p className="font-bold">Opening Hymn</p>
                  {(item.number || item.title) && <p className="ml-3 text-gray-600 dark:text-slate-400">Hymn {item.number ? `#${item.number}` : ''}{item.title ? `: ${item.title}` : ''}{item.number && item.title && <span className="ml-2"><HymnLink number={item.number} title={item.title} /></span>}</p>}
                </div>
              )}
              {item.type === 'openingPrayer' && (
                <div>
                  <p className="font-bold">Opening Prayer</p>
                  {item.name && <p className="ml-3 text-gray-600 dark:text-slate-400">{item.name}</p>}
                </div>
              )}
              {item.type === 'announce' && (
                <p className="text-sm italic text-center text-gray-500 dark:text-slate-400">
                  Announcements and Ward Business
                </p>
              )}
              {item.type === 'testimony' && (
                <p className="text-sm italic text-center text-gray-500 dark:text-slate-400">
                  Bearing of Testimonies
                </p>
              )}
              {item.type === 'sacramentHymn' && (
                <div>
                  <p className="font-bold">Sacrament Hymn</p>
                  {(item.number || item.title) && <p className="ml-3 text-gray-600 dark:text-slate-400">Hymn {item.number ? `#${item.number}` : ''}{item.title ? `: ${item.title}` : ''}{item.number && item.title && <span className="ml-2"><HymnLink number={item.number} title={item.title} /></span>}</p>}
                </div>
              )}
              {item.type === 'sacramentAdmin' && (
                <p className="text-sm italic text-center text-gray-500 dark:text-slate-400">
                  Blessing and Passing of the Sacrament
                </p>
              )}
              {item.type === 'speaker' && (
                <div>
                  <p className="font-bold">Speaker</p>
                  {item.name && <p className="ml-3 text-gray-600 dark:text-slate-400">{item.name}</p>}
                  {item.topic && <p className="ml-4 italic text-gray-500 dark:text-slate-400">{item.topic}</p>}
                </div>
              )}
              {item.type === 'hymn' && (
                <div>
                  <p className="font-bold">Hymn</p>
                  {(item.number || item.title) && <p className="ml-3 text-gray-600 dark:text-slate-400">Hymn {item.number ? `#${item.number}` : ''}{item.title ? `: ${item.title}` : ''}{item.number && item.title && <span className="ml-2"><HymnLink number={item.number} title={item.title} /></span>}</p>}
                </div>
              )}
              
              {/* ── ADD THIS BLOCK ──────────────────────────────────────────────── */}
              {item.type === 'childrensHymn' && (
                <div>
                  <p className="font-bold">Children's Song</p>
                  {(item.number || item.title) && <p className="ml-3 text-gray-600 dark:text-slate-400">{item.number ? `#${item.number}` : ''}{item.title ? `: ${item.title}` : ''}{item.number && item.title && <span className="ml-2"><ChildrensHymnLink number={item.number} title={item.title} /></span>}</p>}
                </div>
              )}
              {/* ────────────────────────────────────────────────────────────────── */}

              {item.type === 'musical' && (
                <div>
                  <p className="font-bold">Musical Number</p>
                  {(item.performers || item.piece) && <p className="ml-3 text-gray-600 dark:text-slate-400">{item.performers ?? ''}{item.performers && item.piece ? ': ' : ''}{item.piece ?? ''}</p>}
                </div>
              )}
              {item.type === 'baptism' && (
                <div>
                  <p className="font-bold">Baptism{item.personName ? ` of ${item.personName}` : ''}</p>
                  {item.performedBy && <p className="ml-3 italic text-gray-500 dark:text-slate-400">Performed by {item.performedBy}</p>}
                  {(item.witness1 || item.witness2) && <p className="ml-3 italic text-gray-500 dark:text-slate-400">Witnessed by {item.witness1 ?? ''}{item.witness1 && item.witness2 ? ' and ' : ''}{item.witness2 ?? ''}</p>}
                </div>
              )}
              {item.type === 'confirmation' && (
                <div>
                  <p className="font-bold">Confirmation{item.personName ? ` of ${item.personName}` : ''}</p>
                  {item.performedBy && <p className="ml-3 italic text-gray-500 dark:text-slate-400">Performed by {item.performedBy}</p>}
                </div>
              )}
              {item.type === 'closingHymn' && (
                <div>
                  <p className="font-bold">Closing Hymn</p>
                  {(item.number || item.title) && <p className="ml-3 text-gray-600 dark:text-slate-400">Hymn {item.number ? `#${item.number}` : ''}{item.title ? `: ${item.title}` : ''}{item.number && item.title && <span className="ml-2"><HymnLink number={item.number} title={item.title} /></span>}</p>}
                </div>
              )}
              {item.type === 'closingPrayer' && (
                <div>
                  <p className="font-bold">Closing Prayer</p>
                  {item.name && <p className="ml-3 text-gray-600 dark:text-slate-400">{item.name}</p>}
                </div>
              )}
              
              {item.type === 'customText' && item.text?.trim() && (
                <p className="text-sm italic text-center text-gray-500 dark:text-slate-400">
                  {item.text}
                </p>
              )}

            </div>
          ))}
        </div>
      </div>

      {/* ANNOUNCEMENTS CARD */}
      <div className="card mb-4">
        <h6 className="font-bold text-lg mb-3 text-gray-800 dark:text-slate-100">📢 Announcements</h6>
        {announcements.length > 0 ? (
          announcements.map((ann, i) => (
            <div key={i} className="mb-4 pb-4 border-b border-gray-100 dark:border-slate-700 last:border-0 last:mb-0 last:pb-0">
              <h6 className="font-bold text-gray-800 dark:text-slate-100 mb-1">{ann.title}</h6>
              <p className="text-sm text-gray-600 dark:text-slate-400 mb-1">{ann.description}</p>

              {/* Date / Time */}
              {(ann.date || ann.time) && (() => {
                const dtLabel = buildDateTimeLabel(ann);
                return dtLabel ? (
                  <p className="text-xs text-gray-600 dark:text-slate-300 mt-1">{dtLabel}</p>
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

              {/* Public/private badge */}
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                {ann.isPublic ? '🌐 Public' : '🔒 Private (PDF only)'}
              </p>
            </div>
          ))
        ) : (
          <p className="text-sm text-gray-400 dark:text-slate-500 italic">No announcements</p>
        )}
      </div>

      {/* WARD LEADERSHIP CARD */}
      {leadership.length > 0 && (
        <div className="card mb-4">
          <h6 className="font-bold text-lg mb-3 text-gray-800 dark:text-slate-100">👥 Ward Leadership</h6>
          {!program.leadershipPublic && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mb-3">
              🔒 Not shown on public program
            </p>
          )}
          <div className="space-y-3">
            {leadership.map((l, i) => (
              <div key={i}>
                <p className="font-semibold text-sm text-gray-700 dark:text-slate-200">{l.role}</p>
                <p className="text-sm text-gray-600 dark:text-slate-300">{l.name}</p>
                {l.phone && <p className="text-xs text-gray-400 dark:text-slate-400">📞 {l.phone}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MEETING SCHEDULES CARD */}
      {schedules.length > 0 && (
        <div className="card mb-4">
          <h6 className="font-bold text-lg mb-3 text-gray-800 dark:text-slate-100">🗓️ Meeting Schedules</h6>
          {!program.schedulesPublic && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mb-3">
              🔒 Not shown on public program
            </p>
          )}
          <div className="space-y-1">
            {schedules.map((s, i) => (
              <p key={i} className="text-sm dark:text-slate-300">
                <strong className="dark:text-slate-200">{s.organization}:</strong>{' '}
                {s.day} at {s.meeting_time ?? s.time}
                {s.location && <span className="text-gray-500 dark:text-slate-400"> — {s.location}</span>}
              </p>
            ))}
          </div>
        </div>
      )}
      <WardDisclaimer wardName={wardName} stakeName={stakeName} />
    </div>
  );
}

export default ProgramViewer;
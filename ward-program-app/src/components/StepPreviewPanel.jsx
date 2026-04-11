// src/components/StepPreviewPanel.jsx
import React from 'react';
import { CoverPreviewBlock } from './CoverPreviewBlock';
import { getResolvedSizes, PANEL_HEIGHT_IN } from '../utils/printSettingsUtils';
import { COVER_PANEL_WIDTH_IN, COVER_PANEL_HEIGHT_IN } from '../utils/coverImageUtils';

// ── Constants ────────────────────────────────────────────────────────────────
const PDF_PANEL_HEIGHT_PX = Math.round(PANEL_HEIGHT_IN * 96); // ~749px
const PDF_PANEL_WIDTH_PX  = 360;                               // 3.75in × 96dpi
const PDF_PANEL_HEIGHT_IN = PANEL_HEIGHT_IN.toFixed(2);        // ✅ "7.80" not 7.895833...


// ── HealthBadge — sits ABOVE the preview box, never inside it ───────────────
function HealthBadge({ health, label }) {
  if (!health) return null;

  const { usedPct, status } = health;

  const badgeStyle =
    status === 'overflow'
      ? 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 border-red-300 dark:border-red-700'
      : status === 'warning'
      ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-600'
      : 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 border-green-300 dark:border-green-700';

  const icon =
    status === 'overflow' ? '🔴'
    : status === 'warning' ? '🟡'
    : '🟢';

  const barColor =
    status === 'overflow' ? 'bg-red-500'
    : status === 'warning' ? 'bg-amber-400'
    : 'bg-green-500';

  const clampedPct = Math.min(usedPct, 100);

  return (
    <div
      className={`flex items-center gap-2 mb-2 px-3 py-1.5 rounded-lg
                  border text-xs font-medium ${badgeStyle}`}
      style={{ width: `${PDF_PANEL_WIDTH_PX}px`, maxWidth: '100%', margin: '0 auto 8px' }}
    >
      <span>{icon}</span>
      <span className="flex-1">{label}</span>

      {/* Progress bar */}
      <div className="w-24 h-1.5 rounded-full bg-gray-200 dark:bg-slate-700 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${clampedPct}%` }}
        />
      </div>

      <span className="font-bold tabular-nums">{usedPct}%</span>
    </div>
  );
}

// ── PdfPageWrapper ────────────────────────────────────────────────────────────
function PdfPageWrapper({ caption, children, centerContent = false }) {
  return (
    <div
      style={{
        width:        `${PDF_PANEL_WIDTH_PX}px`,
        maxWidth:     '100%',
        position:     'relative',
        margin:       '0 auto',
        border:       '2px dashed #94a3b8',
        borderRadius: '8px',
        overflow:     'hidden',
      }}
      className="bg-white dark:bg-slate-950"
    >
      {/* ── Content area ── */}
      <div
        style={{
          display:        'flex',
          flexDirection:  'column',
          justifyContent: centerContent ? 'center' : 'flex-start',
          minHeight:      `${PDF_PANEL_HEIGHT_PX}px`,
          paddingBottom:  '24px',
        }}
      >
        {children}
      </div>

      {/* ── Caption footer ── */}
      {/* ✅ FIX: NO inline backgroundColor — Tailwind only so dark: variants work */}
      <div
        style={{
          position:   'absolute',
          bottom:     0,
          left:       0,
          right:      0,
          textAlign:  'center',
          fontSize:   '0.6rem',
          padding:    '3px 8px',
          lineHeight: 1.2,
          borderTop:  '1px solid',
        }}
        className="text-slate-400 dark:text-slate-500
                   bg-white dark:bg-slate-950
                   border-slate-200 dark:border-slate-700"
      >
        {caption}
      </div>
    </div>
  );
}

// ── StepPreviewPanel ──────────────────────────────────────────────────────────
export function StepPreviewPanel({
  step,
  formData,
  wardDefaults,
  leadershipMode,
  schedulesMode,
  health,
}) {
  return (
    <>
      {/* ════════════════════════════════════════════════════════════════════
          STEP 1 — Cover
      ════════════════════════════════════════════════════════════════════ */}
      {step === 1 && (() => {
        const sizes = getResolvedSizes(formData.cover?.printSettings);
        return (
          <>
            <HealthBadge health={health?.cover} label="Cover panel fill" />
            <PdfPageWrapper
              centerContent
              caption={`Cover panel · ${COVER_PANEL_WIDTH_IN}" × ${COVER_PANEL_HEIGHT_IN}" · Slider height is to scale`}
            >
              <div style={{
                display:       'flex',
                flexDirection: 'column',
                alignItems:    'center',
                gap:           '0.5rem',
                padding:       '0.75rem 0.5rem',
                width:         '100%',
              }}>
                {(formData.cover.layout ?? []).length === 0 ? (
                  <p style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                    Add cover elements to preview
                  </p>
                ) : (
                  (formData.cover.layout ?? []).map((block, i) => (
                    <CoverPreviewBlock
                      key={block.id ?? i}
                      block={block}
                      formData={formData}
                      sizes={sizes}
                    />
                  ))
                )}
              </div>
            </PdfPageWrapper>
          </>
        );
      })()}

      {/* ════════════════════════════════════════════════════════════════════
          STEP 3 — Meeting Order
      ════════════════════════════════════════════════════════════════════ */}
      {step === 3 && (() => {
        const sizes = getResolvedSizes(formData.meetingOrder?.printSettings);
        return (
          <>
            <HealthBadge health={health?.meetingOrder} label="Meeting Order panel fill" />
            <PdfPageWrapper
              caption={`Meeting Order · PDF half-panel (3.75" wide · ${PDF_PANEL_HEIGHT_IN}" tall)`}
            >
              <div
                style={{ fontSize: `${sizes.bodyPt}pt`, lineHeight: 1.4 }}
                className="px-3 pt-3"
              >
                {/* Program title */}
                <h6
                  style={{ fontSize: `${sizes.titlePt}pt` }}
                  className="font-bold text-lds-blue dark:text-blue-400
                             mb-2 text-center"
                >
                  📋 {formData.programName ?? 'Sacrament Meeting Program'}
                </h6>

                {/* Header fields */}
                {[
                  { label: 'Conducting',  val: formData.meetingOrder.conducting  },
                  { label: 'Presiding',   val: formData.meetingOrder.presiding   },
                  { label: 'Chorister',   val: formData.meetingOrder.chorister   },
                  { label: 'Accompanist', val: formData.meetingOrder.accompanist },
                ].map(({ label, val }) => (
                  <p key={label}
                     style={{ fontSize: `${sizes.bodyPt}pt` }}
                     className="text-gray-900 dark:text-slate-100 leading-snug">
                    <span className="font-semibold">{label}:</span>{' '}
                    {val || '(Not set)'}
                  </p>
                ))}

                {/* Meeting items */}
                {formData.meetingOrder.meetingItems?.length > 0 ? (
                  <ul className="mt-2 space-y-0.5 list-disc list-inside">
                    {formData.meetingOrder.meetingItems.map((item, i) => (
                      <li key={item.id ?? i}
                          style={{ fontSize: `${sizes.bodyPt}pt` }}
                          className="text-gray-900 dark:text-slate-100 leading-snug">
                        {item.type === 'openingHymn' && (
                          <span>
                            <span className="font-bold">Opening Hymn</span>
                            <span className="block ml-2">#{item.number ?? '?'}: {item.title ?? '(Title)'}</span>
                          </span>
                        )}
                        {item.type === 'openingPrayer' && (
                          <span>
                            <span className="font-bold">Opening Prayer</span>
                            <span className="block ml-2">{item.name ?? '(Name)'}</span>
                          </span>
                        )}

                        {item.type === 'testimony' && (
                          <span className="italic text-center block text-gray-500 dark:text-slate-400">
                            Bearing of Testimonies
                          </span>
                        )}
                        
                        {item.type === 'sacramentHymn' && (
                          <span>
                            <span className="font-bold">Sacrament Hymn</span>
                            <span className="block ml-2">#{item.number ?? '?'}: {item.title ?? '(Title)'}</span>
                          </span>
                        )}
                        {item.type === 'sacramentAdmin' && (
                          <span className="italic text-center block text-gray-500 dark:text-slate-400">
                            Blessing and Passing of the Sacrament
                          </span>
                        )}
                        {item.type === 'speaker' && (
                          <span>
                            <span className="font-bold">Speaker</span>
                            <span className="block ml-2">{item.name ?? '(Name)'}</span>
                            {item.topic && <span className="block ml-4 italic" style={{ fontSize: `${sizes.subPt}pt` }}>{item.topic}</span>}
                          </span>
                        )}

                        {item.type === 'hymn' && (
                          <span>
                            <span className="font-bold">Hymn</span>
                            <span className="block ml-2">#{item.number ?? '?'}: {item.title ?? '(Title)'}</span>
                          </span>
                        )}

                        {item.type === 'childrensHymn' && (
                          <span>
                            <span className="font-bold">Children's Song</span>
                            <span className="block ml-2">#{item.number ?? '?'}: {item.title ?? '(Title)'}</span>
                          </span>
                        )}
                        {item.type === 'musical' && (
                          <span>
                            <span className="font-bold">Musical Number</span>
                            <span className="block ml-2">🎵 {item.performers ?? '(Performers)'}: {item.piece ?? '(Piece)'}</span>
                          </span>
                        )}
                        {item.type === 'closingHymn' && (
                          <span>
                            <span className="font-bold">Closing Hymn</span>
                            <span className="block ml-2">#{item.number ?? '?'}: {item.title ?? '(Title)'}</span>
                          </span>
                        )}
                        {item.type === 'closingPrayer' && (
                          <span>
                            <span className="font-bold">Closing Prayer</span>
                            <span className="block ml-2">{item.name ?? '(Name)'}</span>
                          </span>
                        )}
                        {item.type === 'announce' && (
                          <span className="italic text-center block text-gray-500 dark:text-slate-400">
                            Announcements and Ward Business
                          </span>
                        )}
                        {item.type === 'baptism' && (
                          <span>
                            <span className="font-bold">Baptism of {item.personName ?? '(Name)'}</span>
                            {item.performedBy && <span className="block ml-2 italic" style={{ fontSize: `${sizes.subPt}pt` }}>Performed by {item.performedBy}</span>}
                            {(item.witness1 || item.witness2) && <span className="block ml-2 italic" style={{ fontSize: `${sizes.subPt}pt` }}>Witnessed by {item.witness1 ?? ''}{item.witness1 && item.witness2 ? ' and ' : ''}{item.witness2 ?? ''}</span>}
                          </span>
                        )}
                        {item.type === 'confirmation' && (
                          <span>
                            <span className="font-bold">Confirmation of {item.personName ?? '(Name)'}</span>
                            {item.performedBy && <span className="block ml-2 italic" style={{ fontSize: `${sizes.subPt}pt` }}>Performed by {item.performedBy}</span>}
                          </span>
                        )}
                        {item.type === 'customText' && (
                          item.text?.trim()
                            ? <span className="italic text-center block text-gray-500 dark:text-slate-400">{item.text}</span>
                            : <span className="block h-[2em] border-l-2 border-dashed border-amber-400 dark:border-amber-600 ml-1 opacity-60" title="Spacing block — 2 blank lines in PDF" />
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-400 dark:text-slate-500 italic mt-2"
                     style={{ fontSize: `${sizes.bodyPt}pt` }}>
                    (No meeting items yet)
                  </p>
                )}
              </div>
            </PdfPageWrapper>
          </>
        );
      })()}

      {/* ════════════════════════════════════════════════════════════════════
          STEP 2 — Announcements
      ════════════════════════════════════════════════════════════════════ */}
      {step === 2 && (() => {
        const sizes = getResolvedSizes(formData.announcementSettings);
        return (
          <>
            <HealthBadge health={health?.announcements} label="Announcements panel fill" />
            <PdfPageWrapper
              caption={`Announcements · PDF half-panel (3.75" wide · ${PDF_PANEL_HEIGHT_IN}" tall)`}
            >
              <div
                style={{ fontSize: `${sizes.bodyPt}pt` }}
                className="px-3 pt-3"
              >
                <h6
                  style={{ fontSize: `${sizes.titlePt}pt` }}
                  className="font-bold text-lds-blue dark:text-blue-400 mb-2"
                >
                  📢 Announcements
                </h6>

                {formData.announcements?.length > 0 ? (
                  formData.announcements.map((a, i) => (
                    <div key={a.id ?? i} className="mb-2">

                      {/* Title + public badge */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <p style={{ fontSize: `${sizes.headingPt ?? sizes.bodyPt}pt` }}
                           className="font-semibold text-gray-900 dark:text-slate-100">
                          {a.title || '(No title)'}
                        </p>
                        <span className="text-xs text-gray-400 dark:text-slate-500">
                          {a.isPublic === false ? '🔒 Private' : '🌐 Public'}
                        </span>
                      </div>

                      {/* Description */}
                      <p style={{ fontSize: `${sizes.bodyPt}pt` }}
                         className="text-gray-800 dark:text-slate-200 leading-snug">
                        {a.description || '(No description)'}
                      </p>

                      {/* Date / time line */}
                      {(a.date || a.time) && (
                        <p style={{ fontSize: `${sizes.subPt ?? sizes.bodyPt}pt` }}
                           className="text-blue-600 dark:text-blue-400 mt-0.5">
                          {a.isAllDay ? (
                            // All-day: show date range or single date
                            <>
                              📅 {a.date && new Date(a.date + 'T00:00:00').toLocaleDateString('en-US', {
                                weekday: 'short', month: 'short', day: 'numeric'
                              })}
                              {a.endDate && a.endDate !== a.date && (
                                <> – {new Date(a.endDate + 'T00:00:00').toLocaleDateString('en-US', {
                                  weekday: 'short', month: 'short', day: 'numeric'
                                })}</>
                              )}
                              {' · All Day'}
                            </>
                          ) : (
                            // Timed: start date, optional end date, start time, optional end time
                            <>
                              {a.date && `📅 ${new Date(a.date + 'T00:00:00').toLocaleDateString('en-US', {
                                weekday: 'short', month: 'short', day: 'numeric'
                              })}`}
                              {a.endDate && a.endDate !== a.date && (
                                <> – {new Date(a.endDate + 'T00:00:00').toLocaleDateString('en-US', {
                                  weekday: 'short', month: 'short', day: 'numeric'
                                })}</>
                              )}
                              {a.time && (
                                <> · 🕐 {new Date(`2000-01-01T${a.time}`).toLocaleTimeString('en-US', {
                                  hour: 'numeric', minute: '2-digit', hour12: true
                                })}</>
                              )}
                              {a.endTime && (
                                <> – {new Date(`2000-01-01T${a.endTime}`).toLocaleTimeString('en-US', {
                                  hour: 'numeric', minute: '2-digit', hour12: true
                                })}</>
                              )}
                            </>
                          )}
                        </p>
                      )}

                      {/* Location */}
                      {a.location && (
                        <p style={{ fontSize: `${sizes.subPt ?? sizes.bodyPt}pt` }}
                           className="text-gray-500 dark:text-slate-400 mt-0.5">
                          📍 {a.location}
                        </p>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-gray-400 dark:text-slate-500 italic"
                     style={{ fontSize: `${sizes.bodyPt}pt` }}>
                    (No announcements yet)
                  </p>
                )}
              </div>
            </PdfPageWrapper>
          </>
        );
      })()}

      {/* ════════════════════════════════════════════════════════════════════
          STEP 4 — Leadership + Schedules
      ════════════════════════════════════════════════════════════════════ */}
      {step === 4 && (() => {
        const sizes      = getResolvedSizes(formData.leadershipSettings);
        // ── Scale font to match PDF panel width ratio ──────────────────────────
        // PDF left panel table is 5.0" wide. Preview is 360px ≈ 3.75".
        // Scale down proportionally so wrapping matches PDF behavior.
        const PDF_TABLE_WIDTH_IN = 5.0;
        const PREVIEW_WIDTH_IN   = 3.75;
        const scale = PREVIEW_WIDTH_IN / PDF_TABLE_WIDTH_IN; // ≈ 0.75
        const scaledBodyPt = Math.round(sizes.bodyPt * scale * 10) / 10;
        const leaderRows = leadershipMode === 'default'
          ? (wardDefaults.leadership ?? [])
          : (formData.leadership      ?? []);
        const schedRows  = schedulesMode === 'default'
          ? (wardDefaults.schedules ?? [])
          : (formData.schedules     ?? []);
        return (
          <>
            <HealthBadge health={health?.leadership} label="Leadership & Schedules panel fill" />
            <PdfPageWrapper
              caption={`Leadership & Schedules · PDF half-panel (3.75" wide · ${PDF_PANEL_HEIGHT_IN}" tall)`}
            >
              <div
                style={{ fontSize: `${scaledBodyPt}pt` }}
                className="px-3 pt-3"
              >
                {/* ── Leadership ── */}
                <h6
                  style={{ fontSize: `${sizes.titlePt}pt` }}
                 
                  className="font-bold text-lds-blue dark:text-blue-400 mb-1"
                >
                  👥 Ward Leadership
                </h6>
                <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">
                  {leadershipMode === 'default' ? '🏛️ Ward Default' : '✏️ Customized'}
                </p>
                {leaderRows.length > 0 ? (
                  <table style={{ fontSize: `${scaledBodyPt}pt`, width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr className="bg-blue-600 dark:bg-blue-800 text-white">
                        <th className="text-left px-1 py-0.5" style={{ width: '30%', fontSize: `${scaledBodyPt}pt` }}>Role</th>
                        <th className="text-left px-1 py-0.5" style={{ width: '38%', fontSize: `${scaledBodyPt}pt` }}>Name</th>
                        <th className="text-left px-1 py-0.5" style={{ width: '32%', fontSize: `${scaledBodyPt}pt` }}>Phone</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderRows.map((l, i) => (
                        <tr key={l.id ?? i}
                            className={i % 2 === 0
                              ? 'bg-gray-100 dark:bg-slate-700'
                              : 'bg-white dark:bg-slate-800'}>
                          <td className="px-1 py-0.5 text-gray-900 dark:text-slate-100" style={{ overflow: 'hidden', fontSize: `${scaledBodyPt}pt` }}>{l.role ?? ''}</td>
                          <td className="px-1 py-0.5 text-gray-900 dark:text-slate-100" style={{ overflow: 'hidden', fontSize: `${scaledBodyPt}pt` }}>{l.name ?? ''}</td>
                          <td className="px-1 py-0.5 text-gray-500 dark:text-slate-400" style={{ overflow: 'hidden', fontSize: `${scaledBodyPt}pt` }}>{l.phone ?? ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-gray-400 dark:text-slate-500 italic"
                    style={{ fontSize: `${scaledBodyPt}pt` }}>
                    (No leadership yet)
                  </p>
                )}

                {/* ── Schedules ── */}
                <h6
                  style={{ fontSize: `${sizes.titlePt}pt` }}
                  className="font-bold text-lds-blue dark:text-blue-400 mt-3 mb-1"
                >
                  🗓️ Meeting Schedules
                </h6>
                <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">
                  {schedulesMode === 'default' ? '🏛️ Ward Default' : '✏️ Customized'}
                  {' · '}
                  {formData.schedulesPublic === false ? '🔒 PDF Only' : '🌐 Public'}
                </p>
                {schedRows.length > 0 ? (
                  <table style={{ fontSize: `${scaledBodyPt}pt`, width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr className="bg-blue-600 dark:bg-blue-800 text-white">
                        <th className="text-left px-1 py-0.5" style={{ width: '42%', fontSize: `${scaledBodyPt}pt` }}>Organization</th>
                        <th className="text-left px-1 py-0.5" style={{ width: '30%', fontSize: `${scaledBodyPt}pt` }}>Day</th>
                        <th className="text-left px-1 py-0.5" style={{ width: '28%', fontSize: `${scaledBodyPt}pt` }}>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schedRows.map((s, i) => (
                        <tr key={s.id ?? i}
                            className={i % 2 === 0
                              ? 'bg-gray-100 dark:bg-slate-700'
                              : 'bg-white dark:bg-slate-800'}>
                          <td className="px-1 py-0.5 text-gray-900 dark:text-slate-100" style={{ fontSize: `${scaledBodyPt}pt` }}>{s.organization ?? ''}</td>
                          <td className="px-1 py-0.5 text-gray-900 dark:text-slate-100" style={{ fontSize: `${scaledBodyPt}pt` }}>{s.day ?? ''}</td>
                          <td className="px-1 py-0.5 text-gray-900 dark:text-slate-100" style={{ fontSize: `${scaledBodyPt}pt` }}>{s.meeting_time ?? s.time ?? ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-gray-400 dark:text-slate-500 italic"
                    style={{ fontSize: `${scaledBodyPt}pt` }}>
                    (No schedules yet)
                  </p>
                )}
              </div>
            </PdfPageWrapper>
          </>
        );
      })()}

      {/* ════════════════════════════════════════════════════════════════════
          STEP 5 — Program Summary
      ════════════════════════════════════════════════════════════════════ */}
      {step === 5 && (
        <div className="space-y-3 px-1">
          <h6 className="font-bold text-gray-700 dark:text-slate-200 text-sm mb-2">
            📋 Program Summary
          </h6>
          {[
            { icon: '📅', label: 'Date',          val: formData.date ?? '(Not set)'                    },
            { icon: '📋', label: 'Meeting Items',  val: formData.meetingOrder.meetingItems?.length ?? 0 },
            { icon: '📢', label: 'Announcements',  val: formData.announcements?.length ?? 0             },
            { icon: '🖼️', label: 'Cover Blocks',   val: formData.cover.layout?.length ?? 0             },
          ].map(({ icon, label, val }) => (
            <div key={label}
                 className="flex justify-between items-center text-sm
                            text-gray-700 dark:text-slate-300 border-b
                            border-gray-100 dark:border-slate-700 pb-1">
              <span>{icon} {label}</span>
              <span className="font-semibold">{val}</span>
            </div>
          ))}
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-2">
            📌 Program Type:{' '}
            <span className="font-semibold">
              {formData.programName ?? 'Sacrament Meeting Program'}
            </span>
          </p>
          {formData.wardName && (
            <p className="text-xs text-gray-500 dark:text-slate-400">
              🏛️ Ward:{' '}
              <span className="font-semibold">{formData.wardName}</span>
            </p>
          )}
        </div>
      )}
    </>
  );
}
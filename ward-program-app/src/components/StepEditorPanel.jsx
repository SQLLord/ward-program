// src/components/StepEditorPanel.jsx
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom'; 
import DraggableList      from './DraggableList';
import { CoverBlockEditor } from './CoverBlockEditor';
import { MeetingItemRow }   from './MeetingItemRow';
import { PanelHealthBar } from './PanelHealthBar';
import { generateId } from '../utils/generateId';
import { AnnouncementRow } from './AnnouncementRow';
import ImportAnnouncementsModal from './ImportAnnouncementsModal';
import { api } from '../utils/api';


export function StepEditorPanel({
  step, formData, setFormData, updateField,
  addCoverBlock, removeCoverBlock, updateCoverBlock,
  addMeetingItem, removeMeetingItem, updateMeetingItem,
  addAnnouncement, removeAnnouncement, updateAnnouncement,
  addLeadership, removeLeadership, updateLeadership,
  addSchedule, removeSchedule, updateSchedule,
  formatPhoneNumber, handlePublish, COVER_BLOCK_TYPES,
  imageUrlLoading, setImageUrlLoading, lastFetchedUrlRef,
  wardDefaults, leadershipMode, switchLeadershipToCustom,
  switchLeadershipToDefault,
  schedulesMode, switchSchedulesToCustom, switchSchedulesToDefault,
  resetConfirm, setResetConfirm, wardName,
  programName, updateProgramName, health, isNewProgram, onFirstItemAdded, 
  importedRequestIds, onImportRequests, 
}) {

  // Add these right after the resetConfirmPortal declaration:
  const [newCoverBlockId,   setNewCoverBlockId]   = useState(null);
  const [newMeetingItemId,  setNewMeetingItemId]  = useState(null);
  const [newAnnouncementId, setNewAnnouncementId] = useState(null);
  const [pendingRequestCount, setPendingRequestCount] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const ITEM_LABELS = {
    childrensHymn: "Children's Song",
  };



  // Clear newItemId flags after they've been consumed (1 render cycle)
  useEffect(() => {
    if (newCoverBlockId)   { const t = setTimeout(() => setNewCoverBlockId(null),   100); return () => clearTimeout(t); }
  }, [newCoverBlockId]);

  useEffect(() => {
    if (newMeetingItemId)  { const t = setTimeout(() => setNewMeetingItemId(null),  100); return () => clearTimeout(t); }
  }, [newMeetingItemId]);

  useEffect(() => {
    if (newAnnouncementId) { const t = setTimeout(() => setNewAnnouncementId(null), 100); return () => clearTimeout(t); }
  }, [newAnnouncementId]);

  useEffect(() => {
    api.get('/announcements/requests?status=pending')
        .then(data => setPendingRequestCount(
            data.filter(r => !importedRequestIds?.has(r.id)).length
        ))
        .catch(() => {});
}, []);

  // ── Reset Confirm Portal — renders at body level to escape sticky panels ──
  const resetConfirmPortal = resetConfirm
    ? ReactDOM.createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-200 dark:border-slate-600 p-6 max-w-sm w-full mx-4">
            <div className="text-center mb-4">
              <div className="text-4xl mb-2">⚠️</div>
              <h5 className="text-lg font-bold text-gray-800 dark:text-slate-100">
                Discard custom changes?
              </h5>
            </div>
            <p className="text-sm text-gray-600 dark:text-slate-300 text-center mb-5">
              Switching back to Ward Defaults will remove your custom{' '}
              {resetConfirm === 'leadership' ? 'leadership' : 'schedule'} entries for this program.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setResetConfirm(null)}
                className="btn-secondary flex-1"
              >
                ✏️ Keep Custom
              </button>
              <button
                onClick={() => {
                  if (resetConfirm === 'leadership') switchLeadershipToDefault();
                  else switchSchedulesToDefault();
                  setResetConfirm(null);
                }}
                className="btn-primary flex-1"
              >
                ✅ Use Ward Defaults
              </button>
            </div>
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <>
      
      {/* ── Reset Confirm Portal ── */}
      {resetConfirmPortal}

      {/* ── STEP 1: COVER ─────────────────────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-4">

          {/* Program Name */}
          <div className="border border-gray-200 dark:border-slate-600 rounded-lg p-3 bg-gray-50 dark:bg-slate-700/50">
            <p className="text-sm font-semibold text-gray-700 dark:text-slate-200 mb-2">📋 Program Type</p>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300 cursor-pointer mb-1">
              <input type="radio" checked={!programName} onChange={() => updateProgramName('')} />
              Sacrament Meeting Program (default)
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300 cursor-pointer">
              <input type="radio" checked={!!programName} onChange={() => updateProgramName('Custom Program')} />
              Custom name
            </label>
            
            {!!programName && (
              <div className="mt-2 pl-6">
                <input
                  value={programName}
                  onChange={e => updateProgramName(e.target.value)}
                  placeholder="e.g. Fast & Testimony Meeting, Ward Conference..."
                  className="input w-full"
                  maxLength={200}
                />
              </div>
            )}

          </div>

          {/* Add Cover Elements */}
          <div>
            <p className="text-sm font-semibold text-gray-700 dark:text-slate-200 mb-2">➕ Add Cover Elements</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(COVER_BLOCK_TYPES).map(([type, def]) => (
                <button
                  key={type}
                  
                  onClick={() => {
                    const newId = generateId();  
                    setNewCoverBlockId(newId);
                    addCoverBlock(type, newId);
                    onFirstItemAdded?.(); 
                  }}

                  className="btn-add-block"
                >
                  {def.icon} + {def.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-2">
              💡 Use the ⋮⋮ handle to drag and reorder. Use 🗑️ to delete a block.
            </p>
          </div>

          {/* Cover Block List */}
          {(formData.cover.layout ?? []).length === 0 ? (
            <div className="text-center py-8 border border-dashed border-gray-300 dark:border-slate-600 rounded-lg">
              <div className="text-4xl mb-2">🖼️</div>
              <p className="text-gray-400 dark:text-slate-500 text-sm">No cover elements yet. Add some above!</p>
            </div>
          ) : (
            <DraggableList
              items={formData.cover.layout ?? []}
              onReorder={(newLayout) => updateField('cover.layout', newLayout)}
              newItemId={newCoverBlockId}                      // ← ADD
              renderItem={(block, _index, isNew) => (          // ← ADD isNew param
                <CoverBlockEditor
                  key={block.id}
                  block={block}
                  isNew={isNewProgram ? true : (block.id === newCoverBlockId)}                               // ← ADD
                  formData={formData}
                  setFormData={setFormData}
                  updateField={updateField}
                  updateCoverBlock={updateCoverBlock}
                  removeCoverBlock={removeCoverBlock}
                  imageUrlLoading={imageUrlLoading}
                  setImageUrlLoading={setImageUrlLoading}
                  lastFetchedUrlRef={lastFetchedUrlRef}
                  wardName={wardName}
                />
              )}
            />
          )}
        </div>
      )}

      {/* ── STEP 3: MEETING ORDER ──────────────────────────────────────────── */}
      {step === 3 && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Conducting',  field: 'meetingOrder.conducting'  },
              { label: 'Presiding',   field: 'meetingOrder.presiding'   },
              { label: 'Chorister',   field: 'meetingOrder.chorister'   },
              { label: 'Accompanist', field: 'meetingOrder.accompanist' },
            ].map(({ label, field }) => (
              <div key={field}>
                <label className="label text-xs">{label}</label>
                <input
                  type="text"
                  value={formData.meetingOrder[field.split('.')[1]] ?? ''}
                  onChange={(e) => updateField(field, e.target.value)}
                  className="input w-full"
                  maxLength={150}  
                />
              </div>
            ))}
          </div>

          <div>
            <h6 className="font-bold text-sm text-gray-700 dark:text-slate-200 mb-2">
              📋 Meeting Items (Drag to Reorder)
            </h6>
            <div className="flex flex-wrap gap-1 mb-3">
              <p className="w-full text-xs text-gray-500 dark:text-slate-400 mb-1">Add Items:</p>
              {
              ['openingHymn','openingPrayer','announce','sacramentHymn','sacramentAdmin',
              'speaker','hymn','childrensHymn','musical','testimony','closingHymn','closingPrayer','baptism','confirmation','customText'

              ].map(type => (
                <button key={type} 
                  onClick={() => {
                    const newId = generateId();
                    setNewMeetingItemId(newId);
                    addMeetingItem(type, newId);
                    onFirstItemAdded?.();
                  }}

                  className="btn-primary btn-small">
                  
                  + {({
                      childrensHymn: "Children's Song",
                      customText: 'Custom Text',
                      sacramentAdmin: 'Sacrament Admin',
                    }[type] ?? type.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()))}

                </button>
              ))}
            </div>
            <DraggableList
              items={formData.meetingOrder.meetingItems}
              onReorder={(reordered) => setFormData({
                ...formData,
                meetingOrder: { ...formData.meetingOrder, meetingItems: reordered }
              })}
              newItemId={newMeetingItemId}                     // ← ADD
              renderItem={(item, _index, isNew) => (           // ← ADD isNew param
                <MeetingItemRow
                  key={item.id}
                  item={item}
                  isNew={isNewProgram ? true : (item.id === newMeetingItemId)}                        // ← ADD
                  updateMeetingItem={updateMeetingItem}
                  removeMeetingItem={removeMeetingItem}
                />
              )}
            />
          </div>
        </div>
      )}

      {/* ── STEP 2: ANNOUNCEMENTS ──────────────────────────────────────────── */}
      {step === 2 && (
        <div>
          <div className="flex gap-2 mb-3">
              <button onClick={() => {
                  const newId = generateId();
                  setNewAnnouncementId(newId);
                  addAnnouncement(newId);
                  onFirstItemAdded?.();
              }} className="btn-primary btn-small">
                  + Add Announcement
              </button>
              <button
                onClick={() => setShowImportModal(true)}
                className="btn-secondary btn-small"
              >
                📥 Import Requests{pendingRequestCount !== null && pendingRequestCount > 0
                    ? ` (${pendingRequestCount})`
                    : pendingRequestCount === 0 ? ' (0)' : ''}
            </button>
          </div>
          <DraggableList
            items={formData.announcements}
            onReorder={(reordered) => setFormData({ ...formData, announcements: reordered })}
            newItemId={newAnnouncementId}                    // ← ADD
            renderItem={(ann, _index, isNew) => (            // ← ADD isNew param
              <AnnouncementRow
                key={ann.id}
                ann={ann}
                isNew={isNewProgram ? true : (ann.id === newAnnouncementId)}                               // ← ADD
                updateAnnouncement={updateAnnouncement}
                removeAnnouncement={removeAnnouncement}
              />
            )}
          />

          {showImportModal && (
            <ImportAnnouncementsModal
              onClose={() => setShowImportModal(false)}
              alreadyImported={importedRequestIds}
              onImport={(announcements, requestIds) => {
                announcements.forEach(ann => addAnnouncement(null, ann));
                onImportRequests(requestIds);
                onFirstItemAdded?.();
              }}
            />
          )}
        </div>
      )}

      {/* ── STEP 4: LEADERSHIP & SCHEDULES ────────────────────────────────── */}
      {step === 4 && (
        <div className="space-y-6">

          
          {/* ── LEADERSHIP ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h5 className="font-bold text-sm text-gray-700 dark:text-slate-200">👥 Ward Leadership</h5>
              {/* Segmented toggle */}
              <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-slate-600">
                <button
                  onClick={() => leadershipMode === 'custom' && setResetConfirm('leadership')}
                  className={`px-3 py-1.5 text-xs font-medium transition ${
                    leadershipMode === 'default'
                      ? 'bg-lds-blue dark:bg-blue-600 text-white'
                      : 'bg-white dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-600'
                  }`}
                >🏛️ Ward Defaults</button>
                <button
                  onClick={() => leadershipMode === 'default' && switchLeadershipToCustom()}
                  className={`px-3 py-1.5 text-xs font-medium transition ${
                    leadershipMode === 'custom'
                      ? 'bg-lds-blue dark:bg-blue-600 text-white'
                      : 'bg-white dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-600'
                  }`}
                >✏️ Customize</button>
              </div>
            </div>

            <p className="text-xs text-gray-500 dark:text-slate-400 mb-2">
              {leadershipMode === 'default'
                ? 'Showing ward defaults. Changes here apply to all programs.'
                : '✏️ Customized for this program only.'}
            </p>
            
            {/* Content */}
            {leadershipMode === 'default' ? (
              <div className="bg-gray-50 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 rounded-lg p-3">
                {(wardDefaults.leadership ?? []).length === 0 ? (
                  <div className="text-center py-4">
                    <div className="text-3xl mb-1">👥</div>
                    <p className="text-xs text-gray-400 dark:text-slate-500">No ward leadership set up yet.</p>
                  </div>
                ) : (
                  wardDefaults.leadership.map((leader, i) => (
                    <div key={i} className="text-sm py-1 border-b border-gray-100 dark:border-slate-600 last:border-0">
                      <span className="font-medium dark:text-slate-200">{leader.role || '(Role)'}</span>
                      <span className="text-gray-500 dark:text-slate-400"> — {leader.name || '(Name)'}</span>
                    </div>
                  ))
                )}
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-2 italic">
                  🔒 Read-only — click Customize to override for this program
                </p>
              </div>
            ) : (
              <div>
                <button onClick={addLeadership} className="btn-primary btn-small mb-2">
                  + Add
                </button>
                <DraggableList
                  items={formData.leadership ?? []}
                  onReorder={(reordered) => setFormData({ ...formData, leadership: reordered })}
                  renderItem={(leader) => (
                    <div className="grid grid-cols-12 gap-1 items-center">
                      <input type="text" value={leader.role ?? ''} onChange={(e) => updateLeadership(leader.id, 'role', e.target.value)} placeholder="Role" className="input col-span-3 text-xs" maxLength={150}/>
                      <input type="text" value={leader.name ?? ''} onChange={(e) => updateLeadership(leader.id, 'name', e.target.value)} placeholder="Name" className="input col-span-4 text-xs" maxLength={150}/>
                      <input type="text" value={leader.phone ?? ''} onChange={(e) => updateLeadership(leader.id, 'phone', formatPhoneNumber(e.target.value))} placeholder="Phone" className="input col-span-2 text-xs" maxLength={14} />
                      <button onClick={() => removeLeadership(leader.id)} className="btn-danger col-start-12 w-9 h-9 p-0 min-w-[2.25rem] flex items-center justify-center">🗑️</button>
                    </div>
                  )}
                />
              </div>
            )}
          </div>

          {/* ── SCHEDULES ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h5 className="font-bold text-sm text-gray-700 dark:text-slate-200">🗓️ Meeting Schedules</h5>
              {/* Segmented toggle */}
              <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-slate-600">
                <button
                  onClick={() => schedulesMode === 'custom' && setResetConfirm('schedules')}
                  className={`px-3 py-1.5 text-xs font-medium transition ${
                    schedulesMode === 'default'
                      ? 'bg-lds-blue dark:bg-blue-600 text-white'
                      : 'bg-white dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-600'
                  }`}
                >🏛️ Ward Defaults</button>
                <button
                  onClick={() => schedulesMode === 'default' && switchSchedulesToCustom()}
                  className={`px-3 py-1.5 text-xs font-medium transition ${
                    schedulesMode === 'custom'
                      ? 'bg-lds-blue dark:bg-blue-600 text-white'
                      : 'bg-white dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-600'
                  }`}
                >✏️ Customize</button>
              </div>
            </div>

            <p className="text-xs text-gray-500 dark:text-slate-400 mb-2">
              {schedulesMode === 'default'
                ? 'Showing ward defaults. Customize only for special Sundays.'
                : '✏️ Customized for this program only.'}
            </p>

            {/* Visibility Toggle */}
            <div className="flex items-center gap-4 text-sm mb-3 text-gray-700 dark:text-slate-300">
              <span className="font-medium text-xs text-gray-500 dark:text-slate-400">👁️ Visibility</span>
              <label className="flex items-center gap-1 cursor-pointer">
                <input type="radio" checked={formData.schedulesPublic !== false}
                  onChange={() => updateField('schedulesPublic', true)} />
                🌐 Public
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input type="radio" checked={formData.schedulesPublic === false}
                  onChange={() => updateField('schedulesPublic', false)} />
                🔒 PDF Only
              </label>
            </div>
            {formData.schedulesPublic === false && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">
                🔒 Hidden on public website — appears in printed PDF only.
              </p>
            )}

            {/* Content */}
            {schedulesMode === 'default' ? (
              <div className="bg-gray-50 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 rounded-lg p-3">
                {(wardDefaults.schedules ?? []).length === 0 ? (
                  <div className="text-center py-4">
                    <div className="text-3xl mb-1">🗓️</div>
                    <p className="text-xs text-gray-400 dark:text-slate-500">No ward schedules set up yet.</p>
                  </div>
                ) : (
                  wardDefaults.schedules.map((sched, i) => (
                    <div key={i} className="text-sm py-1 border-b border-gray-100 dark:border-slate-600 last:border-0">
                      <span className="font-medium dark:text-slate-200">{sched.organization || '(Organization)'}</span>
                      <span className="text-gray-500 dark:text-slate-400"> — {sched.day} at {sched.meeting_time ?? sched.time}</span>
                    </div>
                  ))
                )}
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-2 italic">
                  🔒 Read-only — click Customize to override for this program
                </p>
              </div>
            ) : (
              <div>
                <button onClick={addSchedule} className="btn-primary btn-small mb-2">
                  + Add
                </button>
                <DraggableList
                  items={formData.schedules ?? []}
                  onReorder={(reordered) => setFormData({ ...formData, schedules: reordered })}
                  renderItem={(sched) => (
                    <div className="grid grid-cols-12 gap-1 items-center">
                      <input type="text" value={sched.organization ?? ''} onChange={(e) => updateSchedule(sched.id, 'organization', e.target.value)} placeholder="Organization" className="input col-span-5 text-xs" maxLength={150}/>
                      <input type="text" value={sched.day ?? ''} onChange={(e) => updateSchedule(sched.id, 'day', e.target.value)} placeholder="Day" className="input col-span-3 text-xs" maxLength={20}/>
                      <input type="text" value={sched.time ?? ''} onChange={(e) => updateSchedule(sched.id, 'time', e.target.value)} placeholder="Time" className="input col-span-3 text-xs" maxLength={50}/>
                      <button onClick={() => removeSchedule(sched.id)} className="btn-danger col-start-12 w-9 h-9 p-0 min-w-[2.25rem] flex items-center justify-center">🗑️</button>
                    </div>
                  )}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── STEP 5: PUBLISH ─────────────────────────────────────────────── */}
      {/* ── STEP 5: PUBLISH ─────────────────────────────────────────────── */}
      {step === 5 && (
        <div className="space-y-4">

          {/* ── All-panels health display ── */}
          <h6 className="font-semibold text-gray-700 dark:text-slate-200">
            📊 Page Layout Health
          </h6>
          <PanelHealthBar label="Cover Panel"           health={health?.cover}       />
          <PanelHealthBar label="Leadership & Schedules" health={health?.leadership}  />
          <PanelHealthBar label="Meeting Order"          health={health?.meetingOrder}/>
          <PanelHealthBar label="Announcements"          health={health?.announcements}/>

          {health?.allClear ? (
            <p className="text-green-600 dark:text-green-400 text-sm font-medium">
              ✅ All panels within bounds — safe to publish!
            </p>
          ) : (
            <p className="text-red-500 dark:text-red-400 text-sm font-medium">
              🔴 One or more panels will overflow. Go back and fix before publishing.
            </p>
          )}

          {/* ── Status summary ── */}
          <div className="text-center py-4">
            <div className="text-4xl mb-2">{health?.allClear ? '✅' : '⚠️'}</div>
            <h5 className="text-lg font-bold text-gray-800 dark:text-slate-100">
              {health?.allClear ? 'Ready to Publish!' : 'Fix Overflows First'}
            </h5>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
              {health?.allClear
                ? 'Use the button above to publish.'
                : 'Return to the affected steps and adjust content or font size.'}
            </p>
          </div>

        </div>
      )}
    </>
  );
}
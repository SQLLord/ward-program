// ProgramBuilder.jsx — with health engine + step gating
import React, { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { COVER_BLOCK_TYPES, BUILDER_STEPS } from '../constants/coverBlocks';
import { formatPhoneNumber } from '../utils/formatters';
import { useProgramForm } from '../hooks/useProgramForm';
import { ProgramModals } from '../components/ProgramModals';
import { StepEditorPanel } from '../components/StepEditorPanel';
import { StepPreviewPanel } from '../components/StepPreviewPanel';
import { calculatePanelHealth } from '../utils/panelHealth';
import { PanelHealthBar } from '../components/PanelHealthBar';
import { PrintSettingsFlyout } from '../components/PrintSettingsFlyout';
import SaveAsTemplateModal from '../components/SaveAsTemplateModal';

function ProgramBuilder() {
  const { id } = useParams();
  const [isNewProgram, setIsNewProgram] = useState(id === 'new');
  
  const {
    formData, setFormData, step, setStep,
    imageUrlLoading, setImageUrlLoading, lastFetchedUrlRef,
    republishModal, setRepublishModal,
    cancelModal, setCancelModal,
    publishConflictModal, setPublishConflictModal,
    updateField,
    addCoverBlock, removeCoverBlock, updateCoverBlock,
    addMeetingItem, removeMeetingItem, updateMeetingItem,
    addAnnouncement, removeAnnouncement, updateAnnouncement,
    addLeadership, removeLeadership, updateLeadership,
    addSchedule, removeSchedule, updateSchedule,
    handleSaveDraft, handleSaveAndRepublish, handleSaveAsDraft,
    handlePublish, handlePublishConflictOnly, handlePublishConflictBoth,
    handleDiscardAndExit,
    wardDefaults, leadershipMode, schedulesMode,
    resetConfirm, setResetConfirm,
    switchLeadershipToCustom, switchLeadershipToDefault,
    switchSchedulesToCustom, switchSchedulesToDefault,
    wardName,
    importedRequestIds,       // ← ADD
    recordImportedRequests,   // ← ADD
  } = useProgramForm(id);

  const updateProgramName = (val) => updateField('programName', val);

  // ── Health engine — recalculates on every formData change ───────────────
  const health = useMemo(
    () => calculatePanelHealth(formData, wardDefaults),
    [formData, wardDefaults]
  );

  // ── Map step number to its panel health ──────────────────────────────────
  const stepHealth = (stepNum) => {
    if (!health) return null;
    switch (stepNum) {
      case 1: return health.cover;
      case 2: return health.announcements;
      case 3: return health.meetingOrder;
      case 4: return health.leadership;
      default: return null;
    }
  };

  const [showTemplateModal, setShowTemplateModal] = useState(false);
  
  // ── Step change — gate forward navigation on overflow ───────────────────
  const handleStepChange = (newStep) => {
    // Always allow backward navigation
    if (newStep < step) { setStep(newStep); return; }

    // Always allow staying on same step
    if (newStep === step) return;

    // Allow jumping TO an overflowed step (so user can fix it)
    const targetHealth = stepHealth(newStep);
    if (targetHealth?.status === 'overflow') { setStep(newStep); return; }

    // Block jumping PAST any overflowed step between current and target
    const hasOverflowBetween = BUILDER_STEPS
      .filter(b => b.num > step && b.num < newStep)
      .some(b => stepHealth(b.num)?.status === 'overflow');
    if (hasOverflowBetween) return;

    // Also block if current step itself is overflowed (can't leave it going forward)
    const currentHealth = stepHealth(step);
    if (currentHealth?.status === 'overflow') return;

    setStep(newStep);
  };

  if (!formData) return (
    <div className="text-center py-20 text-gray-400 dark:text-slate-500">
      <div className="text-4xl mb-3">⏳</div>
      <p>Loading...</p>
    </div>
  );

  // ── Shared prev/next nav bar ─────────────────────────────────────────────
  const StepNav = () => {
    const currentHealth = stepHealth(step);
    const isBlocked = currentHealth?.status === 'overflow';
    const isWarning = currentHealth?.status === 'warning';

    return (
      <div>
        <div className="flex items-center justify-between gap-3 py-2">
          <button
            onClick={() => handleStepChange(Math.max(1, step - 1))}
            disabled={step === 1}
            className="btn-secondary disabled:opacity-50"
          >
            ← Previous
          </button>

          <span className="text-sm text-gray-500 dark:text-slate-400 font-medium">
            Step {step} of {BUILDER_STEPS.length} — {BUILDER_STEPS[step - 1].name}
            {currentHealth && (
              <span className="ml-2">
                <PanelHealthBar health={currentHealth} compact />
              </span>
            )}
          </span>

          {step === BUILDER_STEPS.length ? (
            <div className="w-32" />
          ) : (
            <button
              onClick={() => handleStepChange(step + 1)}
              disabled={isBlocked}
              title={isBlocked ? 'Fix panel overflow before advancing' : ''}
              className={`transition font-semibold px-6 py-3 rounded-lg
                ${isBlocked
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 cursor-not-allowed border border-red-300 dark:border-red-700'
                  : isWarning ? 'btn-warning' : 'btn-primary'
                }`}
            >
              {isBlocked ? '🔴 Fix Overflow First' : isWarning ? '⚠️ Next →' : 'Next →'}
            </button>
          )}
        </div>

        {/* Save as Template — below the nav row, only on step 5 */}
        {step === 5 && (
          <button
            onClick={() => setShowTemplateModal(true)}
            className="btn-secondary w-full mt-2"
          >
            📋 Save as Template
          </button>
        )}
      </div>
    );
  };

  return (
    // <div className="max-w-7xl mx-auto px-4 py-6">
    <div className="page-container">
      <ProgramModals
        republishModal={republishModal} setRepublishModal={setRepublishModal}
        cancelModal={cancelModal} setCancelModal={setCancelModal}
        publishConflictModal={publishConflictModal}
        setPublishConflictModal={setPublishConflictModal}
        handleSaveAndRepublish={handleSaveAndRepublish}
        handleSaveAsDraft={handleSaveAsDraft}
        handlePublishConflictOnly={handlePublishConflictOnly}
        handlePublishConflictBoth={handlePublishConflictBoth}
        handleDiscardAndExit={handleDiscardAndExit}
      />

      {showTemplateModal && (
            <SaveAsTemplateModal
                formData={formData}
                onClose={() => setShowTemplateModal(false)}
            />
        )}

      {/* HEADER */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-lds-blue dark:text-slate-100">
          {id ? 'Edit Program' : 'Create Program'}
        </h2>

        <div className="flex gap-2 items-center flex-wrap">

          {/* Cancel — always visible */}
          <button
            onClick={() => setCancelModal(true)}
            className="btn-danger"
          >
            ✕ Cancel
          </button>

          {formData.status === 'published' ? (
            <>
              {/* Editing a published program — Save & Republish ONLY */}
              <button
                onClick={handleSaveAndRepublish}
                disabled={!health?.allClear}
                title={
                  !health?.allClear
                    ? 'Fix panel overflows before republishing'
                    : 'Save changes and keep published'
                }
                className={`transition font-semibold px-4 py-2 rounded-lg text-sm
                  ${!health?.allClear
                    ? 'bg-red-100 dark:bg-red-900/30 text-red-500 dark:text-red-400 cursor-not-allowed border border-red-300 dark:border-red-700'
                    : 'btn-primary'
                  }`}
              >
                {!health?.allClear ? '🔴 Fix Overflows' : '💾 Save & Republish'}
              </button>
            </>
          ) : (
            <>
              {/* New, draft, copy, or archived — Save as Draft + Publish */}
              <button
                onClick={handleSaveDraft}
                className="btn-secondary"
                title="Save as draft without publishing"
              >
                📄 Save as Draft
              </button>
              <button
                onClick={handlePublish}
                disabled={!health?.allClear}
                title={
                  !health?.allClear
                    ? 'Fix panel overflows before publishing'
                    : 'Publish this program'
                }
                className={`transition font-semibold px-4 py-2 rounded-lg text-sm
                  ${!health?.allClear
                    ? 'bg-red-100 dark:bg-red-900/30 text-red-500 dark:text-red-400 cursor-not-allowed border border-red-300 dark:border-red-700'
                    : 'btn-primary'
                  }`}
              >
                {!health?.allClear ? '🔴 Fix Overflows' : '🚀 Publish'}
              </button>
            </>
          )}

        </div>
      </div>

      {/* Program Date */}
      <div className="mb-4 flex items-center gap-3">
        <label className="label mb-0 text-sm whitespace-nowrap">📅 Program Date *</label>
        <input
          type="date"
          value={formData.date ?? ''}
          onChange={e => updateField('date', e.target.value)}
          className="input text-sm"
          style={{ maxWidth: '180px' }}
        />
        {formData.date ? (
          <span className="text-sm text-gray-500 dark:text-slate-400">
            📌 {new Date(formData.date + 'T00:00:00').toLocaleDateString('en-US', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            })}
          </span>
        ) : (
          <span className="text-sm text-amber-600 dark:text-amber-400">
            ⚠️ No date set
          </span>
        )}
      </div>
      {formData.id && (
        <span className="text-xs text-gray-400 dark:text-slate-500">
            🆔 ID: {formData.id}
        </span>
      )}

      {/* STEP TABS */}
      <div className="flex rounded-xl overflow-hidden border border-gray-200 dark:border-slate-700 mb-4">
        {BUILDER_STEPS.map(s => {
          const sh = stepHealth(s.num);
          const isBlocked = sh?.status === 'overflow';
          const isWarn = sh?.status === 'warning';

          // Block tab if it's AHEAD of an overflowed step,
          // but NEVER block the overflowed tab itself (user needs to click it to fix it)
          const anyOverflowBefore = BUILDER_STEPS
            .filter(b => b.num < s.num)
            .some(b => stepHealth(b.num)?.status === 'overflow');

          const isTabDisabled = anyOverflowBefore && !isBlocked;

          return (
            <button
              key={s.num}
              onClick={() => handleStepChange(s.num)}
              disabled={isTabDisabled}
              className={`flex-1 py-3 px-2 text-center transition text-sm font-medium relative
                ${step === s.num
                  ? 'bg-lds-blue dark:bg-blue-600 text-white'
                  : isTabDisabled
                  ? 'bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-slate-500 cursor-not-allowed'
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                }`}
            >
              <div>{s.icon}</div>
              <div>{s.name}</div>
              {sh && (
                <div className="text-xs mt-0.5">
                  {isBlocked ? '🔴' : isWarn ? '⚠️' : '✅'}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* TOP NAV */}
      <StepNav />

      {/* TWO-COLUMN LAYOUT */}
      {/* <div className="grid grid-cols-2 gap-6 mt-4"> */}
      <div className="grid grid-cols-2 gap-6 mt-4 items-start">
        {/* LEFT: EDITOR */}
        {/* <div className="card"> */}
        <div className="card sticky top-[72px] max-h-[calc(100vh-180px)] overflow-y-auto">
          
          <div className="flex justify-between items-center mb-4 gap-2">
            <h4 className="text-lg font-bold text-lds-blue dark:text-slate-100 flex-shrink-0">
              {BUILDER_STEPS[step - 1].name}
            </h4>
            {step <= 4 && (
              <PrintSettingsFlyout
                step={step}
                formData={formData}
                updateField={updateField}
              />
            )}
          </div>

          <StepEditorPanel
            step={step}
            formData={formData} setFormData={setFormData}
            updateField={updateField}
            addCoverBlock={addCoverBlock}
            removeCoverBlock={removeCoverBlock}
            updateCoverBlock={updateCoverBlock}
            addMeetingItem={addMeetingItem}
            removeMeetingItem={removeMeetingItem}
            updateMeetingItem={updateMeetingItem}
            addAnnouncement={addAnnouncement}
            removeAnnouncement={removeAnnouncement}
            updateAnnouncement={updateAnnouncement}
            addLeadership={addLeadership}
            removeLeadership={removeLeadership}
            updateLeadership={updateLeadership}
            addSchedule={addSchedule}
            removeSchedule={removeSchedule}
            updateSchedule={updateSchedule}
            formatPhoneNumber={formatPhoneNumber}
            handlePublish={handlePublish}
            COVER_BLOCK_TYPES={COVER_BLOCK_TYPES}
            imageUrlLoading={imageUrlLoading}
            setImageUrlLoading={setImageUrlLoading}
            lastFetchedUrlRef={lastFetchedUrlRef}
            wardDefaults={wardDefaults}
            leadershipMode={leadershipMode}
            switchLeadershipToCustom={switchLeadershipToCustom}
            switchLeadershipToDefault={switchLeadershipToDefault}
            schedulesMode={schedulesMode}
            switchSchedulesToCustom={switchSchedulesToCustom}
            switchSchedulesToDefault={switchSchedulesToDefault}
            resetConfirm={resetConfirm}
            setResetConfirm={setResetConfirm}
            wardName={wardName}
            programName={formData.programName}
            updateProgramName={updateProgramName}
            health={health}
            isNewProgram={isNewProgram}
            onFirstItemAdded={() => setIsNewProgram(false)}
            importedRequestIds={importedRequestIds}
            onImportRequests={recordImportedRequests}
          />
        </div>

        {/* RIGHT: PREVIEW */}
        {/* <div className="card"> */}
        <div className="card sticky top-[72px] max-h-[calc(100vh-180px)] overflow-y-auto">
          <h5 className="text-base font-bold text-gray-700 dark:text-slate-200 mb-4">
            🔍 Live Preview
          </h5>
          <StepPreviewPanel
            step={step}
            formData={formData}
            wardDefaults={wardDefaults}
            leadershipMode={leadershipMode}
            schedulesMode={schedulesMode}
            health={health}
          />
        </div>
      </div>

      {/* BOTTOM NAV */}
      <div className="mt-4">
        <StepNav />
      </div>
    </div>
  );
}



export default ProgramBuilder;
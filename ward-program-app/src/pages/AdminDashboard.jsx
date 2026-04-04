import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../utils/api';
import { Link, useNavigate } from 'react-router-dom';
import { useProgramContext } from '../context/ProgramContext';
import { useError } from '../context/ErrorContext';
import StatusBadge from '../components/StatusBadge';
import { logger } from '../utils/logger';

function AdminDashboard() {
  const navigate      = useNavigate();
  const { showToast } = useError();
  const {
    createProgram, publishProgram, publishProgramBoth,
    unpublishProgram, archiveProgram, deleteProgram, duplicateProgram
  } = useProgramContext();

  const [programs, setPrograms]             = useState([]);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState(null);
  const [filter, setFilter]                 = useState('all');
  const [deleteConfirm, setDeleteConfirm]   = useState(null);
  const [publishModal, setPublishModal]     = useState(null);
  const [unpublishModal, setUnpublishModal] = useState(null);
  const [archiveConfirm, setArchiveConfirm] = useState(null);

  const DASHBOARD_PAGE_SIZE = 20;
  const [page, setPage]           = useState(1);
  const [hasMore, setHasMore]     = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const filteredPrograms = programs.filter(p =>
    filter === 'all' ? true : p.status === filter
  );

  const sortedPrograms = [...filteredPrograms].sort((a, b) => {
    if (a.status === 'published' && b.status !== 'published') return -1;
    if (b.status === 'published' && a.status !== 'published') return 1;
    return new Date(b.date) - new Date(a.date);
  });

  const handleCreateNew = () => navigate('/builder/new');

  const loadSummary = useCallback(async (pageNum = 1) => {
    try {
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);

      const data = await api.get(
        `/programs/summary?status=all&page=${pageNum}&pageSize=${DASHBOARD_PAGE_SIZE}`
      );

      if (pageNum === 1) {
        setPrograms(data);
      } else {
        setPrograms(prev => [...prev, ...data]);
      }

      setHasMore(data.length === DASHBOARD_PAGE_SIZE);
      setPage(pageNum);
    } catch (err) {
      logger.error('[AdminDashboard] loadSummary:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => { loadSummary(1); }, [loadSummary]);

  const handleLoadMore = () => loadSummary(page + 1);

  // ── PUBLISH ───────────────────────────────────────────────────────────────
  const handlePublish = async (programId) => {
    const target = programs.find(p => p.id === programId);
    if (!target) return;
    const sameDate = programs.filter(
      p => p.status === 'published' && p.date === target.date && p.id !== programId
    );
    if (sameDate.length > 0) {
      const dateLabel = target.date
        ? new Date(target.date + 'T00:00:00').toLocaleDateString('en-US', {
            weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
          })
        : 'this date';
      setPublishModal({ programId, dateLabel, mode: 'sameDate', sameDate });
    } else {
      try {
        await publishProgram(programId, { archiveExisting: false });
        await loadSummary(1); setPage(1);
        showToast('🚀 Program published successfully!');
      } catch (err) {
        logger.error('[AdminDashboard] handlePublish error:', err);
        showToast('❌ Failed to publish. Please try again.');
      }
    }
  };

  const handlePublishOnly = async () => {
    try {
      if (publishModal.sameDate) {
        for (const p of publishModal.sameDate) { await unpublishProgram(p.id); }
      }
      await publishProgram(publishModal.programId);
      setPublishModal(null);
      await loadSummary(1); setPage(1);
      showToast('🚀 Program published — existing program unpublished!');
    } catch (err) {
      logger.error('[AdminDashboard] handlePublishOnly error:', err);
      showToast('❌ Failed to publish. Please try again.');
    }
  };

  const handlePublishBoth = async () => {
    try {
      await publishProgramBoth(publishModal.programId);
      setPublishModal(null);
      await loadSummary(1); setPage(1);
      showToast('🚀 Both programs are now published!');
    } catch (err) {
      logger.error('[AdminDashboard] handlePublishBoth error:', err);
      showToast('❌ Failed to publish. Please try again.');
    }
  };

  const handlePublishConfirmOtherDate = async () => {
    try {
      await publishProgram(publishModal.programId, { archiveExisting: false });
      setPublishModal(null);
      await loadSummary(1); setPage(1);
      showToast('🚀 Program published successfully!');
    } catch (err) {
      logger.error('[AdminDashboard] handlePublishConfirmOtherDate error:', err);
      showToast('❌ Failed to publish. Please try again.');
    }
  };

  // ── UNPUBLISH ─────────────────────────────────────────────────────────────
  const handleUnpublishClick   = (programId) => setUnpublishModal({ programId });
  const handleUnpublishToDraft = async () => {
    try {
      await unpublishProgram(unpublishModal.programId);
      setUnpublishModal(null);
      await loadSummary(1); setPage(1);
      showToast('📝 Program moved back to draft.');
    } catch (err) {
      logger.error('[AdminDashboard] handleUnpublishToDraft error:', err);
      showToast('❌ Failed to unpublish. Please try again.');
    }
  };

  const handleUnpublishToArchive = async () => {
    try {
      await archiveProgram(unpublishModal.programId);
      setUnpublishModal(null);
      await loadSummary(1); setPage(1);
      showToast('📦 Program archived successfully.');
    } catch (err) {
      logger.error('[AdminDashboard] handleUnpublishToArchive error:', err);
      showToast('❌ Failed to archive. Please try again.');
    }
  };

  // ── ARCHIVE ───────────────────────────────────────────────────────────────
  const handleArchiveClick   = (programId) => setArchiveConfirm({ programId });
  const handleArchiveConfirm = async () => {
    try {
      await archiveProgram(archiveConfirm.programId);
      setArchiveConfirm(null);
      await loadSummary(1); setPage(1);
      showToast('📦 Program archived successfully.');
    } catch (err) {
      logger.error('[AdminDashboard] handleArchiveConfirm error:', err);
      showToast('❌ Failed to archive. Please try again.');
    }
  };

  // ── DELETE ────────────────────────────────────────────────────────────────
  const handleDeleteClick   = (program) => setDeleteConfirm({ id: program.id, date: program.date ?? 'Untitled Program' });
  const handleDeleteConfirm = async () => {
    try {
      await deleteProgram(deleteConfirm.id);
      setDeleteConfirm(null);
      await loadSummary(1); setPage(1);
      showToast('🗑️ Program deleted.');
    } catch (err) {
      logger.error('[AdminDashboard] handleDeleteConfirm error:', err);
      showToast('❌ Failed to delete. Please try again.');
    }
  };

  // ── DUPLICATE ─────────────────────────────────────────────────────────────
  const handleDuplicate = async (programId) => {
    try {
      const newProgram = await duplicateProgram(programId);
      if (newProgram) navigate(`/builder/${newProgram.id}`);
      showToast('📋 Program copied — editing new draft.');
    } catch (err) {
      logger.error('[AdminDashboard] handleDuplicate error:', err);
      showToast('❌ Failed to copy program. Please try again.');
    }
  };

  const formatLastModified = (isoString) => {
    if (!isoString) return 'Never saved';
    const diff    = Date.now() - new Date(isoString).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours   = Math.floor(diff / 3600000);
    const days    = Math.floor(diff / 86400000);
    if (minutes < 1)  return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24)   return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <div className="page-container">

      {/* ── PUBLISH CONFLICT MODAL ─────────────────────────────────────────── */}
      {publishModal && (
        <div className="modal-backdrop">
          <div className="modal-container max-w-md">
            <div className="text-center mb-4">
              <div className="text-6xl mb-3">📢</div>
              <h3 className="text-xl font-bold text-gray-800 dark:text-slate-100">
                {publishModal.mode === 'sameDate'
                  ? 'Program Already Published'
                  : 'Another Program is Live'}
              </h3>
            </div>
            {publishModal.mode === 'sameDate' ? (
              <>
                <p className="text-gray-600 dark:text-slate-300 text-center mb-5">
                  A program is already published for{' '}
                  <strong className="text-lds-blue dark:text-slate-100">{publishModal.dateLabel}</strong>.
                  How would you like to proceed?
                </p>
                <div className="space-y-3 mb-4">
                  <button
                    onClick={handlePublishOnly}
                    className="modal-action-btn border-green-400 dark:border-green-600 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30"
                  >
                    <p className="font-bold text-green-800 dark:text-green-300">✅ Publish This One Only</p>
                    <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">Unpublish the existing program and publish this one</p>
                  </button>
                  <button
                    onClick={handlePublishBoth}
                    className="modal-action-btn border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                  >
                    <p className="font-bold text-blue-800 dark:text-blue-300">📋 Publish Both</p>
                    <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">Keep the existing program live and also publish this one</p>
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-gray-600 dark:text-slate-300 text-center mb-5">
                  There is already a published program for a different date.
                  Would you like to publish this one too?
                </p>
                <div className="space-y-3 mb-4">
                  <button
                    onClick={handlePublishConfirmOtherDate}
                    className="modal-action-btn border-green-400 dark:border-green-600 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30"
                  >
                    <p className="font-bold text-green-800 dark:text-green-300">🚀 Yes, Publish</p>
                    <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">Both programs will be live at the same time</p>
                  </button>
                </div>
              </>
            )}
            <button onClick={() => setPublishModal(null)} className="w-full btn-secondary">
              Cancel — Don't Publish
            </button>
          </div>
        </div>
      )}

      {/* ── UNPUBLISH CONFIRMATION MODAL ───────────────────────────────────── */}
      {unpublishModal && (
        <div className="modal-backdrop">
          <div className="modal-container max-w-md">
            <div className="text-center mb-4">
              <div className="text-6xl mb-3">⏸️</div>
              <h3 className="text-xl font-bold text-gray-800 dark:text-slate-100">Unpublish Program?</h3>
            </div>
            <p className="text-gray-600 dark:text-slate-300 text-center mb-5">
              This program is currently <strong className="text-green-600 dark:text-green-400">live</strong>.
              Where would you like to move it?
            </p>
            <div className="space-y-3 mb-4">
              <button
                onClick={handleUnpublishToDraft}
                className="modal-action-btn border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30"
              >
                <p className="font-bold text-amber-800 dark:text-amber-300">📝 Save as Draft</p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">Unpublish and keep it editable — you can republish it later</p>
              </button>
              <button
                onClick={handleUnpublishToArchive}
                className="modal-action-btn border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30"
              >
                <p className="font-bold text-blue-800 dark:text-blue-300">📦 Archive</p>
                <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">Unpublish and archive it — great for keeping past program records</p>
              </button>
            </div>
            <button onClick={() => setUnpublishModal(null)} className="w-full btn-secondary">
              Cancel — Keep it Published
            </button>
          </div>
        </div>
      )}

      {/* ── ARCHIVE CONFIRMATION MODAL ─────────────────────────────────────── */}
      {archiveConfirm && (
        <div className="modal-backdrop">
          <div className="modal-container max-w-md">
            <div className="text-center mb-4">
              <div className="text-6xl mb-3">📦</div>
              <h3 className="text-xl font-bold text-gray-800 dark:text-slate-100">Archive Program?</h3>
            </div>
            <p className="text-gray-600 dark:text-slate-300 text-center mb-2">
              This program is currently <strong className="text-green-600 dark:text-green-400">live</strong>.
              Archiving will unpublish it and move it to your archive.
            </p>
            <p className="text-amber-600 dark:text-amber-400 text-sm text-center mb-5">
              ⚠️ The program will no longer be visible to the public.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setArchiveConfirm(null)} className="btn-secondary flex-1">
                Cancel
              </button>
              <button onClick={handleArchiveConfirm} className="btn-info flex-1">
                📦 Yes, Archive
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRMATION MODAL ──────────────────────────────────────── */}
      {deleteConfirm && (
        <div className="modal-backdrop">
          <div className="modal-container max-w-md">
            <div className="text-center mb-4">
              <div className="text-6xl mb-3">🗑️</div>
              <h3 className="text-xl font-bold text-gray-800 dark:text-slate-100">Delete Program?</h3>
            </div>
            <p className="text-gray-600 dark:text-slate-300 text-center mb-2">
              You are about to permanently delete:
            </p>
            <p className="text-center font-bold text-lds-blue dark:text-slate-100 text-lg mb-4">
              {deleteConfirm.date}
            </p>
            <p className="text-red-500 dark:text-red-400 text-sm text-center mb-5">
              ⚠️ This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="btn-secondary flex-1">
                Cancel
              </button>
              <button onClick={handleDeleteConfirm} className="btn-danger flex-1">
                🗑️ Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-3xl font-bold text-lds-blue dark:text-slate-100">Program Dashboard</h1>
        <button onClick={handleCreateNew} className="btn-primary">
          ➕ Create New Program
        </button>
      </div>

      {/* ── SUMMARY STATS BAR ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="card-stat border-gray-400">
          <div className="text-3xl font-bold text-gray-700 dark:text-slate-100">{programs.length}</div>
          <div className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wide mt-1">Total Programs</div>
        </div>
        <div className="card-stat border-yellow-400">
          <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
            {programs.filter(p => p.status === 'draft').length}
          </div>
          <div className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wide mt-1">Drafts</div>
        </div>
        <div className="card-stat border-green-500">
          <div className="text-3xl font-bold text-green-600 dark:text-green-400">
            {programs.filter(p => p.status === 'published').length}
          </div>
          <div className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wide mt-1">Published</div>
        </div>
        <div className="card-stat border-blue-400">
          <div className="text-3xl font-bold text-blue-500 dark:text-blue-400">
            {programs.filter(p => p.status === 'archived').length}
          </div>
          <div className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wide mt-1">Archived</div>
        </div>
      </div>

      {/* ── FILTER TABS ────────────────────────────────────────────────────── */}
      <div className="flex gap-2 mb-6">
        {['all', 'draft', 'published', 'archived'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg transition font-medium ${
              filter === f
                ? 'bg-lds-blue text-white dark:bg-blue-600'
                : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-200 hover:bg-gray-200 dark:hover:bg-slate-600'
            }`}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* ── ERROR BANNER ───────────────────────────────────────────────────── */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg mb-4">
          ⚠️ Failed to load programs. Please try again or contact support.
          <button onClick={loadSummary} className="ml-4 underline text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300">
            Retry
          </button>
        </div>
      )}

      {/* ── LOADING STATE ──────────────────────────────────────────────────── */}
      {loading && (
        <div className="text-center py-12 text-gray-400 dark:text-slate-500">
          <div className="text-4xl mb-3">⏳</div>
          <p>Loading programs...</p>
        </div>
      )}

      {/* ── PROGRAMS LIST ──────────────────────────────────────────────────── */}
      {!loading && (sortedPrograms.length === 0 ? (
        <div className="card text-center py-12">
          <div className="text-5xl mb-4">📋</div>
          <p className="text-gray-500 dark:text-slate-400">
            {filter !== 'all' ? `No ${filter} programs` : 'Create your first program to get started'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedPrograms.map(program => (
            <div key={program.id} className="card flex justify-between items-start">

              {/* LEFT: Program Info */}
              <div>
                <h5 className="font-bold text-lg text-lds-blue dark:text-slate-100">
                  {program.programName || 'Sacrament Meeting Program'}
                </h5>
                <p className="text-sm text-gray-500 dark:text-slate-400 mb-1">
                  {program.date ?? 'No date'}
                </p>
                {program.speakerCount > 0 ? (
                  <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
                    🎤 {program.speakerCount} speaker{program.speakerCount !== 1 ? 's' : ''} assigned
                  </p>
                ) : (
                  <p className="text-sm text-gray-400 dark:text-slate-500 italic mt-1">🎤 No speakers assigned</p>
                )}
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  📢 {program.announcementCount ?? 0} Announcement{program.announcementCount !== 1 ? 's' : ''}
                </p>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                  ✏️ Last edited: {formatLastModified(program.lastModified)}
                </p>
                <StatusBadge status={program.status} />
              </div>

              {/* RIGHT: Actions */}
              <div className="flex gap-2 flex-wrap justify-end">
                <Link to={`/builder/${program.id}`} className="btn-secondary text-sm">✏️ Edit</Link>
                <Link to={`/view/${program.id}`}    className="btn-secondary text-sm">👁️ View</Link>
                <button onClick={() => handleDuplicate(program.id)} className="btn-purple btn-small">
                  📋 Copy
                </button>
                {program.status === 'draft' && (
                  <button onClick={() => handlePublish(program.id)} className="btn-primary text-sm">
                    ✓ Publish
                  </button>
                )}
                {program.status === 'published' && (
                  <button onClick={() => handleUnpublishClick(program.id)} className="btn-warning btn-small">
                    ⏸️ Unpublish
                  </button>
                )}
                {program.status === 'published' && (
                  <button onClick={() => handleArchiveClick(program.id)} className="btn-info btn-small">
                    📦 Archive
                  </button>
                )}
                {(program.status === 'draft' || program.status === 'archived') && (
                  <button onClick={() => handleDeleteClick(program)} className="btn-danger text-sm">
                    🗑️ Delete
                  </button>
                )}
              </div>

            </div>
          ))}
        </div>
      ))}

      {/* LOAD MORE */}
      {!loading && hasMore && (
        <div className="text-center mt-6">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="btn-secondary px-8"
          >
            {loadingMore ? '⏳ Loading...' : '⬇️ Load More Programs'}
          </button>
        </div>
      )}
      {!loading && !hasMore && programs.length > DASHBOARD_PAGE_SIZE && (
        <p className="text-center text-sm text-gray-400 dark:text-slate-500 mt-4">
          ✅ All programs loaded ({programs.length} total)
        </p>
      )}

    </div>
  );
}

export default AdminDashboard;

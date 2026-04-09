// src/hooks/useProgramForm.js
// ============================================================
// Custom React hook that encapsulates all state management,
// CRUD handlers, and save/publish logic for ProgramBuilder.
// ============================================================
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useProgramContext } from '../context/ProgramContext';
import { getHymnTitle } from '../data/hymns';
import { useError } from '../context/ErrorContext';
import { api } from '../utils/api';
import { calculatePanelHealth } from '../utils/panelHealth';
import { PRESETS } from '../utils/printSettingsUtils';
import { getChildrensHymnTitle } from '../data/childrensHymns';
import { logger } from '../utils/logger';

// ============================================================
// LOCAL UTILITIES (unchanged)
// ============================================================
const deepClone = (obj) => JSON.parse(JSON.stringify(obj));

const defaultCoverLayout = () => [
  { id: 'block-date',  type: 'date',  label: 'Date' },
  { id: 'block-image', type: 'image', label: 'Cover Image' },
  { id: 'block-quote', type: 'quote', label: 'Quote & Attribution' },
];

const ensureIds = (data) => {
  const ensured = { ...data };
  if (ensured.meetingOrder?.meetingItems) {
    ensured.meetingOrder.meetingItems = ensured.meetingOrder.meetingItems.map(
      (item) => ({ ...item, id: item.id ?? `meeting-${Date.now()}-${Math.random()}` })
    );
  }
  if (ensured.announcements) {
    ensured.announcements = ensured.announcements.map(
      (ann) => ({ ...ann, id: ann.id ?? `ann-${Date.now()}-${Math.random()}` })
    );
  }
  if (ensured.leadership) {
    ensured.leadership = ensured.leadership.map(
      (leader) => ({ ...leader, id: leader.id ?? `leader-${Date.now()}-${Math.random()}` })
    );
  }
  if (ensured.schedules) {
    ensured.schedules = ensured.schedules.map(
      (sched) => ({ ...sched, id: sched.id ?? `sched-${Date.now()}-${Math.random()}` })
    );
  }
  return ensured;
};


// ============================================================
// HELPER: Fetch published programs for conflict detection
// Always fetches fresh from the summary endpoint — never
// relies on the context programs[] array which may be empty.
// ============================================================
const fetchPublishedPrograms = async () => {
  try {
    return await api.get('/programs/summary?status=published&page=1&pageSize=100');
  } catch (err) {
    logger.warn('[useProgramForm] Could not fetch published programs for conflict check:', err);
    return [];
  }
};

// ============================================================
// HOOK
// ============================================================
export function useProgramForm(id) {
  const navigate = useNavigate();
  const {
    currentProgram,
    createProgram,
    publishProgram,
    unpublishProgram,
    loadWardDefaults,
    loadWardName,
  } = useProgramContext();
  const { showToast } = useError();

  // ============================================================
  // STATE (unchanged)
  // ============================================================
  const [step, setStep]                               = useState(1);
  const [formData, setFormData]                       = useState(null);
  const [republishModal, setRepublishModal]           = useState(false);
  const [cancelModal, setCancelModal]                 = useState(false);
  const [publishConflictModal, setPublishConflictModal] = useState(null);
  const [pendingPublishAction, setPendingPublishAction] = useState(null);
  const [imageUrlLoading, setImageUrlLoading]         = useState(false);
  const lastFetchedUrlRef                             = useRef('');
  const [importedRequestIds, setImportedRequestIds] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const recordImportedRequests = useCallback((ids) => {
    setImportedRequestIds(prev => new Set([...prev, ...ids]));
}, []);

  // Ward defaults + override modes
  const [wardDefaults, setWardDefaults]   = useState({ leadership: [], schedules: [] });
  const [leadershipMode, setLeadershipMode] = useState('default');
  const [schedulesMode, setSchedulesMode]   = useState('default');
  const [resetConfirm, setResetConfirm]     = useState(null);
  const [wardName, setWardName]             = useState('');
  const [stakeName, setStakeName]           = useState('');

  useEffect(() => {
    loadWardName().then(({ wardName, stakeName }) => {
      setWardName(wardName);
      setStakeName(stakeName);
      
    });
  }, [loadWardName]);
  
  const location = useLocation();
  
  // ============================================================
  // LOAD PROGRAM DATA
  // ============================================================
  const prepareAndLoad = useCallback((source) => {
    const loaded = deepClone(source);
    if (!loaded.cover) loaded.cover = {};
    if (!loaded.meetingOrder) loaded.meetingOrder = {};
    if (!loaded.meetingOrder.meetingItems) loaded.meetingOrder.meetingItems = [];

    // ── Per-panel print settings migration ──────────────────────────────────
    const defaultPS = { preset: 'standard', bodySize: 9, headingSize: 11 };
    if (!loaded.cover.printSettings)           loaded.cover.printSettings = { ...defaultPS };
    if (!loaded.meetingOrder.printSettings)    loaded.meetingOrder.printSettings = { ...defaultPS };
    if (!loaded.announcementSettings)          loaded.announcementSettings = { ...defaultPS };
    if (!loaded.leadershipSettings)            loaded.leadershipSettings = { ...defaultPS };
    if (!loaded.schedulesSettings)             loaded.schedulesSettings = { ...defaultPS };

    if (!loaded.cover.imageHeightPct && loaded.cover.imageHeight) {
      loaded.cover.imageHeightPct = Math.round(
        (Math.min(loaded.cover.imageHeight, 7.9) / 7.9) * 100
      );
    }

    if (!loaded.cover.layout || loaded.cover.layout.length === 0) {
      loaded.cover.layout = defaultCoverLayout();
    }

    setImportedRequestIds(new Set());

    loaded.meetingOrder.conducting  = loaded.meetingOrder.conducting  ?? loaded.conducting  ?? '';
    loaded.meetingOrder.presiding   = loaded.meetingOrder.presiding   ?? loaded.presiding   ?? '';
    loaded.meetingOrder.chorister   = loaded.meetingOrder.chorister   ?? loaded.chorister   ?? '';
    loaded.meetingOrder.accompanist = loaded.meetingOrder.accompanist ?? loaded.accompanist ?? '';

    loaded.meetingOrder.meetingItems = loaded.meetingOrder.meetingItems.map(item => {
      if (item.type === 'baptism') {
        return {
          ...item,
          personName:  item.personName  ?? item.name ?? '',
          performedBy: item.performedBy ?? '',
          witness1:    item.witness1    ?? '',
          witness2:    item.witness2    ?? '',
        };
      }
      if (item.type === 'confirmation') {
        return {
          ...item,
          personName:  item.personName  ?? item.name ?? '',
          performedBy: item.performedBy ?? '',
        };
      }
      return item;
    });

    const syncPresetSizes = (ps) => {
      if (!ps || ps.preset === 'custom') return ps;
      const resolved = PRESETS[ps.preset] ?? PRESETS.standard;
      return {
        ...ps,
        bodySize: resolved.bodyPt,
        headingSize: resolved.headingPt,
      };
    };

    loaded.cover.printSettings       = syncPresetSizes(loaded.cover.printSettings);
    loaded.meetingOrder.printSettings = syncPresetSizes(loaded.meetingOrder.printSettings);
    loaded.announcementSettings      = syncPresetSizes(loaded.announcementSettings);
    loaded.leadershipSettings        = syncPresetSizes(loaded.leadershipSettings);

    setFormData(ensureIds(loaded));
    setLeadershipMode(loaded.leadershipMode ?? 'default');
    setSchedulesMode(loaded.schedulesMode   ?? 'default');
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const templateId = params.get('template');

    if (id === 'new' && templateId) {
        // Load from template
        const loadFromTemplate = async () => {
            try {
                const result = await api.get(`/templates/${templateId}`);
                const t = result.template;
                prepareAndLoad({
                    // Template fields
                    programName:          t.programName ?? '',
                    cover:                t.cover ?? {},
                    meetingOrder:         t.meetingOrder ?? {},
                    announcementSettings: t.announcementSettings ?? { preset: 'standard' },
                    leadershipSettings:   t.leadershipSettings   ?? { preset: 'standard' },
                    leadershipMode:       t.leadershipMode        ?? 'default',
                    schedulesMode:        t.schedulesMode          ?? 'default',
                    schedulesPublic:      t.schedulesPublic        !== false,
                    // New program fields — always fresh
                    date:         new Date().toISOString().slice(0, 10),
                    status:       'draft',
                    announcements: [],
                    leadership:    [],
                    schedules:     [],
                });
            } catch (err) {
                logger.error('[useProgramForm] Failed to load template:', err);
                // Fall back to blank new program
                prepareAndLoad({
                    date: new Date().toISOString().slice(0, 10),
                    status: 'draft',
                    programName: '',
                    cover: {
                        image: '', imageUrl: '', imageSource: 'url',
                        imageBleed: false, imageHeightPct: 50,
                        quote: '', attribution: '', layout: [],
                        printSettings: { preset: 'standard', bodySize: 9, headingSize: 11 },
                    },
                    meetingOrder: {
                        conducting: '', presiding: '', chorister: '', accompanist: '',
                        meetingItems: [],
                        printSettings: { preset: 'standard', bodySize: 9, headingSize: 11 },
                    },
                    announcementSettings: { preset: 'standard', bodySize: 9, headingSize: 11 },
                    leadershipSettings:   { preset: 'standard', bodySize: 9, headingSize: 11 },
                    announcements: [], leadership: [], leadershipPublic: true,
                    schedules: [], schedulesPublic: true,
                });
            }
        };
        loadFromTemplate();
        return;
    }

    if (id === 'new') {
      prepareAndLoad({
        date: new Date().toISOString().slice(0, 10),
        status: 'draft',
        programName: '',
        cover: {
          image: '', imageUrl: '', imageSource: 'url',
          imageBleed: false,
          imageHeightPct: 50,
          quote: '', attribution: '', layout: [],
          printSettings: { preset: 'standard', bodySize: 9, headingSize: 11 },
        },
        meetingOrder: {
          conducting: '', presiding: '', chorister: '', accompanist: '',
          meetingItems: [],
          printSettings: { preset: 'standard', bodySize: 9, headingSize: 11 },
        },
        announcementSettings: { preset: 'standard', bodySize: 9, headingSize: 11 },
        leadershipSettings:   { preset: 'standard', bodySize: 9, headingSize: 11 },
        announcements: [], leadership: [], leadershipPublic: true,
        schedules:     [], schedulesPublic: true,
      });
      return;
    }
    if (!id) {
      if (currentProgram) prepareAndLoad(currentProgram);
      return;
    }
    const loadFromApi = async () => {
      try {
        const data = await api.get(`/programs/${id}`);
        prepareAndLoad(data);
      } catch (err) {
        logger.error('[useProgramForm] Failed to load program:', err);
        if (currentProgram) prepareAndLoad(currentProgram);
      }
    };
    loadFromApi();
  }, [id, prepareAndLoad, location.search]);

  // ============================================================
  // LOAD WARD DEFAULTS
  // ============================================================
  useEffect(() => {
    loadWardDefaults().then(defaults => {
      setWardDefaults(defaults ?? { leadership: [], schedules: [] });
    });
  }, [loadWardDefaults]);

  // ============================================================
  // GENERIC FIELD UPDATER (unchanged)
  // ============================================================
  const updateField = (path, value) => {
    setFormData(prev => {
      const keys    = path.split('.');
      const updated = deepClone(prev);
      let current   = updated;
      for (let i = 0; i < keys.length - 1; i++) current = current[keys[i]];
      current[keys[keys.length - 1]] = value;
      return updated;
    });
  };

  // ============================================================
  // COVER BLOCK MANAGEMENT
  // ── addCoverBlock now accepts an optional pregenerated id so
  //    StepEditorPanel can track which block is "new" for auto-expand.
  // ============================================================
  const addCoverBlock = (type, preId) => {
    const newBlock = {
      id:    preId ?? `block-${type}-${Date.now()}`,
      type,
      label: type,
      ...(type === 'welcome' && { welcomeText: wardName ? `Welcome to ${wardName}` : 'Welcome to Sacrament Meeting' }),
      ...(type === 'custom'  && { customText: '' }),
    };
    setFormData(prev => ({
      ...prev,
      cover: { ...prev.cover, layout: [...(prev.cover.layout ?? []), newBlock] },
    }));
  };

  const removeCoverBlock = (blockId) => {
    const block = formData.cover.layout.find((b) => b.id === blockId);
    if (block?.type === 'image') {
      setFormData(prev => ({
        ...prev,
        cover: {
          ...prev.cover,
          image: '', imageUrl: '', imageSource: 'url',
          imageBleed: false,
          imageHeightPct: 50,
          layout: prev.cover.layout.filter((b) => b.id !== blockId),
        },
      }));
      return;
    }
    if (block?.type === 'quote') {
      setFormData(prev => ({
        ...prev,
        cover: {
          ...prev.cover,
          quote: '', attribution: '',
          layout: prev.cover.layout.filter((b) => b.id !== blockId),
        },
      }));
      return;
    }
    setFormData(prev => ({
      ...prev,
      cover: { ...prev.cover, layout: prev.cover.layout.filter((b) => b.id !== blockId) },
    }));
  };

  const updateCoverBlock = (blockId, field, value) => {
    setFormData(prev => {
      const updated = deepClone(prev);
      const block   = updated.cover.layout.find((b) => b.id === blockId);
      if (block) block[field] = value;
      return updated;
    });
  };

  // ============================================================
  // MEETING ITEMS
  // ── addMeetingItem now accepts an optional pregenerated id.
  // ============================================================
  const addMeetingItem = (type, preId) => {
    const newItem = { id: preId ?? Date.now().toString(), type };
    switch (type) {
      case 'openingHymn': case 'sacramentHymn':
      case 'closingHymn': case 'hymn':
        newItem.number = ''; newItem.title = ''; break;
      case 'childrensHymn':
        newItem.number = ''; newItem.title = ''; break;
      case 'openingPrayer': case 'closingPrayer':
        newItem.name = ''; break;
      case 'sacramentAdmin':
        newItem.label = 'Blessing and Passing of the Sacrament'; break;
      case 'speaker':
        newItem.name = ''; newItem.topic = ''; break;
      case 'musical':
        newItem.performers = ''; newItem.piece = ''; break;
      case 'baptism':
        newItem.personName = ''; newItem.performedBy = '';
        newItem.witness1   = ''; newItem.witness2    = ''; break;
      case 'confirmation':
        newItem.personName = ''; newItem.performedBy = ''; break;
      default: break;
    }
    setFormData(prev => ({
      ...prev,
      meetingOrder: {
        ...prev.meetingOrder,
        meetingItems: [...prev.meetingOrder.meetingItems, newItem],
      },
    }));
  };

  const removeMeetingItem = (itemId) => {
    setFormData(prev => ({
      ...prev,
      meetingOrder: {
        ...prev.meetingOrder,
        meetingItems: prev.meetingOrder.meetingItems.filter((i) => i.id !== itemId),
      },
    }));
  };

  const updateMeetingItem = (itemId, field, value) => {
    setFormData(prev => {
      const updated = deepClone(prev);
      const item    = updated.meetingOrder.meetingItems.find((i) => i.id === itemId);
      if (item) {
        item[field] = value;

        if (field === 'number') {
          if (item.type === 'childrensHymn') {
            item.title = value ? (getChildrensHymnTitle(value) ?? '') : '';
          } else {
            item.title = value ? (getHymnTitle(value) ?? '') : '';
          }
        }

        if (field === 'name')       item.personName = value;
        if (field === 'personName') item.name       = value;
      }
      return updated;
    });
  };

  // ============================================================
  // ANNOUNCEMENTS
  // ── addAnnouncement now accepts an optional pregenerated id.
  // ============================================================
  const addAnnouncement = (preId, data = {}) => {
      setFormData(prev => ({
          ...prev,
          announcements: [
              ...prev.announcements,
              {
                  id:          preId ?? Date.now().toString(),
                  title:       data.title       ?? '',
                  description: data.description ?? '',
                  isPublic:    data.isPublic    ?? true,
                  isAllDay:    data.isAllDay    ?? false,
                  date:        data.date        ?? '',
                  endDate:     data.endDate     ?? '',
                  time:        data.time        ?? '',
                  endTime:     data.endTime     ?? '',
                  location:    data.location    ?? '',
              },
          ],
      }));
  };

  const removeAnnouncement = (annId) => {
    setFormData(prev => ({
      ...prev,
      announcements: prev.announcements.filter((a) => a.id !== annId),
    }));
  };

  const updateAnnouncement = (annId, field, value) => {
    setFormData(prev => {
      const updated = deepClone(prev);
      const ann     = updated.announcements.find((a) => a.id === annId);
      if (ann) ann[field] = value;
      return updated;
    });
  };

  // ============================================================
  // LEADERSHIP (unchanged)
  // ============================================================
  const addLeadership = () => {
    setFormData(prev => ({
      ...prev,
      leadership: [
        ...(prev.leadership ?? []),
        { id: Date.now().toString(), role: '', name: '', phone: '', email: '' },
      ],
    }));
  };

  const removeLeadership = (leaderId) => {
    setFormData(prev => ({
      ...prev,
      leadership: prev.leadership.filter((l) => l.id !== leaderId),
    }));
  };

  const updateLeadership = (leaderId, field, value) => {
    setFormData(prev => {
      const updated = deepClone(prev);
      const leader  = updated.leadership.find((l) => l.id === leaderId);
      if (leader) leader[field] = value;
      return updated;
    });
  };

  // ============================================================
  // SCHEDULES (unchanged)
  // ============================================================
  const addSchedule = () => {
    setFormData(prev => ({
      ...prev,
      schedules: [
        ...(prev.schedules ?? []),
        { id: Date.now().toString(), organization: '', day: '', time: '', location: '' },
      ],
    }));
  };

  const removeSchedule = (schedId) => {
    setFormData(prev => ({
      ...prev,
      schedules: prev.schedules.filter((s) => s.id !== schedId),
    }));
  };

  const updateSchedule = (schedId, field, value) => {
    setFormData(prev => {
      const updated = deepClone(prev);
      const sched   = updated.schedules.find((s) => s.id === schedId);
      if (sched) sched[field] = value;
      return updated;
    });
  };

  // ============================================================
  // SAVE / PUBLISH HANDLERS
  // ============================================================
  const handleSaveDraft = async () => {
    if (saving) return;                          // ← guard
    if (formData.status === 'published') { setRepublishModal(true); return; }
    setSaving(true);                             // ← lock
    showToast('💾 Saving draft, please wait...');
    const updated = { ...formData, status: 'draft' };
    try {
        if (!formData.id) {
            await createProgram(updated);
        } else {
            await api.put(`/programs/${formData.id}`, updated);
            if (importedRequestIds.size > 0) {
                try {
                    await api.post('/announcements/requests/mark-added', {
                        requestIds: [...importedRequestIds],
                        programId: formData.id,
                    });
                    setImportedRequestIds(new Set());
                } catch (err) {
                    console.warn('[ProgramForm] Failed to mark announcement requests as added:', err.message);
                }
            }
        }
        showToast('✅ Draft saved successfully!');
        setTimeout(() => navigate('/admin'), 1500);
    } catch (err) {
        logger.error('[handleSaveDraft] failed:', err);
        showToast('❌ Failed to save draft. Please try again.');
        setSaving(false);                        // ← only unlock on failure; success navigates away
    }
  };

  const handleSaveAndRepublish = async () => {
    if (saving) return;
    const currentHealth = calculatePanelHealth(formData, wardDefaults);
    if (!currentHealth?.allClear) {
        showToast('❌ Cannot republish — one or more panels will overflow. Fix them first.');
        return;
    }
    setSaving(true);
    showToast('💾 Saving and republishing, please wait...');
    const publishedPrograms = await fetchPublishedPrograms();
    const sameDate = publishedPrograms.filter(
      (p) => p.status === 'published' && p.date === formData.date && p.id !== formData.id
    );
    if (sameDate.length > 0) {
      const dateLabel = formData.date
        ? new Date(formData.date + 'T00:00:00').toLocaleDateString('en-US', {
            weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
          })
        : 'this date';
      setPendingPublishAction({ sameDate, isRepublish: true });
      setRepublishModal(false);
      setPublishConflictModal({ mode: 'sameDate', dateLabel, sameDate });
    } else {
      try {
        const updated = { ...formData, status: 'published' };
        await api.put(`/programs/${formData.id}`, updated);
        if (importedRequestIds.size > 0) {
          try {
              await api.post('/announcements/requests/mark-added', {
                  requestIds: [...importedRequestIds],
                  programId: formData.id,
              });
              setImportedRequestIds(new Set()); // clear after marking
          } catch (err) {
              // Non-fatal — log but don't fail the save
              console.warn('[ProgramForm] Failed to mark announcement requests as added:', err.message);
          }
        }
        setRepublishModal(false);
        showToast('🚀 Program updated and republished!');
        setTimeout(() => navigate('/admin'), 1500);
      } catch (err) {
        logger.error('[handleSaveAndRepublish] failed:', err);
        showToast('❌ Failed to republish. Please try again.');
        setSaving(false);
      }
    }
  };

  const handleSaveAsDraft = async () => {
    if (saving) return;
    setSaving(true);
    showToast('💾 Saving as draft, please wait...');
    try {
      const updated = { ...formData, status: 'draft' };
      await api.put(`/programs/${formData.id}`, updated);
      if (importedRequestIds.size > 0) {
        try {
            await api.post('/announcements/requests/mark-added', {
                requestIds: [...importedRequestIds],
                programId: formData.id,
            });
            setImportedRequestIds(new Set()); // clear after marking
        } catch (err) {
            // Non-fatal — log but don't fail the save
            console.warn('[ProgramForm] Failed to mark announcement requests as added:', err.message);
        }
      }
      await unpublishProgram(formData.id);
      setRepublishModal(false);
      showToast('💾 Saved as draft — program unpublished.');
      setTimeout(() => navigate('/admin'), 1500);
    } catch (err) {
      logger.error('[handleSaveAsDraft] failed:', err);
      showToast('❌ Failed to save as draft. Please try again.');
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (saving) return;
    const currentHealth = calculatePanelHealth(formData, wardDefaults);
    if (!currentHealth?.allClear) {
        showToast('❌ Cannot publish — one or more panels will overflow. Fix them first.');
        return;
    }
    setSaving(true);
    showToast('🚀 Publishing, please wait...');
    const publishedPrograms = await fetchPublishedPrograms();
    if (formData.id) {
      const sameDate = publishedPrograms.filter(
        (p) => p.status === 'published' && p.date === formData.date && p.id !== formData.id
      );
      if (sameDate.length > 0) {
        const dateLabel = formData.date
          ? new Date(formData.date + 'T00:00:00').toLocaleDateString('en-US', {
              weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
            })
          : 'this date';
        setPublishConflictModal({ mode: 'sameDate', dateLabel, sameDate });
      } else {
        try {
          await api.put(`/programs/${formData.id}`, { ...formData, status: 'published' });
          if (importedRequestIds.size > 0) {
            try {
                await api.post('/announcements/requests/mark-added', {
                    requestIds: [...importedRequestIds],
                    programId: formData.id,
                });
                setImportedRequestIds(new Set()); // clear after marking
            } catch (err) {
                // Non-fatal — log but don't fail the save
                console.warn('[ProgramForm] Failed to mark announcement requests as added:', err.message);
            }
          }
          showToast('🚀 Program published successfully!');
          setTimeout(() => navigate('/admin'), 1500);
        } catch (err) {
          logger.error('[handlePublish] existing program failed:', err);
          showToast('❌ Failed to publish. Please try again.');
          setSaving(false);
        }
      }
      return;
    }
    try {
      const sameDate = publishedPrograms.filter(
        (p) => p.status === 'published' && p.date === formData.date
      );
      if (sameDate.length > 0) {
        const saved = await createProgram({ ...formData, status: 'draft' });
        if (!saved?.id) throw new Error('No id returned from createProgram');
        setFormData((prev) => ({ ...prev, id: saved.id }));
        navigate(`/builder/${saved.id}`, { replace: true });
        const dateLabel = formData.date
          ? new Date(formData.date + 'T00:00:00').toLocaleDateString('en-US', {
              weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
            })
          : 'this date';
        setPublishConflictModal({ mode: 'sameDate', dateLabel, sameDate });
      } else {
        await createProgram({ ...formData, status: 'published' });
        showToast('🚀 Program published successfully!');
        setTimeout(() => navigate('/admin'), 1500);
      }
    } catch (err) {
      logger.error('[handlePublish] new program publish failed:', err);
      showToast('❌ Failed to publish. Please try again.');
      setSaving(false);
    }
  };

  const handlePublishConflictOnly = async () => {
    if (saving) return;
    setPublishConflictModal(null);
    setSaving(true);
    showToast('🚀 Publishing, please wait...');
    try {
      await publishProgram(formData.id, { conflict_action: 'archive_existing' });
      showToast('🚀 Program published and conflicting program archived!');
      setTimeout(() => navigate('/admin'), 1500);
    } catch (err) {
      logger.error('[handlePublishConflictOnly] failed:', err);
      showToast('❌ Failed to publish. Please try again.');
      setSaving(false);
    }
  };

  const handlePublishConflictBoth = async () => {
    if (saving) return;
    setPublishConflictModal(null);
    setSaving(true);
    showToast('🚀 Publishing, please wait...');
    try {
      if (formData.id) {
        await api.put(`/programs/${formData.id}`, { ...formData, status: 'published' });
      } else {
        await createProgram({ ...formData, status: 'published' });
      }
      if (importedRequestIds.size > 0) {
        try {
            await api.post('/announcements/requests/mark-added', {
                requestIds: [...importedRequestIds],
                programId: formData.id,
            });
            setImportedRequestIds(new Set());
        } catch (err) {
            console.warn('[ProgramForm] Failed to mark announcement requests as added:', err.message);
        }
      }
      showToast('🚀 Program published successfully!');
      setTimeout(() => navigate('/admin'), 1500);
    } catch (err) {
      logger.error('[handlePublishConflictBoth] failed:', err);
      showToast('❌ Failed to publish. Please try again.');
      setSaving(false);
    }
  };

  const handleDiscardAndExit = () => {
    setCancelModal(false);
    navigate('/admin');
  };

  const switchLeadershipToCustom = () => {
    setFormData(prev => ({
      ...prev,
      leadershipMode: 'custom',
      leadership: (wardDefaults.leadership ?? []).map(l => ({
        ...l,
        id: `leader-${Date.now()}-${Math.random()}`,
      })),
    }));
    setLeadershipMode('custom');
    showToast('✅ Leadership copied from ward defaults — customize as needed.');
  };

  const switchLeadershipToDefault = () => {
    setFormData(prev => ({ ...prev, leadershipMode: 'default', leadership: [] }));
    setLeadershipMode('default');
    setResetConfirm(null);
    showToast('✅ Switched back to ward leadership defaults.');
  };

  const switchSchedulesToCustom = () => {
    setFormData(prev => ({
      ...prev,
      schedulesMode: 'custom',
      schedules: (wardDefaults.schedules ?? []).map(s => ({
        ...s,
        id: `sched-${Date.now()}-${Math.random()}`,
      })),
    }));
    setSchedulesMode('custom');
    showToast('✅ Schedules copied from ward defaults — customize as needed.');
  };

  const switchSchedulesToDefault = () => {
    setFormData(prev => ({ ...prev, schedulesMode: 'default', schedules: [] }));
    setSchedulesMode('default');
    setResetConfirm(null);
    showToast('✅ Switched back to ward schedule defaults.');
  };

  // ============================================================
  // RETURN (unchanged)
  // ============================================================
  return {
    formData, setFormData,
    step, setStep,
    imageUrlLoading, setImageUrlLoading,
    lastFetchedUrlRef,
    republishModal,       setRepublishModal,
    cancelModal,          setCancelModal,
    publishConflictModal, setPublishConflictModal,
    pendingPublishAction, setPendingPublishAction,
    updateField,
    addCoverBlock,    removeCoverBlock,    updateCoverBlock,
    addMeetingItem,   removeMeetingItem,   updateMeetingItem,
    addAnnouncement,  removeAnnouncement,  updateAnnouncement,
    addLeadership,    removeLeadership,    updateLeadership,
    addSchedule,      removeSchedule,      updateSchedule,
    handleSaveDraft, handleSaveAndRepublish, handleSaveAsDraft,
    handlePublish,   handlePublishConflictOnly, handlePublishConflictBoth,
    handleDiscardAndExit,
    switchLeadershipToCustom, switchLeadershipToDefault,
    switchSchedulesToCustom,  switchSchedulesToDefault,
    wardDefaults,
    leadershipMode, schedulesMode,
    resetConfirm, setResetConfirm,
    wardName, stakeName, importedRequestIds, recordImportedRequests, saving
  };
}
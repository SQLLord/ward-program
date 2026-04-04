// src/context/ProgramContext.jsx
import React, {
  createContext, useContext, useState, useCallback, useRef,  // ← ADD useRef
} from 'react';
import { api } from '../utils/api';
import { useAuth } from './AuthContext';
import { logger } from '../utils/logger';

const ProgramContext = createContext();

export const useProgramContext = () => {
  const context = useContext(ProgramContext);
  if (!context) throw new Error('useProgramContext must be used within ProgramProvider');
  return context;
};

export const ProgramProvider = ({ children }) => {
  const { user } = useAuth();
  const [programs, setPrograms]           = useState([]);
  const [currentProgram, setCurrentProgram] = useState(null);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);

  // ── Ward defaults cache ──────────────────────────────────────────────────
  // Persists across re-renders and StrictMode double-invocations.
  // Call invalidateWardDefaultsCache() after saving ward defaults so the
  // next call to loadWardDefaults() fetches fresh data from the server.
  const wardDefaultsCache = useRef(null);

  const invalidateWardDefaultsCache = useCallback(() => {
    wardDefaultsCache.current = null;
  }, []);
  // ────────────────────────────────────────────────────────────────────────

  const loadPrograms = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get('/programs');
      setPrograms(data);
    } catch (err) {
      setError(err.message);
      logger.error('[ProgramContext] loadPrograms:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPublishedByDate = useCallback(async (date) => {
    try {
      const data = await api.get(`/programs?status=published&date=${encodeURIComponent(date)}`);
      return data;
    } catch (err) {
      logger.error('[ProgramContext] loadPublishedByDate:', err);
      return [];
    }
  }, []);

  // ── loadWardDefaults — cached ────────────────────────────────────────────
  const loadWardDefaults = useCallback(async () => {
    // Return cached value if already fetched this session
    if (wardDefaultsCache.current) {
      return wardDefaultsCache.current;
    }
    try {
      const data = await api.get('/programs/ward-defaults');
      wardDefaultsCache.current = data;   // ← cache it
      return data;
    } catch (err) {
      logger.error('[ProgramContext] loadWardDefaults:', err);
      return { leadership: [], schedules: [] };
    }
  }, []);
  // ────────────────────────────────────────────────────────────────────────

  const createProgram = useCallback(async (data) => {
    const blank = data ?? {
      date: new Date().toISOString().slice(0, 10),
      status: 'draft',
      cover: {
        image: '', imageUrl: '', imageSource: 'url',
        imageBleed: false, imageHeight: 4,
        imagePosition: 'center', imageFit: 'cover',
        quote: '', attribution: '', layout: [],
      },
      meetingOrder: {
        conducting: '', presiding: '', chorister: '', accompanist: '',
        meetingItems: [],
      },
      announcements: [], leadership: [], leadershipPublic: true,
      schedules: [], schedulesPublic: true,
    };
    const newProgram = await api.post('/programs', blank);
    setPrograms(prev => [newProgram, ...prev]);
    setCurrentProgram(newProgram);
    return newProgram;
  }, []);

  const saveProgram = useCallback(async (program) => {
    let saved;
    if (program.id && programs.some(p => p.id === program.id)) {
      saved = await api.put(`/programs/${program.id}`, program);
      setPrograms(prev => prev.map(p => (p.id === saved.id ? saved : p)));
    } else {
      saved = await api.post('/programs', program);
      setPrograms(prev => [saved, ...prev]);
    }
    return saved;
  }, [programs]);

  const publishProgram = useCallback(async (programId, options = {}) => {
    const body = (options.archiveExisting || options.conflict_action)
      ? { conflict_action: options.conflict_action ?? 'archive_existing' } : {};
    try {
      await api.post(`/programs/${programId}/publish`, body);
      setPrograms(prev =>
        prev.map(p => (p.id === programId ? { ...p, status: 'published' } : p))
      );
    } catch (err) {
      throw err;
    }
  }, []);

  const publishProgramExclusive = useCallback(async (programId) => {
    await api.post(`/programs/${programId}/publish`, {
      conflict_action: 'archive_existing',
    });
    setPrograms(prev =>
      prev.map(p => (p.id === programId ? { ...p, status: 'published' } : p))
    );
  }, []);

  // Add this after publishProgramExclusive
  const publishProgramBoth = useCallback(async (programId) => {
    await api.post(`/programs/${programId}/publish`, {
      conflict_action: 'allow',   // ← tells proc to publish regardless
    });
    setPrograms(prev =>
      prev.map(p => (p.id === programId ? { ...p, status: 'published' } : p))
    );
  }, []);

  const unpublishProgram = useCallback(async (programId) => {
    await api.post(`/programs/${programId}/unpublish`, {});
    setPrograms(prev =>
      prev.map(p => (p.id === programId ? { ...p, status: 'draft' } : p))
    );
  }, []);

  const archiveProgram = useCallback(async (programId) => {
    await api.post(`/programs/${programId}/archive`, {});
    setPrograms(prev =>
      prev.map(p => (p.id === programId ? { ...p, status: 'archived' } : p))
    );
  }, []);

  const deleteProgram = useCallback(async (programId) => {
    await api.delete(`/programs/${programId}`);
    setPrograms(prev => prev.filter(p => p.id !== programId));
  }, []);

  const duplicateProgram = useCallback(async (programId) => {
    const newProgram = await api.post(`/programs/${programId}/duplicate`, {});
    setPrograms(prev => [newProgram, ...prev]);
    return newProgram;
  }, []);


  const publicSchedulesCacheRef = useRef(null);

  // Update loadPublicSchedules
  const loadPublicSchedules = useCallback(async () => {
    if (publicSchedulesCacheRef.current) return publicSchedulesCacheRef.current;
    try {
      const data = await api.get('/programs/public-schedules');
      const schedules = data.schedules ?? [];
      publicSchedulesCacheRef.current = schedules; // ← cache it
      return schedules;
    } catch (err) {
      logger.error('[ProgramContext] loadPublicSchedules:', err);
      return [];
    }
  }, []);


  // ── Ward name cache ──────────────────────────────────────────────────────────
  const wardNameCacheRef = useRef(null);

  const loadWardName = useCallback(async () => {
    if (wardNameCacheRef.current) return wardNameCacheRef.current;
    try {
      const data = await api.get('/ward/name');
      // ✅ Cache the full object — wardName AND stakeName
      wardNameCacheRef.current = {
        wardName:  data.wardName  ?? '',
        stakeName: data.stakeName ?? null,
        wardUrl:   data.wardUrl   ?? '',
      };
      return wardNameCacheRef.current;
    } catch (err) {
      logger.error('[ProgramContext] loadWardName error:', err);
      return { wardName: '', stakeName: null, wardUrl: '' };
    }
  }, []);

  return (
    <ProgramContext.Provider value={{
      programs, currentProgram, loading, error,
      loadPrograms, loadPublishedByDate, loadWardDefaults,
      invalidateWardDefaultsCache,                          // ← ADD to context
      createProgram, saveProgram,
      publishProgram, publishProgramExclusive, publishProgramBoth,
      unpublishProgram, archiveProgram, loadWardName,
      deleteProgram, duplicateProgram, loadPublicSchedules,
    }}>
      {children}
    </ProgramContext.Provider>
  );
};

export const usePublishedProgram = () => {
  const { programs } = useProgramContext();
  return programs.find(p => p.status === 'published');
};
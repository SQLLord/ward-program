// src/context/UserContext.jsx
import React, {
  createContext, useContext, useState, useCallback,
} from 'react';
import { api } from '../utils/api';
import { logger } from '../utils/logger';

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);


  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get('/users');
      setUsers(data);
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        setUsers([]);
      } else {
        setError(err.message);
        logger.error('[UserContext] loadUsers:', err);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const addUser = useCallback(async (userData) => {
    const newUser = await api.post('/users', userData);
    setUsers(prev => [...prev, newUser]);
    return newUser;
  }, []);

  const updateUser = useCallback(async (id, updates) => {
    await api.put(`/users/${id}`, updates);
    const fresh = await api.get(`/users/${id}`);
    setUsers(prev => prev.map(u => (u.id === id ? fresh : u)));
    return fresh;
  }, []);

  const deactivateUser = useCallback(async (id) => {
    await api.patch(`/users/${id}/status`, { status: 'inactive' });
    setUsers(prev => prev.map(u => (u.id === id ? { ...u, status: 'inactive' } : u)));
  }, []);

  const reactivateUser = useCallback(async (id) => {
    await api.patch(`/users/${id}/status`, { status: 'active' });
    setUsers(prev => prev.map(u => (u.id === id ? { ...u, status: 'active' } : u)));
  }, []);

  const deleteUser = useCallback(async (id) => {
    await api.delete(`/users/${id}`);
    setUsers(prev => prev.filter(u => u.id !== id));
  }, []);

  const getUserById    = useCallback((id)    => users.find(u => u.id === id) ?? null, [users]);
  const findUserByEmail = useCallback((email) =>
    users.find(u => u.email.toLowerCase() === email.toLowerCase()) ?? null, [users]);

  return (
    <UserContext.Provider value={{
      users, loading, error, loadUsers,
      addUser, updateUser, deactivateUser,
      reactivateUser, deleteUser,
      getUserById, findUserByEmail,
    }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUsers() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUsers() must be inside a <UserProvider>.');
  return ctx;
}
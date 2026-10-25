import { createContext, useContext, useEffect, useState } from 'react';
import api from '../services/api.js';

const AuthContext = createContext(null);

function readStoredUser() {
  if (!sessionStorage.getItem('queuewise_token')) return null;
  try {
    return JSON.parse(sessionStorage.getItem('queuewise_user') || 'null');
  } catch {
    sessionStorage.removeItem('queuewise_user');
    return null;
  }
}

export function AuthProvider({ children }) {
  useState(() => {
    localStorage.removeItem('queuewise_token');
    localStorage.removeItem('queuewise_user');
    return null;
  });
  const [user, setUser] = useState(readStoredUser);
  const [loading, setLoading] = useState(Boolean(sessionStorage.getItem('queuewise_token')));
  useEffect(() => { if (!loading) return; api.get('/auth/me').then(({ data }) => setUser(data.user)).catch(() => logout()).finally(() => setLoading(false)); }, []);
  async function login(credentials) { const { data } = await api.post('/auth/login', credentials); persist(data); }
  async function loginStaff(credentials) { const { data } = await api.post('/auth/staff/login', credentials); persist(data); }
  async function register(credentials) { const { data } = await api.post('/auth/register', credentials); return data; }
  async function updateProfile(updates) { const { data } = await api.patch('/auth/me', updates); sessionStorage.setItem('queuewise_user', JSON.stringify(data.user)); setUser(data.user); return data.user; }
  function persist(data) { sessionStorage.setItem('queuewise_token', data.token); sessionStorage.setItem('queuewise_user', JSON.stringify(data.user)); setUser(data.user); setLoading(false); }
  function logout() { sessionStorage.removeItem('queuewise_token'); sessionStorage.removeItem('queuewise_user'); localStorage.removeItem('queuewise_token'); localStorage.removeItem('queuewise_user'); setUser(null); setLoading(false); }
  return <AuthContext.Provider value={{ user, loading, login, loginStaff, register, updateProfile, logout }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);

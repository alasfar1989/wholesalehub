import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      await api.init();
      if (api.token) {
        const data = await api.getMe();
        setUser(data.user);
      }
    } catch {
      await api.setToken(null);
    } finally {
      setLoading(false);
    }
  }

  async function login(phone, password) {
    const data = await api.login({ phone, password });
    await api.setToken(data.token);
    setUser(data.user);
    return data.user;
  }

  async function signup(body) {
    const data = await api.signup(body);
    await api.setToken(data.token);
    setUser(data.user);
    return data.user;
  }

  async function logout() {
    await api.setToken(null);
    setUser(null);
  }

  async function refreshUser() {
    const data = await api.getMe();
    setUser(data.user);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

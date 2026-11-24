/**
 * Authentication & Role-Based Session Context (`src/context/AuthContext.jsx`)
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axiosClient from '../api/axiosClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadSession = useCallback(async () => {
    try {
      const token = localStorage.getItem('hospital_dfa_token');
      if (!token) {
        setLoading(false);
        return;
      }
      const res = await axiosClient.get('/auth/me');
      setUser(res.data.data.user);
    } catch {
      try {
        localStorage.removeItem('hospital_dfa_token');
      } catch {
        // Ignore storage error
      }
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const login = async (email, password) => {
    const res = await axiosClient.post('/auth/login', { email, password });
    const { token, user: loggedInUser } = res.data.data;
    try {
      localStorage.setItem('hospital_dfa_token', token);
    } catch {
      // Ignore storage error
    }
    setUser(loggedInUser);
    return loggedInUser;
  };

  const registerPatient = async (payload) => {
    const res = await axiosClient.post('/auth/register', payload);
    const { token, user: createdUser } = res.data.data;
    try {
      localStorage.setItem('hospital_dfa_token', token);
    } catch {
      // Ignore storage error
    }
    setUser(createdUser);
    return createdUser;
  };

  const logout = async () => {
    try {
      await axiosClient.post('/auth/logout');
    } catch {
      // Ignore logout network error
    } finally {
      try {
        localStorage.removeItem('hospital_dfa_token');
      } catch {
        // Ignore storage error
      }
      setUser(null);
    }
  };

  const updateProfile = async (payload) => {
    const res = await axiosClient.put('/auth/profile', payload);
    const updatedUser = res.data.data.user;
    setUser((prev) => ({ ...prev, ...updatedUser }));
    return updatedUser;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: Boolean(user),
        login,
        registerPatient,
        logout,
        updateProfile,
        refreshUser: loadSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside an AuthProvider');
  }
  return ctx;
}

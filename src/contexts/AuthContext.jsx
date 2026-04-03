import React, { createContext, useState, useEffect, useContext } from 'react';

const AuthContext = createContext({});

// Mock users - matching the credentials shown in the login screen
const MOCK_USERS = {
  admin: {
    id: 'mock-admin-uuid-001',
    email: 'admin@sentimentanalyzer.com',
    username: 'admin',
    password: 'admin123',
    full_name: 'Admin User',
    role: 'admin',
    is_active: true,
  },
  agent: {
    id: 'mock-agent-uuid-002',
    email: 'agent@sentimentanalyzer.com',
    username: 'agent',
    password: 'agent123',
    full_name: 'Agent User',
    role: 'agent',
    is_active: true,
  },
};

const SESSION_KEY = 'csa_auth_session';

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore session from localStorage on mount
    try {
      const stored = localStorage.getItem(SESSION_KEY);
      if (stored) {
        const session = JSON.parse(stored);
        setUser(session.user);
        setProfile(session.profile);
      }
    } catch (e) {
      localStorage.removeItem(SESSION_KEY);
    } finally {
      setLoading(false);
    }
  }, []);

  const signIn = async (username, password) => {
    // Simulate async delay
    await new Promise((resolve) => setTimeout(resolve, 400));

    const mockUser = MOCK_USERS[username?.toLowerCase()?.trim()];

    if (!mockUser) {
      throw new Error('اسم المستخدم غير موجود. استخدم: admin أو agent');
    }

    if (mockUser.password !== password) {
      throw new Error('كلمة المرور غير صحيحة. يرجى المحاولة مرة أخرى.');
    }

    if (!mockUser.is_active) {
      throw new Error('هذا الحساب غير نشط. تواصل مع المسؤول.');
    }

    const userObj = {
      id: mockUser.id,
      email: mockUser.email,
      username: mockUser.username,
    };

    const profileObj = {
      id: mockUser.id,
      email: mockUser.email,
      full_name: mockUser.full_name,
      role: mockUser.role,
      is_active: mockUser.is_active,
    };

    // Persist session
    localStorage.setItem(SESSION_KEY, JSON.stringify({ user: userObj, profile: profileObj }));

    setUser(userObj);
    setProfile(profileObj);

    return { user: userObj, profile: profileObj };
  };

  const signOut = async () => {
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
    setProfile(null);
  };

  const value = {
    user,
    profile,
    loading,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
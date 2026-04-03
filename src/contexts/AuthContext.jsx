import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

// ── Map Supabase English errors → Arabic messages ─────────────────────────────
function toArabicError(msg = '') {
  if (msg.includes('Invalid login credentials'))  return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
  if (msg.includes('Email not confirmed'))         return 'يرجى تأكيد البريد الإلكتروني أولاً.';
  if (msg.includes('Too many requests'))           return 'تم تجاوز عدد المحاولات. انتظر قليلاً ثم أعد المحاولة.';
  if (msg.includes('User not found'))              return 'المستخدم غير موجود.';
  if (msg.includes('disabled'))                    return 'هذا الحساب معطّل. تواصل مع المسؤول.';
  return msg;
}

export const AuthProvider = ({ children }) => {
  const [user,    setUser]    = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // ── Fetch profile from user_profiles ─────────────────────────────────────
  const fetchProfile = async (userId) => {
    if (!userId) return null;
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, email, username, full_name, role, is_active, avatar_url')
      .eq('id', userId)
      .single();

    if (error) {
      console.warn('Could not fetch user profile:', error.message);
      return null;
    }

    // Reject inactive users
    if (data && !data.is_active) {
      await supabase.auth.signOut();
      throw new Error('هذا الحساب غير نشط. تواصل مع المسؤول.');
    }

    return data;
  };

  // ── Restore session on mount ──────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      if (session?.user) {
        setUser(session.user);
        const prof = await fetchProfile(session.user.id);
        if (mounted) setProfile(prof);
      }
      if (mounted) setLoading(false);
    });

    // Listen for sign-in / sign-out / token refresh events
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user);
          const prof = await fetchProfile(session.user.id);
          if (mounted) setProfile(prof);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setProfile(null);
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          setUser(session.user);
        }

        if (mounted) setLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []); // eslint-disable-line

  // ── Sign In ───────────────────────────────────────────────────────────────
  const signIn = async (email, password) => {
    if (!email?.trim() || !password) {
      throw new Error('يرجى إدخال البريد الإلكتروني وكلمة المرور.');
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email:    email.trim().toLowerCase(),
      password,
    });

    if (error) throw new Error(toArabicError(error.message));

    // Profile is set automatically via onAuthStateChange listener
    return data;
  };

  // ── Sign Out ──────────────────────────────────────────────────────────────
  const signOut = async () => {
    await supabase.auth.signOut();
    // State cleared by onAuthStateChange listener
  };

  const value = { user, profile, loading, signIn, signOut };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
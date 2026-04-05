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

// ── Fetch user profile — always resolves, never rejects ──────────────────────
async function fetchProfile(userId) {
  if (!userId) return null;
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, email, username, full_name, role, is_active, avatar_url')
      .eq('id', userId)
      .single();

    if (error) {
      console.warn('Profile fetch error:', error.message);
      return null;
    }
    if (data && !data.is_active) {
      console.warn('Inactive user — signing out.');
      supabase.auth.signOut(); // fire and forget
      return null;
    }
    return data ?? null;
  } catch (err) {
    console.warn('fetchProfile unexpected error:', err.message);
    return null;
  }
}

export const AuthProvider = ({ children }) => {
  const [user,    setUser]    = useState(undefined); // undefined = not yet determined
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // getSession() gives us the current session synchronously from storage.
    // We call it once on mount, then listen for changes.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      if (session?.user) {
        setUser(session.user);
        fetchProfile(session.user.id).then(prof => {
          if (mounted) {
            setProfile(prof);
            setLoading(false);
          }
        });
      } else {
        setUser(null);
        setLoading(false);
      }
    }).catch(() => {
      if (mounted) {
        setUser(null);
        setLoading(false);
      }
    });

    // Only handle SIGNED_OUT and TOKEN_REFRESHED here.
    // SIGNED_IN after signInWithPassword is handled by the navigate() in login page.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;

        if (event === 'SIGNED_OUT') {
          setUser(null);
          setProfile(null);
          setLoading(false);
        } else if (event === 'SIGNED_IN' && session?.user) {
          // Update user state; profile already set by getSession or will load momentarily
          setUser(session.user);
          fetchProfile(session.user.id).then(prof => {
            if (mounted) {
              setProfile(prof);
              setLoading(false);
            }
          });
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          setUser(session.user);
          // Don't touch loading or profile — just keep existing state
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

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

    // ── Check if the account is active BEFORE allowing navigation ────────────
    if (data?.user) {
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('is_active')
        .eq('id', data.user.id)
        .single();

      if (!profileError && profileData && !profileData.is_active) {
        // Sign the user back out silently and raise a friendly Arabic error
        await supabase.auth.signOut();
        throw new Error('هذا الحساب معطّل. يرجى التواصل مع المسؤول.');
      }

      // ── Record last login timestamp ─────────────────────────────────────────
      // Fire-and-forget: don't block login if this update fails
      supabase
        .from('user_profiles')
        .update({ last_login: new Date().toISOString() })
        .eq('id', data.user.id)
        .then(({ error: updateErr }) => {
          if (updateErr) console.warn('last_login update failed:', updateErr.message);
        });
    }

    return data;
  };

  // ── Update Profile (name, avatar_url) ──────────────────────────────────────
  const updateProfile = async (updates) => {
    if (!user?.id) throw new Error('لا يوجد مستخدم مسجّل الدخول.');

    const allowed = ['full_name', 'avatar_url'];
    const payload = Object.fromEntries(
      Object.entries(updates).filter(([k]) => allowed.includes(k))
    );

    const { error } = await supabase
      .from('user_profiles')
      .update(payload)
      .eq('id', user.id);

    if (error) throw new Error(error.message);

    // Refresh local profile state
    setProfile(prev => prev ? { ...prev, ...payload } : prev);
  };

  // ── Sign Out ─────────────────────────────────────────────────────────────────
  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const value = { user, profile, loading, signIn, signOut, updateProfile };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
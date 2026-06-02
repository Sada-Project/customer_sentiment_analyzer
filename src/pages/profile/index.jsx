import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/ui/Header';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import Icon from '../../components/AppIcon';

// ── Avatar presets ─────────────────────────────────────────────────────────────
const BASE = 'https://api.dicebear.com/9.x/micah/svg';
const SKIN = 'f2d3b1';

const AVATAR_PRESETS = [
  { url: `${BASE}?seed=Alex&skinColor=${SKIN}&backgroundColor=b6e3f4&hair=fonze&mouth=smile` },
  { url: `${BASE}?seed=Emma&skinColor=${SKIN}&backgroundColor=c0aede&hair=dannyPhantom&mouth=smile` },
  { url: `${BASE}?seed=Carlos&skinColor=${SKIN}&backgroundColor=d1d4f9&hair=mrT&mouth=smile` },
  { url: `${BASE}?seed=Layla&skinColor=${SKIN}&backgroundColor=ffd5dc&hair=full&mouth=smile` },
  { url: `${BASE}?seed=James&skinColor=${SKIN}&backgroundColor=b6e3f4&hair=dougFunny&mouth=smile` },
  { url: `${BASE}?seed=Amina&skinColor=${SKIN}&backgroundColor=ffdfbf&hair=full&mouth=smile` },
  { url: `${BASE}?seed=Omar&skinColor=${SKIN}&backgroundColor=c0aede&hair=fonze&mouth=smile` },
  { url: `${BASE}?seed=Sofia&skinColor=${SKIN}&backgroundColor=d1d4f9&hair=dannyPhantom&mouth=smile` },
  { url: `${BASE}?seed=Marcus&skinColor=${SKIN}&backgroundColor=ffd5dc&hair=mrT&mouth=smile` },
  { url: `${BASE}?seed=Nadia&skinColor=${SKIN}&backgroundColor=b6e3f4&hair=full&mouth=smile` },
  { url: `${BASE}?seed=Kofi&skinColor=${SKIN}&backgroundColor=d1d4f9&hair=dannyPhantom&mouth=smile` },
  { url: `${BASE}?seed=Priya&skinColor=${SKIN}&backgroundColor=ffdfbf&hair=dougFunny&mouth=smile` },
];

// ── Toast ──────────────────────────────────────────────────────────────────────
const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  const styles = {
    success: 'bg-emerald-950/95 border-emerald-500/40 text-emerald-300',
    error:   'bg-red-950/95 border-red-500/40 text-red-300',
  };
  const icons = { success: 'CheckCircle', error: 'AlertTriangle' };

  return (
    <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-3 px-6 py-4 rounded-xl border shadow-2xl backdrop-blur-sm min-w-[320px] ${styles[type] ?? styles.success} animate-in slide-in-from-top-4 duration-300`}>
      <Icon name={icons[type] ?? 'CheckCircle'} size={20} />
      <p className="flex-1 text-base font-medium">{message}</p>
      <button onClick={onClose} className="opacity-60 hover:opacity-100 text-xl leading-none">×</button>
    </div>
  );
};

// ── Password strength helper ───────────────────────────────────────────────────
const getStrength = (pwd) => [
  pwd.length >= 8,
  /[A-Z]/.test(pwd),
  /[0-9]/.test(pwd),
  /[^A-Za-z0-9]/.test(pwd),
].filter(Boolean).length;

const STRENGTH_LABELS = ['', 'Very Weak', 'Weak', 'Medium', 'Strong'];
const STRENGTH_COLORS = ['', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-emerald-500'];
const STRENGTH_TEXT   = ['', 'text-red-400', 'text-orange-400', 'text-yellow-400', 'text-emerald-400'];

// ── Main Profile Page ──────────────────────────────────────────────────────────
const ProfilePage = () => {
  const { profile, updateProfile } = useAuth();
  const navigate = useNavigate();

  const [nameForm,  setNameForm]  = useState({ full_name: profile?.full_name || '' });
  const [nameErrors, setNameErrors] = useState({});
  const [nameSaving, setNameSaving] = useState(false);

  const [pwdForm,  setPwdForm]  = useState({ new: '', confirm: '' });
  const [pwdErrors, setPwdErrors] = useState({});
  const [pwdSaving, setPwdSaving] = useState(false);
  const [showPwd, setShowPwd]   = useState({ new: false, confirm: false });

  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const fileInputRef = useRef(null);

  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'success') => setToast({ message, type });

  const [activeTab, setActiveTab] = useState('info'); // 'info' | 'security'

  useEffect(() => {
    if (profile) {
      setNameForm({ full_name: profile.full_name || '' });
      setAvatarUrl(profile.avatar_url || '');
    }
  }, [profile]);

  const displayAvatar = avatarUrl || `${BASE}?seed=${encodeURIComponent(profile?.email || 'user')}&skinColor=d4a574&backgroundColor=b6e3f4`;

  const roleLabel = profile?.role === 'admin' ? 'System Admin' : 'Agent';
  const isAdmin   = profile?.role === 'admin';

  // ── Save Name ─────────────────────────────────────────────────────────────────
  const handleSaveName = async (e) => {
    e?.preventDefault();
    const errors = {};
    if (!nameForm.full_name.trim())          errors.full_name = 'Name is required';
    if (nameForm.full_name.trim().length < 2) errors.full_name = 'Name is too short';
    setNameErrors(errors);
    if (Object.keys(errors).length) return;

    setNameSaving(true);
    try {
      await updateProfile({ full_name: nameForm.full_name.trim() });
      showToast('Name updated successfully ✓');
    } catch (err) {
      showToast(err.message || 'Failed to update name', 'error');
    } finally {
      setNameSaving(false);
    }
  };

  // ── Save Password ─────────────────────────────────────────────────────────────
  const handleSavePassword = async (e) => {
    e?.preventDefault();
    const errors = {};
    if (!pwdForm.new)                         errors.new = 'New password is required';
    if (pwdForm.new && pwdForm.new.length < 8) errors.new = 'Must be at least 8 characters';
    if (pwdForm.new !== pwdForm.confirm)       errors.confirm = 'Passwords do not match';
    setPwdErrors(errors);
    if (Object.keys(errors).length) return;

    setPwdSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pwdForm.new });
      if (error) throw error;
      setPwdForm({ new: '', confirm: '' });
      showToast('Password changed successfully ✓');
    } catch (err) {
      showToast(err.message || 'Failed to change password', 'error');
    } finally {
      setPwdSaving(false);
    }
  };

  // ── Avatar ────────────────────────────────────────────────────────────────────
  const handleSelectAvatar = async (url) => {
    setAvatarUrl(url);
    setShowAvatarPicker(false);
    setAvatarSaving(true);
    try {
      await updateProfile({ avatar_url: url });
      showToast('Profile picture updated ✓');
    } catch (err) {
      showToast(err.message || 'Something went wrong', 'error');
    } finally {
      setAvatarSaving(false);
    }
  };

  const handleUploadPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { showToast('Please select an image file.', 'error'); return; }
    if (file.size > 2 * 1024 * 1024)     { showToast('Image must be smaller than 2 MB.', 'error'); return; }

    setAvatarSaving(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target.result;
      setAvatarUrl(dataUrl);
      setShowAvatarPicker(false);
      try {
        await updateProfile({ avatar_url: dataUrl });
        showToast('Profile picture updated ✓');
      } catch (err) {
        showToast(err.message || 'Upload failed', 'error');
      } finally {
        setAvatarSaving(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  const strength = getStrength(pwdForm.new);

  return (
    <>
      <Header />

      <main className="pt-16 min-h-screen bg-background">

        {/* ── Hero Banner ───────────────────────────────────────────── */}
        <div
          className="relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, hsl(230 60% 12%) 0%, hsl(260 50% 16%) 50%, hsl(280 45% 14%) 100%)',
          }}
        >
          {/* Decorative blobs */}
          <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full opacity-20"
               style={{ background: 'radial-gradient(circle, hsl(260 80% 60%), transparent 70%)' }} />
          <div className="absolute -bottom-16 right-0 w-72 h-72 rounded-full opacity-15"
               style={{ background: 'radial-gradient(circle, hsl(200 80% 55%), transparent 70%)' }} />

          <div className="relative container mx-auto px-4 py-10 max-w-3xl">
            <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6">

              {/* Avatar with gradient ring */}
              <div className="relative flex-shrink-0">
                <div className="p-1 rounded-full"
                     style={{ background: 'linear-gradient(135deg, hsl(260 80% 65%), hsl(200 80% 60%))' }}>
                  <div className="p-0.5 rounded-full bg-background/10">
                    <img
                      src={displayAvatar}
                      alt="Profile"
                      className="w-28 h-28 rounded-full object-cover border-4 bg-muted"
                      style={{ borderColor: 'hsl(230 60% 12%)' }}
                    />
                  </div>
                </div>

                {/* Loading overlay */}
                {avatarSaving && (
                  <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                    <Icon name="Loader2" size={24} className="text-white animate-spin" />
                  </div>
                )}

                {/* Change photo button */}
                <button
                  onClick={() => setShowAvatarPicker(!showAvatarPicker)}
                  className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full flex items-center justify-center border-2 border-background shadow-lg transition-transform hover:scale-110"
                  style={{ background: 'linear-gradient(135deg, hsl(260 80% 65%), hsl(200 80% 60%))' }}
                  title="Change photo"
                >
                  <Icon name="Camera" size={16} className="text-white" />
                </button>
              </div>

              {/* Name + meta */}
              <div className="flex-1 text-center sm:text-left pb-1">
                <h1 className="text-3xl font-bold text-white leading-tight">
                  {profile?.full_name || 'Your Name'}
                </h1>
                <p className="text-slate-300 mt-1 text-sm">{profile?.email}</p>
                <div className="flex items-center gap-2 mt-3 justify-center sm:justify-start flex-wrap">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                    isAdmin
                      ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  }`}>
                    <Icon name={isAdmin ? 'ShieldCheck' : 'Headphones'} size={12} />
                    {roleLabel}
                  </span>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                    profile?.is_active
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : 'bg-slate-500/20 text-slate-400 border-slate-500/30'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${profile?.is_active ? 'bg-emerald-400' : 'bg-slate-400'}`} />
                    {profile?.is_active ? 'Active' : 'Inactive'}
                  </span>
                  {profile?.created_at && (
                    <span className="text-slate-400 text-xs">
                      Member since {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Avatar Picker Dropdown ────────────────────────────────── */}
        {showAvatarPicker && (
          <div className="container mx-auto px-4 max-w-3xl -mt-1">
            <div className="bg-card border border-border rounded-xl p-5 shadow-2xl">
              <p className="text-sm font-semibold text-foreground mb-4">Choose an avatar or upload your photo</p>
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-3">
                {/* Upload tile */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="relative p-1 rounded-xl border-2 border-dashed border-primary/50 hover:border-primary hover:bg-primary/5 transition-all hover:scale-105 aspect-square flex flex-col items-center justify-center gap-1"
                >
                  <Icon name="Upload" size={18} className="text-primary/70" />
                  <span className="text-[9px] text-primary/70 font-medium text-center leading-tight">Upload<br/>Photo</span>
                </button>
                {AVATAR_PRESETS.map(({ url }, i) => (
                  <button
                    key={i}
                    onClick={() => handleSelectAvatar(url)}
                    className={`relative p-0.5 rounded-xl border-2 transition-all hover:scale-105 overflow-hidden ${
                      avatarUrl === url
                        ? 'border-primary ring-2 ring-primary/40'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <img src={url} alt="avatar" className="w-full aspect-square rounded-lg object-cover" />
                    {avatarUrl === url && (
                      <div className="absolute top-1 right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center shadow">
                        <Icon name="Check" size={10} className="text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowAvatarPicker(false)}
                className="mt-4 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUploadPhoto} />

        {/* ── Tab Bar ───────────────────────────────────────────────── */}
        <div className="container mx-auto px-4 max-w-3xl mt-6">
          <div className="flex gap-1 p-1 bg-muted/40 rounded-xl border border-border w-fit">
            {[
              { id: 'info',     icon: 'User',    label: 'Profile Info' },
              { id: 'security', icon: 'Lock',    label: 'Security' },
              { id: 'account',  icon: 'Info',    label: 'Account' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-card border border-border text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon name={tab.icon} size={15} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Tab Content ───────────────────────────────────────────── */}
        <div className="container mx-auto px-4 max-w-3xl mt-4 pb-16">

          {/* ════ PROFILE INFO TAB ════ */}
          {activeTab === 'info' && (
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
              <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-muted/20">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon name="User" size={18} color="var(--color-primary)" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-foreground">Edit Profile</h2>
                  <p className="text-xs text-muted-foreground">Update your display name</p>
                </div>
              </div>

              <form onSubmit={handleSaveName} className="px-6 py-6 space-y-5">
                {/* Full Name */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Full Name <span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      <Icon name="User" size={16} />
                    </div>
                    <input
                      type="text"
                      value={nameForm.full_name}
                      onChange={e => {
                        setNameForm({ full_name: e.target.value });
                        if (nameErrors.full_name) setNameErrors({});
                      }}
                      placeholder="Enter your full name"
                      className="w-full pl-10 pr-4 py-3 bg-input border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-sm"
                    />
                  </div>
                  {nameErrors.full_name && (
                    <p className="mt-1.5 text-xs text-destructive flex items-center gap-1">
                      <Icon name="AlertCircle" size={12} /> {nameErrors.full_name}
                    </p>
                  )}
                </div>

                {/* Email (read-only) */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      <Icon name="Mail" size={16} />
                    </div>
                    <input
                      type="email"
                      value={profile?.email || ''}
                      readOnly
                      className="w-full pl-10 pr-4 py-3 bg-muted/30 border border-border rounded-xl text-muted-foreground text-sm cursor-not-allowed"
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">Email address cannot be changed here.</p>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={nameSaving || nameForm.full_name.trim() === (profile?.full_name || '')}
                    className="inline-flex items-center gap-2 px-6 py-2.5 text-sm rounded-xl font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: 'linear-gradient(135deg, hsl(260 80% 60%), hsl(220 80% 55%))', color: 'white' }}
                  >
                    {nameSaving
                      ? <><Icon name="Loader2" size={16} className="animate-spin" /> Saving…</>
                      : <><Icon name="Save" size={16} /> Save Changes</>
                    }
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ════ SECURITY TAB ════ */}
          {activeTab === 'security' && (
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
              <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-muted/20">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon name="Lock" size={18} color="var(--color-primary)" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-foreground">Change Password</h2>
                  <p className="text-xs text-muted-foreground">Keep your account secure with a strong password</p>
                </div>
              </div>

              <form onSubmit={handleSavePassword} className="px-6 py-6 space-y-5">

                {/* New Password */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    New Password <span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      <Icon name="Lock" size={16} />
                    </div>
                    <input
                      type={showPwd.new ? 'text' : 'password'}
                      value={pwdForm.new}
                      onChange={e => { setPwdForm(p => ({ ...p, new: e.target.value })); if (pwdErrors.new) setPwdErrors(p => ({ ...p, new: '' })); }}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-12 py-3 bg-input border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-sm"
                    />
                    <button type="button" onClick={() => setShowPwd(p => ({ ...p, new: !p.new }))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      <Icon name={showPwd.new ? 'EyeOff' : 'Eye'} size={16} />
                    </button>
                  </div>
                  {pwdErrors.new && (
                    <p className="mt-1.5 text-xs text-destructive flex items-center gap-1">
                      <Icon name="AlertCircle" size={12} /> {pwdErrors.new}
                    </p>
                  )}

                  {/* Strength bar */}
                  {pwdForm.new && (
                    <div className="mt-3">
                      <div className="flex gap-1.5 mb-1.5">
                        {[1,2,3,4].map(i => (
                          <div
                            key={i}
                            className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                              i <= strength ? STRENGTH_COLORS[strength] : 'bg-border'
                            }`}
                          />
                        ))}
                      </div>
                      <p className={`text-xs font-medium ${STRENGTH_TEXT[strength] || 'text-muted-foreground'}`}>
                        {STRENGTH_LABELS[strength] || ''}
                      </p>
                    </div>
                  )}
                  <p className="mt-1.5 text-xs text-muted-foreground">Must be at least 8 characters</p>
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Confirm New Password <span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      <Icon name="ShieldCheck" size={16} />
                    </div>
                    <input
                      type={showPwd.confirm ? 'text' : 'password'}
                      value={pwdForm.confirm}
                      onChange={e => { setPwdForm(p => ({ ...p, confirm: e.target.value })); if (pwdErrors.confirm) setPwdErrors(p => ({ ...p, confirm: '' })); }}
                      placeholder="••••••••"
                      className={`w-full pl-10 pr-12 py-3 bg-input border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-sm ${
                        pwdForm.confirm && pwdForm.new === pwdForm.confirm
                          ? 'border-emerald-500/50'
                          : 'border-border'
                      }`}
                    />
                    <button type="button" onClick={() => setShowPwd(p => ({ ...p, confirm: !p.confirm }))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      <Icon name={showPwd.confirm ? 'EyeOff' : 'Eye'} size={16} />
                    </button>
                    {pwdForm.confirm && pwdForm.new === pwdForm.confirm && (
                      <div className="absolute right-10 top-1/2 -translate-y-1/2 text-emerald-500">
                        <Icon name="Check" size={16} />
                      </div>
                    )}
                  </div>
                  {pwdErrors.confirm && (
                    <p className="mt-1.5 text-xs text-destructive flex items-center gap-1">
                      <Icon name="AlertCircle" size={12} /> {pwdErrors.confirm}
                    </p>
                  )}
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={pwdSaving || !pwdForm.new || !pwdForm.confirm}
                    className="inline-flex items-center gap-2 px-6 py-2.5 text-sm rounded-xl font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: 'linear-gradient(135deg, hsl(260 80% 60%), hsl(220 80% 55%))', color: 'white' }}
                  >
                    {pwdSaving
                      ? <><Icon name="Loader2" size={16} className="animate-spin" /> Changing…</>
                      : <><Icon name="Shield" size={16} /> Update Password</>
                    }
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ════ ACCOUNT INFO TAB ════ */}
          {activeTab === 'account' && (
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
              <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-muted/20">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon name="Info" size={18} color="var(--color-primary)" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-foreground">Account Information</h2>
                  <p className="text-xs text-muted-foreground">Your account details and access level</p>
                </div>
              </div>

              <div className="px-6 py-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { icon: 'Mail',      label: 'Email Address', value: profile?.email },
                    { icon: 'Shield',    label: 'Role',          value: roleLabel },
                    { icon: 'Activity', label: 'Account Status', value: profile?.is_active ? 'Active' : 'Inactive',
                      badge: profile?.is_active ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-slate-400 bg-slate-500/10 border-slate-500/20' },
                    { icon: 'Calendar', label: 'Member Since',
                      value: profile?.created_at
                        ? new Date(profile.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                        : '—' },
                    { icon: 'Clock', label: 'Last Sign In',
                      value: profile?.last_login
                        ? new Date(profile.last_login).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                        : 'Never' },
                    { icon: 'Building2', label: 'Department',    value: profile?.department_code || 'Not assigned' },
                  ].map(({ icon, label, value, badge }) => (
                    <div key={label} className="flex items-start gap-3 p-4 bg-muted/30 rounded-xl border border-border/50">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Icon name={icon} size={15} color="var(--color-primary)" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
                        {badge ? (
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${badge}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${profile?.is_active ? 'bg-emerald-400' : 'bg-slate-400'}`} />
                            {value}
                          </span>
                        ) : (
                          <p className="text-foreground font-medium text-sm truncate">{value || '—'}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
};

export default ProfilePage;

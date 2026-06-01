import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/ui/Header';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import Icon from '../../components/AppIcon';

// ── Avatar options — same warm light skin tone, varied hair & background ─────
// skinColor=f2d3b1 matches the reference image (warm peach/fair complexion)
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



// ── Small reusable toast ───────────────────────────────────────────────────────
const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  const styles = {
    success: 'bg-emerald-950/95 border-emerald-500/40 text-emerald-300',
    error:   'bg-red-950/95 border-red-500/40 text-red-300',
  };
  const icons = {
    success: 'CheckCircle',
    error:   'AlertTriangle',
  };

  return (
    <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-3 px-6 py-4 rounded-xl border shadow-2xl backdrop-blur-sm min-w-[320px] ${styles[type] ?? styles.success} animate-in slide-in-from-top-4 duration-300`}>
      <Icon name={icons[type] ?? 'CheckCircle'} size={20} />
      <p className="flex-1 text-base font-medium">{message}</p>
      <button onClick={onClose} className="opacity-60 hover:opacity-100 text-xl leading-none">×</button>
    </div>
  );
};

// ── Section card wrapper ───────────────────────────────────────────────────────
const Section = ({ icon, title, children }) => (
  <div className="bg-card border border-border rounded-2xl overflow-hidden">
    <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-muted/20">
      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
        <Icon name={icon} size={18} color="var(--color-primary)" />
      </div>
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
    </div>
    <div className="px-6 py-5">{children}</div>
  </div>
);

// ── Input field ───────────────────────────────────────────────────────────────
const Field = ({ label, required, error, children }) => (
  <div>
    <label className="block text-sm font-medium text-foreground mb-1.5">
      {label} {required && <span className="text-destructive">*</span>}
    </label>
    {children}
    {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
  </div>
);

const Input = ({ className = '', ...props }) => (
  <input
    className={`w-full px-3 py-2.5 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-sm ${className}`}
    {...props}
  />
);

// ── Main Profile Page ─────────────────────────────────────────────────────────
const ProfilePage = () => {
  const { profile, updateProfile } = useAuth();
  const navigate = useNavigate();

  // ── Name form state ──────────────────────────────────────────────────────────
  const [nameForm, setNameForm]         = useState({ full_name: profile?.full_name || '' });
  const [nameErrors, setNameErrors]     = useState({});
  const [nameSaving, setNameSaving]     = useState(false);

  // ── Password form state ──────────────────────────────────────────────────────
  const [pwdForm, setPwdForm]           = useState({ current: '', new: '', confirm: '' });
  const [pwdErrors, setPwdErrors]       = useState({});
  const [pwdSaving, setPwdSaving]       = useState(false);
  const [showPwd, setShowPwd]           = useState({ current: false, new: false, confirm: false });

  // ── Avatar state ─────────────────────────────────────────────────────────────
  const [avatarUrl, setAvatarUrl]       = useState(profile?.avatar_url || '');
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const fileInputRef                    = useRef(null);

  // ── Toast ────────────────────────────────────────────────────────────────────
  const [toast, setToast]               = useState(null);
  const showToast = (message, type = 'success') => setToast({ message, type });

  // Sync when profile loads
  useEffect(() => {
    if (profile) {
      setNameForm({ full_name: profile.full_name || '' });
      setAvatarUrl(profile.avatar_url || '');
    }
  }, [profile]);

  // ── Derived avatar display ───────────────────────────────────────────────────
  const displayAvatar = avatarUrl || `${BASE}?seed=${encodeURIComponent(profile?.email || 'user')}&skinColor=d4a574&backgroundColor=b6e3f4`;

  // ── Save Name ────────────────────────────────────────────────────────────────
  const handleSaveName = async (e) => {
    e?.preventDefault();
    const errors = {};
    if (!nameForm.full_name.trim()) errors.full_name = 'Name is required';
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

  // ── Save Password ────────────────────────────────────────────────────────────
  const handleSavePassword = async (e) => {
    e?.preventDefault();
    const errors = {};
    if (!pwdForm.new) errors.new = 'New password is required';
    if (pwdForm.new && pwdForm.new.length < 8) errors.new = 'Must be at least 8 characters';
    if (pwdForm.new !== pwdForm.confirm) errors.confirm = 'Passwords do not match';
    setPwdErrors(errors);
    if (Object.keys(errors).length) return;

    setPwdSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pwdForm.new });
      if (error) throw error;
      setPwdForm({ current: '', new: '', confirm: '' });
      showToast('Password changed successfully ✓');
    } catch (err) {
      showToast(err.message || 'Failed to change password', 'error');
    } finally {
      setPwdSaving(false);
    }
  };

  // ── Save Avatar (preset) ─────────────────────────────────────────────────────
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

  // ── Upload custom photo ───────────────────────────────────────────────────────
  const handleUploadPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate: image only, max 2 MB
    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file.', 'error');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showToast('Image must be smaller than 2 MB.', 'error');
      return;
    }

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
        // Reset so the same file can be picked again
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  const roleLabel = profile?.role === 'admin' ? 'System Admin' : 'Agent';
  const roleBadge = profile?.role === 'admin'
    ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
    : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';

  return (
    <>
      <Header />

      <main className="pt-16 min-h-screen bg-background">
        <div className="container mx-auto px-4 py-10 max-w-2xl">

          {/* ── Page title ── */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground">My Profile</h1>
            <p className="text-muted-foreground mt-1">Manage your personal information and security settings</p>
          </div>

          <div className="flex flex-col gap-6">

            {/* ════════════════════ AVATAR SECTION ════════════════════ */}
            <Section icon="UserCircle" title="Profile Picture">
              <div className="flex items-center gap-6">
                {/* Current avatar */}
                <div className="relative">
                  <img
                    src={displayAvatar}
                    alt="Profile picture"
                    className="w-24 h-24 rounded-full object-cover border-4 border-border shadow-md bg-muted"
                  />
                  {avatarSaving && (
                    <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                      <Icon name="Loader2" size={24} className="text-white animate-spin" />
                    </div>
                  )}
                </div>

                {/* Info + button */}
                <div className="flex-1">
                  <p className="text-foreground font-semibold text-lg">{profile?.full_name || '—'}</p>
                  <p className="text-muted-foreground text-sm mb-1">{profile?.email}</p>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${roleBadge}`}>
                    {roleLabel}
                  </span>
                  <div className="mt-3">
                    <button
                      onClick={() => setShowAvatarPicker(!showAvatarPicker)}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium"
                    >
                      <Icon name="ImagePlus" size={16} />
                      Change Photo
                    </button>
                  </div>
                </div>
              </div>

              {/* Hidden file input for photo upload */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleUploadPhoto}
              />

              {/* Avatar picker grid */}
              {showAvatarPicker && (
                <div className="mt-5 pt-5 border-t border-border">
                  <p className="text-sm font-medium text-foreground mb-4">Choose an avatar or upload your photo:</p>
                  <div className="grid grid-cols-4 gap-3">

                    {/* Upload your own photo tile — always first */}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="relative p-1 rounded-xl border-2 border-dashed border-primary/50 hover:border-primary hover:bg-primary/5 transition-all hover:scale-105 aspect-square flex flex-col items-center justify-center gap-1.5"
                    >
                      <Icon name="Upload" size={20} className="text-primary/70" />
                      <span className="text-[10px] text-primary/70 font-medium text-center leading-tight">Upload<br/>Photo</span>
                    </button>

                    {/* Preset avatars */}
                    {AVATAR_PRESETS.map(({ url }, i) => (
                      <button
                        key={i}
                        onClick={() => handleSelectAvatar(url)}
                        className={`relative p-1 rounded-xl border-2 transition-all hover:scale-105 overflow-hidden ${
                          avatarUrl === url
                            ? 'border-primary ring-2 ring-primary/40 bg-primary/5'
                            : 'border-border hover:border-primary/50 hover:bg-muted/30'
                        }`}
                      >
                        <img
                          src={url}
                          alt="avatar"
                          className="w-full aspect-square rounded-lg object-cover"
                        />
                        {avatarUrl === url && (
                          <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-primary rounded-full flex items-center justify-center shadow">
                            <Icon name="Check" size={12} className="text-white" />
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
              )}
            </Section>

            {/* ════════════════════ NAME SECTION ════════════════════ */}
            <Section icon="User" title="Edit Name">
              <form onSubmit={handleSaveName} className="flex flex-col gap-4">
                <Field label="Full Name" required error={nameErrors.full_name}>
                  <Input
                    type="text"
                    value={nameForm.full_name}
                    onChange={e => {
                      setNameForm({ full_name: e.target.value });
                      if (nameErrors.full_name) setNameErrors({});
                    }}
                    placeholder="Enter your full name"
                  />
                </Field>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={nameSaving || nameForm.full_name.trim() === (profile?.full_name || '')}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {nameSaving ? <><Icon name="Loader2" size={16} className="animate-spin" /> Saving…</> : <><Icon name="Save" size={16} /> Save Name</>}
                  </button>
                </div>
              </form>
            </Section>

            {/* ════════════════════ PASSWORD SECTION ════════════════════ */}
            <Section icon="Lock" title="Change Password">
              <form onSubmit={handleSavePassword} className="flex flex-col gap-4">

                {/* New password */}
                <Field label="New Password" required error={pwdErrors.new}>
                  <div className="relative">
                    <Input
                      type={showPwd.new ? 'text' : 'password'}
                      value={pwdForm.new}
                      onChange={e => { setPwdForm(p => ({ ...p, new: e.target.value })); if (pwdErrors.new) setPwdErrors(p => ({ ...p, new: '' })); }}
                      placeholder="••••••••"
                      className="pr-10"
                    />
                    <button type="button" onClick={() => setShowPwd(p => ({ ...p, new: !p.new }))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      <Icon name={showPwd.new ? 'EyeOff' : 'Eye'} size={16} />
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Must be at least 8 characters</p>
                </Field>

                {/* Confirm password */}
                <Field label="Confirm New Password" required error={pwdErrors.confirm}>
                  <div className="relative">
                    <Input
                      type={showPwd.confirm ? 'text' : 'password'}
                      value={pwdForm.confirm}
                      onChange={e => { setPwdForm(p => ({ ...p, confirm: e.target.value })); if (pwdErrors.confirm) setPwdErrors(p => ({ ...p, confirm: '' })); }}
                      placeholder="••••••••"
                      className="pr-10"
                    />
                    <button type="button" onClick={() => setShowPwd(p => ({ ...p, confirm: !p.confirm }))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      <Icon name={showPwd.confirm ? 'EyeOff' : 'Eye'} size={16} />
                    </button>
                  </div>
                </Field>

                {/* Password strength indicator */}
                {pwdForm.new && (
                  <div>
                    <div className="flex gap-1 mb-1">
                      {[1,2,3,4].map(i => {
                        const strength = Math.min(4, [
                          pwdForm.new.length >= 8,
                          /[A-Z]/.test(pwdForm.new),
                          /[0-9]/.test(pwdForm.new),
                          /[^A-Za-z0-9]/.test(pwdForm.new),
                        ].filter(Boolean).length);
                        const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-emerald-500'];
                        return <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= strength ? colors[strength - 1] : 'bg-border'}`} />;
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {(() => {
                        const s = [pwdForm.new.length >= 8, /[A-Z]/.test(pwdForm.new), /[0-9]/.test(pwdForm.new), /[^A-Za-z0-9]/.test(pwdForm.new)].filter(Boolean).length;
                        return ['Very Weak', 'Weak', 'Medium', 'Strong'][s - 1] || '';
                      })()}
                    </p>
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={pwdSaving || !pwdForm.new || !pwdForm.confirm}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {pwdSaving ? <><Icon name="Loader2" size={16} className="animate-spin" /> Saving…</> : <><Icon name="Shield" size={16} /> Change Password</>}
                  </button>
                </div>
              </form>
            </Section>

            {/* ════════════════════ ACCOUNT INFO ════════════════════ */}
            <Section icon="Info" title="Account Information">
              <div className="grid grid-cols-2 gap-4 text-sm">
                {[
                  { label: 'Email', value: profile?.email },
                  { label: 'Role', value: roleLabel },
                  { label: 'Status', value: profile?.is_active ? 'Active' : 'Inactive' },
                  { label: 'Member Since', value: profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—' },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-muted/30 rounded-lg p-3">
                    <p className="text-muted-foreground text-xs mb-0.5">{label}</p>
                    <p className="text-foreground font-medium">{value || '—'}</p>
                  </div>
                ))}
              </div>
            </Section>

          </div>
        </div>
      </main>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
};

export default ProfilePage;

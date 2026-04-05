import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Header from '../../components/ui/Header';
import ActionToolbar from './components/ActionToolbar';
import UserTable from './components/UserTable';
import UserModal from './components/UserModal';
import { fetchUsers, toggleUserStatus, updateUser, inviteUser, deleteUser } from '../../services/adminUserService';

// ── Toast notification — top center, large & clear ────────────────────────────
const TOAST_ICONS = {
  success: (
    <svg className="w-6 h-6 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  error: (
    <svg className="w-6 h-6 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </svg>
  ),
  info: (
    <svg className="w-6 h-6 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z" />
    </svg>
  ),
};

const TOAST_STYLES = {
  success: {
    wrapper: 'bg-emerald-950/95 border-emerald-500/40 text-emerald-300',
    bar:     'bg-emerald-500',
    icon:    'text-emerald-400',
  },
  error: {
    wrapper: 'bg-red-950/95 border-red-500/40 text-red-300',
    bar:     'bg-red-500',
    icon:    'text-red-400',
  },
  info: {
    wrapper: 'bg-blue-950/95 border-blue-500/40 text-blue-300',
    bar:     'bg-blue-500',
    icon:    'text-blue-400',
  },
};

const DURATION = 5000;

const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const t = setTimeout(onClose, DURATION);
    return () => clearTimeout(t);
  }, [onClose]);

  const style = TOAST_STYLES[type] ?? TOAST_STYLES.info;

  return (
    <div
      className={`
        fixed top-20 left-1/2 -translate-x-1/2 z-[200]
        flex items-start gap-4
        px-6 py-4 rounded-xl border shadow-2xl backdrop-blur-sm
        min-w-[340px] max-w-[520px] w-max
        ${style.wrapper}
        animate-in slide-in-from-top-4 fade-in duration-300
      `}
    >
      {/* Icon */}
      <span className={`mt-0.5 ${style.icon}`}>{TOAST_ICONS[type] ?? TOAST_ICONS.info}</span>

      {/* Message */}
      <p className="flex-1 text-base font-medium leading-snug">{message}</p>

      {/* Close button */}
      <button
        onClick={onClose}
        className="mt-0.5 opacity-60 hover:opacity-100 transition-opacity text-xl leading-none"
        aria-label="إغلاق"
      >
        ×
      </button>

      {/* Auto-dismiss progress bar */}
      <span
        className={`absolute bottom-0 left-0 h-1 rounded-b-xl ${style.bar} opacity-60`}
        style={{ animation: `shrink ${DURATION}ms linear forwards` }}
      />

      <style>{`
        @keyframes shrink {
          from { width: 100%; }
          to   { width: 0%; }
        }
      `}</style>
    </div>
  );
};

// ── Confirmation Dialog ───────────────────────────────────────────────────────
const ConfirmDialog = ({ message, onConfirm, onCancel }) => (
  <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 backdrop-blur-sm">
    <div className="bg-card border border-border rounded-lg p-6 max-w-sm w-full shadow-xl mx-4">
      <p className="text-foreground text-sm mb-6">{message}</p>
      <div className="flex gap-3 justify-end">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm rounded-md border border-border text-muted-foreground hover:bg-muted transition-colors"
        >
          إلغاء
        </button>
        <button
          onClick={onConfirm}
          className="px-4 py-2 text-sm rounded-md bg-destructive text-white hover:bg-destructive/90 transition-colors"
        >
          تأكيد
        </button>
      </div>
    </div>
  </div>
);

const AdminUserManagement = () => {
  const [searchTerm,    setSearchTerm]    = useState('');
  const [selectedRole,  setSelectedRole]  = useState('all');
  const [isModalOpen,   setIsModalOpen]   = useState(false);
  const [selectedUser,  setSelectedUser]  = useState(null);
  const [users,         setUsers]         = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const [toast,         setToast]         = useState(null);
  const [confirm,       setConfirm]       = useState(null); // { message, onConfirm }

  const showToast = (message, type = 'info') => setToast({ message, type });
  const hideToast = () => setToast(null);

  // ── Fetch users ─────────────────────────────────────────────────────────────
  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchUsers({
        search: searchTerm || undefined,
        role: selectedRole !== 'all' ? selectedRole : undefined,
      });
      setUsers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, selectedRole]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  // ── Client-side filter for instant search feedback ──────────────────────────
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchesSearch =
        !searchTerm ||
        u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRole = selectedRole === 'all' || u.role === selectedRole;
      return matchesSearch && matchesRole;
    });
  }, [users, searchTerm, selectedRole]);

  const handleSearch     = (term) => setSearchTerm(term);
  const handleRoleFilter = (role) => setSelectedRole(role);
  const handleAddUser    = ()     => { setSelectedUser(null); setIsModalOpen(true); };
  const handleEditUser   = (user) => { setSelectedUser(user); setIsModalOpen(true); };

  // ── Permanently delete user (only available for inactive accounts) ───────────
  const handleDeleteUser = (userId) => {
    setConfirm({
      message: 'هل أنت متأكد من حذف هذا الحساب نهائياً؟ سيتم إزالته من النظام بشكل كامل ولا يمكن التراجع عن هذا الإجراء.',
      onConfirm: async () => {
        setConfirm(null);
        try {
          await deleteUser(userId);
          setUsers(prev => prev.filter(u => u.id !== userId));
          showToast('تم حذف الحساب نهائياً.', 'success');
        } catch (err) {
          showToast(`خطأ في الحذف: ${err.message}`, 'error');
        }
      },
    });
  };

  // ── Toggle active / inactive ────────────────────────────────────────────────
  const handleToggleStatus = (userId) => {
    const target = users.find(u => u.id === userId);
    if (!target) return;

    // Only show confirmation dialog when DISABLING an active account
    if (target.is_active) {
      setConfirm({
        message: `هل أنت متأكد من تعطيل حساب "${target.full_name || target.email}"؟ لن يتمكن المستخدم من تسجيل الدخول حتى يتم تفعيل حسابه مجدداً.`,
        onConfirm: async () => {
          setConfirm(null);
          try {
            await toggleUserStatus(userId, true);
            setUsers(prev => prev.map(u =>
              u.id === userId ? { ...u, is_active: false } : u
            ));
            showToast('تم تعطيل الحساب بنجاح.', 'success');
          } catch (err) {
            showToast(`خطأ: ${err.message}`, 'error');
          }
        },
      });
    } else {
      // Enable immediately — no confirmation needed
      (async () => {
        try {
          await toggleUserStatus(userId, false);
          setUsers(prev => prev.map(u =>
            u.id === userId ? { ...u, is_active: true } : u
          ));
          showToast('تم تفعيل الحساب بنجاح.', 'success');
        } catch (err) {
          showToast(`خطأ: ${err.message}`, 'error');
        }
      })();
    }
  };

  // ── Save user (create or update) ────────────────────────────────────────────
  const handleSaveUser = async (userData) => {
    try {
      if (selectedUser) {
        // Only update allowed fields; skip if user has a temp ID (not in DB yet)
        const isTempUser = String(selectedUser.id).startsWith('temp-');
        if (!isTempUser) {
          await updateUser(selectedUser.id, {
            full_name: userData.full_name,
            role:      userData.role,
          });
        }
        setUsers(prev => prev.map(u =>
          u.id === selectedUser.id
            ? { ...u, full_name: userData.full_name, role: userData.role }
            : u
        ));
        showToast('تم تحديث بيانات المستخدم.', 'success');
      } else {
        // New user — create real account in Supabase Auth
        await inviteUser({
          email:     userData.email,
          full_name: userData.full_name,
          role:      userData.role,
          password:  userData.password,
        });
        // Reload list from DB to get the real user record
        await loadUsers();
        showToast('تم إنشاء حساب المستخدم بنجاح.', 'success');
      }
    } catch (err) {
      showToast(`خطأ: ${err.message}`, 'error');
    } finally {
      setIsModalOpen(false);
    }
  };

  // ── Adapt DB shape to what UserTable expects ────────────────────────────────
  const tableUsers = filteredUsers.map(u => ({
    id:         u.id,
    name:       u.full_name || u.email || '—',  // always show full_name
    email:      u.email,
    role:       u.role ?? 'agent',
    status:     u.is_active ? 'active' : 'inactive',
    lastActive: u.last_login
      ? new Date(u.last_login).toLocaleString('ar-SA', {
          year: 'numeric', month: 'short', day: 'numeric',
          hour: '2-digit', minute: '2-digit',
        })
      : 'لم يسجّل دخولاً بعد',
    avatar:     `https://i.pravatar.cc/150?u=${u.email}`,
    // Keep raw DB fields for the edit modal
    full_name:  u.full_name,
    is_active:  u.is_active,
  }));

  return (
    <>
      <Header />
      <main className="pt-16 min-h-screen bg-background">
        <div className="container mx-auto p-6 max-w-[1600px]">

          <div className="mb-6 flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">User Management</h1>
              <p className="text-muted-foreground">Manage access and roles</p>
            </div>
            <div className="flex items-center gap-2 mt-2">
              {loading && <span className="text-xs text-muted-foreground animate-pulse">Loading…</span>}
              {error   && <span className="text-xs text-destructive">⚠ {error}</span>}
            </div>
          </div>

          <ActionToolbar onSearch={handleSearch} onRoleFilter={handleRoleFilter} onAddUser={handleAddUser} />

          <UserTable
            users={tableUsers}
            onEdit={u => handleEditUser(users.find(x => x.id === u.id) ?? u)}
            onDelete={u => handleDeleteUser(u.id)}
            onToggleStatus={u => handleToggleStatus(u.id)}
          />
        </div>
      </main>

      {isModalOpen && (
        <UserModal
          user={selectedUser}
          onSave={handleSaveUser}
          onClose={() => { setIsModalOpen(false); setSelectedUser(null); }}
        />
      )}

      {/* Confirmation Dialog */}
      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}

      {/* Toast Notification */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}
    </>
  );
};

export default AdminUserManagement;
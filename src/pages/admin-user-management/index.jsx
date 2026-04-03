import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Header from '../../components/ui/Header';
import ActionToolbar from './components/ActionToolbar';
import UserTable from './components/UserTable';
import UserModal from './components/UserModal';
import { fetchUsers, toggleUserStatus, updateUser } from '../../services/adminUserService';

// ── Simple Toast notification ─────────────────────────────────────────────────
const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  const colors = {
    success: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    error:   'bg-destructive/10 border-destructive/30 text-destructive',
    info:    'bg-primary/10 border-primary/30 text-primary',
  };

  return (
    <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-4 py-3 border rounded-lg shadow-lg ${colors[type] ?? colors.info} animate-in slide-in-from-bottom-2`}>
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onClose} className="opacity-70 hover:opacity-100 text-lg leading-none">×</button>
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

  // ── Deactivate user (does NOT remove from list — marks as inactive) ─────────
  const handleDeleteUser = (userId) => {
    setConfirm({
      message: 'هل أنت متأكد؟ سيتم تعطيل هذا الحساب.',
      onConfirm: async () => {
        setConfirm(null);
        try {
          await updateUser(userId, { is_active: false });
          // Update in-place: mark inactive, don't remove from list
          setUsers(prev => prev.map(u =>
            u.id === userId ? { ...u, is_active: false } : u
          ));
          showToast('تم تعطيل المستخدم بنجاح.', 'success');
        } catch (err) {
          showToast(`خطأ: ${err.message}`, 'error');
        }
      },
    });
  };

  // ── Toggle active / inactive ────────────────────────────────────────────────
  const handleToggleStatus = async (userId) => {
    const target = users.find(u => u.id === userId);
    if (!target) return;
    try {
      await toggleUserStatus(userId, target.is_active);
      setUsers(prev => prev.map(u =>
        u.id === userId ? { ...u, is_active: !u.is_active } : u
      ));
      showToast(
        target.is_active ? 'تم تعطيل المستخدم.' : 'تم تفعيل المستخدم.',
        'success'
      );
    } catch (err) {
      showToast(`خطأ: ${err.message}`, 'error');
    }
  };

  // ── Save user (create or update) ────────────────────────────────────────────
  const handleSaveUser = async (userData) => {
    try {
      if (selectedUser) {
        await updateUser(selectedUser.id, userData);
        setUsers(prev => prev.map(u =>
          u.id === selectedUser.id ? { ...u, ...userData } : u
        ));
        showToast('تم تحديث بيانات المستخدم.', 'success');
      } else {
        // New user — optimistic UI; real creation requires backend/admin SDK
        const newUser = {
          id: `temp-${Date.now()}`,
          ...userData,
          is_active: true,
          created_at: new Date().toISOString(),
        };
        setUsers(prev => [newUser, ...prev]);
        showToast('تم إضافة المستخدم (يجب إنشاء الحساب في Supabase Auth).', 'info');
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
    name:       u.full_name,
    email:      u.email,
    role:       u.role ?? 'agent',          // keep lowercase for consistency
    status:     u.is_active ? 'active' : 'inactive',
    lastActive: u.last_login ? new Date(u.last_login).toLocaleString() : 'Never',
    avatar:     `https://i.pravatar.cc/150?u=${u.email}`,
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
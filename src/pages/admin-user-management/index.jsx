import React, { useState, useEffect, useMemo } from 'react';
import Header from '../../components/ui/Header';
import ActionToolbar from './components/ActionToolbar';
import UserTable from './components/UserTable';
import UserModal from './components/UserModal';
import { fetchUsers, toggleUserStatus, updateUser } from '../../services/adminUserService';

const AdminUserManagement = () => {
  const [searchTerm,    setSearchTerm]    = useState('');
  const [selectedRole,  setSelectedRole]  = useState('all');
  const [isModalOpen,   setIsModalOpen]   = useState(false);
  const [selectedUser,  setSelectedUser]  = useState(null);
  const [users,         setUsers]         = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchUsers({ search: searchTerm || undefined, role: selectedRole !== 'all' ? selectedRole : undefined });
      setUsers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, [searchTerm, selectedRole]); // eslint-disable-line

  // Client-side filter for instant search feel
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

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to deactivate this user?')) return;
    try {
      await updateUser(userId, { is_active: false });
      setUsers(prev => prev.filter(u => u.id !== userId));
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleToggleStatus = async (userId) => {
    const target = users.find(u => u.id === userId);
    if (!target) return;
    try {
      await toggleUserStatus(userId, target.is_active);
      setUsers(prev => prev.map(u =>
        u.id === userId ? { ...u, is_active: !u.is_active } : u
      ));
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleSaveUser = async (userData) => {
    try {
      if (selectedUser) {
        await updateUser(selectedUser.id, userData);
        setUsers(prev => prev.map(u => u.id === selectedUser.id ? { ...u, ...userData } : u));
      } else {
        // New user — optimistic UI, real creation needs backend
        const newUser = { id: `temp-${Date.now()}`, ...userData, is_active: true, created_at: new Date().toISOString() };
        setUsers(prev => [newUser, ...prev]);
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsModalOpen(false);
    }
  };

  // Adapt DB shape to what UserTable expects
  const tableUsers = filteredUsers.map(u => ({
    id:         u.id,
    name:       u.full_name,
    email:      u.email,
    role:       u.role ? u.role.charAt(0).toUpperCase() + u.role.slice(1) : 'Agent',
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
              <h1 className="text-3xl font-bold text-foreground mb-2 font-['Inter']">User Management</h1>
              <p className="text-muted-foreground font-['Inter']">Manage access and roles</p>
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
        <UserModal user={selectedUser} onSave={handleSaveUser} onClose={() => { setIsModalOpen(false); setSelectedUser(null); }} />
      )}
    </>
  );
};

export default AdminUserManagement;
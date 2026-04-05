import React from 'react';
import Icon from '../../../components/AppIcon';

const UserTable = ({ users, onEdit, onDelete, onToggleStatus }) => {

  const getRoleBadgeStyle = (role) => {
    const map = {
      admin:      'bg-purple-500/20 text-purple-400 border-purple-500/30',
      agent:      'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      supervisor: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    };
    return map[role?.toLowerCase()] ?? 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  };

  const getRoleLabel = (role) => {
    const labels = { admin: 'Admin', agent: 'Agent', supervisor: 'Supervisor' };
    return labels[role?.toLowerCase()] ?? role ?? '—';
  };

  const isTempUser = (userId) => String(userId).startsWith('temp-');

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-muted/30 border-b border-border">
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                المستخدم
              </th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                الحالة
              </th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                الدور
              </th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                آخر نشاط
              </th>
              <th className="px-6 py-3.5 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                الإجراءات
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users?.length > 0 ? (
              users?.map((user) => (
                <tr
                  key={user?.id}
                  className={`hover:bg-muted/20 transition-colors ${user?.status === 'inactive' ? 'opacity-60' : ''}`}
                >
                  {/* User Column */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <img
                          src={user?.avatar}
                          alt={`${user?.name} avatar`}
                          className="w-10 h-10 rounded-full object-cover border-2 border-border"
                        />
                        {/* Online indicator */}
                        <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-card ${user?.status === 'active' ? 'bg-emerald-500' : 'bg-slate-500'}`} />
                      </div>
                      <div>
                        <p className="text-foreground font-medium text-sm">
                          {user?.name || '—'}
                          {isTempUser(user?.id) && (
                            <span className="ml-2 text-xs text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">مؤقت</span>
                          )}
                        </p>
                        <p className="text-muted-foreground text-xs">{user?.email}</p>
                      </div>
                    </div>
                  </td>

                  {/* Status Column */}
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                      user?.status === 'active'
                        ? 'bg-emerald-500/10 text-emerald-500'
                        : 'bg-slate-500/10 text-slate-400'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${user?.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                      {user?.status === 'active' ? 'نشط' : 'معطّل'}
                    </span>
                  </td>

                  {/* Role Column */}
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getRoleBadgeStyle(user?.role)}`}>
                      {getRoleLabel(user?.role)}
                    </span>
                  </td>

                  {/* Last Active Column */}
                  <td className="px-6 py-4">
                    <span className="text-muted-foreground text-sm">{user?.lastActive}</span>
                  </td>

                  {/* Actions Column */}
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-1">
                      {/* Edit — always visible */}
                      <button
                        onClick={() => onEdit?.(user)}
                        className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
                        title="تعديل المستخدم"
                      >
                        <Icon name="Edit" size={16} />
                      </button>

                      {user?.status === 'active' ? (
                        /* ACTIVE: show only Disable button */
                        <button
                          onClick={() => onToggleStatus?.(user)}
                          className="p-2 text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10 rounded-md transition-colors"
                          title="تعطيل الحساب"
                        >
                          <Icon name="UserX" size={16} />
                        </button>
                      ) : (
                        /* INACTIVE: show Enable + Delete */
                        <>
                          <button
                            onClick={() => onToggleStatus?.(user)}
                            className="p-2 text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10 rounded-md transition-colors"
                            title="تفعيل الحساب"
                          >
                            <Icon name="UserCheck" size={16} />
                          </button>
                          <button
                            onClick={() => onDelete?.(user)}
                            className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                            title="حذف الحساب نهائياً"
                          >
                            <Icon name="Trash2" size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="px-6 py-16 text-center">
                  <div className="flex flex-col items-center justify-center gap-3">
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                      <Icon name="Users" size={32} className="text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground text-sm">لا يوجد مستخدمون مطابقون</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UserTable;
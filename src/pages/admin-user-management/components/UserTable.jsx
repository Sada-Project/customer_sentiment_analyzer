import React from 'react';
import Icon from '../../../components/AppIcon';

const UserTable = ({ users, onEdit, onDelete, onToggleStatus }) => {
  const getRoleBadgeColor = (role) => {
    const colors = {
      admin:      'bg-purple-500/20 text-purple-400 border-purple-500/30',
      agent:      'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      supervisor: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    };
    return colors?.[role?.toLowerCase()] || 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-900/50 border-b border-slate-700">
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                User
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Last Active
              </th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {users?.length > 0 ? (
              users?.map((user) => (
                <tr 
                  key={user?.id} 
                  className="hover:bg-slate-700/30 transition-colors"
                >
                  {/* User Column */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={user?.avatar}
                        alt={`${user?.name} avatar`}
                        className="w-10 h-10 rounded-full object-cover border-2 border-slate-700"
                      />
                      <div>
                        <p className="text-white font-medium font-['Inter']">
                          {user?.name}
                        </p>
                        <p className="text-slate-400 text-sm font-['Inter']">
                          {user?.email}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Status Column */}
                  <td className="px-6 py-4">
                  </td>

                  {/* Role Column */}
                  <td className="px-6 py-4">
                    <span 
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getRoleBadgeColor(user?.role)} font-['Inter']`}
                    >
                      {user?.role}
                    </span>
                  </td>

                  {/* Last Active Column */}
                  <td className="px-6 py-4">
                    <span className="text-slate-400 text-sm font-['Inter']">
                      {user?.lastActive}
                    </span>
                  </td>

                  {/* Actions Column */}
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => onEdit?.(user)}
                        className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-md transition-colors"
                        title="Edit User"
                      >
                        <Icon name="Edit" size={18} />
                      </button>
                      <button
                        onClick={() => onDelete?.(user)}
                        className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                        title="Deactivate User"
                      >
                        <Icon name="Trash2" size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center justify-center">
                    <Icon name="Users" size={48} color="rgb(148 163 184)" />
                    <p className="text-slate-400 mt-4 font-['Inter']">
                      No users found
                    </p>
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
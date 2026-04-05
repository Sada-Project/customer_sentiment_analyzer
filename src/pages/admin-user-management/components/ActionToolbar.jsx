import React from 'react';
import Icon from '../../../components/AppIcon';

// Role filter options
const ROLE_OPTIONS = [
  { value: 'all',   label: 'جميع الأدوار' },
  { value: 'admin', label: 'Admin'         },
  { value: 'agent', label: 'Agent'         },
];

const ActionToolbar = ({ onSearch, onRoleFilter, onAddUser }) => {
  return (
    <div className="bg-card border border-border rounded-lg p-4 mb-6">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">

        {/* Search Input */}
        <div className="flex-1 w-full sm:w-auto">
          <div className="relative">
            <Icon
              name="Search"
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
            <input
              type="text"
              placeholder="البحث عن مستخدم..."
              onChange={(e) => onSearch?.(e?.target?.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm transition-all"
            />
          </div>
        </div>

        {/* Role Filter */}
        <select
          onChange={(e) => onRoleFilter?.(e?.target?.value)}
          defaultValue="all"
          className="px-3 py-2.5 bg-input border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all cursor-pointer"
        >
          {ROLE_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        {/* Add User Button */}
        <button
          onClick={onAddUser}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors whitespace-nowrap"
        >
          <Icon name="UserPlus" size={16} />
          <span>إضافة مستخدم</span>
        </button>
      </div>
    </div>
  );
};

export default ActionToolbar;
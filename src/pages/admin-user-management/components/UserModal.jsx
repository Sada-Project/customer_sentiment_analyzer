import React, { useState, useEffect } from 'react';
import Icon from '../../../components/AppIcon';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import Button from '../../../components/ui/Button';

// Role options
const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'agent', label: 'Agent' },
];

// Department options (matches departments.code in DB)
const DEPT_OPTIONS = [
  { value: '',          label: 'No Department' },
  { value: 'support',   label: 'Customer Support' },
  { value: 'technical', label: 'Technical Support' },
  { value: 'sales',     label: 'Sales' },
  { value: 'billing',   label: 'Billing' },
];

// Common job titles
const ROLE_TITLE_OPTIONS = [
  { value: 'Support Agent',           label: 'Support Agent' },
  { value: 'Senior Support Agent',    label: 'Senior Support Agent' },
  { value: 'Technical Specialist',    label: 'Technical Specialist' },
  { value: 'Senior Technical Lead',   label: 'Senior Technical Lead' },
  { value: 'Billing Specialist',      label: 'Billing Specialist' },
  { value: 'Sales Representative',    label: 'Sales Representative' },
  { value: 'Sales Specialist',        label: 'Sales Specialist' },
  { value: 'Team Lead',               label: 'Team Lead' },
  { value: 'Quality Analyst',         label: 'Quality Analyst' },
];

const UserModal = ({ user, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    full_name:       '',
    email:           '',
    role:            'agent',
    role_title:      '',
    department_code: '',
    password:        '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        full_name:       user?.full_name || user?.name || '',
        email:           user?.email || '',
        role:            user?.role?.toLowerCase() || 'agent',
        role_title:      user?.role_title || '',
        department_code: user?.department_code || '',
        password:        '',
        confirmPassword: '',
      });
    } else {
      setFormData({ full_name: '', email: '', role: 'agent', role_title: '', department_code: '', password: '', confirmPassword: '' });
    }
    setErrors({});
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e?.target ?? {};
    if (!name) return;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors?.[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleRoleChange = (value) => {
    setFormData(prev => ({ ...prev, role: value }));
    if (errors?.role) setErrors(prev => ({ ...prev, role: '' }));
  };

  const handleRoleTitleChange = (value) => {
    setFormData(prev => ({ ...prev, role_title: value }));
  };

  const handleDeptChange = (value) => {
    setFormData(prev => ({ ...prev, department_code: value }));
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData?.full_name?.trim()) {
      newErrors.full_name = 'Full name is required';
    }
    if (!formData?.email?.trim()) {
      newErrors.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData?.email)) {
      newErrors.email = 'Invalid email address format';
    }
    if (!user && !formData?.password) {
      newErrors.password = 'Password is required for new users';
    }
    if (formData?.password && formData?.password?.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }
    if (formData?.password && formData?.password !== formData?.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    if (!formData?.role) {
      newErrors.role = 'Please select a role';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!validateForm()) return;

    setSaving(true);
    try {
      await onSave?.({
        full_name:       formData.full_name.trim(),
        email:           formData.email.trim().toLowerCase(),
        role:            formData.role,
        role_title:      formData.role_title || null,
        department_code: formData.department_code || null,
        ...(formData.password ? { password: formData.password } : {}),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-xl w-full max-w-md shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon name={user ? 'UserCog' : 'UserPlus'} size={18} color="var(--color-primary)" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">
              {user ? 'Edit User' : 'Add New User'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Icon name="X" size={20} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">

          {/* Full Name */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Full Name <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              name="full_name"
              value={formData?.full_name}
              onChange={handleChange}
              placeholder="Enter full name"
              className="w-full px-3 py-2.5 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-sm"
            />
            {errors?.full_name && (
              <p className="mt-1 text-xs text-destructive">{errors?.full_name}</p>
            )}
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Email Address <span className="text-destructive">*</span>
            </label>
            <input
              type="email"
              name="email"
              value={formData?.email}
              onChange={handleChange}
              placeholder="example@company.com"
              disabled={!!user} // Don't allow email change when editing
              className="w-full px-3 py-2.5 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            />
            {errors?.email && (
              <p className="mt-1 text-xs text-destructive">{errors?.email}</p>
            )}
            {user && (
              <p className="mt-1 text-xs text-muted-foreground">Email address cannot be changed.</p>
            )}
          </div>

          {/* Role — uses custom Select */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Role <span className="text-destructive">*</span>
            </label>
            <Select
              options={ROLE_OPTIONS}
              value={formData?.role}
              onChange={handleRoleChange}
              placeholder="Select a role..."
              className="w-full"
            />
            {errors?.role && (
              <p className="mt-1 text-xs text-destructive">{errors?.role}</p>
            )}
          </div>

          {/* Job Title — only shown when editing (not creating) */}
          {user && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Job Title
              </label>
              <Select
                options={ROLE_TITLE_OPTIONS}
                value={formData?.role_title}
                onChange={handleRoleTitleChange}
                placeholder="Select a job title..."
                className="w-full"
              />
              <p className="mt-1 text-xs text-muted-foreground">Shown on the Agent Performance page</p>
            </div>
          )}

          {/* Department — only shown when editing */}
          {user && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Department
              </label>
              <Select
                options={DEPT_OPTIONS}
                value={formData?.department_code}
                onChange={handleDeptChange}
                placeholder="Select a department..."
                className="w-full"
              />
            </div>
          )}

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Password{' '}
              {user
                ? <span className="text-muted-foreground text-xs font-normal">(leave blank to keep current)</span>
                : <span className="text-destructive">*</span>
              }
            </label>
            <input
              type="password"
              name="password"
              value={formData?.password}
              onChange={handleChange}
              placeholder="••••••••"
              className="w-full px-3 py-2.5 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-sm"
            />
            {errors?.password && (
              <p className="mt-1 text-xs text-destructive">{errors?.password}</p>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Confirm Password{' '}
              {(!user || formData?.password) && <span className="text-destructive">*</span>}
            </label>
            <input
              type="password"
              name="confirmPassword"
              value={formData?.confirmPassword}
              onChange={handleChange}
              placeholder="••••••••"
              className="w-full px-3 py-2.5 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-sm"
            />
            {errors?.confirmPassword && (
              <p className="mt-1 text-xs text-destructive">{errors?.confirmPassword}</p>
            )}
          </div>

          {/* Info note for new users */}
          {!user && (
            <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
              <div className="flex items-start gap-2">
                <Icon name="Info" size={16} className="text-primary mt-0.5 flex-shrink-0" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  The account will be created immediately in the system. The user can sign in as soon as the account is created.
                </p>
              </div>
            </div>
          )}

          {/* Footer Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2.5 text-sm rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <Icon name="Loader2" size={16} className="animate-spin" />
                  Saving…
                </>
              ) : (
                user ? 'Save Changes' : 'Add User'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserModal;
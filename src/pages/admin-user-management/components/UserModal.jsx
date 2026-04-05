import React, { useState, useEffect } from 'react';
import Icon from '../../../components/AppIcon';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import Button from '../../../components/ui/Button';

// Role options formatted for the custom Select component
const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin — مدير النظام' },
  { value: 'agent', label: 'Agent — وكيل' },
];

const UserModal = ({ user, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    role: 'agent',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Populate form when editing an existing user
  useEffect(() => {
    if (user) {
      setFormData({
        full_name:       user?.full_name || user?.name || '',
        email:           user?.email || '',
        role:            user?.role?.toLowerCase() || 'agent',
        password:        '',
        confirmPassword: '',
      });
    } else {
      setFormData({ full_name: '', email: '', role: 'agent', password: '', confirmPassword: '' });
    }
    setErrors({});
  }, [user]);

  // Handle regular text inputs
  const handleChange = (e) => {
    const { name, value } = e?.target ?? {};
    if (!name) return;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors?.[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  // Handle custom Select component (calls onChange(value) directly — not e.target)
  const handleRoleChange = (value) => {
    setFormData(prev => ({ ...prev, role: value }));
    if (errors?.role) setErrors(prev => ({ ...prev, role: '' }));
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData?.full_name?.trim()) {
      newErrors.full_name = 'الاسم الكامل مطلوب';
    }
    if (!formData?.email?.trim()) {
      newErrors.email = 'البريد الإلكتروني مطلوب';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData?.email)) {
      newErrors.email = 'صيغة البريد الإلكتروني غير صحيحة';
    }
    if (!user && !formData?.password) {
      newErrors.password = 'كلمة المرور مطلوبة للمستخدمين الجدد';
    }
    if (formData?.password && formData?.password?.length < 8) {
      newErrors.password = 'يجب أن تكون كلمة المرور 8 أحرف على الأقل';
    }
    if (formData?.password && formData?.password !== formData?.confirmPassword) {
      newErrors.confirmPassword = 'كلمتا المرور غير متطابقتين';
    }
    if (!formData?.role) {
      newErrors.role = 'يرجى اختيار الدور';
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
        full_name: formData.full_name.trim(),
        email:     formData.email.trim().toLowerCase(),
        role:      formData.role,
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
              {user ? 'تعديل المستخدم' : 'إضافة مستخدم جديد'}
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
              الاسم الكامل <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              name="full_name"
              value={formData?.full_name}
              onChange={handleChange}
              placeholder="أدخل الاسم الكامل"
              className="w-full px-3 py-2.5 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-sm"
            />
            {errors?.full_name && (
              <p className="mt-1 text-xs text-destructive">{errors?.full_name}</p>
            )}
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              البريد الإلكتروني <span className="text-destructive">*</span>
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
              <p className="mt-1 text-xs text-muted-foreground">لا يمكن تغيير البريد الإلكتروني.</p>
            )}
          </div>

          {/* Role — uses custom Select with options prop */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              الدور <span className="text-destructive">*</span>
            </label>
            <Select
              options={ROLE_OPTIONS}
              value={formData?.role}
              onChange={handleRoleChange}
              placeholder="اختر الدور..."
              className="w-full"
            />
            {errors?.role && (
              <p className="mt-1 text-xs text-destructive">{errors?.role}</p>
            )}
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              كلمة المرور{' '}
              {user
                ? <span className="text-muted-foreground text-xs font-normal">(اتركها فارغة للإبقاء على الحالية)</span>
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
              تأكيد كلمة المرور{' '}
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
                  سيتم إنشاء الحساب مباشرةً في النظام. يمكن للمستخدم تسجيل الدخول فور الإنشاء.
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
              إلغاء
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2.5 text-sm rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <Icon name="Loader2" size={16} className="animate-spin" />
                  جارٍ الحفظ…
                </>
              ) : (
                user ? 'حفظ التغييرات' : 'إضافة المستخدم'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserModal;
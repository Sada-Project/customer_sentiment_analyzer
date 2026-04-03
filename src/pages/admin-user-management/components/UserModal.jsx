import React, { useState, useEffect } from 'react';
import Icon from '../../../components/AppIcon';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import Button from '../../../components/ui/Button';

const UserModal = ({ user, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'agent',
    password: '',
    confirmPassword: ''
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (user) {
      setFormData({
        name: user?.name || '',
        email: user?.email || '',
        role: user?.role?.toLowerCase() || 'agent',
        password: '',
        confirmPassword: ''
      });
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e?.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error for this field
    if (errors?.[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData?.name?.trim()) {
      newErrors.name = 'Full name is required';
    }

    if (!formData?.email?.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/?.test(formData?.email)) {
      newErrors.email = 'Invalid email format';
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

    setErrors(newErrors);
    return Object.keys(newErrors)?.length === 0;
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (validateForm()) {
      onSave?.(formData);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-slate-800 border border-slate-700 rounded-lg w-full max-w-md shadow-xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-xl font-bold text-white font-['Inter']">
            {user ? 'Edit User' : 'Add New User'}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <Icon name="X" size={24} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Full Name */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2 font-['Inter']">
              Full Name
            </label>
            <Input
              type="text"
              name="name"
              value={formData?.name}
              onChange={handleChange}
              placeholder="Enter full name"
              className="w-full bg-slate-900 border-slate-700 text-white placeholder-slate-400"
            />
            {errors?.name && (
              <p className="mt-1 text-sm text-red-400 font-['Inter']">{errors?.name}</p>
            )}
          </div>

          {/* Email Address */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2 font-['Inter']">
              Email Address
            </label>
            <Input
              type="email"
              name="email"
              value={formData?.email}
              onChange={handleChange}
              placeholder="Enter email address"
              className="w-full bg-slate-900 border-slate-700 text-white placeholder-slate-400"
            />
            {errors?.email && (
              <p className="mt-1 text-sm text-red-400 font-['Inter']">{errors?.email}</p>
            )}
          </div>

          {/* Role Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2 font-['Inter']">
              Role
            </label>
            <Select
              name="role"
              value={formData?.role}
              onChange={handleChange}
              className="w-full bg-slate-900 border-slate-700 text-white"
            >
              <option value="admin">Admin</option>
              <option value="agent">Agent</option>
            </Select>
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2 font-['Inter']">
              Password {user && <span className="text-slate-500">(leave blank to keep current)</span>}
            </label>
            <Input
              type="password"
              name="password"
              value={formData?.password}
              onChange={handleChange}
              placeholder="Enter password"
              className="w-full bg-slate-900 border-slate-700 text-white placeholder-slate-400"
            />
            {errors?.password && (
              <p className="mt-1 text-sm text-red-400 font-['Inter']">{errors?.password}</p>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2 font-['Inter']">
              Confirm Password
            </label>
            <Input
              type="password"
              name="confirmPassword"
              value={formData?.confirmPassword}
              onChange={handleChange}
              placeholder="Confirm password"
              className="w-full bg-slate-900 border-slate-700 text-white placeholder-slate-400"
            />
            {errors?.confirmPassword && (
              <p className="mt-1 text-sm text-red-400 font-['Inter']">{errors?.confirmPassword}</p>
            )}
          </div>

          {/* Modal Footer */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-md font-['Inter']"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-['Inter']"
            >
              {user ? 'Save Changes' : 'Add User'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserModal;
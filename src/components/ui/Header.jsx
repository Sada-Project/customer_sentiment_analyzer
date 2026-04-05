import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Icon from '../AppIcon';
import ThemeToggle from '../ThemeToggle';

const Header = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const navigationItems = [
    {
      label: 'Overview',
      path: '/sentiment-overview',
      icon: 'BarChart3',
      tooltip: 'Real-time sentiment monitoring and system status',
      roles: ['admin'] // Admin only
    },
    {
      label: 'Voice Analysis',
      path: '/voice-analysis-hub',
      icon: 'Mic',
      tooltip: 'Active processing hub for recording and file uploads',
      roles: ['admin', 'agent'] // Both admin and agent
    },
    {
      label: 'Customer Insights',
      path: '/customer-insights',
      icon: 'Users',
      tooltip: 'Strategic analytics for business decision-making',
      roles: ['admin', 'agent'] // Both admin and agent
    },
    {
      label: 'Performance',
      path: '/performance-analytics',
      icon: 'TrendingUp',
      tooltip: 'Technical monitoring and AI model accuracy tracking',
      roles: ['admin'] // Admin only
    },
    {
      label: 'Agent Performance',
      path: '/agent-performance-cards',
      icon: 'UserCheck',
      tooltip: 'Agent metrics and performance cards',
      roles: ['admin'] // Admin only
    },
    {
      label: 'Users',
      path: '/admin-user-management',
      icon: 'Settings',
      tooltip: 'User management and access control',
      roles: ['admin'] // Admin only
    }
  ];

  // Filter navigation items based on user role
  const filteredNavigationItems = navigationItems?.filter(item => 
    item?.roles?.includes(profile?.role)
  );

  const isActiveRoute = (path) => {
    return location?.pathname === path;
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login-screen');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-card border-b border-border">
      <div className="flex items-center h-16 px-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 bg-primary/10 rounded-lg transition-all duration-150 ease-out">
            <Icon name="Activity" size={24} color="var(--color-primary)" />
          </div>
          <span className="text-lg font-semibold text-foreground">
            Customer Sentiment Analyzer
          </span>
        </div>

        <nav className="hidden md:flex items-center gap-2 ml-auto">
          {filteredNavigationItems?.map((item) => (
            <Link
              key={item?.path}
              to={item?.path}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium
                whitespace-nowrap
                transition-all duration-150 ease-out
                ${isActiveRoute(item?.path)
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }
              `}
              title={item?.tooltip}
            >
              <Icon name={item?.icon} size={18} />
              <span>{item?.label}</span>
            </Link>
          ))}
        </nav>

        {/* User Profile and Logout */}
        <div className="hidden md:flex items-center gap-4 ml-4">
                  <ThemeToggle />

          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-150 ease-out"
            >
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="avatar" className="w-7 h-7 rounded-full object-cover border border-border" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
                  <Icon name="User" size={16} color="var(--color-primary)" />
                </div>
              )}
              <span>{profile?.full_name || profile?.email}</span>
              <span className="px-2 py-0.5 text-xs font-semibold bg-primary/10 text-primary rounded">
                {profile?.role}
              </span>
              <Icon name="ChevronDown" size={16} />
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-52 bg-card border border-border rounded-lg shadow-lg py-2 z-50">
                <Link
                  to="/profile"
                  onClick={() => setShowUserMenu(false)}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-150 ease-out"
                >
                  <Icon name="UserCircle" size={16} />
                  <span>الملف الشخصي</span>
                </Link>
                <div className="border-t border-border my-1" />
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-150 ease-out"
                >
                  <Icon name="LogOut" size={16} />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={toggleMobileMenu}
          className="md:hidden ml-auto p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-150 ease-out"
          aria-label="Toggle mobile menu"
        >
          <Icon name={isMobileMenuOpen ? 'X' : 'Menu'} size={24} />
        </button>
      </div>
      {isMobileMenuOpen && (
        <>
          <div
            className="fixed inset-0 z-45 bg-background/80 backdrop-blur-sm md:hidden"
            onClick={toggleMobileMenu}
          />
          <div className="fixed top-16 left-0 right-0 z-50 bg-card border-b border-border shadow-lg md:hidden">
            <nav className="flex flex-col p-4 gap-2">
              {filteredNavigationItems?.map((item) => (
                <Link
                  key={item?.path}
                  to={item?.path}
                  onClick={toggleMobileMenu}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium
                    transition-all duration-150 ease-out
                    ${isActiveRoute(item?.path)
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }
                  `}
                >
                  <Icon name={item?.icon} size={20} />
                  <div className="flex flex-col">
                    <span>{item?.label}</span>
                    <span className="text-xs opacity-70">{item?.tooltip}</span>
                  </div>
                </Link>
              ))}
              
              {/* Mobile User Profile and Logout */}
              <div className="border-t border-border mt-2 pt-2">
                <div className="flex items-center justify-between px-4 py-2">
                  <div className="flex items-center gap-2 text-sm">
                  <Icon name="User" size={16} />
                  <span className="text-foreground">{profile?.full_name || profile?.email}</span>
                  <span className="px-2 py-0.5 text-xs font-semibold bg-primary/10 text-primary rounded">
                    {profile?.role}
                  </span>
                  </div>
                   
                    <ThemeToggle />
                  
                </div>
                <button
                  onClick={() => {
                    toggleMobileMenu();
                    handleSignOut();
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-150 ease-out"
                >
                  <Icon name="LogOut" size={16} />
                  <span>Sign Out</span>
                </button>
              </div>
            </nav>
          </div>
        </>
      )}
    </header>
  );
};

export default Header;
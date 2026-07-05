import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, RefreshCw, BookOpen, BookText, BarChart3, Settings, 
  LogOut, X
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { AppLogo } from './AppLogo';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/transfer', label: 'Internal Transfer', icon: RefreshCw },
    { to: '/daybook', label: 'Daybook', icon: BookOpen },
    { to: '/ledger', label: 'Ledger', icon: BookText },
    { to: '/reports', label: 'Reports', icon: BarChart3 },
    { to: '/config', label: 'Configurations', icon: Settings },
  ];

  return (
    <aside className={`fixed md:static inset-y-0 left-0 w-60 min-h-screen bg-[#023020] text-white flex flex-col justify-between p-4 shadow-xl z-40 border-r border-[#011a12] transition-transform duration-300 ease-in-out ${
      isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
    }`}>
      <div>
        {/* Brand/Logo logo with dark green gradient accent */}
        <div className="flex items-center justify-between px-2 py-4 mb-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-lg text-emerald-400">
              <AppLogo className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-md font-bold tracking-wider uppercase">My Ledger</h1>
              <span className="text-[10px] text-[#8aa89f] tracking-widest font-semibold block">CASH & BANK MGT</span>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg text-white/70 hover:bg-white/10 md:hidden cursor-pointer"
            aria-label="Close sidebar"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) => 
                `nav-link ${isActive ? 'active bg-white/12 text-white font-semibold' : ''}`
              }
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      {/* User Session Footer */}
      <div className="border-t border-white/10 pt-4 mt-auto">
        <div className="flex items-center gap-3 px-2 mb-3">
          <div className="w-9 h-9 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-bold text-sm uppercase">
            {user?.full_name?.charAt(0) || 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold truncate text-white">{user?.full_name || 'User'}</p>
            <p className="text-[10px] text-[#8aa89f] truncate">{user?.email || 'user@myledger.com'}</p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full nav-link text-red-300 hover:bg-red-950/20 hover:text-red-200"
        >
          <LogOut className="w-5 h-5" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};

import React from 'react';
import { useLocation } from 'react-router-dom';
import { Bell, Search, Calendar, Menu } from 'lucide-react';

interface TopHeaderProps {
  onMenuClick: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({ onMenuClick }) => {
  const location = useLocation();

  const getPageTitle = () => {
    const path = location.pathname.substring(1);
    if (!path) return 'Dashboard';
    return path.charAt(0).toUpperCase() + path.slice(1);
  };

  const todayStr = new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'full',
  }).format(new Date());

  return (
    <header className="h-16 border-b border-[#e2e8e6] bg-white flex items-center justify-between px-6 z-10 shadow-xs">
      <div className="flex items-center gap-3">
        {/* Mobile Hamburger menu */}
        <button 
          onClick={onMenuClick}
          className="p-2 -ml-2 text-[#4a6b62] hover:bg-[#f1f5f4] rounded-lg transition-colors cursor-pointer md:hidden"
          aria-label="Toggle menu"
        >
          <Menu className="w-6 h-6" />
        </button>
        <div>
          <h2 className="text-lg font-bold text-[#0d1f1a] tracking-tight">{getPageTitle()}</h2>
          <p className="text-[10px] text-[#8aa89f] font-medium hidden sm:block">My Ledger System Dashboard</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Date display */}
        <div className="hidden lg:flex items-center gap-2 text-xs text-[#4a6b62] bg-[#f1f5f4] py-1.5 px-3 rounded-lg border border-[#e2e8e6] font-medium">
          <Calendar className="w-4 h-4 text-[#023020]" />
          <span>{todayStr}</span>
        </div>

        {/* Global actions */}
        <button className="p-2 text-[#4a6b62] hover:bg-[#f1f5f4] rounded-lg transition-colors cursor-pointer relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white"></span>
        </button>
      </div>
    </header>
  );
};

import React, { useState } from 'react';
import { Landmark, GitBranch, Settings2, Building2 } from 'lucide-react';
import { Banks } from './Banks';
import { Branches } from './Branches';
import { VoucherPrefixes } from './VoucherPrefixes';
import { CompanyProfile } from './CompanyProfile';

type ConfigTab = 'banks' | 'branches' | 'prefixes' | 'profile';

export const ConfigIndex: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ConfigTab>('banks');

  const tabs = [
    { id: 'banks', label: 'Bank Accounts', icon: Landmark, component: Banks },
    { id: 'branches', label: 'Branches (6+)', icon: GitBranch, component: Branches },
    { id: 'prefixes', label: 'Voucher Numbering', icon: Settings2, component: VoucherPrefixes },
    { id: 'profile', label: 'Company Profile & FY', icon: Building2, component: CompanyProfile },
  ] as const;

  const ActiveComponent = tabs.find((t) => t.id === activeTab)!.component;

  return (
    <div className="space-y-6">
      {/* Configuration Header Tabs */}
      <div className="flex items-center justify-between border-b border-[#e2e8e6] pb-2">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold transition-all relative cursor-pointer ${
                activeTab === tab.id
                  ? 'text-[#023020]'
                  : 'text-[#8aa89f] hover:text-[#4a6b62]'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#023020] animate-in fade-in duration-200"></span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Render Selected View */}
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
        <ActiveComponent />
      </div>
    </div>
  );
};

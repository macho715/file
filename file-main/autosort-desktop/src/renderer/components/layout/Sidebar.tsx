import React from 'react';

type View = 'dashboard' | 'files' | 'search' | 'settings' | 'quarantine';

interface SidebarProps {
  currentView: View;
  onNavigate: (view: View) => void;
}

const navItems: { id: View; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'files', label: 'Files', icon: '📁' },
  { id: 'search', label: 'Search', icon: '🔍' },
  { id: 'quarantine', label: 'Quarantine', icon: '⚠️' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

export default function Sidebar({ currentView, onNavigate }: SidebarProps) {
  return (
    <aside className="w-56 bg-gray-900 text-white flex flex-col">
      <div className="p-4 border-b border-gray-700">
        <h1 className="text-lg font-bold tracking-tight">Autosort</h1>
        <p className="text-xs text-gray-400 mt-1">File Management System</p>
      </div>

      <nav className="flex-1 py-4">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
              currentView === item.id
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <span className="text-base">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-700">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400"></span>
          <span className="text-xs text-gray-400">Watching active</span>
        </div>
      </div>
    </aside>
  );
}

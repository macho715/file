import React, { useState } from 'react';
import Sidebar from './components/layout/Sidebar';
import TopBar from './components/layout/TopBar';
import DashboardView from './components/dashboard/DashboardView';
import FileBrowser from './components/files/FileBrowser';
import SearchView from './components/search/SearchView';
import SettingsView from './components/settings/SettingsView';
import QuarantineView from './components/quarantine/QuarantineView';

type View = 'dashboard' | 'files' | 'search' | 'settings' | 'quarantine';

export default function App() {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setCurrentView('search');
  };

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <DashboardView />;
      case 'files':
        return <FileBrowser />;
      case 'search':
        return <SearchView initialQuery={searchQuery} />;
      case 'settings':
        return <SettingsView />;
      case 'quarantine':
        return <QuarantineView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar currentView={currentView} onNavigate={setCurrentView} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar onSearch={handleSearch} />
        <main className="flex-1 overflow-auto p-6">{renderView()}</main>
      </div>
    </div>
  );
}

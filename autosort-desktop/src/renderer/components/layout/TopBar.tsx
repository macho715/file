import React, { useState } from 'react';

interface TopBarProps {
  onSearch: (query: string) => void;
}

export default function TopBar({ onSearch }: TopBarProps) {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim());
    }
  };

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center px-6 gap-4">
      <form onSubmit={handleSubmit} className="flex-1 max-w-xl">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search files by name, type, project..."
            className="w-full h-9 pl-10 pr-4 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
            🔍
          </span>
        </div>
      </form>
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <span>DEV-PRESET Autosort</span>
      </div>
    </header>
  );
}

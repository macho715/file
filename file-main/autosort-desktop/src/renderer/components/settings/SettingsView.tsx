import React, { useState, useEffect } from 'react';
import { api } from '../../lib/ipc-client';

interface WatchedFolder {
  id: number;
  path: string;
  enabled: number | boolean;
  recursive: number | boolean;
  label: string;
}

export default function SettingsView() {
  const [folders, setFolders] = useState<WatchedFolder[]>([]);
  const [appInfo, setAppInfo] = useState<{
    root: string;
    rulesCount: number;
    llmUrl: string;
    llmType: string;
  } | null>(null);
  const [newPath, setNewPath] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [llmUrl, setLlmUrl] = useState('');
  const [llmType, setLlmType] = useState('llama_cpp');
  const [actionMessage, setActionMessage] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [foldersData, info] = await Promise.all([
      api.listWatchers(),
      api.getAppInfo(),
    ]);
    setFolders(foldersData);
    setAppInfo(info);
    setLlmUrl(info.llmUrl);
    setLlmType(info.llmType);
  }

  async function handleToggleWatch(idValue: unknown, enabled: boolean) {
    const id = Number(idValue);
    await api.toggleWatcher(id, enabled);
    await loadData();
  }

  async function handleSweep(idValue?: number) {
    await api.sweepWatchers(idValue);
    await loadData();
  }

  async function handleAddFolder() {
    if (!newPath.trim()) return;
    await api.addWatcher(newPath.trim(), newLabel.trim() || newPath.trim(), false);
    setNewPath('');
    setNewLabel('');
    loadData();
  }

  async function handleRemoveFolder(id: number) {
    await api.removeWatcher(id);
    loadData();
  }

  async function handleSaveLlm() {
    await api.setSetting('llm_url', llmUrl);
    await api.setSetting('llm_type', llmType);
    setActionMessage('LLM settings saved');
  }

  async function handleReloadRules() {
    const result = await api.reloadRules();
    if (result.success) {
      setActionMessage(`Rules reloaded: ${result.rulesCount}`);
      await loadData();
    } else {
      setActionMessage('Rules reload failed');
    }
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <h2 className="text-xl font-bold text-gray-800">Settings</h2>

      {/* App Info */}
      {appInfo && (
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <h3 className="font-medium text-gray-700 mb-3">System Info</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="text-gray-500">Root Directory:</span>
            <span className="font-mono text-gray-800">{appInfo.root}</span>
            <span className="text-gray-500">Rules Loaded:</span>
            <span className="text-gray-800">{appInfo.rulesCount} rules</span>
          </div>
        </section>
      )}

      {/* Watched Folders */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <h3 className="font-medium text-gray-700 mb-3">Watched Folders</h3>

        <div className="space-y-2 mb-4">
          <div className="flex justify-end">
            <button
              onClick={() => handleSweep()}
              className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Sweep All
            </button>
          </div>
          {folders.length === 0 && (
            <p className="text-sm text-gray-400">No folders configured</p>
          )}
          {folders.map((f) => (
            <div
              key={f.id}
              className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg"
            >
              <div>
                <span className="text-sm font-medium text-gray-800">
                  {f.label}
                </span>
                <span className="text-xs text-gray-400 ml-2 font-mono">
                  {f.path}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleToggleWatch(f.id, Number(f.enabled) === 0)}
                  className={`px-2 py-1 text-xs rounded ${
                    Number(f.enabled) === 0
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                  }`}
                >
                  {Number(f.enabled) === 0 ? 'Enable' : 'Disable'}
                </button>
                <button
                  onClick={() => handleSweep(f.id)}
                  className="px-2 py-1 text-xs bg-white border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
                >
                  Sweep
                </button>
                <button
                  onClick={() => handleRemoveFolder(f.id)}
                  className="text-red-500 hover:text-red-700 text-sm"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleReloadRules}
            className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"
          >
            Reload Rules
          </button>
          <input
            type="text"
            value={newPath}
            onChange={(e) => setNewPath(e.target.value)}
            placeholder="Folder path (e.g., C:\Users\...\Downloads)"
            className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
          />
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Label"
            className="w-32 px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
          />
          <button
            onClick={handleAddFolder}
            className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
          >
            Add
          </button>
        </div>
        {actionMessage && <p className="text-xs text-gray-500 mt-2">{actionMessage}</p>}
      </section>

      {/* LLM Configuration */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <h3 className="font-medium text-gray-700 mb-3">LLM Configuration</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-gray-600 mb-1">
              LLM Endpoint URL
            </label>
            <input
              type="text"
              value={llmUrl}
              onChange={(e) => setLlmUrl(e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">
              LLM Type
            </label>
            <select
              value={llmType}
              onChange={(e) => setLlmType(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
            >
              <option value="llama_cpp">llama.cpp (OpenAI compatible)</option>
              <option value="ollama">Ollama</option>
            </select>
          </div>
          <button
            onClick={handleSaveLlm}
            className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
          >
            Save LLM Settings
          </button>
        </div>
      </section>
    </div>
  );
}

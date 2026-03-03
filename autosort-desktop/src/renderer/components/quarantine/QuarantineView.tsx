import React, { useEffect, useState } from 'react';
import { api } from '../../lib/ipc-client';
import Toast from '../common/Toast';

interface ReclassifyState {
  id: number;
  docType: string;
  project: string;
  vendor: string;
  tags: string;
  reasons: string;
}

const DOC_TYPES = ['dev_code', 'dev_note', 'dev_archive', 'ops_doc', 'photo', 'other', 'temp'];

export default function QuarantineView() {
  const [files, setFiles] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<{
    id: number;
    variant: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);
  const [reclassifyForm, setReclassifyForm] = useState<ReclassifyState | null>(null);

  useEffect(() => {
    loadQuarantine();
    const dispose = api.onFileProcessed((data) => {
      if (data.status === 'quarantined') {
        loadQuarantine();
      }
    });
    return dispose;
  }, []);

  async function loadQuarantine() {
    setLoading(true);
    try {
      const data = await api.listQuarantine();
      setFiles(data);
    } catch (e) {
      console.error('Failed to load quarantine', e);
    } finally {
      setLoading(false);
    }
  }

  function pushToast(message: string, variant: 'success' | 'error' | 'info' = 'info') {
    setToastMessage({ id: Date.now(), variant, message });
  }

  async function handleApprove(idValue: unknown) {
    const id = Number(idValue);
    if (!Number.isFinite(id) || id <= 0 || actionId !== null) return;
    setActionId(id);
    try {
      const ok = await api.approveQuarantine(id);
      if (ok) {
        pushToast('Quarantine entry approved', 'success');
      }
      await loadQuarantine();
    } catch (e) {
      pushToast('Failed to approve', 'error');
      console.error(e);
    } finally {
      setActionId(null);
    }
  }

  function openReclassifyForm(idValue: unknown) {
    const id = Number(idValue);
    if (!Number.isFinite(id) || id <= 0) return;

    const current = files.find((f) => Number(f.id) === id);
    if (!current) return;

    setReclassifyForm({
      id,
      docType: String(current.doc_type || 'other'),
      project: String(current.project || ''),
      vendor: String(current.vendor || ''),
      tags: Array.isArray(current.tags) ? current.tags.join(', ') : '',
      reasons: Array.isArray(current.reasons)
        ? current.reasons.join(', ')
        : String(current.classification_source || 'manual_review'),
    });
  }

  async function submitReclassify() {
    if (!reclassifyForm) return;

    const overrides: {
      doc_type?: string;
      project?: string;
      vendor?: string;
      tags?: string[];
      reasons?: string[];
    } = {};

    if (reclassifyForm.docType.trim()) {
      overrides.doc_type = reclassifyForm.docType.trim();
    }

    if (reclassifyForm.project.trim()) {
      overrides.project = reclassifyForm.project.trim();
    }

    if (reclassifyForm.vendor.trim()) {
      overrides.vendor = reclassifyForm.vendor.trim();
    }

    const tags = reclassifyForm.tags
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    if (tags.length > 0) {
      overrides.tags = tags;
    }

    const reasons = reclassifyForm.reasons
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    if (reasons.length > 0) {
      overrides.reasons = reasons;
    }

    setActionId(reclassifyForm.id);
    try {
      await api.reclassifyQuarantine(reclassifyForm.id, overrides);
      pushToast('Reclassified successfully', 'success');
      await loadQuarantine();
      setReclassifyForm(null);
    } catch (e) {
      pushToast('Failed to reclassify', 'error');
      console.error(e);
    } finally {
      setActionId(null);
    }
  }

  async function handleDelete(idValue: unknown) {
    const id = Number(idValue);
    if (!Number.isFinite(id) || id <= 0 || actionId !== null) return;
    if (!window.confirm('Delete this quarantined file to quarantine/deleted folder?')) return;

    setActionId(id);
    try {
      const ok = await api.deleteQuarantine(id);
      if (ok) {
        pushToast('Quarantine entry moved to deleted', 'info');
      }
      await loadQuarantine();
    } catch (e) {
      pushToast('Failed to delete', 'error');
      console.error(e);
    } finally {
      setActionId(null);
    }
  }

  return (
    <div className="space-y-4 relative">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">Quarantine</h2>
        <button
          onClick={loadQuarantine}
          className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Refresh
        </button>
      </div>

      <p className="text-sm text-gray-500">
        Files that could not be automatically classified with high confidence
        are placed here for manual review.
      </p>

      {loading ? (
        <div className="text-gray-400 py-8 text-center">Loading...</div>
      ) : files.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <p className="text-gray-400">No quarantined files</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Filename
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Reason
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Type
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Confidence
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Date
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {files.map((file, i) => (
                <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800 truncate max-w-xs">
                    {String(file.filename ?? '')}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700">
                      {String(file.classification_source ?? 'unknown')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {String(file.doc_type ?? 'unknown')}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {(Number(file.confidence ?? 0) * 100).toFixed(0)}%
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {String(file.first_seen_at ?? '')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(file.id)}
                        disabled={actionId !== null}
                        className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => openReclassifyForm(file.id)}
                        disabled={actionId !== null}
                        className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Reclassify
                      </button>
                      <button
                        onClick={() => handleDelete(file.id)}
                        disabled={actionId !== null}
                        className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {reclassifyForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl w-full max-w-xl p-5 shadow-xl">
            <h3 className="font-medium text-gray-800 mb-3">Reclassify File</h3>
            <div className="grid gap-3 text-sm">
              <label className="space-y-1">
                <span className="text-gray-600">Doc Type</span>
                <select
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg bg-white"
                  value={reclassifyForm.docType}
                  onChange={(e) =>
                    setReclassifyForm((prev) => prev ? { ...prev, docType: e.target.value } : null)
                  }
                >
                  {DOC_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-gray-600">Project (optional)</span>
                <input
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg"
                  value={reclassifyForm.project}
                  onChange={(e) =>
                    setReclassifyForm((prev) => prev ? { ...prev, project: e.target.value } : null)
                  }
                />
              </label>

              <label className="space-y-1">
                <span className="text-gray-600">Vendor (optional)</span>
                <input
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg"
                  value={reclassifyForm.vendor}
                  onChange={(e) =>
                    setReclassifyForm((prev) => prev ? { ...prev, vendor: e.target.value } : null)
                  }
                />
              </label>

              <label className="space-y-1">
                <span className="text-gray-600">Tags (comma-separated)</span>
                <input
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg"
                  value={reclassifyForm.tags}
                  onChange={(e) =>
                    setReclassifyForm((prev) => prev ? { ...prev, tags: e.target.value } : null)
                  }
                />
              </label>

              <label className="space-y-1">
                <span className="text-gray-600">Reasons (comma-separated)</span>
                <input
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg"
                  value={reclassifyForm.reasons}
                  onChange={(e) =>
                    setReclassifyForm((prev) => prev ? { ...prev, reasons: e.target.value } : null)
                  }
                />
              </label>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setReclassifyForm(null)}
                className="px-3 py-1.5 text-sm bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200"
                disabled={actionId !== null}
              >
                Cancel
              </button>
              <button
                onClick={submitReclassify}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                disabled={actionId !== null}
              >
                Reclassify
              </button>
            </div>
          </div>
        </div>
      )}

      {toastMessage && (
        <Toast
          key={toastMessage.id}
          variant={toastMessage.variant}
          message={toastMessage.message}
          onClose={() => setToastMessage(null)}
        />
      )}
    </div>
  );
}

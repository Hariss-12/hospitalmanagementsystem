import React, { useEffect, useState, useCallback } from 'react';
import axiosClient from '../api/axiosClient';
import { StatusBadge } from '../components/HospitalComponents';

export default function AdminDashboard() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  const loadOverview = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axiosClient.get('/admin/overview');
      setOverview(res.data.data);
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  if (loading) {
    return <div className="py-12 text-center text-sm text-slate-500">Loading Hospital Administration Overview...</div>;
  }

  const metrics = overview?.metrics || {};
  const stateCounts = metrics.stateCounts || {};

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <span className="text-xs font-mono uppercase text-teal-700 font-semibold">
          Hospital Administration &amp; Governance
        </span>
        <h1 className="text-2xl font-bold text-slate-900">Administrator Dashboard</h1>
        <p className="text-sm text-slate-500">
          Monitor hospital-wide appointment states, audit immutable DFA transition logs, and oversee clinical staff.
          Administrators cannot bypass DFA transition rules.
        </p>
      </div>

      {feedback.text && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
          {feedback.text}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        {Object.entries(stateCounts).map(([state, count]) => (
          <div key={state} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs font-mono text-slate-500">{state}</div>
            <div className="text-2xl font-extrabold text-slate-900 mt-1">{count}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-4">
          Recent Global DFA State Transition Audit Trail
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Actor &amp; Role</th>
                <th className="py-2.5 px-3">Previous State (q)</th>
                <th className="py-2.5 px-3">Event (σ)</th>
                <th className="py-2.5 px-3">Next State δ(q, σ)</th>
                <th className="py-2.5 px-3">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(overview?.recentHistory || []).map((h) => (
                <tr key={h._id}>
                  <td className="py-2.5 px-3 text-xs font-mono text-slate-500">
                    {new Date(h.createdAt).toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="font-semibold text-slate-900">{h.actorName}</span>{' '}
                    <span className="text-xs text-teal-700 font-mono">({h.actorRole})</span>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-xs">{h.previousState}</td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded bg-slate-100 font-mono text-xs font-bold text-slate-800">
                      {h.event}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <StatusBadge status={h.nextState} />
                  </td>
                  <td className="py-2.5 px-3 text-xs text-slate-600">{h.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

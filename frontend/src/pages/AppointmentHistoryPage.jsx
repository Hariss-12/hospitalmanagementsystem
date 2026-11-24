import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { StatusBadge, DFAStateGraph } from '../components/HospitalComponents';

export default function AppointmentHistoryPage() {
  const [searchParams] = useSearchParams();
  const initialAptId = searchParams.get('appointmentId') || '';

  const [appointments, setAppointments] = useState([]);
  const [selectedId, setSelectedId] = useState(initialAptId);
  const [historyData, setHistoryData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axiosClient.get('/appointments').then((res) => {
      const list = res.data.data.appointments || [];
      setAppointments(list);
      if (!selectedId && list.length > 0) {
        setSelectedId(list[0]._id);
      }
      setLoading(false);
    });
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    axiosClient.get(`/appointments/${selectedId}/history`).then((res) => {
      setHistoryData(res.data.data);
    });
  }, [selectedId]);

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-xs font-mono uppercase text-teal-700 font-semibold">
            Immutable State Transition Log
          </span>
          <h1 className="text-2xl font-bold text-slate-900">Appointment State History</h1>
          <p className="text-sm text-slate-500">
            Every valid transition δ(q, σ) → q&apos; is recorded chronologically with actor role and version number.
          </p>
        </div>

        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          {appointments.map((a) => (
            <option key={a._id} value={a._id}>
              {a.appointmentCode} — {a.doctorId?.name} ({a.appointmentDate} {a.timeSlot}) [{a.status}]
            </option>
          ))}
        </select>
      </div>

      {historyData && <DFAStateGraph activeState={historyData.currentState} />}

      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-4">
          Chronological Transition Trace ({historyData?.history?.length || 0} transitions)
        </h2>

        {loading ? (
          <div className="py-8 text-center text-sm text-slate-500">Loading transition trace...</div>
        ) : !historyData?.history?.length ? (
          <div className="py-8 text-center text-sm text-slate-500">No history records found.</div>
        ) : (
          <div className="space-y-3">
            {historyData.history.map((item, idx) => (
              <div
                key={item._id}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-wrap items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-mono">
                    <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-800 font-bold">
                      Step #{idx + 1} (v{item.versionAfter})
                    </span>
                    <span className="font-semibold text-slate-700">{item.previousState}</span>
                    <span>──[{item.event}]──►</span>
                    <StatusBadge status={item.nextState} />
                  </div>
                  <p className="text-sm text-slate-800 font-medium">{item.reason}</p>
                  <p className="text-xs text-slate-500">
                    Triggered by <strong>{item.actorName}</strong> ({item.actorRole}) • Slot:{' '}
                    {item.appointmentDate} at {item.timeSlot}
                  </p>
                </div>
                <div className="text-xs font-mono text-slate-500">
                  {new Date(item.createdAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

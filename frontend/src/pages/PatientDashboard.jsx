import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
import { StatusBadge, DFAStateGraph } from '../components/HospitalComponents';

export default function PatientDashboard() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [selectedApt, setSelectedApt] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  const fetchAppointments = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (searchQuery.trim()) params.q = searchQuery.trim();
      const res = await axiosClient.get('/appointments', { params });
      const list = res.data.data.appointments || [];
      setAppointments(list);
      if (list.length > 0 && !selectedApt) {
        setSelectedApt(list[0]);
      }
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery, selectedApt]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const handleCancelAppointment = async (apt) => {
    setFeedback({ type: '', text: '' });
    try {
      const res = await axiosClient.patch(`/appointments/${apt._id}/cancel`, {
        reason: 'Cancelled by patient from Patient Dashboard',
        expectedVersion: apt.__v,
      });
      setFeedback({
        type: 'success',
        text: res.data.message,
      });
      const updated = res.data.data.appointment;
      setSelectedApt(updated);
      fetchAppointments();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: `HTTP ${err.status}: ${err.message}`,
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <span className="text-xs font-mono uppercase text-teal-700 font-semibold">
            Patient Portal
          </span>
          <h1 className="text-2xl font-bold text-slate-900">Welcome, {user?.name}</h1>
          <p className="text-sm text-slate-500">
            Track your appointments, inspect live DFA states, reschedule, or cancel pending visits.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            to="/appointments/book"
            className="px-4 py-2.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold shadow-sm"
          >
            + Book New Appointment
          </Link>
          <Link
            to="/appointments/history"
            className="px-4 py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold"
          >
            Full Audit History
          </Link>
        </div>
      </div>

      {feedback.text && (
        <div
          className={`p-4 rounded-xl border text-sm font-medium ${
            feedback.type === 'error'
              ? 'bg-rose-50 border-rose-300 text-rose-800'
              : 'bg-emerald-50 border-emerald-300 text-emerald-800'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {selectedApt && (
        <DFAStateGraph activeState={selectedApt.status} lastEvent={selectedApt.lastEvent} />
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-900">Your Appointments</h2>
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              placeholder="Search code, doctor, reason..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            >
              <option value="">All DFA States</option>
              <option value="REQUESTED">REQUESTED</option>
              <option value="CONFIRMED">CONFIRMED</option>
              <option value="RESCHEDULED">RESCHEDULED</option>
              <option value="CANCELLED">CANCELLED</option>
              <option value="REJECTED">REJECTED</option>
              <option value="COMPLETED">COMPLETED</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="py-8 text-center text-sm text-slate-500">Loading appointments...</div>
        ) : appointments.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-500">
            No appointments found. Click &ldquo;+ Book New Appointment&rdquo; to schedule a visit.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <th className="py-3 px-3">Code</th>
                  <th className="py-3 px-3">Doctor &amp; Dept</th>
                  <th className="py-3 px-3">Date &amp; Slot</th>
                  <th className="py-3 px-3">Reason</th>
                  <th className="py-3 px-3">DFA State</th>
                  <th className="py-3 px-3">Permitted DFA Events</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {appointments.map((apt) => {
                  const canReschedule = ['REQUESTED', 'CONFIRMED', 'RESCHEDULED'].includes(apt.status);
                  const canCancel = ['REQUESTED', 'CONFIRMED', 'RESCHEDULED'].includes(apt.status);
                  return (
                    <tr
                      key={apt._id}
                      onClick={() => setSelectedApt(apt)}
                      className={`hover:bg-slate-50 cursor-pointer ${
                        selectedApt?._id === apt._id ? 'bg-teal-50/40' : ''
                      }`}
                    >
                      <td className="py-3 px-3 font-mono text-xs font-semibold text-slate-800">
                        {apt.appointmentCode}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-900">{apt.doctorId?.name}</div>
                        <div className="text-xs text-slate-500">{apt.doctorId?.specialization}</div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-medium text-slate-900">{apt.appointmentDate}</div>
                        <div className="text-xs font-mono text-teal-700">{apt.timeSlot}</div>
                      </td>
                      <td className="py-3 px-3 text-slate-600 max-w-xs truncate">{apt.reason}</td>
                      <td className="py-3 px-3">
                        <StatusBadge status={apt.status} />
                      </td>
                      <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-wrap gap-2">
                          {canReschedule && (
                            <Link
                              to={`/appointments/${apt._id}/reschedule`}
                              className="px-2.5 py-1 rounded bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-xs font-semibold"
                            >
                              RESCHEDULE
                            </Link>
                          )}
                          {canCancel && (
                            <button
                              type="button"
                              onClick={() => handleCancelAppointment(apt)}
                              className="px-2.5 py-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold"
                            >
                              CANCEL
                            </button>
                          )}
                          <Link
                            to={`/appointments/history?appointmentId=${apt._id}`}
                            className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium"
                          >
                            Audit Log
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
import { StatusBadge, DFAStateGraph } from '../components/HospitalComponents';

export default function DoctorDashboard() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [doctorProfile, setDoctorProfile] = useState(null);
  const [selectedApt, setSelectedApt] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [feedback, setFeedback] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(true);

  const loadDoctorWorkspace = useCallback(async () => {
    try {
      setLoading(true);
      const [meRes, aptRes] = await Promise.all([
        axiosClient.get('/auth/me'),
        axiosClient.get('/appointments', {
          params: statusFilter ? { status: statusFilter } : {},
        }),
      ]);
      setDoctorProfile(meRes.data.data.user.doctorProfile || null);
      const list = aptRes.data.data.appointments || [];
      setAppointments(list);
      if (list.length > 0 && !selectedApt) {
        setSelectedApt(list[0]);
      }
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, selectedApt]);

  useEffect(() => {
    loadDoctorWorkspace();
  }, [loadDoctorWorkspace]);

  const triggerDFAEvent = async (apt, endpoint, reasonText) => {
    setFeedback({ type: '', text: '' });
    try {
      const res = await axiosClient.patch(`/appointments/${apt._id}/${endpoint}`, {
        reason: reasonText,
        expectedVersion: apt.__v,
      });
      setFeedback({ type: 'success', text: res.data.message });
      setSelectedApt(res.data.data.appointment);
      loadDoctorWorkspace();
    } catch (err) {
      setFeedback({ type: 'error', text: `HTTP ${err.status}: ${err.message}` });
    }
  };

  const toggleDoctorAvailability = async () => {
    if (!doctorProfile) return;
    try {
      const res = await axiosClient.put(`/doctors/${doctorProfile._id}/availability`, {
        isAvailable: !doctorProfile.isAvailable,
      });
      setDoctorProfile(res.data.data.doctor);
      setFeedback({
        type: 'success',
        text: `Consultation availability updated to ${res.data.data.doctor.isAvailable ? 'ACTIVE' : 'PAUSED'}.`,
      });
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <span className="text-xs font-mono uppercase text-teal-700 font-semibold">
            Clinical Doctor Console
          </span>
          <h1 className="text-2xl font-bold text-slate-900">{user?.name}</h1>
          <p className="text-sm text-slate-500">
            {doctorProfile
              ? `${doctorProfile.specialization} • ${doctorProfile.department} • Room ${doctorProfile.roomNumber}`
              : 'Execute DFA transitions (APPROVE, REJECT, COMPLETE, RESCHEDULE, CANCEL) on assigned patient appointments.'}
          </p>
        </div>

        {doctorProfile && (
          <button
            type="button"
            onClick={toggleDoctorAvailability}
            className={`px-4 py-2 rounded-lg text-xs font-bold border ${
              doctorProfile.isAvailable
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                : 'bg-rose-50 border-rose-300 text-rose-800'
            }`}
          >
            Status: {doctorProfile.isAvailable ? 'Available for Booking' : 'Unavailable'} (Toggle)
          </button>
        )}
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
          <h2 className="text-lg font-bold text-slate-900">Assigned Patient Appointments</h2>
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

        {loading ? (
          <div className="py-8 text-center text-sm text-slate-500">Loading assigned queue...</div>
        ) : appointments.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-500">
            No appointments matching the selected filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <th className="py-3 px-3">Code</th>
                  <th className="py-3 px-3">Patient</th>
                  <th className="py-3 px-3">Date &amp; Slot</th>
                  <th className="py-3 px-3">Reason</th>
                  <th className="py-3 px-3">Current DFA State</th>
                  <th className="py-3 px-3">Doctor DFA Transitions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {appointments.map((apt) => {
                  const canApprove = ['REQUESTED', 'RESCHEDULED'].includes(apt.status);
                  const canReject = ['REQUESTED', 'RESCHEDULED'].includes(apt.status);
                  const canComplete = apt.status === 'CONFIRMED';
                  const canCancel = ['CONFIRMED', 'RESCHEDULED'].includes(apt.status);
                  const canReschedule = ['REQUESTED', 'CONFIRMED', 'RESCHEDULED'].includes(apt.status);

                  return (
                    <tr
                      key={apt._id}
                      onClick={() => setSelectedApt(apt)}
                      className="hover:bg-slate-50 cursor-pointer"
                    >
                      <td className="py-3 px-3 font-mono text-xs font-semibold">
                        {apt.appointmentCode}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-900">{apt.patientId?.name}</div>
                        <div className="text-xs text-slate-500">{apt.patientId?.email}</div>
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
                        <div className="flex flex-wrap gap-1.5">
                          {canApprove && (
                            <button
                              type="button"
                              onClick={() =>
                                triggerDFAEvent(apt, 'approve', 'Approved by attending physician')
                              }
                              className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                            >
                              APPROVE
                            </button>
                          )}
                          {canReject && (
                            <button
                              type="button"
                              onClick={() =>
                                triggerDFAEvent(apt, 'reject', 'Rejected due to emergency schedule conflict')
                              }
                              className="px-2.5 py-1 rounded bg-red-600 hover:bg-red-700 text-white text-xs font-semibold"
                            >
                              REJECT
                            </button>
                          )}
                          {canComplete && (
                            <button
                              type="button"
                              onClick={() =>
                                triggerDFAEvent(apt, 'complete', 'Clinical consultation completed')
                              }
                              className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
                            >
                              COMPLETE
                            </button>
                          )}
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
                              onClick={() =>
                                triggerDFAEvent(apt, 'cancel', 'Cancelled by attending physician')
                              }
                              className="px-2.5 py-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold"
                            >
                              CANCEL
                            </button>
                          )}
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

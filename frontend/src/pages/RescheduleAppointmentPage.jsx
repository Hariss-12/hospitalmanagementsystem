import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { StatusBadge } from '../components/HospitalComponents';

export default function RescheduleAppointmentPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [appointment, setAppointment] = useState(null);
  const [appointmentDate, setAppointmentDate] = useState('');
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    axiosClient
      .get(`/appointments/${id}`)
      .then((res) => {
        const apt = res.data.data.appointment;
        setAppointment(apt);
        setAppointmentDate(apt.appointmentDate);
        setSelectedSlot(apt.timeSlot);
      })
      .catch((err) => setError(err.message));
  }, [id]);

  useEffect(() => {
    if (!appointment || !appointmentDate) return;
    const docId = appointment.doctorId?._id || appointment.doctorId;
    axiosClient
      .get(`/doctors/${docId}/slots`, { params: { date: appointmentDate } })
      .then((res) => {
        const slots = res.data.data.availableSlots || [];
        setAvailableSlots(slots);
        if (slots.length > 0 && !slots.includes(selectedSlot)) {
          setSelectedSlot(slots[0]);
        }
      })
      .catch((err) => setError(err.message));
  }, [appointment, appointmentDate, selectedSlot]);

  const handleReschedule = async (e) => {
    e.preventDefault();
    setError('');
    try {
      setSubmitting(true);
      await axiosClient.patch(`/appointments/${id}/reschedule`, {
        appointmentDate,
        timeSlot: selectedSlot,
        reason: reason.trim() || 'Rescheduled via portal',
        expectedVersion: appointment?.__v,
      });
      navigate(-1);
    } catch (err) {
      setError(`HTTP ${err.status}: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (!appointment && !error) {
    return <div className="py-12 text-center text-sm text-slate-500">Loading appointment...</div>;
  }

  return (
    <div className="max-w-xl mx-auto bg-white rounded-2xl border border-slate-200 p-8 shadow-sm space-y-6">
      <div>
        <span className="text-xs font-mono uppercase text-sky-700 font-semibold">
          DFA Transition Event: σ = RESCHEDULE → RESCHEDULED
        </span>
        <h1 className="text-2xl font-bold text-slate-900">Reschedule Appointment</h1>
        {appointment && (
          <div className="mt-2 flex items-center gap-3 text-xs text-slate-600">
            <span>Code: {appointment.appointmentCode}</span>
            <StatusBadge status={appointment.status} />
          </div>
        )}
      </div>

      {error && (
        <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleReschedule} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            New Appointment Date (YYYY-MM-DD) *
          </label>
          <input
            type="date"
            min={new Date().toISOString().slice(0, 10)}
            value={appointmentDate}
            onChange={(e) => setAppointmentDate(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-2">
            Select New Available Time Slot *
          </label>
          <div className="grid grid-cols-3 gap-2">
            {availableSlots.map((slot) => (
              <button
                type="button"
                key={slot}
                onClick={() => setSelectedSlot(slot)}
                className={`py-2 px-3 rounded-lg text-xs font-mono font-semibold border ${
                  selectedSlot === slot
                    ? 'bg-sky-700 text-white border-sky-700'
                    : 'bg-slate-50 text-slate-700 border-slate-300'
                }`}
              >
                {slot}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Reason for Rescheduling *
          </label>
          <input
            type="text"
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="e.g., Travel schedule adjustment"
          />
        </div>

        <button
          type="submit"
          disabled={submitting || !selectedSlot}
          className="w-full py-2.5 rounded-lg bg-sky-700 hover:bg-sky-800 text-white font-semibold text-sm disabled:opacity-50"
        >
          {submitting ? 'Applying DFA Transition...' : 'Trigger RESCHEDULE Event'}
        </button>
      </form>
    </div>
  );
}

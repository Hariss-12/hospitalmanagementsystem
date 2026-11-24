import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axiosClient from '../api/axiosClient';

export default function BookAppointmentPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const initialDoctorId = searchParams.get('doctorId') || '';
  const defaultTomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [doctors, setDoctors] = useState([]);
  const [doctorId, setDoctorId] = useState(initialDoctorId);
  const [appointmentDate, setAppointmentDate] = useState(defaultTomorrow);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [bookedSlots, setBookedSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [reason, setReason] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    axiosClient.get('/doctors').then((res) => {
      const list = res.data.data.doctors || [];
      setDoctors(list);
      if (!doctorId && list.length > 0) {
        setDoctorId(list[0]._id);
      }
    });
  }, [doctorId]);

  useEffect(() => {
    if (!doctorId || !appointmentDate) return;
    axiosClient
      .get(`/doctors/${doctorId}/slots`, { params: { date: appointmentDate } })
      .then((res) => {
        const slotData = res.data.data;
        setAvailableSlots(slotData.availableSlots || []);
        setBookedSlots(slotData.bookedSlots || []);
        setSelectedSlot(slotData.availableSlots?.[0] || '');
      })
      .catch((err) => {
        setError(err.message);
      });
  }, [doctorId, appointmentDate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!doctorId || !appointmentDate || !selectedSlot || !reason.trim()) {
      setError('Please select a doctor, date, available time slot, and clinical reason.');
      return;
    }

    try {
      setSubmitting(true);
      await axiosClient.post('/appointments', {
        doctorId,
        appointmentDate,
        timeSlot: selectedSlot,
        reason: reason.trim(),
        symptoms: symptoms.trim(),
      });
      navigate('/patient/dashboard');
    } catch (err) {
      setError(`HTTP ${err.status}: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-slate-200 p-8 shadow-sm space-y-6">
      <div>
        <span className="text-xs font-mono uppercase text-teal-700 font-semibold">
          DFA Initial State Entry (q0 = REQUESTED)
        </span>
        <h1 className="text-2xl font-bold text-slate-900">Book Hospital Appointment</h1>
        <p className="text-sm text-slate-500">
          Select an attending specialist and a verified free slot. New bookings enter the DFA in
          state <code className="font-mono text-teal-700 font-bold">REQUESTED</code>.
        </p>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Select Specialist Doctor *
          </label>
          <select
            value={doctorId}
            onChange={(e) => setDoctorId(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {doctors.map((d) => (
              <option key={d._id} value={d._id}>
                {d.name} — {d.specialization} ({d.department}) • ₹{d.consultationFee}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Appointment Date (YYYY-MM-DD) *
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
            Available Time Slots ({availableSlots.length} free, {bookedSlots.length} booked) *
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {availableSlots.map((slot) => (
              <button
                type="button"
                key={slot}
                onClick={() => setSelectedSlot(slot)}
                className={`py-2 px-3 rounded-lg text-xs font-mono font-semibold border transition ${
                  selectedSlot === slot
                    ? 'bg-teal-700 text-white border-teal-700'
                    : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-teal-50'
                }`}
              >
                {slot}
              </button>
            ))}
            {bookedSlots.map((slot) => (
              <button
                type="button"
                key={slot}
                disabled
                className="py-2 px-3 rounded-lg text-xs font-mono bg-rose-50 text-rose-400 border border-rose-200 line-through cursor-not-allowed"
              >
                {slot} (Booked)
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Clinical Reason for Visit *
          </label>
          <input
            type="text"
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="e.g., Annual cardiac screening and ECG evaluation"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Symptoms / Additional Notes
          </label>
          <textarea
            rows={2}
            value={symptoms}
            onChange={(e) => setSymptoms(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Describe any symptoms or prior reports..."
          />
        </div>

        <button
          type="submit"
          disabled={submitting || !selectedSlot}
          className="w-full py-2.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-semibold text-sm disabled:opacity-50"
        >
          {submitting ? 'Submitting Booking Request...' : 'Confirm Booking'}
        </button>
      </form>
    </div>
  );
}

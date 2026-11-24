import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axiosClient from '../api/axiosClient';

export default function DoctorDirectoryPage() {
  const [doctors, setDoctors] = useState([]);
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        setLoading(true);
        const params = {};
        if (search.trim()) params.q = search.trim();
        if (department) params.department = department;
        const res = await axiosClient.get('/doctors', { params });
        setDoctors(res.data.data.doctors || []);
      } finally {
        setLoading(false);
      }
    };
    fetchDoctors();
  }, [search, department]);

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Hospital Specialist Directory</h1>
          <p className="text-sm text-slate-500">
            Browse verified attending physicians, check working days, and book available OPD slots.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search doctor or specialization..."
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">All Departments</option>
            <option value="Cardiology">Cardiology</option>
            <option value="Neurology">Neurology</option>
            <option value="Orthopaedics">Orthopaedics</option>
            <option value="General Medicine">General Medicine</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-slate-500">Loading specialist directory...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {doctors.map((doc) => (
            <div
              key={doc._id}
              className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xs font-mono uppercase text-teal-700 font-semibold">
                      {doc.department} • Room {doc.roomNumber}
                    </span>
                    <h2 className="text-lg font-bold text-slate-900 mt-0.5">{doc.name}</h2>
                    <p className="text-xs text-slate-500">
                      {doc.qualification} • {doc.experienceYears} yrs experience
                    </p>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                      doc.isAvailable
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    {doc.isAvailable ? 'Available' : 'Unavailable'}
                  </span>
                </div>
                <p className="text-sm text-slate-600 mt-3">{doc.bio}</p>
                <div className="mt-3 text-xs text-slate-500">
                  <strong>Consultation Fee:</strong> ₹{doc.consultationFee} |{' '}
                  <strong>Working Days:</strong> {(doc.availableDays || []).join(', ')}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <div className="text-xs text-slate-500">
                  {(doc.availableSlots || []).length} daily slots configured
                </div>
                <Link
                  to={`/appointments/book?doctorId=${doc._id}`}
                  className="px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold"
                >
                  Select &amp; Check Slots
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

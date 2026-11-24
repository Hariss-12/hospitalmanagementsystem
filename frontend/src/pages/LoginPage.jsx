import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axiosClient from '../api/axiosClient';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Wake a sleeping hosted API while the user enters their credentials. This
  // avoids making the login request pay the entire cold-start delay.
  useEffect(() => {
    axiosClient.get('/health').catch(() => {
      // Login will surface any real connection or server error.
    });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      setSubmitting(true);
      const user = await login(email, password);
      if (user.role === 'Doctor') navigate('/doctor/dashboard');
      else if (user.role === 'Administrator') navigate('/admin/dashboard');
      else navigate('/patient/dashboard');
    } catch (err) {
      setError(err.message || 'Invalid credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  const fillDemoAccount = (demoEmail) => {
    setEmail(demoEmail);
    setPassword('Hospital@123');
  };

  return (
    <div className="max-w-md mx-auto bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Hospital Portal Login</h1>
      <p className="text-sm text-slate-500 mb-6">
        Sign in as a Patient, Doctor, or Hospital Administrator.
      </p>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="name@aegishealth.org"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-semibold text-sm disabled:opacity-50"
        >
          {submitting ? 'Authenticating...' : 'Sign In'}
        </button>
      </form>

      <div className="mt-6 pt-5 border-t border-slate-200">
        <div className="text-xs font-semibold text-slate-500 mb-2">
          Quick Seeded Role Credentials (Password: Hospital@123)
        </div>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => fillDemoAccount('aravind.patient@aegishealth.org')}
            className="text-xs py-1.5 px-2 rounded bg-slate-100 hover:bg-teal-50 text-slate-700 font-medium border border-slate-200"
          >
            Patient Demo
          </button>
          <button
            type="button"
            onClick={() => fillDemoAccount('ananya.cardio@aegishealth.org')}
            className="text-xs py-1.5 px-2 rounded bg-slate-100 hover:bg-teal-50 text-slate-700 font-medium border border-slate-200"
          >
            Doctor Demo
          </button>
          <button
            type="button"
            onClick={() => fillDemoAccount('admin@aegishealth.org')}
            className="text-xs py-1.5 px-2 rounded bg-slate-100 hover:bg-teal-50 text-slate-700 font-medium border border-slate-200"
          >
            Admin Demo
          </button>
        </div>
      </div>

      <p className="text-xs text-slate-500 mt-4 text-center">
        New patient?{' '}
        <Link to="/register" className="text-teal-700 font-semibold hover:underline">
          Create a patient account
        </Link>
      </p>
    </div>
  );
}

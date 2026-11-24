/**
 * Reusable UI Components:
 * - Navbar (Role-based navigation bar)
 * - ProtectedRoute (Enforces authentication + role guard, redirects to /unauthorized on role mismatch)
 * - StatusBadge (Semantic hospital DFA state badge)
 * - DFAStateGraph (Interactive SVG state transition diagram highlighting current state & valid transitions)
 */

import React from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const STATE_STYLES = {
  REQUESTED: {
    bg: 'bg-amber-50 border-amber-300 text-amber-800',
    dot: 'bg-amber-500',
    label: 'REQUESTED (q0)',
  },
  CONFIRMED: {
    bg: 'bg-emerald-50 border-emerald-300 text-emerald-800',
    dot: 'bg-emerald-500',
    label: 'CONFIRMED',
  },
  RESCHEDULED: {
    bg: 'bg-sky-50 border-sky-300 text-sky-800',
    dot: 'bg-sky-500',
    label: 'RESCHEDULED',
  },
  CANCELLED: {
    bg: 'bg-rose-50 border-rose-300 text-rose-800',
    dot: 'bg-rose-500',
    label: 'CANCELLED (Terminal)',
  },
  REJECTED: {
    bg: 'bg-red-50 border-red-300 text-red-800',
    dot: 'bg-red-600',
    label: 'REJECTED (Terminal)',
  },
  COMPLETED: {
    bg: 'bg-indigo-50 border-indigo-300 text-indigo-800',
    dot: 'bg-indigo-600',
    label: 'COMPLETED (Terminal)',
  },
};

export function StatusBadge({ status }) {
  const style = STATE_STYLES[status] || {
    bg: 'bg-slate-100 border-slate-300 text-slate-700',
    dot: 'bg-slate-400',
    label: status || 'UNKNOWN',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${style.bg}`}
    >
      <span className={`w-2 h-2 rounded-full ${style.dot}`} />
      {style.label}
    </span>
  );
}

export function ProtectedRoute({ allowedRoles, children }) {
  const { user, loading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-sm font-medium text-teal-700 animate-pulse">
          Verifying hospital session &amp; role permissions...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (Array.isArray(allowedRoles) && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}

export function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();

  const getDashboardLink = () => {
    if (!user) return '/';
    if (user.role === 'Patient') return '/patient/dashboard';
    if (user.role === 'Doctor') return '/doctor/dashboard';
    if (user.role === 'Administrator') return '/admin/dashboard';
    return '/';
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-teal-700 text-white flex items-center justify-center font-bold text-lg">
              A+
            </div>
            <div>
              <span className="font-bold text-slate-900 tracking-tight block leading-none">
                Aegis Health
              </span>
              <span className="text-[11px] text-teal-700 font-mono">
                DFA Appointment System
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-4 text-sm font-medium text-slate-600">
            <Link to="/doctors" className="hover:text-teal-700 transition-colors">
              Doctor Directory
            </Link>
            <Link to="/dfa-visualizer" className="hover:text-teal-700 transition-colors">
              DFA Engine Visualizer
            </Link>
            {isAuthenticated && (
              <>
                <Link to={getDashboardLink()} className="hover:text-teal-700 transition-colors">
                  {user.role} Dashboard
                </Link>
                {user.role === 'Patient' && (
                  <Link to="/appointments/book" className="hover:text-teal-700 transition-colors">
                    Book Appointment
                  </Link>
                )}
                <Link to="/appointments/history" className="hover:text-teal-700 transition-colors">
                  Appointment History
                </Link>
              </>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <>
              <Link
                to="/profile"
                className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium"
              >
                {user.name} ({user.role})
              </Link>
              <button
                type="button"
                onClick={logout}
                className="text-xs px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold border border-rose-200"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="text-sm font-medium text-slate-700 hover:text-teal-700 px-3 py-1.5"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="text-sm font-semibold bg-teal-700 hover:bg-teal-800 text-white px-4 py-2 rounded-lg shadow-sm"
              >
                Patient Registration
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function DFAStateGraph({ activeState = 'REQUESTED', lastEvent = null, onSelectState }) {
  const nodes = [
    { id: 'REQUESTED', x: 110, y: 70, label: 'REQUESTED', sub: 'Initial (q0)', terminal: false },
    { id: 'CONFIRMED', x: 350, y: 70, label: 'CONFIRMED', sub: 'Active', terminal: false },
    { id: 'RESCHEDULED', x: 590, y: 70, label: 'RESCHEDULED', sub: 'Active', terminal: false },
    { id: 'REJECTED', x: 110, y: 230, label: 'REJECTED', sub: 'Terminal (F)', terminal: true },
    { id: 'CANCELLED', x: 350, y: 230, label: 'CANCELLED', sub: 'Terminal (F)', terminal: true },
    { id: 'COMPLETED', x: 590, y: 230, label: 'COMPLETED', sub: 'Terminal (F)', terminal: true },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">
            Formal Automaton State Graph M = (Q, Σ, δ, q0, F)
          </h3>
          <p className="text-xs text-slate-500">
            Active State: <span className="font-mono font-semibold text-teal-700">{activeState}</span>
            {lastEvent ? ` | Last Input Symbol (σ): ${lastEvent}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-teal-600 inline-block" /> Current State
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-slate-200 border border-slate-400 inline-block" /> Active State
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-rose-100 border border-rose-400 inline-block" /> Terminal Lock (F)
          </span>
        </div>
      </div>

      <svg viewBox="0 0 700 295" className="w-full h-auto">
        <defs>
          <marker id="dfa-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M 0 1 L 8 5 L 0 9 z" fill="#475569" />
          </marker>
        </defs>

        {/* Directed Edges */}
        <line x1="185" y1="70" x2="270" y2="70" stroke="#0f766e" strokeWidth="2" markerEnd="url(#dfa-arrow)" />
        <text x="227" y="60" textAnchor="middle" className="text-[10px] fill-teal-800 font-mono">APPROVE</text>

        <line x1="425" y1="58" x2="510" y2="58" stroke="#0284c7" strokeWidth="2" markerEnd="url(#dfa-arrow)" />
        <text x="467" y="49" textAnchor="middle" className="text-[10px] fill-sky-800 font-mono">RESCHEDULE</text>

        <line x1="515" y1="84" x2="430" y2="84" stroke="#0f766e" strokeWidth="2" markerEnd="url(#dfa-arrow)" />
        <text x="467" y="100" textAnchor="middle" className="text-[10px] fill-teal-800 font-mono">APPROVE</text>

        <line x1="110" y1="108" x2="110" y2="186" stroke="#dc2626" strokeWidth="2" markerEnd="url(#dfa-arrow)" />
        <text x="74" y="150" textAnchor="middle" className="text-[10px] fill-red-700 font-mono">REJECT</text>

        <line x1="160" y1="108" x2="310" y2="188" stroke="#e11d48" strokeWidth="1.75" strokeDasharray="4 3" markerEnd="url(#dfa-arrow)" />
        <line x1="350" y1="108" x2="350" y2="186" stroke="#e11d48" strokeWidth="2" markerEnd="url(#dfa-arrow)" />
        <text x="382" y="150" textAnchor="middle" className="text-[10px] fill-rose-700 font-mono">CANCEL</text>

        <line x1="545" y1="108" x2="395" y2="188" stroke="#e11d48" strokeWidth="1.75" strokeDasharray="4 3" markerEnd="url(#dfa-arrow)" />
        <line x1="420" y1="108" x2="565" y2="188" stroke="#4f46e5" strokeWidth="2" markerEnd="url(#dfa-arrow)" />
        <text x="538" y="148" textAnchor="middle" className="text-[10px] fill-indigo-700 font-mono">COMPLETE</text>

        {nodes.map((n) => {
          const isCurrent = n.id === activeState;
          const fill = isCurrent
            ? '#0f766e'
            : n.terminal
            ? '#fff1f2'
            : '#f8fafc';
          const stroke = isCurrent
            ? '#0d9488'
            : n.terminal
            ? '#f43f5e'
            : '#64748b';
          const textFill = isCurrent ? '#ffffff' : '#0f172a';
          const subFill = isCurrent ? '#ccfbf1' : '#64748b';

          return (
            <g
              key={n.id}
              onClick={() => onSelectState && onSelectState(n.id)}
              style={{ cursor: onSelectState ? 'pointer' : 'default' }}
            >
              <rect
                x={n.x - 74}
                y={n.y - 34}
                width="148"
                height="68"
                rx="34"
                fill={fill}
                stroke={stroke}
                strokeWidth={isCurrent ? '3' : '1.75'}
              />
              {n.terminal && (
                <rect
                  x={n.x - 68}
                  y={n.y - 28}
                  width="136"
                  height="56"
                  rx="28"
                  fill="none"
                  stroke={isCurrent ? '#99f6e4' : '#fda4af'}
                  strokeWidth="1.2"
                />
              )}
              <text
                x={n.x}
                y={n.y - 5}
                textAnchor="middle"
                fill={textFill}
                className="text-xs font-bold"
              >
                {n.label}
              </text>
              <text
                x={n.x}
                y={n.y + 13}
                textAnchor="middle"
                fill={subFill}
                className="text-[10px] font-mono"
              >
                {n.sub}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

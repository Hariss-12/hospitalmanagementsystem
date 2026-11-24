import React from 'react';
import { Link } from 'react-router-dom';
import { DFAStateGraph } from '../components/HospitalComponents';

export default function LandingPage() {
  return (
    <div className="space-y-12 pb-12">
      <section className="bg-gradient-to-br from-teal-900 via-teal-800 to-slate-900 text-white rounded-2xl p-8 md:p-12 shadow-lg">
        <div className="max-w-3xl space-y-5">
          <span className="inline-block px-3 py-1 rounded-full bg-teal-700/60 border border-teal-400/30 text-xs font-mono uppercase tracking-wider">
            Deterministic Finite Automaton (DFA) Healthcare Platform
          </span>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-tight">
            Online Hospital Appointment Management System
          </h1>
          <p className="text-teal-100 text-base md:text-lg leading-relaxed">
            Every clinical appointment transitions deterministically through our formal 5-tuple
            state machine M = (Q, Σ, δ, q0, F) with strict role-based access control, optimistic
            concurrency locking, and immutable audit trails.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              to="/doctors"
              className="px-5 py-2.5 rounded-lg bg-white text-teal-900 font-bold text-sm hover:bg-teal-50 shadow"
            >
              Browse Specialist Doctors
            </Link>
            <Link
              to="/register"
              className="px-5 py-2.5 rounded-lg bg-teal-600 text-white font-semibold text-sm border border-teal-400/40 hover:bg-teal-500"
            >
              Register as Patient
            </Link>
            <Link
              to="/dfa-visualizer"
              className="px-5 py-2.5 rounded-lg bg-slate-800/80 text-teal-200 font-mono text-sm border border-slate-600 hover:bg-slate-800"
            >
              Inspect DFA Engine
            </Link>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-mono uppercase text-teal-700 font-semibold mb-1">
            Formal Automaton Control
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">
            Zero Invalid State Transitions
          </h2>
          <p className="text-sm text-slate-600">
            All state changes pass through δ(q, σ). Invalid transitions and attempts to mutate
            terminal states (CANCELLED, REJECTED, COMPLETED) are rejected with HTTP 409 Conflict.
          </p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-mono uppercase text-teal-700 font-semibold mb-1">
            Concurrency &amp; Double-Booking Guard
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">
            Atomic Slot &amp; Version Locking
          </h2>
          <p className="text-sm text-slate-600">
            Compound partial uniqueness indexes and document version keys (__v) prevent race-condition
            double bookings and concurrent status updates.
          </p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-mono uppercase text-teal-700 font-semibold mb-1">
            Defense-in-Depth RBAC
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">
            Patient, Doctor &amp; Admin Isolation
          </h2>
          <p className="text-sm text-slate-600">
            Strict ownership verification prevents IDOR vulnerabilities while enforcing role-specific
            transition permissions across every endpoint.
          </p>
        </div>
      </section>

      <DFAStateGraph activeState="REQUESTED" />
    </div>
  );
}

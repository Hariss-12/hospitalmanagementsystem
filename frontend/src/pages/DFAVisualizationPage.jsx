import React, { useEffect, useState } from 'react';
import axiosClient from '../api/axiosClient';
import { DFAStateGraph, StatusBadge } from '../components/HospitalComponents';

export default function DFAVisualizationPage() {
  const [definition, setDefinition] = useState(null);
  const [simState, setSimState] = useState('REQUESTED');
  const [simLastEvent, setSimLastEvent] = useState(null);
  const [simResult, setSimResult] = useState(null);

  useEffect(() => {
    axiosClient.get('/dfa/definition').then((res) => {
      setDefinition(res.data.data);
    });
  }, []);

  const triggerSimulatedEvent = (event) => {
    if (!definition) return;
    const isTerminal = definition.tuple.F.includes(simState);
    if (isTerminal) {
      setSimResult({
        valid: false,
        httpStatus: 409,
        message: `HTTP 409 Conflict: State '${simState}' is in terminal set F = {CANCELLED, REJECTED, COMPLETED}. No further transitions allowed.`,
      });
      return;
    }

    const match = definition.transitions.find(
      (t) => t.fromState === simState && t.event === event
    );

    if (!match) {
      setSimResult({
        valid: false,
        httpStatus: 409,
        message: `HTTP 409 Conflict: Transition δ(${simState}, ${event}) is undefined in the DFA transition table.`,
      });
      return;
    }

    setSimState(match.toState);
    setSimLastEvent(event);
    setSimResult({
      valid: true,
      httpStatus: 200,
      message: `Valid Transition: δ(${match.fromState}, ${event}) = ${match.toState}. Permitted Roles: ${match.allowedRoles.join(', ')}.`,
    });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <span className="text-xs font-mono uppercase text-teal-700 font-semibold">
          Formal Languages &amp; Automata Theory (FLAT) Module
        </span>
        <h1 className="text-2xl font-bold text-slate-900">
          Interactive Deterministic Finite Automaton (DFA) Visualizer
        </h1>
        <p className="text-sm text-slate-500">
          Click any state node or trigger an input symbol σ ∈ Σ to test how the backend DFA engine
          evaluates δ(q, σ) and rejects invalid or terminal transitions with HTTP 409 Conflict.
        </p>
      </div>

      <DFAStateGraph
        activeState={simState}
        lastEvent={simLastEvent}
        onSelectState={(s) => {
          setSimState(s);
          setSimLastEvent(null);
          setSimResult(null);
        }}
      />

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-slate-800">Current Simulator State (q):</span>
            <StatusBadge status={simState} />
          </div>
          <button
            type="button"
            onClick={() => {
              setSimState('REQUESTED');
              setSimLastEvent(null);
              setSimResult(null);
            }}
            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-mono font-semibold"
          >
            Reset to Initial State (q0 = REQUESTED)
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {['APPROVE', 'RESCHEDULE', 'CANCEL', 'REJECT', 'COMPLETE'].map((ev) => (
            <button
              key={ev}
              type="button"
              onClick={() => triggerSimulatedEvent(ev)}
              className="px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-mono font-bold"
            >
              Send Input σ = {ev}
            </button>
          ))}
        </div>

        {simResult && (
          <div
            className={`p-4 rounded-xl border text-sm font-mono ${
              simResult.valid
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : 'bg-rose-50 border-rose-300 text-rose-900'
            }`}
          >
            {simResult.message}
          </div>
        )}
      </div>
    </div>
  );
}

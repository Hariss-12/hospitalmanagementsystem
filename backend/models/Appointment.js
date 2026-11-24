/**
 * Appointment Schema
 *
 * Enforces:
 * - Current DFA state (`status`) strictly constrained to DFA_STATES (`q0 = REQUESTED`).
 * - Compound partial uniqueness index on `(doctorId, appointmentDate, timeSlot)`
 *   for active states (`REQUESTED`, `CONFIRMED`, `RESCHEDULED`) to prevent double booking.
 * - Optimistic concurrency control via `__v`.
 */

const mongoose = require('../config/mongoose');
const { DFA_STATES, INITIAL_STATE } = require('../dfa/dfaConstants');

const appointmentSchema = new mongoose.Schema(
  {
    appointmentCode: {
      type: String,
      required: true,
      unique: true,
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Patient reference is required.'],
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: [true, 'Doctor reference is required.'],
    },
    appointmentDate: {
      type: String, // YYYY-MM-DD
      required: [true, 'Appointment date (YYYY-MM-DD) is required.'],
      trim: true,
    },
    timeSlot: {
      type: String, // e.g., "10:00 AM"
      required: [true, 'Time slot is required.'],
      trim: true,
    },
    reason: {
      type: String,
      required: [true, 'Reason for visit is required.'],
      trim: true,
    },
    symptoms: {
      type: String,
      default: '',
      trim: true,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
    status: {
      type: String,
      enum: Object.values(DFA_STATES),
      default: INITIAL_STATE,
      required: true,
    },
    lastEvent: {
      type: String,
      default: 'BOOK_INITIAL',
    },
    rescheduleCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent double-booking of the same doctor on the same date & slot while appointment is active
appointmentSchema.index(
  { doctorId: 1, appointmentDate: 1, timeSlot: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: {
        $in: [DFA_STATES.REQUESTED, DFA_STATES.CONFIRMED, DFA_STATES.RESCHEDULED],
      },
    },
  }
);

module.exports = mongoose.model('Appointment', appointmentSchema);

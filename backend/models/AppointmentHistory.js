/**
 * AppointmentHistory Schema
 *
 * Immutable audit record capturing every DFA transition:
 * - appointmentId
 * - previousState (q)
 * - event (σ)
 * - nextState δ(q, σ)
 * - actorId & actorRole
 * - reason / clinical note
 * - slot snapshot (appointmentDate, timeSlot)
 */

const mongoose = require('../config/mongoose');
const { DFA_STATES, USER_ROLES } = require('../dfa/dfaConstants');

const appointmentHistorySchema = new mongoose.Schema(
  {
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      required: true,
    },
    previousState: {
      type: String,
      enum: ['NONE', ...Object.values(DFA_STATES)],
      required: true,
    },
    event: {
      type: String,
      required: true,
    },
    nextState: {
      type: String,
      enum: Object.values(DFA_STATES),
      required: true,
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    actorName: {
      type: String,
      required: true,
    },
    actorRole: {
      type: String,
      enum: Object.values(USER_ROLES),
      required: true,
    },
    reason: {
      type: String,
      default: '',
      trim: true,
    },
    appointmentDate: {
      type: String,
      required: true,
    },
    timeSlot: {
      type: String,
      required: true,
    },
    versionAfter: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('AppointmentHistory', appointmentHistorySchema);

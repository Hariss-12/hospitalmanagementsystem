/**
 * Appointment Management Controller (Strictly Driven by the Formal DFA Engine)
 *
 * Implements:
 * 1. Appointment booking -> Initial state q0 = REQUESTED
 * 2. Server-side validation of doctor availability, working days, blocked dates, and future/today dates
 * 3. Atomic double-booking prevention and concurrency locks
 * 4. DFA-driven transitions: APPROVE, REJECT, RESCHEDULE, CANCEL, COMPLETE
 * 5. Optimistic concurrency control (`__v` + atomic conditional update)
 * 6. Complete immutable AppointmentHistory recording
 * 7. Strict ownership checks preventing IDOR across Patients and Doctors
 */

const crypto = require('node:crypto');
const Appointment = require('../models/Appointment');
const AppointmentHistory = require('../models/AppointmentHistory');
const Doctor = require('../models/Doctor');
const User = require('../models/User');
const {
  DFA_STATES,
  DFA_EVENTS,
  INITIAL_STATE,
  USER_ROLES,
} = require('../dfa/dfaConstants');
const {
  DFATransitionError,
  getAllowedEvents,
  getFormalDFADefinition,
} = require('../dfa/dfaEngine');
const {
  assertNoDirectStatusMutation,
  validateAppointmentTransition,
} = require('../dfa/dfaValidator');
const { getWeekdayName } = require('./doctorController');

// In-process concurrency locks to prevent race conditions during simultaneous requests
const activeSlotLocks = new Set();
const activeAppointmentLocks = new Set();

function parseDateYYYYMMDD(dateStr) {
  if (typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) {
    return null;
  }
  const [y, m, d] = dateStr.trim().split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    return null;
  }
  return dateStr.trim();
}

function isDateInPast(dateStr) {
  const todayUTC = new Date().toISOString().slice(0, 10);
  return dateStr < todayUTC;
}

/**
 * Validates that the specified doctor is active, works on `appointmentDate`, has not blocked
 * `appointmentDate`, offers `timeSlot`, and has no conflicting active appointment on that slot.
 */
async function validateDoctorAndSlotOnServer(doctorId, appointmentDate, timeSlot, excludeAppointmentId = null) {
  const validDate = parseDateYYYYMMDD(appointmentDate);
  if (!validDate) {
    const err = new Error('Invalid appointmentDate format. Expected valid calendar date in YYYY-MM-DD format.');
    err.statusCode = 400;
    err.code = 'INVALID_APPOINTMENT_DATE';
    throw err;
  }

  if (isDateInPast(validDate)) {
    const err = new Error(`Cannot book or reschedule an appointment in the past (${validDate}).`);
    err.statusCode = 400;
    err.code = 'PAST_DATE_FORBIDDEN';
    throw err;
  }

  const doctor = await Doctor.findById(doctorId).lean();
  if (!doctor) {
    const err = new Error('Selected doctor does not exist.');
    err.statusCode = 404;
    err.code = 'DOCTOR_NOT_FOUND';
    throw err;
  }

  if (!doctor.isAvailable) {
    const err = new Error(`Dr. ${doctor.name} is currently unavailable for appointments.`);
    err.statusCode = 400;
    err.code = 'DOCTOR_UNAVAILABLE';
    throw err;
  }

  const weekday = getWeekdayName(validDate);
  if (!Array.isArray(doctor.availableDays) || !doctor.availableDays.includes(weekday)) {
    const err = new Error(
      `Dr. ${doctor.name} does not consult on ${weekday}s. Available days: ${doctor.availableDays.join(', ')}.`
    );
    err.statusCode = 400;
    err.code = 'DOCTOR_NOT_WORKING_ON_DAY';
    throw err;
  }

  if (Array.isArray(doctor.blockedDates) && doctor.blockedDates.includes(validDate)) {
    const err = new Error(`Dr. ${doctor.name} is unavailable on ${validDate} (blocked date).`);
    err.statusCode = 400;
    err.code = 'DOCTOR_DATE_BLOCKED';
    throw err;
  }

  const normalizedSlot = String(timeSlot || '').trim();
  if (!Array.isArray(doctor.availableSlots) || !doctor.availableSlots.includes(normalizedSlot)) {
    const err = new Error(
      `Time slot '${normalizedSlot}' is not offered by Dr. ${doctor.name}. Valid slots: ${doctor.availableSlots.join(', ')}.`
    );
    err.statusCode = 400;
    err.code = 'INVALID_DOCTOR_TIME_SLOT';
    throw err;
  }

  // Check for double booking among active DFA states (REQUESTED, CONFIRMED, RESCHEDULED)
  const existingConflict = await Appointment.findOne({
    doctorId: String(doctor._id),
    appointmentDate: validDate,
    timeSlot: normalizedSlot,
    status: { $in: [DFA_STATES.REQUESTED, DFA_STATES.CONFIRMED, DFA_STATES.RESCHEDULED] },
  }).lean();

  if (existingConflict && String(existingConflict._id) !== String(excludeAppointmentId || '')) {
    const err = new Error(
      `Slot conflict: Dr. ${doctor.name} already has an active appointment on ${validDate} at ${normalizedSlot}.`
    );
    err.statusCode = 409;
    err.code = 'DOUBLE_BOOKING_CONFLICT';
    throw err;
  }

  return { doctor, validDate, normalizedSlot };
}

/**
 * GET /api/dfa/definition
 * Returns formal 5-tuple M = (Q, Σ, δ, q0, F) and transition matrix.
 */
async function getDFADefinition(_req, res, next) {
  try {
    return res.status(200).json({
      success: true,
      data: getFormalDFADefinition(),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/appointments
 * Creates a new appointment in initial DFA state q0 = REQUESTED.
 */
async function bookAppointment(req, res, next) {
  let slotLockKey = null;
  try {
    // 1. Never allow client to supply a `status` field directly
    assertNoDirectStatusMutation(req.body);

    const { doctorId, appointmentDate, timeSlot, reason, symptoms, patientId } = req.body || {};

    if (!doctorId || !appointmentDate || !timeSlot || !reason || !String(reason).trim()) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'doctorId, appointmentDate, timeSlot, and reason are required.',
          code: 'MISSING_BOOKING_FIELDS',
        },
      });
    }

    // Determine target patientId (Patients can only book for themselves)
    let targetPatientId = req.user.id;
    if (req.user.role === USER_ROLES.ADMIN && patientId) {
      targetPatientId = String(patientId);
    } else if (req.user.role === USER_ROLES.PATIENT && patientId && String(patientId) !== String(req.user.id)) {
      return res.status(403).json({
        success: false,
        error: {
          message: 'Forbidden: Patients cannot book appointments on behalf of another patient.',
          code: 'IDOR_BOOKING_FORBIDDEN',
        },
      });
    }

    // Acquire atomic slot lock to prevent race-condition double booking
    slotLockKey = `${doctorId}:${appointmentDate}:${String(timeSlot).trim()}`;
    if (activeSlotLocks.has(slotLockKey)) {
      return res.status(409).json({
        success: false,
        error: {
          message: 'Concurrent booking attempt detected for this doctor and time slot. Please try another slot.',
          code: 'CONCURRENT_SLOT_LOCK_CONFLICT',
        },
      });
    }
    activeSlotLocks.add(slotLockKey);

    const { doctor, validDate, normalizedSlot } = await validateDoctorAndSlotOnServer(
      doctorId,
      appointmentDate,
      timeSlot,
      null
    );

    const appointmentCode = `APT-${Date.now().toString(36).toUpperCase()}-${crypto
      .randomBytes(2)
      .toString('hex')
      .toUpperCase()}`;

    // Initial DFA state is strictly q0 = REQUESTED
    const created = await Appointment.create({
      appointmentCode,
      patientId: targetPatientId,
      doctorId: String(doctor._id),
      appointmentDate: validDate,
      timeSlot: normalizedSlot,
      reason: String(reason).trim(),
      symptoms: symptoms ? String(symptoms).trim() : '',
      notes: '',
      status: INITIAL_STATE,
      lastEvent: 'BOOK_INITIAL',
      rescheduleCount: 0,
    });

    // Record initial state entry in AppointmentHistory
    await AppointmentHistory.create({
      appointmentId: String(created._id),
      previousState: 'NONE',
      event: 'BOOK_INITIAL',
      nextState: INITIAL_STATE,
      actorId: req.user.id,
      actorName: req.user.name,
      actorRole: req.user.role,
      reason: `Initial appointment booked: ${String(reason).trim()}`,
      appointmentDate: validDate,
      timeSlot: normalizedSlot,
      versionAfter: created.__v || 0,
    });

    const populated = await Appointment.findById(created._id)
      .populate('patientId', 'name email phone gender bloodGroup')
      .populate('doctorId', 'name specialization department roomNumber consultationFee')
      .lean();

    return res.status(201).json({
      success: true,
      message: 'Appointment booked and initialized in DFA state REQUESTED.',
      data: {
        appointment: {
          ...populated,
          allowedTransitions: getAllowedEvents(populated.status, req.user.role),
        },
      },
    });
  } catch (err) {
    next(err);
  } finally {
    if (slotLockKey) {
      activeSlotLocks.delete(slotLockKey);
    }
  }
}

/**
 * Helper to check whether `req.user` is authorized to view `appointment`.
 */
function assertCanViewAppointment(appointment, user) {
  const patientIdStr = String(appointment.patientId?._id || appointment.patientId);
  const doctorIdStr = String(appointment.doctorId?._id || appointment.doctorId);

  if (user.role === USER_ROLES.PATIENT && patientIdStr !== String(user.id)) {
    const err = new Error('Forbidden: You are not authorized to view another patient\'s appointment.');
    err.statusCode = 403;
    err.code = 'IDOR_PATIENT_READ_FORBIDDEN';
    throw err;
  }

  if (
    user.role === USER_ROLES.DOCTOR &&
    doctorIdStr !== String(user.doctorProfileId) &&
    doctorIdStr !== String(user.id)
  ) {
    const err = new Error('Forbidden: You are not authorized to view appointments assigned to another doctor.');
    err.statusCode = 403;
    err.code = 'IDOR_DOCTOR_READ_FORBIDDEN';
    throw err;
  }
}

/**
 * GET /api/appointments
 * Lists appointments scoped to the authenticated user's role with search & filtering.
 */
async function listAppointments(req, res, next) {
  try {
    const { status, doctorId, date, q } = req.query || {};
    const filter = {};

    // Role-based ownership filter
    if (req.user.role === USER_ROLES.PATIENT) {
      filter.patientId = req.user.id;
    } else if (req.user.role === USER_ROLES.DOCTOR) {
      filter.doctorId = req.user.doctorProfileId || '__unassigned__';
    } else if (doctorId) {
      filter.doctorId = String(doctorId);
    }

    if (status && Object.values(DFA_STATES).includes(status)) {
      filter.status = status;
    }
    if (date) {
      filter.appointmentDate = String(date).trim();
    }

    const appointments = await Appointment.find(filter)
      .populate('patientId', 'name email phone gender bloodGroup dateOfBirth')
      .populate('doctorId', 'name email specialization department roomNumber consultationFee')
      .sort({ appointmentDate: 1, createdAt: -1 })
      .lean();

    const filtered = appointments.filter((apt) => {
      if (!q || !String(q).trim()) return true;
      const term = String(q).trim().toLowerCase();
      const codeMatch = (apt.appointmentCode || '').toLowerCase().includes(term);
      const reasonMatch = (apt.reason || '').toLowerCase().includes(term);
      const patName = (apt.patientId?.name || '').toLowerCase().includes(term);
      const docName = (apt.doctorId?.name || '').toLowerCase().includes(term);
      const docSpec = (apt.doctorId?.specialization || '').toLowerCase().includes(term);
      return codeMatch || reasonMatch || patName || docName || docSpec;
    });

    const enriched = filtered.map((apt) => ({
      ...apt,
      allowedTransitions: getAllowedEvents(apt.status, req.user.role),
    }));

    return res.status(200).json({
      success: true,
      count: enriched.length,
      data: {
        appointments: enriched,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/appointments/:id
 */
async function getAppointmentById(req, res, next) {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate('patientId', 'name email phone gender bloodGroup dateOfBirth')
      .populate('doctorId', 'name email specialization department roomNumber consultationFee')
      .lean();

    if (!appointment) {
      return res.status(404).json({
        success: false,
        error: { message: 'Appointment not found.', code: 'APPOINTMENT_NOT_FOUND' },
      });
    }

    assertCanViewAppointment(appointment, req.user);

    const history = await AppointmentHistory.find({ appointmentId: String(appointment._id) })
      .sort({ createdAt: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: {
        appointment: {
          ...appointment,
          allowedTransitions: getAllowedEvents(appointment.status, req.user.role),
        },
        history,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/appointments/:id/history
 */
async function getAppointmentHistory(req, res, next) {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate('patientId', 'name email')
      .populate('doctorId', 'name specialization department')
      .lean();

    if (!appointment) {
      return res.status(404).json({
        success: false,
        error: { message: 'Appointment not found.', code: 'APPOINTMENT_NOT_FOUND' },
      });
    }

    assertCanViewAppointment(appointment, req.user);

    const history = await AppointmentHistory.find({ appointmentId: String(appointment._id) })
      .sort({ createdAt: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: history.length,
      data: {
        appointmentId: String(appointment._id),
        appointmentCode: appointment.appointmentCode,
        currentState: appointment.status,
        isTerminal: ['CANCELLED', 'REJECTED', 'COMPLETED'].includes(appointment.status),
        history,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Core Centralized DFA State Transition Handler
 *
 * Used by:
 * - POST /api/appointments/:id/transition
 * - PATCH /api/appointments/:id/approve
 * - PATCH /api/appointments/:id/reject
 * - PATCH /api/appointments/:id/reschedule
 * - PATCH /api/appointments/:id/cancel
 * - PATCH /api/appointments/:id/complete
 */
async function executeAppointmentDFATransition(req, res, next, fixedEvent = null) {
  const appointmentId = String(req.params.id);
  let slotLockKey = null;

  try {
    // 1. Block any attempt to pass `{ status: "..." }` directly
    assertNoDirectStatusMutation(req.body);

    const event = fixedEvent || (req.body && req.body.event);
    if (!event) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'DFA input event is required (APPROVE, REJECT, RESCHEDULE, CANCEL, or COMPLETE).',
          code: 'MISSING_DFA_EVENT',
        },
      });
    }

    // 2. Prevent concurrent state updates on the same appointment
    if (activeAppointmentLocks.has(appointmentId)) {
      return res.status(409).json({
        success: false,
        error: {
          message: 'Concurrent status modification detected for this appointment. Please retry.',
          code: 'CONCURRENT_STATUS_UPDATE_CONFLICT',
        },
      });
    }
    activeAppointmentLocks.add(appointmentId);

    const appointment = await Appointment.findById(appointmentId).lean();
    if (!appointment) {
      return res.status(404).json({
        success: false,
        error: { message: 'Appointment not found.', code: 'APPOINTMENT_NOT_FOUND' },
      });
    }

    // 3. Optional client optimistic lock check (`expectedVersion`)
    if (
      req.body &&
      req.body.expectedVersion !== undefined &&
      Number(req.body.expectedVersion) !== Number(appointment.__v || 0)
    ) {
      return res.status(409).json({
        success: false,
        error: {
          message: 'Stale appointment version detected. Another user modified this appointment concurrently.',
          code: 'OPTIMISTIC_LOCK_VERSION_MISMATCH',
        },
      });
    }

    // 4. Validate ownership, role permissions, terminal state lock, and formal δ(currentState, event)
    const dfaResult = validateAppointmentTransition(appointment, event, req.user);

    const { appointmentDate, timeSlot, reason, notes } = req.body || {};
    let nextDate = appointment.appointmentDate;
    let nextSlot = appointment.timeSlot;
    let nextRescheduleCount = Number(appointment.rescheduleCount || 0);

    // 5. Additional validation when event === RESCHEDULE
    if (event === DFA_EVENTS.RESCHEDULE) {
      if (!appointmentDate || !timeSlot) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Rescheduling requires both a new `appointmentDate` (YYYY-MM-DD) and `timeSlot`.',
            code: 'MISSING_RESCHEDULE_SLOT',
          },
        });
      }

      slotLockKey = `${appointment.doctorId}:${appointmentDate}:${String(timeSlot).trim()}`;
      if (activeSlotLocks.has(slotLockKey)) {
        return res.status(409).json({
          success: false,
          error: {
            message: 'Target reschedule slot is currently being booked by another request.',
            code: 'CONCURRENT_SLOT_LOCK_CONFLICT',
          },
        });
      }
      activeSlotLocks.add(slotLockKey);

      const validatedSlot = await validateDoctorAndSlotOnServer(
        appointment.doctorId,
        appointmentDate,
        timeSlot,
        appointment._id
      );

      nextDate = validatedSlot.validDate;
      nextSlot = validatedSlot.normalizedSlot;
      nextRescheduleCount += 1;
    }

    const updateSet = {
      status: dfaResult.nextState,
      lastEvent: dfaResult.event,
      appointmentDate: nextDate,
      timeSlot: nextSlot,
      rescheduleCount: nextRescheduleCount,
    };
    if (notes !== undefined) {
      updateSet.notes = String(notes).trim();
    }

    // 6. Atomic conditional update enforcing previous status and version (__v)
    const updated = await Appointment.findOneAndUpdate(
      {
        _id: String(appointment._id),
        status: appointment.status,
        __v: appointment.__v,
      },
      {
        $set: updateSet,
        $inc: { __v: 1 },
      },
      { new: true }
    )
      .populate('patientId', 'name email phone gender bloodGroup dateOfBirth')
      .populate('doctorId', 'name email specialization department roomNumber consultationFee')
      .lean();

    if (!updated) {
      throw new DFATransitionError(
        'Concurrent appointment state modification conflict detected. State changed during execution.',
        409,
        {
          code: 'CONCURRENT_MODIFICATION_CONFLICT',
          currentState: appointment.status,
          event,
        }
      );
    }

    // 7. Record immutable DFA transition in AppointmentHistory
    const historyEntry = await AppointmentHistory.create({
      appointmentId: String(updated._id),
      previousState: dfaResult.previousState,
      event: dfaResult.event,
      nextState: dfaResult.nextState,
      actorId: req.user.id,
      actorName: req.user.name,
      actorRole: req.user.role,
      reason: reason ? String(reason).trim() : dfaResult.description,
      appointmentDate: updated.appointmentDate,
      timeSlot: updated.timeSlot,
      versionAfter: updated.__v,
    });

    return res.status(200).json({
      success: true,
      message: `DFA Transition successful: ${dfaResult.previousState} --[${dfaResult.event}]--> ${dfaResult.nextState}`,
      data: {
        transition: dfaResult,
        historyEntry,
        appointment: {
          ...updated,
          allowedTransitions: getAllowedEvents(updated.status, req.user.role),
        },
      },
    });
  } catch (err) {
    next(err);
  } finally {
    activeAppointmentLocks.delete(appointmentId);
    if (slotLockKey) {
      activeSlotLocks.delete(slotLockKey);
    }
  }
}

/**
 * Rejects direct PUT/PATCH requests that attempt to modify appointment status without DFA events.
 */
async function rejectDirectStatusUpdate(req, res, next) {
  try {
    assertNoDirectStatusMutation(req.body);
    return res.status(409).json({
      success: false,
      error: {
        message: 'Direct appointment updates are disabled. Use DFA transition endpoints (/transition, /approve, /reject, /reschedule, /cancel, /complete).',
        code: 'DIRECT_UPDATE_FORBIDDEN',
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getDFADefinition,
  bookAppointment,
  listAppointments,
  getAppointmentById,
  getAppointmentHistory,
  executeAppointmentDFATransition,
  rejectDirectStatusUpdate,
};

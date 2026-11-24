/**
 * Doctor Directory & Availability Management Controller
 *
 * Implements:
 * - Doctor directory listing with search, specialization, and department filtering
 * - Doctor detail & real-time slot availability calculation against active appointments
 * - Doctor availability updates (restricted to the owning Doctor or Administrator)
 */

const Doctor = require('../models/Doctor');
const Appointment = require('../models/Appointment');
const { DFA_STATES, USER_ROLES } = require('../dfa/dfaConstants');

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getWeekdayName(dateStr) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr || ''));
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const dt = new Date(Date.UTC(year, month, day));
  if (Number.isNaN(dt.getTime())) return null;
  return WEEKDAYS[dt.getUTCDay()];
}

/**
 * Computes real-time available and booked slots for a doctor on a specific YYYY-MM-DD date.
 */
async function computeDoctorSlotAvailability(doctor, dateStr) {
  const weekday = getWeekdayName(dateStr);
  if (!weekday) {
    return {
      date: dateStr,
      weekday: null,
      isDoctorAvailable: Boolean(doctor.isAvailable),
      isWorkingDay: false,
      isBlockedDate: false,
      allConfiguredSlots: doctor.availableSlots || [],
      bookedSlots: [],
      availableSlots: [],
    };
  }

  const isWorkingDay = Array.isArray(doctor.availableDays) && doctor.availableDays.includes(weekday);
  const isBlockedDate = Array.isArray(doctor.blockedDates) && doctor.blockedDates.includes(dateStr);

  // Active appointments occupying slots on this date
  const activeAppointments = await Appointment.find({
    doctorId: String(doctor._id),
    appointmentDate: dateStr,
    status: { $in: [DFA_STATES.REQUESTED, DFA_STATES.CONFIRMED, DFA_STATES.RESCHEDULED] },
  }).lean();

  const bookedSlots = activeAppointments.map((a) => a.timeSlot);
  const allSlots = Array.isArray(doctor.availableSlots) ? doctor.availableSlots : [];

  const availableSlots =
    doctor.isAvailable && isWorkingDay && !isBlockedDate
      ? allSlots.filter((slot) => !bookedSlots.includes(slot))
      : [];

  return {
    date: dateStr,
    weekday,
    isDoctorAvailable: Boolean(doctor.isAvailable),
    isWorkingDay,
    isBlockedDate,
    allConfiguredSlots: allSlots,
    bookedSlots,
    availableSlots,
  };
}

/**
 * GET /api/doctors
 * Public/Authenticated endpoint returning the hospital doctor directory.
 */
async function listDoctors(req, res, next) {
  try {
    const { q, specialization, department, availableOnly } = req.query || {};
    const doctors = await Doctor.find({}).sort({ name: 1 }).lean();

    const filtered = doctors.filter((doc) => {
      if (availableOnly === 'true' && !doc.isAvailable) return false;
      if (specialization && doc.specialization.toLowerCase() !== String(specialization).toLowerCase()) {
        return false;
      }
      if (department && doc.department.toLowerCase() !== String(department).toLowerCase()) {
        return false;
      }
      if (q && String(q).trim()) {
        const term = String(q).trim().toLowerCase();
        const matchName = doc.name.toLowerCase().includes(term);
        const matchSpec = doc.specialization.toLowerCase().includes(term);
        const matchDept = doc.department.toLowerCase().includes(term);
        if (!matchName && !matchSpec && !matchDept) return false;
      }
      return true;
    });

    return res.status(200).json({
      success: true,
      count: filtered.length,
      data: {
        doctors: filtered,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/doctors/:id
 * Returns doctor details along with slot availability for `?date=YYYY-MM-DD`.
 */
async function getDoctorById(req, res, next) {
  try {
    const doctor = await Doctor.findById(req.params.id).lean();
    if (!doctor) {
      return res.status(404).json({
        success: false,
        error: { message: 'Doctor not found.', code: 'DOCTOR_NOT_FOUND' },
      });
    }

    const targetDate =
      req.query.date ||
      new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const slotAvailability = await computeDoctorSlotAvailability(doctor, targetDate);

    return res.status(200).json({
      success: true,
      data: {
        doctor,
        slotAvailability,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/doctors/:id/slots?date=YYYY-MM-DD
 */
async function getDoctorSlots(req, res, next) {
  try {
    const doctor = await Doctor.findById(req.params.id).lean();
    if (!doctor) {
      return res.status(404).json({
        success: false,
        error: { message: 'Doctor not found.', code: 'DOCTOR_NOT_FOUND' },
      });
    }

    const dateStr = req.query.date;
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr))) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Query parameter `date` in YYYY-MM-DD format is required.',
          code: 'INVALID_DATE_FORMAT',
        },
      });
    }

    const slotAvailability = await computeDoctorSlotAvailability(doctor, dateStr);
    return res.status(200).json({
      success: true,
      data: slotAvailability,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/doctors/:id/availability
 * Protected: Only the Doctor who owns this profile or an Administrator may modify availability.
 */
async function updateDoctorAvailability(req, res, next) {
  try {
    const doctor = await Doctor.findById(req.params.id).lean();
    if (!doctor) {
      return res.status(404).json({
        success: false,
        error: { message: 'Doctor not found.', code: 'DOCTOR_NOT_FOUND' },
      });
    }

    // Ownership verification for Doctor role (IDOR prevention)
    if (
      req.user.role === USER_ROLES.DOCTOR &&
      String(doctor.userId) !== String(req.user.id) &&
      String(doctor._id) !== String(req.user.doctorProfileId)
    ) {
      return res.status(403).json({
        success: false,
        error: {
          message: 'Forbidden: You may only update your own doctor availability schedule.',
          code: 'IDOR_DOCTOR_AVAILABILITY_VIOLATION',
        },
      });
    }

    const {
      availableDays,
      availableSlots,
      blockedDates,
      isAvailable,
      consultationFee,
      roomNumber,
      bio,
    } = req.body || {};

    const updates = {};

    if (availableDays !== undefined) {
      if (!Array.isArray(availableDays) || availableDays.some((d) => !WEEKDAYS.includes(d))) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'availableDays must be an array of valid weekday names (Monday-Sunday).',
            code: 'INVALID_AVAILABLE_DAYS',
          },
        });
      }
      updates.availableDays = availableDays;
    }

    if (availableSlots !== undefined) {
      if (!Array.isArray(availableSlots) || availableSlots.length === 0) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'availableSlots must be a non-empty array of time slot strings.',
            code: 'INVALID_AVAILABLE_SLOTS',
          },
        });
      }
      updates.availableSlots = availableSlots.map((s) => String(s).trim()).filter(Boolean);
    }

    if (blockedDates !== undefined) {
      if (!Array.isArray(blockedDates)) {
        return res.status(400).json({
          success: false,
          error: { message: 'blockedDates must be an array of YYYY-MM-DD strings.', code: 'INVALID_BLOCKED_DATES' },
        });
      }
      updates.blockedDates = blockedDates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d)));
    }

    if (typeof isAvailable === 'boolean') {
      updates.isAvailable = isAvailable;
    }
    if (consultationFee !== undefined && Number(consultationFee) >= 0) {
      updates.consultationFee = Number(consultationFee);
    }
    if (roomNumber !== undefined) {
      updates.roomNumber = String(roomNumber).trim();
    }
    if (bio !== undefined) {
      updates.bio = String(bio).trim();
    }

    const updatedDoctor = await Doctor.findByIdAndUpdate(
      doctor._id,
      { $set: updates },
      { new: true }
    ).lean();

    return res.status(200).json({
      success: true,
      message: 'Doctor availability updated successfully.',
      data: {
        doctor: updatedDoctor,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listDoctors,
  getDoctorById,
  getDoctorSlots,
  updateDoctorAvailability,
  computeDoctorSlotAvailability,
  getWeekdayName,
};

/**
 * Administrator Controller
 *
 * Provides:
 * - Hospital-wide KPIs & DFA state distribution statistics
 * - Doctor onboarding (creating a Doctor user + Doctor profile)
 * - User directory & account status management
 * - Global DFA transition audit log inspection
 *
 * Note: Administrators CANNOT bypass the DFA engine to arbitrarily set appointment statuses.
 */

const User = require('../models/User');
const Doctor = require('../models/Doctor');
const Appointment = require('../models/Appointment');
const AppointmentHistory = require('../models/AppointmentHistory');
const { hashPassword } = require('../utils/cryptoAuth');
const { DFA_STATES, USER_ROLES } = require('../dfa/dfaConstants');

/**
 * GET /api/admin/overview
 */
async function getSystemOverview(_req, res, next) {
  try {
    const [users, doctors, appointments, recentHistory] = await Promise.all([
      User.find({}).sort({ createdAt: -1 }).lean(),
      Doctor.find({}).sort({ name: 1 }).lean(),
      Appointment.find({})
        .populate('patientId', 'name email')
        .populate('doctorId', 'name specialization department')
        .sort({ createdAt: -1 })
        .lean(),
      AppointmentHistory.find({})
        .populate('appointmentId', 'appointmentCode status')
        .sort({ createdAt: -1 })
        .limit(40)
        .lean(),
    ]);

    const stateCounts = {};
    for (const s of Object.values(DFA_STATES)) {
      stateCounts[s] = 0;
    }
    for (const apt of appointments) {
      stateCounts[apt.status] = (stateCounts[apt.status] || 0) + 1;
    }

    const totalPatients = users.filter((u) => u.role === USER_ROLES.PATIENT).length;
    const totalDoctors = doctors.length;
    const totalAdmins = users.filter((u) => u.role === USER_ROLES.ADMIN).length;

    return res.status(200).json({
      success: true,
      data: {
        metrics: {
          totalUsers: users.length,
          totalPatients,
          totalDoctors,
          totalAdmins,
          totalAppointments: appointments.length,
          stateCounts,
        },
        users,
        doctors,
        recentAppointments: appointments.slice(0, 25),
        recentHistory,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/admin/doctors
 * Allows an Administrator to onboard a new Doctor account and clinical profile.
 */
async function createDoctorAccount(req, res, next) {
  try {
    const {
      name,
      email,
      password,
      specialization,
      department,
      qualification,
      experienceYears,
      consultationFee,
      roomNumber,
      bio,
      availableDays,
      availableSlots,
    } = req.body || {};

    if (!name || !email || !password || !specialization || !department || !qualification) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'name, email, password, specialization, department, and qualification are required.',
          code: 'MISSING_DOCTOR_FIELDS',
        },
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail }).lean();
    if (existing) {
      return res.status(409).json({
        success: false,
        error: {
          message: 'A user with this email already exists.',
          code: 'EMAIL_ALREADY_EXISTS',
        },
      });
    }

    const passwordHash = await hashPassword(String(password));
    const doctorUser = await User.create({
      name: String(name).trim(),
      email: normalizedEmail,
      passwordHash,
      role: USER_ROLES.DOCTOR,
      isActive: true,
    });

    const doctorProfile = await Doctor.create({
      userId: String(doctorUser._id),
      name: String(name).trim(),
      email: normalizedEmail,
      specialization: String(specialization).trim(),
      department: String(department).trim(),
      qualification: String(qualification).trim(),
      experienceYears: Number(experienceYears || 5),
      consultationFee: Number(consultationFee || 500),
      roomNumber: roomNumber ? String(roomNumber).trim() : 'OPD-201',
      bio: bio ? String(bio).trim() : '',
      availableDays: Array.isArray(availableDays) && availableDays.length > 0
        ? availableDays
        : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      availableSlots: Array.isArray(availableSlots) && availableSlots.length > 0
        ? availableSlots
        : ['09:00 AM', '10:00 AM', '11:00 AM', '02:00 PM', '03:00 PM'],
      isAvailable: true,
    });

    return res.status(201).json({
      success: true,
      message: 'Doctor account and clinical profile created successfully.',
      data: {
        user: {
          id: String(doctorUser._id),
          name: doctorUser.name,
          email: doctorUser.email,
          role: doctorUser.role,
        },
        doctorProfile,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getSystemOverview,
  createDoctorAccount,
};

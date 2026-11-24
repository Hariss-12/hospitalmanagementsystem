/**
 * Database Seed Utility
 *
 * Seeds initial Hospital Administrator, 4 specialist Doctors across departments,
 * and 2 Patients so the system is immediately ready for testing and evaluation.
 */

const User = require('../models/User');
const Doctor = require('../models/Doctor');
const Appointment = require('../models/Appointment');
const AppointmentHistory = require('../models/AppointmentHistory');
const { hashPassword } = require('./cryptoAuth');
const { USER_ROLES, DFA_STATES } = require('../dfa/dfaConstants');

async function seedDatabase({ forceReset = false } = {}) {
  if (forceReset) {
    await AppointmentHistory.deleteMany({});
    await Appointment.deleteMany({});
    await Doctor.deleteMany({});
    await User.deleteMany({});
  }

  const existingAdmin = await User.findOne({ email: 'admin@aegishealth.org' }).lean();
  if (existingAdmin && !forceReset) {
    const doctors = await Doctor.find({}).lean();
    const patients = await User.find({ role: USER_ROLES.PATIENT }).lean();
    return { admin: existingAdmin, doctors, patients, seeded: false };
  }

  const defaultPasswordHash = await hashPassword('Hospital@123');

  // 1. Seed Hospital Administrator
  const admin = await User.create({
    name: 'Dr. Vikram Sethi (Chief Medical Admin)',
    email: 'admin@aegishealth.org',
    passwordHash: defaultPasswordHash,
    role: USER_ROLES.ADMIN,
    phone: '+91-9840010001',
    gender: 'Male',
    address: 'Aegis Multispeciality Hospital, Chennai, Tamil Nadu',
    isActive: true,
  });

  // 2. Seed Specialist Doctors
  const doctorSeeds = [
    {
      name: 'Dr. Ananya Krishnan',
      email: 'ananya.cardio@aegishealth.org',
      specialization: 'Interventional Cardiology',
      department: 'Cardiology',
      qualification: 'MBBS, MD, DM (Cardiology)',
      experienceYears: 12,
      consultationFee: 800,
      roomNumber: 'CARD-101',
      bio: 'Senior Interventional Cardiologist specializing in coronary imaging, heart failure management, and preventive cardiology.',
      availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      availableSlots: ['09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '02:00 PM', '03:00 PM', '04:00 PM'],
    },
    {
      name: 'Dr. Rajeshwar Nair',
      email: 'rajeshwar.neuro@aegishealth.org',
      specialization: 'Clinical Neurology',
      department: 'Neurology',
      qualification: 'MBBS, MD, DM (Neurology)',
      experienceYears: 15,
      consultationFee: 950,
      roomNumber: 'NEURO-204',
      bio: 'Lead Neurologist focusing on stroke rehabilitation, epilepsy, and neuro-electrophysiology.',
      availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      availableSlots: ['09:00 AM', '10:00 AM', '11:00 AM', '11:30 AM', '02:30 PM', '03:30 PM', '04:30 PM'],
    },
    {
      name: 'Dr. Meenakshi Sundaram',
      email: 'meenakshi.ortho@aegishealth.org',
      specialization: 'Orthopaedics & Sports Medicine',
      department: 'Orthopaedics',
      qualification: 'MBBS, MS (Ortho), DNB',
      experienceYears: 9,
      consultationFee: 650,
      roomNumber: 'ORTHO-112',
      bio: 'Specialist in arthroscopic knee and shoulder reconstruction, joint preservation, and trauma care.',
      availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      availableSlots: ['09:30 AM', '10:00 AM', '10:30 AM', '11:30 AM', '02:00 PM', '03:00 PM'],
    },
    {
      name: 'Dr. Karthik Subramanian',
      email: 'karthik.general@aegishealth.org',
      specialization: 'Internal Medicine & Diabetology',
      department: 'General Medicine',
      qualification: 'MBBS, MD (General Medicine)',
      experienceYears: 8,
      consultationFee: 500,
      roomNumber: 'OPD-105',
      bio: 'Consultant Physician specializing in metabolic disorders, infectious diseases, and preventive health screenings.',
      availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      availableSlots: ['09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '02:00 PM', '02:30 PM', '03:00 PM'],
    },
  ];

  const createdDoctors = [];
  for (const ds of doctorSeeds) {
    const docUser = await User.create({
      name: ds.name,
      email: ds.email,
      passwordHash: defaultPasswordHash,
      role: USER_ROLES.DOCTOR,
      phone: '+91-9840020000',
      isActive: true,
    });

    const docProfile = await Doctor.create({
      userId: String(docUser._id),
      name: ds.name,
      email: ds.email,
      specialization: ds.specialization,
      department: ds.department,
      qualification: ds.qualification,
      experienceYears: ds.experienceYears,
      consultationFee: ds.consultationFee,
      roomNumber: ds.roomNumber,
      bio: ds.bio,
      availableDays: ds.availableDays,
      availableSlots: ds.availableSlots,
      blockedDates: [],
      isAvailable: true,
    });
    createdDoctors.push(docProfile);
  }

  // 3. Seed Sample Patients
  const patient1 = await User.create({
    name: 'Aravind Swaminathan',
    email: 'aravind.patient@aegishealth.org',
    passwordHash: defaultPasswordHash,
    role: USER_ROLES.PATIENT,
    phone: '+91-9443011223',
    dateOfBirth: '1998-05-14',
    gender: 'Male',
    bloodGroup: 'O+',
    address: '42 Anna Nagar East, Chennai, Tamil Nadu',
    isActive: true,
  });

  const patient2 = await User.create({
    name: 'Priya Darshini',
    email: 'priya.patient@aegishealth.org',
    passwordHash: defaultPasswordHash,
    role: USER_ROLES.PATIENT,
    phone: '+91-9443099887',
    dateOfBirth: '2001-11-22',
    gender: 'Female',
    bloodGroup: 'B+',
    address: '18 Peelamedu Main Rd, Coimbatore, Tamil Nadu',
    isActive: true,
  });

  // 4. Seed 2 sample appointments in different DFA states for instant demonstration
  const tomorrow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const dayAfter = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const apt1 = await Appointment.create({
    appointmentCode: 'APT-SEED-1001',
    patientId: String(patient1._id),
    doctorId: String(createdDoctors[0]._id),
    appointmentDate: tomorrow,
    timeSlot: '09:00 AM',
    reason: 'Routine cardiac ECG evaluation and blood pressure review',
    symptoms: 'Mild exertional fatigue',
    notes: 'Bring previous lipid profile report',
    status: DFA_STATES.CONFIRMED,
    lastEvent: 'APPROVE',
    rescheduleCount: 0,
  });

  await AppointmentHistory.create([
    {
      appointmentId: String(apt1._id),
      previousState: 'NONE',
      event: 'BOOK_INITIAL',
      nextState: DFA_STATES.REQUESTED,
      actorId: String(patient1._id),
      actorName: patient1.name,
      actorRole: USER_ROLES.PATIENT,
      reason: 'Initial appointment booked: Routine cardiac ECG evaluation',
      appointmentDate: tomorrow,
      timeSlot: '09:00 AM',
      versionAfter: 0,
    },
    {
      appointmentId: String(apt1._id),
      previousState: DFA_STATES.REQUESTED,
      event: 'APPROVE',
      nextState: DFA_STATES.CONFIRMED,
      actorId: String(createdDoctors[0].userId),
      actorName: createdDoctors[0].name,
      actorRole: USER_ROLES.DOCTOR,
      reason: 'Slot verified and confirmed by Cardiology OPD.',
      appointmentDate: tomorrow,
      timeSlot: '09:00 AM',
      versionAfter: 1,
    },
  ]);

  const apt2 = await Appointment.create({
    appointmentCode: 'APT-SEED-1002',
    patientId: String(patient2._id),
    doctorId: String(createdDoctors[1]._id),
    appointmentDate: dayAfter,
    timeSlot: '10:00 AM',
    reason: 'Migraine frequency assessment and neurological consultation',
    symptoms: 'Photophobia and episodic headache',
    notes: '',
    status: DFA_STATES.REQUESTED,
    lastEvent: 'BOOK_INITIAL',
    rescheduleCount: 0,
  });

  await AppointmentHistory.create({
    appointmentId: String(apt2._id),
    previousState: 'NONE',
    event: 'BOOK_INITIAL',
    nextState: DFA_STATES.REQUESTED,
    actorId: String(patient2._id),
    actorName: patient2.name,
    actorRole: USER_ROLES.PATIENT,
    reason: 'Initial appointment booked: Migraine frequency assessment',
    appointmentDate: dayAfter,
    timeSlot: '10:00 AM',
    versionAfter: 0,
  });

  return {
    admin,
    doctors: createdDoctors,
    patients: [patient1, patient2],
    seeded: true,
  };
}

if (require.main === module) {
  const { connectDB, disconnectDB } = require('../config/db');
  connectDB()
    .then(() => seedDatabase({ forceReset: true }))
    .then((res) => {
      console.log(
        `Database seeded successfully: 1 Admin, ${res.doctors.length} Doctors, ${res.patients.length} Patients.`
      );
      return disconnectDB();
    })
    .catch((err) => {
      console.error('Seed error:', err);
      process.exit(1);
    });
}

module.exports = {
  seedDatabase,
};

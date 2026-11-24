/**
 * Doctor Schema
 *
 * Stores clinical specialization, department, consultation fee, weekly available days,
 * standardized time slots, and specific blocked dates.
 */

const mongoose = require('../config/mongoose');

const doctorSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: [true, 'Doctor name is required.'],
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    specialization: {
      type: String,
      required: [true, 'Specialization is required.'],
      trim: true,
    },
    department: {
      type: String,
      required: [true, 'Department is required.'],
      trim: true,
    },
    qualification: {
      type: String,
      required: [true, 'Qualification is required.'],
      trim: true,
    },
    experienceYears: {
      type: Number,
      default: 5,
    },
    consultationFee: {
      type: Number,
      default: 500,
    },
    roomNumber: {
      type: String,
      default: 'OPD-101',
    },
    bio: {
      type: String,
      default: '',
    },
    availableDays: {
      type: Array,
      default: () => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    },
    availableSlots: {
      type: Array,
      default: () => [
        '09:00 AM',
        '09:30 AM',
        '10:00 AM',
        '10:30 AM',
        '11:00 AM',
        '11:30 AM',
        '02:00 PM',
        '02:30 PM',
        '03:00 PM',
        '04:00 PM',
      ],
    },
    blockedDates: {
      type: Array,
      default: () => [],
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Doctor', doctorSchema);

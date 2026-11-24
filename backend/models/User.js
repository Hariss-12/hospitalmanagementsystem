/**
 * User Schema (Patient, Doctor, Administrator)
 *
 * Security Rules:
 * - `passwordHash` has `select: false` so it is NEVER serialized by default.
 * - `role` is strictly constrained to ['Patient', 'Doctor', 'Administrator'].
 * - Public registration always sets `role = 'Patient'` in the controller.
 */

const mongoose = require('../config/mongoose');
const { USER_ROLES } = require('../dfa/dfaConstants');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Full name is required.'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email address is required.'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required.'],
      select: false,
    },
    role: {
      type: String,
      enum: Object.values(USER_ROLES),
      default: USER_ROLES.PATIENT,
      required: true,
    },
    phone: {
      type: String,
      default: '',
      trim: true,
    },
    dateOfBirth: {
      type: String,
      default: '',
    },
    gender: {
      type: String,
      enum: ['Male', 'Female', 'Other', 'Prefer not to say', ''],
      default: '',
    },
    bloodGroup: {
      type: String,
      default: '',
    },
    address: {
      type: String,
      default: '',
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('User', userSchema);

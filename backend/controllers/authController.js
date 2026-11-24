/**
 * Authentication Controller
 *
 * Implements:
 * - Patient Registration (strictly enforces role = 'Patient', never trusts client role)
 * - Login (Patient, Doctor, Administrator) with constant-time password verification
 * - Logout (JWT JTI revocation + HttpOnly cookie clearing)
 * - Profile retrieval and safe profile update
 */

const User = require('../models/User');
const Doctor = require('../models/Doctor');
const { hashPassword, verifyPassword, signJwt } = require('../utils/cryptoAuth');
const { revokeTokenJti } = require('../middleware/authMiddleware');
const { USER_ROLES } = require('../dfa/dfaConstants');
const ENV = require('../config/env');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validatePasswordStrength(password) {
  if (typeof password !== 'string' || password.length < 8) {
    return 'Password must be at least 8 characters long.';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter.';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter.';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one digit.';
  }
  return null;
}

function setAuthCookie(res, token) {
  res.cookie('hospital_jwt', token, {
    httpOnly: true,
    secure: ENV.NODE_ENV === 'production',
    sameSite: 'Strict',
    maxAge: 4 * 60 * 60 * 1000, // 4 hours
    path: '/',
  });
}

/**
 * POST /api/auth/register
 * Public endpoint for Patient registration.
 * Security: Strictly ignores any `role` supplied in request body and forces `Patient`.
 */
async function register(req, res, next) {
  try {
    const { name, email, password, phone, dateOfBirth, gender, bloodGroup, address } = req.body || {};

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Full name is required and must be at least 2 characters.',
          code: 'INVALID_NAME',
        },
      });
    }

    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'A valid email address is required.',
          code: 'INVALID_EMAIL',
        },
      });
    }

    const pwdError = validatePasswordStrength(password);
    if (pwdError) {
      return res.status(400).json({
        success: false,
        error: {
          message: pwdError,
          code: 'WEAK_PASSWORD',
        },
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail }).lean();
    if (existing) {
      return res.status(409).json({
        success: false,
        error: {
          message: 'An account with this email address already exists.',
          code: 'EMAIL_ALREADY_REGISTERED',
        },
      });
    }

    const passwordHash = await hashPassword(password);

    // SECURITY: Never trust req.body.role — always enforce USER_ROLES.PATIENT on public registration
    const createdUser = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: USER_ROLES.PATIENT,
      phone: phone ? String(phone).trim() : '',
      dateOfBirth: dateOfBirth ? String(dateOfBirth).trim() : '',
      gender: ['Male', 'Female', 'Other', 'Prefer not to say'].includes(gender) ? gender : '',
      bloodGroup: bloodGroup ? String(bloodGroup).trim() : '',
      address: address ? String(address).trim() : '',
      isActive: true,
    });

    const token = signJwt({
      id: String(createdUser._id),
      role: USER_ROLES.PATIENT,
      email: createdUser.email,
    });

    setAuthCookie(res, token);

    return res.status(201).json({
      success: true,
      message: 'Patient account registered successfully.',
      data: {
        token,
        user: {
          id: String(createdUser._id),
          name: createdUser.name,
          email: createdUser.email,
          role: createdUser.role,
          phone: createdUser.phone,
          dateOfBirth: createdUser.dateOfBirth,
          gender: createdUser.gender,
          bloodGroup: createdUser.bloodGroup,
          address: createdUser.address,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/login
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body || {};

    if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Email and password are required.',
          code: 'MISSING_CREDENTIALS',
        },
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail }).select('+passwordHash').lean();

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Invalid email or password.',
          code: 'INVALID_CREDENTIALS',
        },
      });
    }

    const isMatch = await verifyPassword(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Invalid email or password.',
          code: 'INVALID_CREDENTIALS',
        },
      });
    }

    let doctorProfileId = null;
    if (user.role === USER_ROLES.DOCTOR) {
      const docProfile = await Doctor.findOne({ userId: String(user._id) }).lean();
      if (docProfile) {
        doctorProfileId = String(docProfile._id);
      }
    }

    const token = signJwt({
      id: String(user._id),
      role: user.role,
      email: user.email,
      doctorProfileId,
    });

    setAuthCookie(res, token);

    return res.status(200).json({
      success: true,
      message: 'Logged in successfully.',
      data: {
        token,
        user: {
          id: String(user._id),
          name: user.name,
          email: user.email,
          role: user.role,
          doctorProfileId,
          phone: user.phone,
          dateOfBirth: user.dateOfBirth,
          gender: user.gender,
          bloodGroup: user.bloodGroup,
          address: user.address,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/logout
 */
async function logout(req, res, next) {
  try {
    if (req.user && req.user.jti) {
      revokeTokenJti(req.user.jti);
    }
    res.clearCookie('hospital_jwt', { path: '/' });
    return res.status(200).json({
      success: true,
      message: 'Logged out successfully.',
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/auth/me
 */
async function getMe(req, res, next) {
  try {
<<<<<<< HEAD
    const user = req.authenticatedUser;
=======
    const user = await User.findById(req.user.id).lean();
    if (!user) {
      return res.status(404).json({
        success: false,
        error: { message: 'User not found.', code: 'USER_NOT_FOUND' },
      });
    }
>>>>>>> ce80f239edc9e0b467abb27280f2a6646f4c47a5

    let doctorProfile = null;
    if (user.role === USER_ROLES.DOCTOR) {
      doctorProfile = await Doctor.findOne({ userId: String(user._id) }).lean();
    }

    return res.status(200).json({
      success: true,
      data: {
        user: {
          id: String(user._id),
          name: user.name,
          email: user.email,
          role: user.role,
          doctorProfileId: doctorProfile ? String(doctorProfile._id) : null,
          doctorProfile,
          phone: user.phone,
          dateOfBirth: user.dateOfBirth,
          gender: user.gender,
          bloodGroup: user.bloodGroup,
          address: user.address,
          createdAt: user.createdAt,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/auth/profile
 * Allows authenticated user to update personal demographic details.
 * Strictly blocks modifying `role`, `email`, or `passwordHash`.
 */
async function updateProfile(req, res, next) {
  try {
    if (req.body && Object.prototype.hasOwnProperty.call(req.body, 'role')) {
      return res.status(403).json({
        success: false,
        error: {
          message: 'Forbidden: Role modification is not permitted through profile settings.',
          code: 'ROLE_ESCALATION_FORBIDDEN',
        },
      });
    }

    const { name, phone, dateOfBirth, gender, bloodGroup, address } = req.body || {};
    const updates = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length < 2) {
        return res.status(400).json({
          success: false,
          error: { message: 'Name must be at least 2 characters.', code: 'INVALID_NAME' },
        });
      }
      updates.name = name.trim();
    }
    if (phone !== undefined) updates.phone = String(phone).trim();
    if (dateOfBirth !== undefined) updates.dateOfBirth = String(dateOfBirth).trim();
    if (gender !== undefined && ['Male', 'Female', 'Other', 'Prefer not to say', ''].includes(gender)) {
      updates.gender = gender;
    }
    if (bloodGroup !== undefined) updates.bloodGroup = String(bloodGroup).trim();
    if (address !== undefined) updates.address = String(address).trim();

    const updated = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      { new: true }
    ).lean();

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      data: {
        user: {
          id: String(updated._id),
          name: updated.name,
          email: updated.email,
          role: updated.role,
          phone: updated.phone,
          dateOfBirth: updated.dateOfBirth,
          gender: updated.gender,
          bloodGroup: updated.bloodGroup,
          address: updated.address,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  register,
  login,
  logout,
  getMe,
  updateProfile,
};

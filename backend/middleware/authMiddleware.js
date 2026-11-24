/**
 * Backend Authentication Middleware (JWT Verification + Revocation Check + User Hydration)
 */

const { verifyJwt } = require('../utils/cryptoAuth');
const User = require('../models/User');
const Doctor = require('../models/Doctor');

// In-memory revoked token JTI set for immediate logout invalidation
const revokedTokens = new Set();

function revokeTokenJti(jti) {
  if (jti) {
    revokedTokens.add(jti);
  }
}

function extractToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  if (req.cookies && req.cookies.hospital_jwt) {
    return req.cookies.hospital_jwt;
  }
  return null;
}

async function authenticate(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Authentication required. Please provide a valid Bearer token or session cookie.',
          code: 'AUTH_TOKEN_MISSING',
        },
      });
    }

    let decoded;
    try {
      decoded = verifyJwt(token);
    } catch (jwtErr) {
      return res.status(401).json({
        success: false,
        error: {
          message: jwtErr.message || 'Invalid or expired authentication token.',
          code: 'AUTH_TOKEN_INVALID',
        },
      });
    }

    if (decoded.jti && revokedTokens.has(decoded.jti)) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Session has been logged out. Please sign in again.',
          code: 'AUTH_TOKEN_REVOKED',
        },
      });
    }

    // Fetch live user record from DB — NEVER trust client-supplied role without DB verification
    const user = await User.findById(decoded.id).lean();
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'User account not found or has been deactivated.',
          code: 'USER_INACTIVE_OR_DELETED',
        },
      });
    }

    let doctorProfileId = decoded.doctorProfileId || null;
    if (user.role === 'Doctor' && !doctorProfileId) {
      const docProfile = await Doctor.findOne({ userId: String(user._id) }).lean();
      if (docProfile) {
        doctorProfileId = String(docProfile._id);
      }
    }

    req.user = {
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role, // Verified authoritative role from DB
      doctorProfileId,
      jti: decoded.jti,
    };
<<<<<<< HEAD
    req.authenticatedUser = user;
=======
>>>>>>> ce80f239edc9e0b467abb27280f2a6646f4c47a5

    next();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  authenticate,
  revokeTokenJti,
  extractToken,
};

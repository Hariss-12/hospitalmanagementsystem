const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointmentController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { DFA_EVENTS, USER_ROLES } = require('../dfa/dfaConstants');

// All appointment endpoints require authentication
router.use(authenticate);

// Book appointment (Patients & Administrators)
router.post(
  '/',
  authorizeRoles(USER_ROLES.PATIENT, USER_ROLES.ADMIN),
  appointmentController.bookAppointment
);

// List appointments (Role-scoped inside controller)
router.get('/', appointmentController.listAppointments);

// Get single appointment details + history
router.get('/:id', appointmentController.getAppointmentById);

// Get appointment DFA transition history
router.get('/:id/history', appointmentController.getAppointmentHistory);

// Centralized DFA Event Transition Endpoint
router.post('/:id/transition', (req, res, next) =>
  appointmentController.executeAppointmentDFATransition(req, res, next, null)
);

// Semantic DFA Event Endpoints (All strictly mediated by the centralized DFA Engine)
router.patch(
  '/:id/approve',
  authorizeRoles(USER_ROLES.DOCTOR, USER_ROLES.ADMIN),
  (req, res, next) =>
    appointmentController.executeAppointmentDFATransition(req, res, next, DFA_EVENTS.APPROVE)
);

router.patch(
  '/:id/reject',
  authorizeRoles(USER_ROLES.DOCTOR, USER_ROLES.ADMIN),
  (req, res, next) =>
    appointmentController.executeAppointmentDFATransition(req, res, next, DFA_EVENTS.REJECT)
);

router.patch(
  '/:id/reschedule',
  authorizeRoles(USER_ROLES.PATIENT, USER_ROLES.DOCTOR, USER_ROLES.ADMIN),
  (req, res, next) =>
    appointmentController.executeAppointmentDFATransition(req, res, next, DFA_EVENTS.RESCHEDULE)
);

router.patch(
  '/:id/cancel',
  authorizeRoles(USER_ROLES.PATIENT, USER_ROLES.DOCTOR, USER_ROLES.ADMIN),
  (req, res, next) =>
    appointmentController.executeAppointmentDFATransition(req, res, next, DFA_EVENTS.CANCEL)
);

router.patch(
  '/:id/complete',
  authorizeRoles(USER_ROLES.DOCTOR, USER_ROLES.ADMIN),
  (req, res, next) =>
    appointmentController.executeAppointmentDFATransition(req, res, next, DFA_EVENTS.COMPLETE)
);

// Block direct PUT/PATCH status tampering
router.put('/:id', appointmentController.rejectDirectStatusUpdate);
router.patch('/:id', appointmentController.rejectDirectStatusUpdate);

module.exports = router;

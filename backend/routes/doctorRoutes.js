const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctorController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { USER_ROLES } = require('../dfa/dfaConstants');

router.get('/', doctorController.listDoctors);
router.get('/:id', doctorController.getDoctorById);
router.get('/:id/slots', doctorController.getDoctorSlots);
router.put(
  '/:id/availability',
  authenticate,
  authorizeRoles(USER_ROLES.DOCTOR, USER_ROLES.ADMIN),
  doctorController.updateDoctorAvailability
);

module.exports = router;

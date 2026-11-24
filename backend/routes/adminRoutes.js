const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { USER_ROLES } = require('../dfa/dfaConstants');

router.use(authenticate);
router.use(authorizeRoles(USER_ROLES.ADMIN));

router.get('/overview', adminController.getSystemOverview);
router.post('/doctors', adminController.createDoctorAccount);

module.exports = router;

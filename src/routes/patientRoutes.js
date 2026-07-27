const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  bookAppointment,
  getPatientAppointments,
  getAppointmentById,
  cancelAppointment,
  bookAppointmentValidation,
} = require('../controllers/patientController');

// All patient routes require authentication and patient role
router.use(authenticate, authorize('patient'));

/**
 * @swagger
 * /api/patients/appointments:
 *   get:
 *     summary: Get patient's appointments
 *     tags: [Patients]
 *     security:
 *       - bearerAuth: []
 *   post:
 *     summary: Book an appointment
 *     tags: [Patients]
 *     security:
 *       - bearerAuth: []
 */
router.get('/appointments', getPatientAppointments);
router.post('/appointments', bookAppointmentValidation, validate, bookAppointment);
router.get('/appointments/:id', getAppointmentById);
router.put('/appointments/:id/cancel', cancelAppointment);

module.exports = router;

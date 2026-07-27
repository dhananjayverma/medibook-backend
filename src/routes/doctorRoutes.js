const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  getDoctors,
  getSpecializations,
  getDoctorById,
  getDoctorSlots,
  addSlot,
  updateSlot,
  deleteSlot,
  getDoctorAppointments,
  updateAppointmentStatus,
  addSlotValidation,
} = require('../controllers/doctorController');

// ─── Public routes ────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/doctors:
 *   get:
 *     summary: Search and list doctors
 *     tags: [Doctors]
 *     parameters:
 *       - in: query
 *         name: name
 *         schema: { type: string }
 *       - in: query
 *         name: specialization
 *         schema: { type: string }
 *       - in: query
 *         name: date
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 */
router.get('/', getDoctors);
router.get('/specializations', getSpecializations);
router.get('/:id', getDoctorById);
router.get('/:id/slots', getDoctorSlots);

// ─── Doctor-only routes ───────────────────────────────────────────────────────
router.use(authenticate, authorize('doctor'));

router.get('/me/appointments', getDoctorAppointments);
router.post('/me/slots', addSlotValidation, validate, addSlot);
router.put('/me/slots/:slotId', updateSlot);
router.delete('/me/slots/:slotId', deleteSlot);
router.put('/me/appointments/:id/status', updateAppointmentStatus);

module.exports = router;

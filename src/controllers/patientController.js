const { body } = require('express-validator');
const { pool } = require('../config/database');
const {
  successResponse,
  errorResponse,
  paginatedResponse,
  getPagination,
  buildPaginationMeta,
} = require('../utils/response');

/**
 * POST /api/patients/appointments
 * Patient: Book an appointment
 */
const bookAppointment = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const userId = req.user.id;
    const { slot_id, notes } = req.body;

    // Get patient record
    const [patientRows] = await conn.query(
      'SELECT id FROM patients WHERE user_id = ?',
      [userId]
    );
    if (patientRows.length === 0) {
      return errorResponse(res, 'Patient profile not found', 404);
    }
    const patientId = patientRows[0].id;

    await conn.beginTransaction();

    // Lock and check the slot
    const [slots] = await conn.query(
      `SELECT id, doctor_id, slot_date, start_time, end_time, is_booked, is_active
       FROM availability_slots
       WHERE id = ? FOR UPDATE`,
      [slot_id]
    );

    if (slots.length === 0) {
      await conn.rollback();
      return errorResponse(res, 'Slot not found', 404);
    }

    const slot = slots[0];

    if (!slot.is_active) {
      await conn.rollback();
      return errorResponse(res, 'This slot is no longer available', 400);
    }

    if (slot.is_booked) {
      await conn.rollback();
      return errorResponse(res, 'This slot is already booked', 409);
    }

    // Check if patient already has an appointment at this time
    const [existing] = await conn.query(
      `SELECT id FROM appointments
       WHERE patient_id = ? AND appointment_date = ? AND status NOT IN ('cancelled')
       AND (
         (start_time < ? AND end_time > ?)
       )`,
      [patientId, slot.slot_date, slot.end_time, slot.start_time]
    );

    if (existing.length > 0) {
      await conn.rollback();
      return errorResponse(res, 'You already have an appointment at this time', 409);
    }

    // Create appointment
    const [result] = await conn.query(
      `INSERT INTO appointments
       (slot_id, doctor_id, patient_id, appointment_date, start_time, end_time, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [slot_id, slot.doctor_id, patientId, slot.slot_date, slot.start_time, slot.end_time, notes || null]
    );

    // Mark slot as booked
    await conn.query(
      'UPDATE availability_slots SET is_booked = 1 WHERE id = ?',
      [slot_id]
    );

    await conn.commit();

    // Return the created appointment
    const [appointment] = await pool.query(
      `SELECT
         a.id, a.appointment_date, a.start_time, a.end_time, a.status, a.notes,
         d.specialization, d.consultation_fee, d.hospital_name,
         u.full_name as doctor_name
       FROM appointments a
       JOIN doctors d ON d.id = a.doctor_id
       JOIN users u ON u.id = d.user_id
       WHERE a.id = ?`,
      [result.insertId]
    );

    return successResponse(res, appointment[0], 'Appointment booked successfully', 201);
  } catch (error) {
    await conn.rollback();
    console.error('Book appointment error:', error);
    return errorResponse(res, 'Failed to book appointment', 500);
  } finally {
    conn.release();
  }
};

/**
 * GET /api/patients/appointments
 * Patient: View their booked appointments
 */
const getPatientAppointments = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page, limit, offset } = getPagination(req.query);
    const { status } = req.query;

    const [patientRows] = await pool.query(
      'SELECT id FROM patients WHERE user_id = ?',
      [userId]
    );
    if (patientRows.length === 0) {
      return errorResponse(res, 'Patient profile not found', 404);
    }
    const patientId = patientRows[0].id;

    let whereConditions = ['a.patient_id = ?'];
    let params = [patientId];

    if (status) {
      whereConditions.push('a.status = ?');
      params.push(status);
    }

    const whereClause = 'WHERE ' + whereConditions.join(' AND ');

    const [countRows] = await pool.query(
      `SELECT COUNT(*) as total FROM appointments a ${whereClause}`,
      params
    );
    const total = countRows[0].total;

    const [appointments] = await pool.query(
      `SELECT
         a.id, a.appointment_date, a.start_time, a.end_time, a.status, a.notes,
         a.cancellation_reason, a.created_at,
         d.id as doctor_id, d.specialization, d.qualification, d.consultation_fee,
         d.hospital_name, d.hospital_address, d.rating,
         u.full_name as doctor_name, u.phone as doctor_phone, u.profile_image as doctor_image
       FROM appointments a
       JOIN doctors d ON d.id = a.doctor_id
       JOIN users u ON u.id = d.user_id
       ${whereClause}
       ORDER BY a.appointment_date DESC, a.start_time DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const pagination = buildPaginationMeta(total, page, limit);
    return paginatedResponse(res, appointments, pagination, 'Appointments fetched');
  } catch (error) {
    console.error('Get patient appointments error:', error);
    return errorResponse(res, 'Failed to fetch appointments', 500);
  }
};

/**
 * GET /api/patients/appointments/:id
 * Patient: Get single appointment detail
 */
const getAppointmentById = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const [patientRows] = await pool.query(
      'SELECT id FROM patients WHERE user_id = ?',
      [userId]
    );
    if (patientRows.length === 0) {
      return errorResponse(res, 'Patient profile not found', 404);
    }
    const patientId = patientRows[0].id;

    const [rows] = await pool.query(
      `SELECT
         a.id, a.appointment_date, a.start_time, a.end_time, a.status, a.notes,
         a.cancellation_reason, a.created_at,
         d.id as doctor_id, d.specialization, d.qualification, d.experience_years,
         d.consultation_fee, d.hospital_name, d.hospital_address, d.about, d.rating,
         u.full_name as doctor_name, u.email as doctor_email,
         u.phone as doctor_phone, u.profile_image as doctor_image
       FROM appointments a
       JOIN doctors d ON d.id = a.doctor_id
       JOIN users u ON u.id = d.user_id
       WHERE a.id = ? AND a.patient_id = ?`,
      [id, patientId]
    );

    if (rows.length === 0) {
      return errorResponse(res, 'Appointment not found', 404);
    }

    return successResponse(res, rows[0], 'Appointment fetched');
  } catch (error) {
    console.error('Get appointment error:', error);
    return errorResponse(res, 'Failed to fetch appointment', 500);
  }
};

/**
 * PUT /api/patients/appointments/:id/cancel
 * Patient: Cancel an appointment
 */
const cancelAppointment = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { cancellation_reason } = req.body;

    const [patientRows] = await conn.query(
      'SELECT id FROM patients WHERE user_id = ?',
      [userId]
    );
    if (patientRows.length === 0) {
      return errorResponse(res, 'Patient profile not found', 404);
    }
    const patientId = patientRows[0].id;

    const [rows] = await conn.query(
      'SELECT id, status, slot_id FROM appointments WHERE id = ? AND patient_id = ?',
      [id, patientId]
    );

    if (rows.length === 0) {
      return errorResponse(res, 'Appointment not found', 404);
    }

    if (rows[0].status === 'cancelled') {
      return errorResponse(res, 'Appointment is already cancelled', 400);
    }

    if (rows[0].status === 'completed') {
      return errorResponse(res, 'Cannot cancel a completed appointment', 400);
    }

    await conn.beginTransaction();

    await conn.query(
      `UPDATE appointments SET status = 'cancelled', cancellation_reason = ? WHERE id = ?`,
      [cancellation_reason || null, id]
    );

    // Free up the slot
    await conn.query(
      'UPDATE availability_slots SET is_booked = 0 WHERE id = ?',
      [rows[0].slot_id]
    );

    await conn.commit();

    return successResponse(res, null, 'Appointment cancelled successfully');
  } catch (error) {
    await conn.rollback();
    console.error('Cancel appointment error:', error);
    return errorResponse(res, 'Failed to cancel appointment', 500);
  } finally {
    conn.release();
  }
};

// Validation rules
const bookAppointmentValidation = [
  body('slot_id').isInt({ min: 1 }).withMessage('Valid slot ID required'),
  body('notes').optional().isLength({ max: 500 }).withMessage('Notes must be under 500 characters'),
];

module.exports = {
  bookAppointment,
  getPatientAppointments,
  getAppointmentById,
  cancelAppointment,
  bookAppointmentValidation,
};

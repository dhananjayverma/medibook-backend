const { body, query, param } = require('express-validator');
const { pool } = require('../config/database');
const {
  successResponse,
  errorResponse,
  paginatedResponse,
  getPagination,
  buildPaginationMeta,
} = require('../utils/response');

/**
 * GET /api/doctors
 * Search doctors with filters and pagination
 */
const getDoctors = async (req, res) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const { name, specialization, date } = req.query;

    // List doctors if they are marked available OR if they have active unbooked slots created in the future
    let whereConditions = [
      '(d.is_available = 1 OR EXISTS (SELECT 1 FROM availability_slots s WHERE s.doctor_id = d.id AND s.is_booked = 0 AND s.is_active = 1 AND (s.slot_date > CURDATE() OR (s.slot_date = CURDATE() AND s.start_time > CURTIME()))))'
    ];
    let params = [];

    if (name) {
      whereConditions.push('u.full_name LIKE ?');
      params.push(`%${name}%`);
    }

    if (specialization) {
      whereConditions.push('d.specialization LIKE ?');
      params.push(`%${specialization}%`);
    }

    if (date) {
      whereConditions.push(`
        EXISTS (
          SELECT 1 FROM availability_slots s
          WHERE s.doctor_id = d.id
          AND s.slot_date = ?
          AND s.is_booked = 0
          AND s.is_active = 1
        )
      `);
      params.push(date);
    }

    const whereClause = whereConditions.length > 0
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';

    const countQuery = `
      SELECT COUNT(*) as total
      FROM doctors d
      JOIN users u ON u.id = d.user_id
      ${whereClause}
    `;

    const dataQuery = `
      SELECT
        d.id, d.specialization, d.qualification, d.experience_years,
        d.consultation_fee, d.hospital_name, d.hospital_address,
        d.rating, d.total_reviews, d.is_available,
        u.full_name, u.email, u.phone, u.profile_image
      FROM doctors d
      JOIN users u ON u.id = d.user_id
      ${whereClause}
      ORDER BY d.rating DESC, d.total_reviews DESC
      LIMIT ? OFFSET ?
    `;

    const [countRows] = await pool.query(countQuery, params);
    const total = countRows[0].total;

    const [doctors] = await pool.query(dataQuery, [...params, limit, offset]);

    const pagination = buildPaginationMeta(total, page, limit);

    return paginatedResponse(res, doctors, pagination, 'Doctors fetched successfully');
  } catch (error) {
    console.error('Get doctors error:', error);
    return errorResponse(res, 'Failed to fetch doctors', 500);
  }
};

/**
 * GET /api/doctors/specializations
 * Get list of available specializations
 */
const getSpecializations = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT DISTINCT specialization FROM doctors ORDER BY specialization'
    );
    return successResponse(res, rows.map((r) => r.specialization), 'Specializations fetched');
  } catch (error) {
    return errorResponse(res, 'Failed to fetch specializations', 500);
  }
};

/**
 * GET /api/doctors/:id
 * Get single doctor with profile details
 */
const getDoctorById = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.query(
      `SELECT
        d.id, d.user_id, d.specialization, d.qualification, d.experience_years,
        d.consultation_fee, d.hospital_name, d.hospital_address, d.about,
        d.rating, d.total_reviews, d.is_available,
        u.full_name, u.email, u.phone, u.profile_image
       FROM doctors d
       JOIN users u ON u.id = d.user_id
       WHERE d.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return errorResponse(res, 'Doctor not found', 404);
    }

    const doctorData = rows[0];

    // Fetch matching reviews for this doctor
    const [reviews] = await pool.query(
      `SELECT r.id, r.rating, r.review_text, r.created_at,
              u.full_name as patient_name
       FROM reviews r
       JOIN patients p ON p.id = r.patient_id
       JOIN users u ON u.id = p.user_id
       WHERE r.doctor_id = ?
       ORDER BY r.created_at DESC`,
      [id]
    );

    doctorData.reviews = reviews;

    return successResponse(res, doctorData, 'Doctor fetched successfully');
  } catch (error) {
    console.error('Get doctor by id error:', error);
    return errorResponse(res, 'Failed to fetch doctor', 500);
  }
};

/**
 * GET /api/doctors/:id/slots
 * Get available slots for a doctor (optionally filtered by date)
 */
const getDoctorSlots = async (req, res) => {
  try {
    const { id } = req.params;
    const { date } = req.query;
    const { page, limit, offset } = getPagination(req.query);

    // Verify doctor exists
    const [doctorCheck] = await pool.query('SELECT id FROM doctors WHERE id = ?', [id]);
    if (doctorCheck.length === 0) {
      return errorResponse(res, 'Doctor not found', 404);
    }

    let whereConditions = [
      'doctor_id = ?',
      'is_active = 1',
      'is_booked = 0',
      // Check if slot_date is in the future, OR if it's today, check if start_time is in the future
      '(slot_date > CURDATE() OR (slot_date = CURDATE() AND start_time > CURTIME()))',
    ];
    let params = [id];

    if (date) {
      whereConditions.push('slot_date = ?');
      params.push(date);
    }

    const whereClause = 'WHERE ' + whereConditions.join(' AND ');

    const [countRows] = await pool.query(
      `SELECT COUNT(*) as total FROM availability_slots ${whereClause}`,
      params
    );
    const total = countRows[0].total;

    const [slots] = await pool.query(
      `SELECT id, slot_date, start_time, end_time, is_booked
       FROM availability_slots ${whereClause}
       ORDER BY slot_date, start_time
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const pagination = buildPaginationMeta(total, page, limit);
    return paginatedResponse(res, slots, pagination, 'Slots fetched');
  } catch (error) {
    console.error('Get doctor slots error:', error);
    return errorResponse(res, 'Failed to fetch slots', 500);
  }
};

/**
 * POST /api/doctors/slots
 * Doctor: Add availability slot(s)
 */
const addSlot = async (req, res) => {
  try {
    const userId = req.user.id;
    const { slot_date, start_time, end_time, slots } = req.body;

    // Get doctor record
    const [doctorRows] = await pool.query('SELECT id FROM doctors WHERE user_id = ?', [userId]);
    if (doctorRows.length === 0) {
      return errorResponse(res, 'Doctor profile not found', 404);
    }
    const doctorId = doctorRows[0].id;

    // Support bulk slot insertion
    const slotsToInsert = slots || [{ slot_date, start_time, end_time }];

    if (!slotsToInsert || slotsToInsert.length === 0) {
      return errorResponse(res, 'No slots provided', 400);
    }

    const values = slotsToInsert.map((s) => [doctorId, s.slot_date, s.start_time, s.end_time]);

    await pool.query(
      `INSERT INTO availability_slots (doctor_id, slot_date, start_time, end_time)
       VALUES ? ON DUPLICATE KEY UPDATE is_active = 1`,
      [values]
    );

    return successResponse(res, null, 'Slots added successfully', 201);
  } catch (error) {
    console.error('Add slot error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return errorResponse(res, 'Slot already exists for this time', 409);
    }
    return errorResponse(res, 'Failed to add slot', 500);
  }
};

/**
 * PUT /api/doctors/slots/:slotId
 * Doctor: Edit an availability slot
 */
const updateSlot = async (req, res) => {
  try {
    const userId = req.user.id;
    const { slotId } = req.params;
    const { slot_date, start_time, end_time, is_active } = req.body;

    // Verify ownership
    const [rows] = await pool.query(
      `SELECT s.id, s.is_booked
       FROM availability_slots s
       JOIN doctors d ON d.id = s.doctor_id
       WHERE s.id = ? AND d.user_id = ?`,
      [slotId, userId]
    );

    if (rows.length === 0) {
      return errorResponse(res, 'Slot not found or not authorized', 404);
    }

    if (rows[0].is_booked) {
      return errorResponse(res, 'Cannot edit a booked slot', 400);
    }

    const updates = {};
    if (slot_date) updates.slot_date = slot_date;
    if (start_time) updates.start_time = start_time;
    if (end_time) updates.end_time = end_time;
    if (typeof is_active === 'boolean') updates.is_active = is_active ? 1 : 0;

    if (Object.keys(updates).length === 0) {
      return errorResponse(res, 'No fields to update', 400);
    }

    await pool.query('UPDATE availability_slots SET ? WHERE id = ?', [updates, slotId]);

    return successResponse(res, null, 'Slot updated successfully');
  } catch (error) {
    console.error('Update slot error:', error);
    return errorResponse(res, 'Failed to update slot', 500);
  }
};

/**
 * DELETE /api/doctors/slots/:slotId
 * Doctor: Delete an availability slot
 */
const deleteSlot = async (req, res) => {
  try {
    const userId = req.user.id;
    const { slotId } = req.params;

    const [rows] = await pool.query(
      `SELECT s.id, s.is_booked
       FROM availability_slots s
       JOIN doctors d ON d.id = s.doctor_id
       WHERE s.id = ? AND d.user_id = ?`,
      [slotId, userId]
    );

    if (rows.length === 0) {
      return errorResponse(res, 'Slot not found or not authorized', 404);
    }

    if (rows[0].is_booked) {
      return errorResponse(res, 'Cannot delete a booked slot', 400);
    }

    await pool.query('DELETE FROM availability_slots WHERE id = ?', [slotId]);

    return successResponse(res, null, 'Slot deleted successfully');
  } catch (error) {
    console.error('Delete slot error:', error);
    return errorResponse(res, 'Failed to delete slot', 500);
  }
};

/**
 * GET /api/doctors/appointments
 * Doctor: View all appointments booked for them
 */
const getDoctorAppointments = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page, limit, offset } = getPagination(req.query);
    const { status, date } = req.query;

    const [doctorRows] = await pool.query(
      'SELECT id FROM doctors WHERE user_id = ?',
      [userId]
    );
    if (doctorRows.length === 0) {
      return errorResponse(res, 'Doctor profile not found', 404);
    }
    const doctorId = doctorRows[0].id;

    let whereConditions = ['a.doctor_id = ?'];
    let params = [doctorId];

    if (status) {
      whereConditions.push('a.status = ?');
      params.push(status);
    }

    if (date) {
      whereConditions.push('a.appointment_date = ?');
      params.push(date);
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
         u.full_name as patient_name, u.email as patient_email, u.phone as patient_phone,
         p.gender, p.blood_group, p.date_of_birth
       FROM appointments a
       JOIN patients pt ON pt.id = a.patient_id
       JOIN users u ON u.id = pt.user_id
       JOIN patients p ON p.id = a.patient_id
       ${whereClause}
       ORDER BY a.appointment_date DESC, a.start_time DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const pagination = buildPaginationMeta(total, page, limit);
    return paginatedResponse(res, appointments, pagination, 'Appointments fetched');
  } catch (error) {
    console.error('Get doctor appointments error:', error);
    return errorResponse(res, 'Failed to fetch appointments', 500);
  }
};

/**
 * PUT /api/doctors/appointments/:id/status
 * Doctor: Update appointment status
 */
const updateAppointmentStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { status, cancellation_reason } = req.body;

    const validStatuses = ['confirmed', 'cancelled', 'completed'];
    if (!validStatuses.includes(status)) {
      return errorResponse(res, `Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400);
    }

    // Verify this appointment belongs to this doctor
    const [rows] = await pool.query(
      `SELECT a.id, a.status, a.slot_id
       FROM appointments a
       JOIN doctors d ON d.id = a.doctor_id
       WHERE a.id = ? AND d.user_id = ?`,
      [id, userId]
    );

    if (rows.length === 0) {
      return errorResponse(res, 'Appointment not found or not authorized', 404);
    }

    if (rows[0].status === 'cancelled') {
      return errorResponse(res, 'Cannot update a cancelled appointment', 400);
    }

    const updates = { status };
    if (status === 'cancelled' && cancellation_reason) {
      updates.cancellation_reason = cancellation_reason;
    }

    await pool.query('UPDATE appointments SET ? WHERE id = ?', [updates, id]);

    // If cancelled, free up the slot
    if (status === 'cancelled') {
      await pool.query(
        'UPDATE availability_slots SET is_booked = 0 WHERE id = ?',
        [rows[0].slot_id]
      );
    }

    // Broadcast status change realtime event
    const { broadcastEvent } = require('../utils/realtime');
    broadcastEvent('APPOINTMENT_STATUS_UPDATED', { appointment_id: id, status, slot_id: rows[0].slot_id });

    return successResponse(res, null, 'Appointment status updated');
  } catch (error) {
    console.error('Update appointment status error:', error);
    return errorResponse(res, 'Failed to update appointment', 500);
  }
};

/**
 * PUT /api/doctors/me/profile
 * Doctor: Update availability profile status
 */
const updateDoctorProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { is_available } = req.body;

    if (typeof is_available !== 'boolean') {
      return errorResponse(res, 'is_available parameter must be a boolean', 400);
    }

    const [doctorRows] = await pool.query('SELECT id FROM doctors WHERE user_id = ?', [userId]);
    if (doctorRows.length === 0) {
      return errorResponse(res, 'Doctor profile not found', 404);
    }

    await pool.query('UPDATE doctors SET is_available = ? WHERE user_id = ?', [is_available ? 1 : 0, userId]);

    return successResponse(res, null, 'Doctor profile updated successfully');
  } catch (error) {
    console.error('Update doctor profile error:', error);
    return errorResponse(res, 'Failed to update profile details', 500);
  }
};

// Validation rules
const addSlotValidation = [
  body('slot_date').optional().isDate().withMessage('Valid date required (YYYY-MM-DD)'),
  body('start_time').optional().matches(/^\d{2}:\d{2}$/).withMessage('Valid start time required (HH:MM)'),
  body('end_time').optional().matches(/^\d{2}:\d{2}$/).withMessage('Valid end time required (HH:MM)'),
];

module.exports = {
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
  updateDoctorProfile,
};

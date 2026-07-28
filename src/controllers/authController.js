const bcrypt = require('bcryptjs');
const { body } = require('express-validator');
const { pool } = require('../config/database');
const { generateToken } = require('../utils/jwt');
const { successResponse, errorResponse } = require('../utils/response');

// Validation rules
const loginValidation = [
  body('email').isEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password required'),
];

/**
 * POST /api/auth/login
 * Login for doctors and patients
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const [users] = await pool.query(
      'SELECT id, email, password, role, full_name, phone, profile_image FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return errorResponse(res, 'Invalid email or password', 401);
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return errorResponse(res, 'Invalid email or password', 401);
    }

    const token = generateToken(user.id, user.role);

    // Get role-specific data
    let profileData = null;
    if (user.role === 'doctor') {
      const [doctors] = await pool.query(
        'SELECT id, specialization, qualification, experience_years, consultation_fee, hospital_name, rating FROM doctors WHERE user_id = ?',
        [user.id]
      );
      profileData = doctors[0] || null;
    } else if (user.role === 'patient') {
      const [patients] = await pool.query(
        'SELECT id, date_of_birth, gender, blood_group FROM patients WHERE user_id = ?',
        [user.id]
      );
      profileData = patients[0] || null;
    }

    const { password: _, ...userWithoutPassword } = user;

    return successResponse(
      res,
      {
        token,
        user: userWithoutPassword,
        profile: profileData,
      },
      'Login successful'
    );
  } catch (error) {
    console.error('Login error:', error);
    return errorResponse(res, 'Login failed', 500);
  }
};

/**
 * GET /api/auth/me
 * Get current user profile
 */
const getMe = async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;

    let profileData = null;
    if (role === 'doctor') {
      const [rows] = await pool.query(
        `SELECT d.*, u.full_name, u.email, u.phone, u.profile_image
         FROM doctors d
         JOIN users u ON u.id = d.user_id
         WHERE d.user_id = ?`,
        [userId]
      );
      profileData = rows[0] || null;
    } else {
      const [rows] = await pool.query(
        `SELECT p.*, u.full_name, u.email, u.phone, u.profile_image
         FROM patients p
         JOIN users u ON u.id = p.user_id
         WHERE p.user_id = ?`,
        [userId]
      );
      profileData = rows[0] || null;
    }

    return successResponse(res, { user: req.user, profile: profileData }, 'Profile fetched');
  } catch (error) {
    console.error('Get me error:', error);
    return errorResponse(res, 'Failed to fetch profile', 500);
  }
};

module.exports = { login, getMe, loginValidation };

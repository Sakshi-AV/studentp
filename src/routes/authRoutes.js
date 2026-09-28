const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { authenticate, JWT_SECRET } = require('../middleware/auth');
const { validateAuthInput } = require('../middleware/validator');

const router = express.Router();

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

// POST /api/auth/register
router.post('/register', validateAuthInput, async (req, res) => {
  try {
    const { name, email, password, role = 'student', department = 'General Studies' } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Full name is required.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const allowedRoles = ['student', 'mentor'];
    const assignedRole = allowedRoles.includes(role) ? role : 'student';

    // Check if email already registered
    const { rows: existing } = await db.query('SELECT id FROM users WHERE LOWER(email) = $1', [cleanEmail]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=fff`;

    const { rows } = await db.query(
      `INSERT INTO users (name, email, password_hash, role, department, avatar_url)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email, role, department, avatar_url, created_at`,
      [name.trim(), cleanEmail, passwordHash, assignedRole, department.trim(), defaultAvatar]
    );

    const newUser = rows[0];
    const token = generateToken(newUser);

    return res.status(201).json({
      success: true,
      message: 'Account registered successfully',
      data: { user: newUser, token },
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ success: false, message: 'Server error during registration', error: error.message });
  }
});

// POST /api/auth/login
router.post('/login', validateAuthInput, async (req, res) => {
  try {
    const { email, password } = req.body;
    const cleanEmail = email.toLowerCase().trim();

    const { rows } = await db.query('SELECT * FROM users WHERE LOWER(email) = $1', [cleanEmail]);
    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid credentials. User not found.' });
    }

    const user = rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials. Incorrect password.' });
    }

    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      avatar_url: user.avatar_url,
      created_at: user.created_at,
    };

    const token = generateToken(safeUser);

    return res.json({
      success: true,
      message: `Welcome back, ${safeUser.name}!`,
      data: { user: safeUser, token },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, message: 'Server error during authentication', error: error.message });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  try {
    return res.json({
      success: true,
      data: { user: req.user },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to retrieve profile' });
  }
});

// GET /api/auth/demo-accounts (Helper for instant previewing as Student, Mentor, or Admin)
router.get('/demo-accounts', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, name, email, role, department, avatar_url FROM users ORDER BY id ASC LIMIT 5`
    );
    return res.json({
      success: true,
      data: { accounts: rows, defaultPassword: 'Password123!' },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to load demo accounts' });
  }
});

module.exports = router;

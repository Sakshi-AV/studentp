const express = require('express');
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Admin protection for all admin routes
router.use(authenticate, authorize(['admin']));

// GET /api/admin/users - User directory with project/task stats
router.get('/users', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT 
        u.id, u.name, u.email, u.role, u.department, u.avatar_url, u.created_at,
        COUNT(DISTINCT p.id) as projects_created,
        COUNT(DISTINCT pm.project_id) as projects_joined,
        COUNT(DISTINCT t.id) as tasks_assigned,
        COUNT(DISTINCT CASE WHEN t.status = 'done' THEN t.id END) as tasks_completed
      FROM users u
      LEFT JOIN projects p ON u.id = p.created_by
      LEFT JOIN project_members pm ON u.id = pm.user_id
      LEFT JOIN tasks t ON u.id = t.assigned_to
      GROUP BY u.id
      ORDER BY u.id ASC
    `);

    return res.json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    console.error('Admin users error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve user directory' });
  }
});

// PATCH /api/admin/users/:id/role - Update user role
router.patch('/users/:id/role', async (req, res) => {
  try {
    const userId = req.params.id;
    const { role } = req.body;

    const validRoles = ['student', 'mentor', 'admin'];
    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({ success: false, message: `Role must be one of: ${validRoles.join(', ')}` });
    }

    const { rows } = await db.query(
      `UPDATE users SET role = $1 WHERE id = $2 RETURNING id, name, email, role, department`,
      [role, userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.json({
      success: true,
      message: `User ${rows[0].name} updated to role '${role}'`,
      data: rows[0],
    });
  } catch (error) {
    console.error('Update role error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update user role' });
  }
});

// GET /api/admin/stats - Global system overview
router.get('/stats', async (req, res) => {
  try {
    const [usersRes, projectsRes, tasksRes, feedbackRes] = await Promise.all([
      db.query(`
        SELECT 
          COUNT(*) as total_users,
          COUNT(CASE WHEN role = 'student' THEN 1 END) as student_count,
          COUNT(CASE WHEN role = 'mentor' THEN 1 END) as mentor_count,
          COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin_count
        FROM users
      `),
      db.query(`
        SELECT 
          COUNT(*) as total_projects,
          COUNT(CASE WHEN status = 'planning' THEN 1 END) as planning,
          COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress,
          COUNT(CASE WHEN status = 'review' THEN 1 END) as review,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed
        FROM projects
      `),
      db.query(`
        SELECT 
          COUNT(*) as total_tasks,
          COUNT(CASE WHEN status = 'todo' THEN 1 END) as todo,
          COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress,
          COUNT(CASE WHEN status = 'review' THEN 1 END) as review,
          COUNT(CASE WHEN status = 'done' THEN 1 END) as done,
          COUNT(CASE WHEN due_date < CURRENT_DATE AND status != 'done' THEN 1 END) as overdue_tasks
        FROM tasks
      `),
      db.query(`
        SELECT COUNT(*) as total_comments,
               COUNT(CASE WHEN is_mentor_feedback = 1 OR is_mentor_feedback = TRUE THEN 1 END) as mentor_reviews
        FROM comments
      `),
    ]);

    return res.json({
      success: true,
      data: {
        users: usersRes.rows[0],
        projects: projectsRes.rows[0],
        tasks: tasksRes.rows[0],
        feedback: feedbackRes.rows[0],
      },
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load system stats' });
  }
});

// GET /api/admin/activities - System-wide audit trail
router.get('/activities', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT a.*, u.name as user_name, u.role as user_role, u.avatar_url as user_avatar, p.title as project_title
      FROM activity_logs a
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN projects p ON a.project_id = p.id
      ORDER BY a.created_at DESC LIMIT 50
    `);
    return res.json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to retrieve system activity logs' });
  }
});

module.exports = router;

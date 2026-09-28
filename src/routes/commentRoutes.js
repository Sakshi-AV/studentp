const express = require('express');
const db = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/comments/task/:taskId
router.get('/task/:taskId', async (req, res) => {
  try {
    const taskId = req.params.taskId;
    const { rows } = await db.query(
      `SELECT c.*, u.name as user_name, u.role as user_role, u.department as user_department, u.avatar_url as user_avatar
       FROM comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.task_id = $1
       ORDER BY c.created_at ASC`,
      [taskId]
    );
    return res.json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to load comments' });
  }
});

// GET /api/comments/project/:projectId
router.get('/project/:projectId', async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const { rows } = await db.query(
      `SELECT c.*, u.name as user_name, u.role as user_role, u.department as user_department, u.avatar_url as user_avatar,
              t.title as task_title
       FROM comments c
       JOIN users u ON c.user_id = u.id
       LEFT JOIN tasks t ON c.task_id = t.id
       WHERE c.project_id = $1
       ORDER BY c.created_at DESC LIMIT 50`,
      [projectId]
    );
    return res.json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to load project feedback' });
  }
});

// POST /api/comments
router.post('/', authenticate, async (req, res) => {
  try {
    const { task_id, project_id, content, is_mentor_feedback = false } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Comment content cannot be empty' });
    }

    if (!task_id && !project_id) {
      return res.status(400).json({ success: false, message: 'Either task_id or project_id must be provided' });
    }

    // Determine target project_id if not explicitly provided
    let targetProjectId = project_id;
    if (!targetProjectId && task_id) {
      const { rows: taskRows } = await db.query('SELECT project_id FROM tasks WHERE id = $1', [task_id]);
      if (taskRows.length > 0) {
        targetProjectId = taskRows[0].project_id;
      }
    }

    // Role check for mentor feedback badge
    const canPostMentorFeedback = req.user.role === 'mentor' || req.user.role === 'admin';
    const feedbackFlag = canPostMentorFeedback && is_mentor_feedback ? 1 : 0;

    const { rows } = await db.query(
      `INSERT INTO comments (task_id, project_id, user_id, content, is_mentor_feedback)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [task_id || null, targetProjectId || null, req.user.id, content.trim(), feedbackFlag]
    );

    const newComment = rows[0];

    // Log activity
    if (targetProjectId) {
      const actionDesc = feedbackFlag
        ? `Mentor ${req.user.name} added official academic feedback`
        : `${req.user.name} commented on discussion thread`;
      await db.query(
        `INSERT INTO activity_logs (project_id, user_id, action_type, description)
         VALUES ($1, $2, $3, $4)`,
        [targetProjectId, req.user.id, 'comment_added', actionDesc]
      );
    }

    return res.status(201).json({
      success: true,
      message: 'Comment posted successfully',
      data: {
        ...newComment,
        user_name: req.user.name,
        user_role: req.user.role,
        user_avatar: req.user.avatar_url,
      },
    });
  } catch (error) {
    console.error('Comment error:', error);
    return res.status(500).json({ success: false, message: 'Failed to post comment', error: error.message });
  }
});

// DELETE /api/comments/:id
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const commentId = req.params.id;
    const { rows } = await db.query('SELECT * FROM comments WHERE id = $1', [commentId]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }

    const comment = rows[0];
    if (comment.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Permission denied to delete this comment' });
    }

    await db.query('DELETE FROM comments WHERE id = $1', [commentId]);
    return res.json({ success: true, message: 'Comment deleted' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to delete comment' });
  }
});

module.exports = router;

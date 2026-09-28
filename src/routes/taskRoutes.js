const express = require('express');
const db = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { validateTaskInput } = require('../middleware/validator');

const router = express.Router();

// GET /api/tasks - List tasks
router.get('/', async (req, res) => {
  try {
    const { project_id, status, priority, assigned_to } = req.query;
    let queryText = `
      SELECT t.*,
             p.title as project_title,
             u_assignee.name as assignee_name, u_assignee.avatar_url as assignee_avatar,
             u_creator.name as creator_name,
             COUNT(c.id) as comment_count
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      LEFT JOIN users u_assignee ON t.assigned_to = u_assignee.id
      LEFT JOIN users u_creator ON t.created_by = u_creator.id
      LEFT JOIN comments c ON t.id = c.task_id
      WHERE 1=1
    `;
    const params = [];

    if (project_id) {
      params.push(project_id);
      queryText += ` AND t.project_id = $${params.length}`;
    }

    if (status && status !== 'all') {
      params.push(status);
      queryText += ` AND t.status = $${params.length}`;
    }

    if (priority && priority !== 'all') {
      params.push(priority);
      queryText += ` AND t.priority = $${params.length}`;
    }

    if (assigned_to) {
      params.push(assigned_to);
      queryText += ` AND t.assigned_to = $${params.length}`;
    }

    queryText += `
      GROUP BY t.id, p.title, u_assignee.name, u_assignee.avatar_url, u_creator.name
      ORDER BY t.position ASC, t.id ASC
    `;

    const { rows } = await db.query(queryText, params);
    return res.json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    console.error('Fetch tasks error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch tasks', error: error.message });
  }
});

// GET /api/tasks/:id - Single task with comments
router.get('/:id', async (req, res) => {
  try {
    const taskId = req.params.id;

    const { rows: taskRows } = await db.query(
      `SELECT t.*,
              p.title as project_title, p.mentor_id as project_mentor_id,
              u_assignee.name as assignee_name, u_assignee.email as assignee_email, u_assignee.avatar_url as assignee_avatar,
              u_creator.name as creator_name
       FROM tasks t
       JOIN projects p ON t.project_id = p.id
       LEFT JOIN users u_assignee ON t.assigned_to = u_assignee.id
       LEFT JOIN users u_creator ON t.created_by = u_creator.id
       WHERE t.id = $1`,
      [taskId]
    );

    if (taskRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const task = taskRows[0];

    // Get comments on task
    const { rows: comments } = await db.query(
      `SELECT c.*, u.name as user_name, u.role as user_role, u.avatar_url as user_avatar
       FROM comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.task_id = $1
       ORDER BY c.created_at ASC`,
      [taskId]
    );

    return res.json({
      success: true,
      data: {
        ...task,
        comments,
      },
    });
  } catch (error) {
    console.error('Fetch single task error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load task details' });
  }
});

// POST /api/tasks - Create task
router.post('/', authenticate, validateTaskInput, async (req, res) => {
  try {
    const { project_id, title, description, status = 'todo', priority = 'medium', assigned_to, due_date, estimated_hours = 0 } = req.body;

    if (!project_id) {
      return res.status(400).json({ success: false, message: 'Project ID is required' });
    }

    // Verify project exists
    const { rows: projectRows } = await db.query('SELECT id FROM projects WHERE id = $1', [project_id]);
    if (projectRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Target project not found' });
    }

    // Calculate next position
    const { rows: posRows } = await db.query(
      'SELECT COALESCE(MAX(position), 0) + 1 as next_pos FROM tasks WHERE project_id = $1 AND status = $2',
      [project_id, status]
    );
    const nextPos = posRows[0]?.next_pos || 0;

    const { rows } = await db.query(
      `INSERT INTO tasks (project_id, title, description, status, priority, assigned_to, created_by, due_date, estimated_hours, position)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        project_id,
        title.trim(),
        description ? description.trim() : '',
        status,
        priority,
        assigned_to || null,
        req.user.id,
        due_date || null,
        parseFloat(estimated_hours) || 0,
        nextPos,
      ]
    );

    const newTask = rows[0];

    // Log activity
    await db.query(
      `INSERT INTO activity_logs (project_id, user_id, action_type, description)
       VALUES ($1, $2, $3, $4)`,
      [project_id, req.user.id, 'task_created', `${req.user.name} created task "${title.trim()}"`]
    );

    return res.status(201).json({
      success: true,
      message: 'Task created successfully',
      data: newTask,
    });
  } catch (error) {
    console.error('Create task error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create task', error: error.message });
  }
});

// PATCH /api/tasks/:id/status - Quick Kanban status change
router.patch('/:id/status', authenticate, async (req, res) => {
  try {
    const taskId = req.params.id;
    const { status } = req.body;

    const validStatuses = ['todo', 'in_progress', 'review', 'done'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: `Status must be one of: ${validStatuses.join(', ')}` });
    }

    const { rows: taskRows } = await db.query('SELECT * FROM tasks WHERE id = $1', [taskId]);
    if (taskRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const oldTask = taskRows[0];

    const { rows: updatedRows } = await db.query(
      `UPDATE tasks SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
      [status, taskId]
    );

    const updatedTask = updatedRows[0];

    // Activity log
    const statusLabels = { todo: 'To Do', in_progress: 'In Progress', review: 'Under Review', done: 'Completed' };
    await db.query(
      `INSERT INTO activity_logs (project_id, user_id, action_type, description)
       VALUES ($1, $2, $3, $4)`,
      [
        updatedTask.project_id,
        req.user.id,
        'task_status_changed',
        `${req.user.name} moved "${updatedTask.title}" to ${statusLabels[status] || status}`,
      ]
    );

    return res.json({
      success: true,
      message: `Task moved to ${statusLabels[status] || status}`,
      data: updatedTask,
    });
  } catch (error) {
    console.error('Status patch error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update task status' });
  }
});

// PUT /api/tasks/:id - Full task update
router.put('/:id', authenticate, validateTaskInput, async (req, res) => {
  try {
    const taskId = req.params.id;
    const { title, description, status, priority, assigned_to, due_date, estimated_hours, actual_hours } = req.body;

    const { rows: existing } = await db.query('SELECT * FROM tasks WHERE id = $1', [taskId]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const task = existing[0];

    const { rows: updated } = await db.query(
      `UPDATE tasks
       SET title = $1, description = $2, status = $3, priority = $4, assigned_to = $5,
           due_date = $6, estimated_hours = $7, actual_hours = $8, updated_at = CURRENT_TIMESTAMP
       WHERE id = $9
       RETURNING *`,
      [
        title.trim(),
        description ? description.trim() : task.description,
        status || task.status,
        priority || task.priority,
        assigned_to !== undefined ? (assigned_to ? assigned_to : null) : task.assigned_to,
        due_date || task.due_date,
        estimated_hours !== undefined ? parseFloat(estimated_hours) || 0 : task.estimated_hours,
        actual_hours !== undefined ? parseFloat(actual_hours) || 0 : task.actual_hours,
        taskId,
      ]
    );

    return res.json({
      success: true,
      message: 'Task updated successfully',
      data: updated[0],
    });
  } catch (error) {
    console.error('Task update error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update task' });
  }
});

// DELETE /api/tasks/:id - Delete task
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const taskId = req.params.id;

    const { rows: existing } = await db.query('SELECT * FROM tasks WHERE id = $1', [taskId]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const task = existing[0];

    await db.query('DELETE FROM tasks WHERE id = $1', [taskId]);

    await db.query(
      `INSERT INTO activity_logs (project_id, user_id, action_type, description)
       VALUES ($1, $2, $3, $4)`,
      [task.project_id, req.user.id, 'task_deleted', `${req.user.name} deleted task "${task.title}"`]
    );

    return res.json({ success: true, message: `Task "${task.title}" deleted` });
  } catch (error) {
    console.error('Delete task error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete task' });
  }
});

module.exports = router;

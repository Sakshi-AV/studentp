const express = require('express');
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { validateProjectInput } = require('../middleware/validator');

const router = express.Router();

// GET /api/projects - List projects with task completion metrics & filters
router.get('/', async (req, res) => {
  try {
    const { search, status, category, mentor_id, user_id } = req.query;
    let queryText = `
      SELECT 
        p.*,
        u_creator.name as creator_name,
        u_creator.avatar_url as creator_avatar,
        u_mentor.name as mentor_name,
        u_mentor.avatar_url as mentor_avatar,
        COUNT(DISTINCT t.id) as total_tasks,
        COUNT(DISTINCT CASE WHEN t.status = 'done' THEN t.id END) as completed_tasks,
        COUNT(DISTINCT CASE WHEN t.status = 'in_progress' THEN t.id END) as in_progress_tasks,
        COUNT(DISTINCT CASE WHEN t.status = 'review' THEN t.id END) as review_tasks,
        COUNT(DISTINCT pm.user_id) as member_count
      FROM projects p
      LEFT JOIN users u_creator ON p.created_by = u_creator.id
      LEFT JOIN users u_mentor ON p.mentor_id = u_mentor.id
      LEFT JOIN tasks t ON p.id = t.project_id
      LEFT JOIN project_members pm ON p.id = pm.project_id
      WHERE 1=1
    `;
    const params = [];

    if (search && search.trim() !== '') {
      params.push(`%${search.trim().toLowerCase()}%`);
      queryText += ` AND (LOWER(p.title) LIKE $${params.length} OR LOWER(p.description) LIKE $${params.length})`;
    }

    if (status && status !== 'all') {
      params.push(status);
      queryText += ` AND p.status = $${params.length}`;
    }

    if (category && category !== 'all') {
      params.push(category);
      queryText += ` AND p.category = $${params.length}`;
    }

    if (mentor_id) {
      params.push(mentor_id);
      queryText += ` AND p.mentor_id = $${params.length}`;
    }

    if (user_id) {
      params.push(user_id);
      queryText += ` AND (p.created_by = $${params.length} OR p.id IN (SELECT project_id FROM project_members WHERE user_id = $${params.length}))`;
    }

    queryText += `
      GROUP BY p.id, u_creator.name, u_creator.avatar_url, u_mentor.name, u_mentor.avatar_url
      ORDER BY p.updated_at DESC, p.id DESC
    `;

    const { rows } = await db.query(queryText, params);

    // Calculate progress percentage for each project
    const projectsWithProgress = rows.map((p) => {
      const total = parseInt(p.total_tasks || 0, 10);
      const completed = parseInt(p.completed_tasks || 0, 10);
      const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;
      return {
        ...p,
        total_tasks: total,
        completed_tasks: completed,
        in_progress_tasks: parseInt(p.in_progress_tasks || 0, 10),
        review_tasks: parseInt(p.review_tasks || 0, 10),
        member_count: parseInt(p.member_count || 0, 10),
        progress_percent: progressPercent,
      };
    });

    return res.json({ success: true, count: projectsWithProgress.length, data: projectsWithProgress });
  } catch (error) {
    console.error('Fetch projects error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch projects', error: error.message });
  }
});

// GET /api/projects/:id - Project details with tasks and members
router.get('/:id', async (req, res) => {
  try {
    const projectId = req.params.id;

    // Fetch Project
    const { rows: projectRows } = await db.query(
      `SELECT p.*,
              u_creator.name as creator_name, u_creator.email as creator_email, u_creator.avatar_url as creator_avatar,
              u_mentor.name as mentor_name, u_mentor.email as mentor_email, u_mentor.avatar_url as mentor_avatar
       FROM projects p
       LEFT JOIN users u_creator ON p.created_by = u_creator.id
       LEFT JOIN users u_mentor ON p.mentor_id = u_mentor.id
       WHERE p.id = $1`,
      [projectId]
    );

    if (projectRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const project = projectRows[0];

    // Fetch Team Members
    const { rows: members } = await db.query(
      `SELECT u.id, u.name, u.email, u.role, u.department, u.avatar_url, pm.role_in_project, pm.joined_at
       FROM project_members pm
       JOIN users u ON pm.user_id = u.id
       WHERE pm.project_id = $1
       ORDER BY pm.joined_at ASC`,
      [projectId]
    );

    // Fetch Tasks
    const { rows: tasks } = await db.query(
      `SELECT t.*,
              u_assignee.name as assignee_name, u_assignee.avatar_url as assignee_avatar,
              u_creator.name as creator_name,
              COUNT(c.id) as comment_count
       FROM tasks t
       LEFT JOIN users u_assignee ON t.assigned_to = u_assignee.id
       LEFT JOIN users u_creator ON t.created_by = u_creator.id
       LEFT JOIN comments c ON t.id = c.task_id
       WHERE t.project_id = $1
       GROUP BY t.id, u_assignee.name, u_assignee.avatar_url, u_creator.name
       ORDER BY t.position ASC, t.id ASC`,
      [projectId]
    );

    // Fetch Project Activity Logs
    const { rows: activities } = await db.query(
      `SELECT a.*, u.name as user_name, u.avatar_url as user_avatar
       FROM activity_logs a
       LEFT JOIN users u ON a.user_id = u.id
       WHERE a.project_id = $1
       ORDER BY a.created_at DESC LIMIT 20`,
      [projectId]
    );

    // Compute progress
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.status === 'done').length;
    const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return res.json({
      success: true,
      data: {
        ...project,
        progress_percent: progressPercent,
        total_tasks: totalTasks,
        completed_tasks: completedTasks,
        members,
        tasks,
        activities,
      },
    });
  } catch (error) {
    console.error('Fetch project detail error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch project details', error: error.message });
  }
});

// POST /api/projects - Create project
router.post('/', authenticate, validateProjectInput, async (req, res) => {
  try {
    const { title, description, category = 'General', status = 'planning', due_date, mentor_id, member_ids = [] } = req.body;
    const createdBy = req.user.id;

    const { rows } = await db.query(
      `INSERT INTO projects (title, description, category, status, mentor_id, created_by, due_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [title.trim(), description ? description.trim() : '', category, status, mentor_id || null, createdBy, due_date || null]
    );

    const newProject = rows[0];

    // Automatically add creator as lead member
    await db.query(
      `INSERT INTO project_members (project_id, user_id, role_in_project) VALUES ($1, $2, $3)`,
      [newProject.id, createdBy, 'lead']
    );

    // Add additional members if provided
    if (Array.isArray(member_ids)) {
      for (const memberId of member_ids) {
        if (memberId && memberId !== createdBy) {
          await db.query(
            `INSERT INTO project_members (project_id, user_id, role_in_project) VALUES ($1, $2, $3)
             ON CONFLICT (project_id, user_id) DO NOTHING`,
            [newProject.id, memberId, 'contributor']
          ).catch(() => {});
        }
      }
    }

    // Log activity
    await db.query(
      `INSERT INTO activity_logs (project_id, user_id, action_type, description)
       VALUES ($1, $2, $3, $4)`,
      [newProject.id, createdBy, 'project_created', `${req.user.name} created the project "${title.trim()}"`]
    );

    return res.status(201).json({
      success: true,
      message: 'Project created successfully',
      data: newProject,
    });
  } catch (error) {
    console.error('Create project error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create project', error: error.message });
  }
});

// PUT /api/projects/:id - Update project
router.put('/:id', authenticate, validateProjectInput, async (req, res) => {
  try {
    const projectId = req.params.id;
    const { title, description, category, status, due_date, mentor_id } = req.body;

    // Check project exists and permissions
    const { rows: existing } = await db.query('SELECT * FROM projects WHERE id = $1', [projectId]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const project = existing[0];
    const isCreator = project.created_by === req.user.id;
    const isMentor = project.mentor_id === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isCreator && !isMentor && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Permission denied. Only project creators, mentors, or admins can modify this project.' });
    }

    const { rows: updated } = await db.query(
      `UPDATE projects 
       SET title = $1, description = $2, category = $3, status = $4, due_date = $5, mentor_id = $6, updated_at = CURRENT_TIMESTAMP
       WHERE id = $7
       RETURNING *`,
      [
        title.trim(),
        description ? description.trim() : project.description,
        category || project.category,
        status || project.status,
        due_date || project.due_date,
        mentor_id !== undefined ? mentor_id : project.mentor_id,
        projectId,
      ]
    );

    // Log activity
    await db.query(
      `INSERT INTO activity_logs (project_id, user_id, action_type, description)
       VALUES ($1, $2, $3, $4)`,
      [projectId, req.user.id, 'project_updated', `${req.user.name} updated project details`]
    );

    return res.json({
      success: true,
      message: 'Project updated successfully',
      data: updated[0],
    });
  } catch (error) {
    console.error('Update project error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update project', error: error.message });
  }
});

// DELETE /api/projects/:id - Delete project
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const projectId = req.params.id;

    const { rows: existing } = await db.query('SELECT * FROM projects WHERE id = $1', [projectId]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const project = existing[0];
    const isCreator = project.created_by === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isCreator && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Permission denied. Only project creator or administrator can delete this project.' });
    }

    await db.query('DELETE FROM projects WHERE id = $1', [projectId]);

    return res.json({ success: true, message: `Project "${project.title}" deleted successfully` });
  } catch (error) {
    console.error('Delete project error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete project', error: error.message });
  }
});

// POST /api/projects/:id/members - Add member to project
router.post('/:id/members', authenticate, async (req, res) => {
  try {
    const projectId = req.params.id;
    const { user_id, role_in_project = 'contributor' } = req.body;

    if (!user_id) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }

    await db.query(
      `INSERT INTO project_members (project_id, user_id, role_in_project)
       VALUES ($1, $2, $3)
       ON CONFLICT (project_id, user_id) DO UPDATE SET role_in_project = $3`,
      [projectId, user_id, role_in_project]
    );

    return res.json({ success: true, message: 'Member added to project successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to add project member' });
  }
});

module.exports = router;

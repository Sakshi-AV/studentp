const express = require('express');
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { validateTaskInput } = require('../middleware/validator');

const router = express.Router();

// Mentor and Admin only access
router.use(authenticate, authorize(['mentor', 'admin']));

/**
 * Helper to get mentor user ID
 * Allows admins to view as a specific mentor via ?mentor_id=X
 */
function getTargetMentorId(req) {
  if (req.user.role === 'admin' && req.query.mentor_id) {
    return parseInt(req.query.mentor_id, 10);
  }
  return req.user.id;
}

/**
 * GET /api/mentor/overview
 * Comprehensive dashboard metrics, mentored projects, assigned students,
 * pending review queue, and recent academic feedbacks.
 */
router.get('/overview', async (req, res) => {
  try {
    const mentorId = getTargetMentorId(req);

    // 1. Fetch Mentored Projects with task metrics
    const { rows: projectRows } = await db.query(
      `SELECT 
        p.*,
        u_creator.name as creator_name,
        u_creator.email as creator_email,
        u_creator.avatar_url as creator_avatar,
        u_creator.department as creator_department,
        COUNT(DISTINCT t.id) as total_tasks,
        COUNT(DISTINCT CASE WHEN t.status = 'done' THEN t.id END) as completed_tasks,
        COUNT(DISTINCT CASE WHEN t.status = 'in_progress' THEN t.id END) as in_progress_tasks,
        COUNT(DISTINCT CASE WHEN t.status = 'review' THEN t.id END) as review_tasks,
        COUNT(DISTINCT CASE WHEN t.status = 'todo' THEN t.id END) as todo_tasks,
        COUNT(DISTINCT pm.user_id) as member_count
      FROM projects p
      LEFT JOIN users u_creator ON p.created_by = u_creator.id
      LEFT JOIN tasks t ON p.id = t.project_id
      LEFT JOIN project_members pm ON p.id = pm.project_id
      WHERE p.mentor_id = $1
      GROUP BY p.id, u_creator.name, u_creator.email, u_creator.avatar_url, u_creator.department
      ORDER BY p.updated_at DESC, p.id DESC`,
      [mentorId]
    );

    const projects = projectRows.map((p) => {
      const total = parseInt(p.total_tasks || 0, 10);
      const completed = parseInt(p.completed_tasks || 0, 10);
      return {
        ...p,
        total_tasks: total,
        completed_tasks: completed,
        in_progress_tasks: parseInt(p.in_progress_tasks || 0, 10),
        review_tasks: parseInt(p.review_tasks || 0, 10),
        todo_tasks: parseInt(p.todo_tasks || 0, 10),
        member_count: parseInt(p.member_count || 0, 10),
        progress_percent: total > 0 ? Math.round((completed / total) * 100) : 0,
      };
    });

    const projectIds = projects.map((p) => p.id);

    // 2. Fetch Assigned Students across mentored projects
    let students = [];
    if (projectIds.length > 0) {
      const { rows: studentRows } = await db.query(
        `SELECT DISTINCT
          u.id, u.name, u.email, u.department, u.avatar_url, u.created_at
        FROM users u
        WHERE u.role = 'student'
          AND (
            u.id IN (SELECT created_by FROM projects WHERE mentor_id = $1)
            OR u.id IN (SELECT pm.user_id FROM project_members pm JOIN projects p ON pm.project_id = p.id WHERE p.mentor_id = $1)
            OR u.id IN (SELECT t.assigned_to FROM tasks t JOIN projects p ON t.project_id = p.id WHERE p.mentor_id = $1 AND t.assigned_to IS NOT NULL)
          )
        ORDER BY u.name ASC`,
        [mentorId]
      );

      // Fetch per-student task metrics and project memberships under this mentor
      const studentMetricsPromises = studentRows.map(async (student) => {
        // Enrolled projects under this mentor
        const { rows: enrolledProjects } = await db.query(
          `SELECT DISTINCT p.id, p.title, p.category, p.status
           FROM projects p
           LEFT JOIN project_members pm ON p.id = pm.project_id
           WHERE p.mentor_id = $1 AND (p.created_by = $2 OR pm.user_id = $2)`,
          [mentorId, student.id]
        );

        // Tasks assigned to this student in mentored projects
        const { rows: studentTasks } = await db.query(
          `SELECT t.id, t.title, t.status, t.priority, t.due_date, t.project_id, p.title as project_title
           FROM tasks t
           JOIN projects p ON t.project_id = p.id
           WHERE p.mentor_id = $1 AND t.assigned_to = $2
           ORDER BY t.updated_at DESC`,
          [mentorId, student.id]
        );

        const totalTasks = studentTasks.length;
        const completedTasks = studentTasks.filter((t) => t.status === 'done').length;
        const inProgressTasks = studentTasks.filter((t) => t.status === 'in_progress').length;
        const reviewTasks = studentTasks.filter((t) => t.status === 'review').length;
        const todoTasks = studentTasks.filter((t) => t.status === 'todo').length;
        const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        return {
          ...student,
          projects: enrolledProjects,
          tasks_count: totalTasks,
          completed_tasks: completedTasks,
          in_progress_tasks: inProgressTasks,
          review_tasks: reviewTasks,
          todo_tasks: todoTasks,
          progress_percent: progressPercent,
          recent_task: studentTasks[0] || null,
        };
      });

      students = await Promise.all(studentMetricsPromises);
    }

    // 3. Fetch Pending Student Work Review Queue (Tasks in status 'review')
    let reviewQueue = [];
    if (projectIds.length > 0) {
      const { rows: reviewRows } = await db.query(
        `SELECT 
          t.*,
          p.title as project_title,
          p.category as project_category,
          u.name as assignee_name,
          u.email as assignee_email,
          u.avatar_url as assignee_avatar,
          u.department as assignee_department,
          COUNT(c.id) as comment_count
        FROM tasks t
        JOIN projects p ON t.project_id = p.id
        LEFT JOIN users u ON t.assigned_to = u.id
        LEFT JOIN comments c ON t.id = c.task_id
        WHERE p.mentor_id = $1 AND t.status = 'review'
        GROUP BY t.id, p.title, p.category, u.name, u.email, u.avatar_url, u.department
        ORDER BY t.updated_at DESC, t.id DESC`,
        [mentorId]
      );
      reviewQueue = reviewRows;
    }

    // 4. Fetch Recent Official Mentor Feedbacks
    let recentFeedbacks = [];
    if (projectIds.length > 0) {
      const { rows: feedbackRows } = await db.query(
        `SELECT 
          c.*,
          u.name as user_name,
          u.avatar_url as user_avatar,
          u.role as user_role,
          p.title as project_title,
          t.title as task_title,
          t.status as task_status
        FROM comments c
        JOIN projects p ON c.project_id = p.id
        JOIN users u ON c.user_id = u.id
        LEFT JOIN tasks t ON c.task_id = t.id
        WHERE p.mentor_id = $1 AND (c.is_mentor_feedback = true OR c.user_id = $1)
        ORDER BY c.created_at DESC
        LIMIT 25`,
        [mentorId]
      );
      recentFeedbacks = feedbackRows;
    }

    // 5. Calculate Aggregate KPIs
    let totalAllTasks = 0;
    let completedAllTasks = 0;
    let inProgressAllTasks = 0;
    let overdueAllTasks = 0;

    projects.forEach((p) => {
      totalAllTasks += p.total_tasks;
      completedAllTasks += p.completed_tasks;
      inProgressAllTasks += p.in_progress_tasks;
    });

    const avgProgress =
      projects.length > 0
        ? Math.round(projects.reduce((acc, p) => acc + p.progress_percent, 0) / projects.length)
        : 0;

    return res.json({
      success: true,
      data: {
        mentor: {
          id: req.user.id,
          name: req.user.name,
          email: req.user.email,
          role: req.user.role,
          department: req.user.department,
        },
        stats: {
          mentored_projects_count: projects.length,
          assigned_students_count: students.length,
          pending_reviews_count: reviewQueue.length,
          total_tasks_count: totalAllTasks,
          completed_tasks_count: completedAllTasks,
          in_progress_tasks_count: inProgressAllTasks,
          avg_progress_percent: avgProgress,
        },
        projects,
        students,
        review_queue: reviewQueue,
        recent_feedbacks: recentFeedbacks,
      },
    });
  } catch (error) {
    console.error('Mentor overview error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve mentor dashboard data', error: error.message });
  }
});

/**
 * GET /api/mentor/tasks
 * Filterable list of all tasks across mentored projects
 */
router.get('/tasks', async (req, res) => {
  try {
    const mentorId = getTargetMentorId(req);
    const { project_id, student_id, status, priority, search } = req.query;

    let queryText = `
      SELECT 
        t.*,
        p.title as project_title,
        p.category as project_category,
        u_assignee.name as assignee_name,
        u_assignee.email as assignee_email,
        u_assignee.avatar_url as assignee_avatar,
        u_assignee.department as assignee_department,
        COUNT(c.id) as comment_count
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      LEFT JOIN users u_assignee ON t.assigned_to = u_assignee.id
      LEFT JOIN comments c ON t.id = c.task_id
      WHERE p.mentor_id = $1
    `;
    const params = [mentorId];

    if (project_id) {
      params.push(project_id);
      queryText += ` AND t.project_id = $${params.length}`;
    }

    if (student_id) {
      params.push(student_id);
      queryText += ` AND t.assigned_to = $${params.length}`;
    }

    if (status && status !== 'all') {
      params.push(status);
      queryText += ` AND t.status = $${params.length}`;
    }

    if (priority && priority !== 'all') {
      params.push(priority);
      queryText += ` AND t.priority = $${params.length}`;
    }

    if (search && search.trim() !== '') {
      params.push(`%${search.trim().toLowerCase()}%`);
      queryText += ` AND (LOWER(t.title) LIKE $${params.length} OR LOWER(t.description) LIKE $${params.length})`;
    }

    queryText += `
      GROUP BY t.id, p.title, p.category, u_assignee.name, u_assignee.email, u_assignee.avatar_url, u_assignee.department
      ORDER BY 
        CASE 
          WHEN t.status = 'review' THEN 1
          WHEN t.status = 'in_progress' THEN 2
          WHEN t.status = 'todo' THEN 3
          ELSE 4 
        END,
        t.due_date ASC NULLS LAST,
        t.updated_at DESC
    `;

    const { rows } = await db.query(queryText, params);
    return res.json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    console.error('Mentor tasks error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch mentor tasks', error: error.message });
  }
});

/**
 * POST /api/mentor/assign-task
 * Mentor assigns a task to an enrolled student on a mentored project
 */
router.post('/assign-task', async (req, res) => {
  try {
    const mentorId = getTargetMentorId(req);
    const { project_id, title, description, assigned_to, priority = 'medium', due_date, estimated_hours = 0 } = req.body;

    if (!project_id) {
      return res.status(400).json({ success: false, message: 'Project selection is required' });
    }

    if (!title || title.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Task title is required' });
    }

    // Verify project belongs to this mentor (or caller is admin)
    const { rows: projRows } = await db.query(
      `SELECT id, title, mentor_id FROM projects WHERE id = $1`,
      [project_id]
    );

    if (projRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    if (req.user.role !== 'admin' && projRows[0].mentor_id !== mentorId) {
      return res.status(403).json({ success: false, message: 'You can only assign tasks to projects you mentor' });
    }

    let studentName = 'Unassigned';
    if (assigned_to) {
      const { rows: userRows } = await db.query('SELECT id, name FROM users WHERE id = $1', [assigned_to]);
      if (userRows.length > 0) {
        studentName = userRows[0].name;
      }
    }

    // Calculate position
    const { rows: posRows } = await db.query(
      'SELECT COALESCE(MAX(position), 0) + 1 as next_pos FROM tasks WHERE project_id = $1 AND status = $2',
      [project_id, 'todo']
    );
    const nextPos = posRows[0]?.next_pos || 0;

    const { rows } = await db.query(
      `INSERT INTO tasks (project_id, title, description, status, priority, assigned_to, created_by, due_date, estimated_hours, position)
       VALUES ($1, $2, $3, 'todo', $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        project_id,
        title.trim(),
        description ? description.trim() : '',
        priority,
        assigned_to || null,
        req.user.id,
        due_date || null,
        parseFloat(estimated_hours) || 0,
        nextPos,
      ]
    );

    const createdTask = rows[0];

    // Log Activity
    await db.query(
      `INSERT INTO activity_logs (project_id, user_id, action_type, description)
       VALUES ($1, $2, $3, $4)`,
      [
        project_id,
        req.user.id,
        'mentor_task_assigned',
        `Mentor ${req.user.name} assigned task "${title.trim()}" to ${studentName}`,
      ]
    );

    // If description was provided, also post an initial mentor guidance note
    if (description && description.trim()) {
      await db.query(
        `INSERT INTO comments (task_id, project_id, user_id, content, is_mentor_feedback)
         VALUES ($1, $2, $3, $4, true)`,
        [
          createdTask.id,
          project_id,
          req.user.id,
          `📌 [Mentor Task Guidelines] ${description.trim()}`,
        ]
      );
    }

    return res.status(201).json({
      success: true,
      message: `Task successfully assigned to ${studentName}`,
      data: createdTask,
    });
  } catch (error) {
    console.error('Mentor assign-task error:', error);
    return res.status(500).json({ success: false, message: 'Failed to assign task', error: error.message });
  }
});

/**
 * POST /api/mentor/review-task
 * Review student deliverable: Approve (complete) or Request Revision with structured academic feedback
 */
router.post('/review-task', async (req, res) => {
  try {
    const mentorId = getTargetMentorId(req);
    const { task_id, action, feedback, rubric_score } = req.body;

    if (!task_id) {
      return res.status(400).json({ success: false, message: 'Task ID is required' });
    }

    const validActions = ['approve', 'request_revision', 'feedback_only'];
    if (!action || !validActions.includes(action)) {
      return res.status(400).json({ success: false, message: `Action must be one of: ${validActions.join(', ')}` });
    }

    // Verify task belongs to a mentored project
    const { rows: taskRows } = await db.query(
      `SELECT t.*, p.mentor_id, p.title as project_title, u.name as assignee_name
       FROM tasks t
       JOIN projects p ON t.project_id = p.id
       LEFT JOIN users u ON t.assigned_to = u.id
       WHERE t.id = $1`,
      [task_id]
    );

    if (taskRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const task = taskRows[0];
    if (req.user.role !== 'admin' && task.mentor_id !== mentorId) {
      return res.status(403).json({ success: false, message: 'You can only review tasks for projects you mentor' });
    }

    let newStatus = task.status;
    let commentPrefix = '';
    let logDescription = '';

    if (action === 'approve') {
      newStatus = 'done';
      commentPrefix = rubric_score ? `🏆 [Mentor Approved: ${rubric_score}] ` : `✅ [Mentor Approved & Verified] `;
      logDescription = `Mentor ${req.user.name} approved deliverable for "${task.title}"`;
    } else if (action === 'request_revision') {
      newStatus = 'in_progress';
      commentPrefix = `⚠️ [Mentor Revision Requested] `;
      logDescription = `Mentor ${req.user.name} requested revisions on "${task.title}"`;
    } else {
      commentPrefix = `🎓 [Mentor Review Notes] `;
      logDescription = `Mentor ${req.user.name} provided academic review on "${task.title}"`;
    }

    // Update task status
    const { rows: updatedRows } = await db.query(
      `UPDATE tasks SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
      [newStatus, task_id]
    );

    const updatedTask = updatedRows[0];

    // Insert official mentor academic feedback comment
    const feedbackText = feedback && feedback.trim().length > 0
      ? `${commentPrefix}${feedback.trim()}`
      : `${commentPrefix}Academic deliverable evaluated and updated.`;

    const { rows: commentRows } = await db.query(
      `INSERT INTO comments (task_id, project_id, user_id, content, is_mentor_feedback)
       VALUES ($1, $2, $3, $4, true)
       RETURNING *`,
      [task_id, task.project_id, req.user.id, feedbackText]
    );

    // Log Activity
    await db.query(
      `INSERT INTO activity_logs (project_id, user_id, action_type, description)
       VALUES ($1, $2, $3, $4)`,
      [task.project_id, req.user.id, 'mentor_task_reviewed', logDescription]
    );

    return res.json({
      success: true,
      message: action === 'approve' ? 'Deliverable approved successfully!' : 'Revision request submitted to student',
      data: {
        task: updatedTask,
        comment: {
          ...commentRows[0],
          user_name: req.user.name,
          user_role: req.user.role,
          user_avatar: req.user.avatar_url,
        },
      },
    });
  } catch (error) {
    console.error('Mentor review-task error:', error);
    return res.status(500).json({ success: false, message: 'Failed to process review', error: error.message });
  }
});

/**
 * POST /api/mentor/communicate
 * Broadcast guidance, send mentorship advice or announcement to students
 */
router.post('/communicate', async (req, res) => {
  try {
    const mentorId = getTargetMentorId(req);
    const { project_id, recipient_id, subject, message } = req.body;

    if (!project_id) {
      return res.status(400).json({ success: false, message: 'Target project is required' });
    }

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Message content cannot be empty' });
    }

    // Verify project belongs to mentor
    const { rows: projRows } = await db.query(
      `SELECT id, title, mentor_id FROM projects WHERE id = $1`,
      [project_id]
    );

    if (projRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    if (req.user.role !== 'admin' && projRows[0].mentor_id !== mentorId) {
      return res.status(403).json({ success: false, message: 'You can only communicate with teams you mentor' });
    }

    let recipientTag = '';
    if (recipient_id) {
      const { rows: uRows } = await db.query('SELECT name FROM users WHERE id = $1', [recipient_id]);
      if (uRows.length > 0) {
        recipientTag = ` [@${uRows[0].name}]`;
      }
    }

    const titlePrefix = subject && subject.trim() ? `[${subject.trim()}] ` : '';
    const formattedContent = `📢 Mentor Broadcast ${titlePrefix}${recipientTag}\n\n${message.trim()}`;

    // Post as official mentor feedback comment on project
    const { rows: commentRows } = await db.query(
      `INSERT INTO comments (task_id, project_id, user_id, content, is_mentor_feedback)
       VALUES (NULL, $1, $2, $3, true)
       RETURNING *`,
      [project_id, req.user.id, formattedContent]
    );

    // Log Activity
    await db.query(
      `INSERT INTO activity_logs (project_id, user_id, action_type, description)
       VALUES ($1, $2, $3, $4)`,
      [
        project_id,
        req.user.id,
        'mentor_communication',
        `Mentor ${req.user.name} shared guidance with ${projRows[0].title}`,
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Mentorship guidance sent successfully',
      data: {
        ...commentRows[0],
        user_name: req.user.name,
        user_role: req.user.role,
        user_avatar: req.user.avatar_url,
      },
    });
  } catch (error) {
    console.error('Mentor communicate error:', error);
    return res.status(500).json({ success: false, message: 'Failed to send message', error: error.message });
  }
});

module.exports = router;

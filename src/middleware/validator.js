function validateProjectInput(req, res, next) {
  const { title, status, due_date } = req.body;
  const errors = [];

  if (!title || typeof title !== 'string' || title.trim().length < 3) {
    errors.push('Project title is required and must be at least 3 characters.');
  }

  const validStatuses = ['planning', 'in_progress', 'review', 'completed', 'on_hold'];
  if (status && !validStatuses.includes(status)) {
    errors.push(`Status must be one of: ${validStatuses.join(', ')}`);
  }

  if (due_date && isNaN(Date.parse(due_date))) {
    errors.push('Invalid due date format. Expected YYYY-MM-DD.');
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: 'Validation failed', errors });
  }

  next();
}

function validateTaskInput(req, res, next) {
  const { title, status, priority, due_date } = req.body;
  const errors = [];

  if (!title || typeof title !== 'string' || title.trim().length < 2) {
    errors.push('Task title is required and must be at least 2 characters.');
  }

  const validStatuses = ['todo', 'in_progress', 'review', 'done'];
  if (status && !validStatuses.includes(status)) {
    errors.push(`Status must be one of: ${validStatuses.join(', ')}`);
  }

  const validPriorities = ['low', 'medium', 'high', 'urgent'];
  if (priority && !validPriorities.includes(priority)) {
    errors.push(`Priority must be one of: ${validPriorities.join(', ')}`);
  }

  if (due_date && isNaN(Date.parse(due_date))) {
    errors.push('Invalid due date format. Expected YYYY-MM-DD.');
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: 'Validation failed', errors });
  }

  next();
}

function validateAuthInput(req, res, next) {
  const { email, password } = req.body;
  const errors = [];

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    errors.push('A valid email address is required.');
  }

  if (!password || password.length < 6) {
    errors.push('Password must be at least 6 characters long.');
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: 'Validation failed', errors });
  }

  next();
}

module.exports = {
  validateProjectInput,
  validateTaskInput,
  validateAuthInput,
};

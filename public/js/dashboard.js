/**
 * Dashboard & Project Overview Module
 */

const Dashboard = (function () {
  let projectsList = [];
  let currentFilter = 'all';
  let currentCategory = 'all';
  let searchQuery = '';

  async function loadDashboard() {
    try {
      const user = window.Auth ? window.Auth.getUser() : null;

      // Update role subtitle
      const subtitleEl = document.getElementById('dashboard-role-subtitle');
      if (subtitleEl && user) {
        if (user.role === 'student') {
          subtitleEl.innerHTML = `<i class="fa-solid fa-user-graduate" style="color: #60A5FA;"></i> Showing your capstone projects & assignments.`;
        } else if (user.role === 'mentor') {
          subtitleEl.innerHTML = `<i class="fa-solid fa-chalkboard-user" style="color: #C084FC;"></i> Showing projects assigned to you for faculty mentorship.`;
        } else if (user.role === 'admin') {
          subtitleEl.innerHTML = `<i class="fa-solid fa-shield-halved" style="color: #FB7185;"></i> System administrator view: showing all campus projects.`;
        }
      }

      // Load faculty mentors list for project creation
      try {
        const mentorsRes = await API.get('/projects/mentors');
        const mentorSelect = document.getElementById('proj-mentor-select');
        if (mentorSelect && mentorsRes.data) {
          mentorSelect.innerHTML = `<option value="">Select a Faculty Mentor (Optional)...</option>` +
            mentorsRes.data.map((m) => `<option value="${m.id}">${escapeHtml(m.name)} - ${escapeHtml(m.department || 'Faculty')}</option>`).join('');
        }
      } catch (e) {
        // Mentors load error handled gracefully
      }

      const res = await API.get('/projects');
      projectsList = res.data || [];

      // Also fetch tasks scoped to current user for metrics and status chart
      const tasksRes = await API.get('/tasks');
      const allTasks = tasksRes.data || [];

      updateMetrics(projectsList, allTasks);
      renderProjects(projectsList);

      // Render Charts
      if (window.StudentPortalCharts) {
        window.StudentPortalCharts.renderProjectsProgressChart('projects-progress-canvas', projectsList);
        window.StudentPortalCharts.renderTaskStatusChart('task-status-canvas', allTasks);
      }
    } catch (err) {
      console.error('Failed to load dashboard:', err);
      if (window.App) window.App.showToast(`Failed to load projects: ${err.message}`, 'error');
    }
  }

  function updateMetrics(projects, tasks) {
    const totalProjectsEl = document.getElementById('metric-total-projects');
    const activeTasksEl = document.getElementById('metric-active-tasks');
    const avgProgressEl = document.getElementById('metric-avg-progress');
    const urgentTasksEl = document.getElementById('metric-urgent-tasks');

    if (totalProjectsEl) totalProjectsEl.textContent = projects.length;

    // Active tasks: todo + in_progress + review
    const activeTasks = tasks.filter((t) => t.status !== 'done');
    if (activeTasksEl) activeTasksEl.textContent = activeTasks.length;

    // Average progress
    let totalProgress = 0;
    if (projects.length > 0) {
      totalProgress = Math.round(
        projects.reduce((acc, p) => acc + (p.progress_percent || 0), 0) / projects.length
      );
    }
    if (avgProgressEl) avgProgressEl.textContent = `${totalProgress}%`;

    // Urgent / Overdue tasks
    const urgentTasks = tasks.filter((t) => (t.priority === 'urgent' || t.priority === 'high') && t.status !== 'done');
    if (urgentTasksEl) urgentTasksEl.textContent = urgentTasks.length;
  }

  function filterProjects() {
    let filtered = [...projectsList];

    // Status filter
    if (currentFilter !== 'all') {
      filtered = filtered.filter((p) => p.status === currentFilter);
    }

    // Category filter
    if (currentCategory !== 'all') {
      filtered = filtered.filter((p) => p.category === currentCategory);
    }

    // Search query
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (p) => p.title.toLowerCase().includes(q) || (p.description && p.description.toLowerCase().includes(q))
      );
    }

    renderProjects(filtered);
  }

  function renderProjects(projects) {
    const container = document.getElementById('projects-grid-container');
    if (!container) return;

    const user = window.Auth ? window.Auth.getUser() : null;

    if (projects.length === 0) {
      let emptyTitle = 'No projects found';
      let emptyMsg = 'Try adjusting your filters or create a new student project.';
      let emptyIcon = 'fa-solid fa-folder-open';

      if (user && user.role === 'student') {
        emptyTitle = 'No Projects Yet';
        emptyMsg = 'Welcome to your portal! You currently have no active projects. Click "+ New Project" above to create your first capstone project and assign a faculty mentor.';
        emptyIcon = 'fa-solid fa-graduation-cap';
      } else if (user && user.role === 'mentor') {
        emptyTitle = 'No Projects Assigned';
        emptyMsg = 'You currently have no capstone projects assigned to you for faculty supervision. When students select you as their mentor, their projects will appear here.';
        emptyIcon = 'fa-solid fa-chalkboard-user';
      }

      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 3.5rem 1.5rem; color: var(--text-muted); background: var(--bg-surface); border: 1px dashed var(--border-subtle); border-radius: var(--radius-lg);">
          <i class="${emptyIcon}" style="font-size: 2.8rem; margin-bottom: 1rem; color: var(--primary-400);"></i>
          <h3 style="font-size: 1.25rem; font-weight: 700; color: var(--text-primary);">${emptyTitle}</h3>
          <p style="font-size: 0.92rem; margin-top: 0.5rem; max-width: 500px; margin-left: auto; margin-right: auto; line-height: 1.6;">${emptyMsg}</p>
        </div>
      `;
      return;
    }

    const statusBadgeClass = {
      planning: 'role-student',
      in_progress: 'role-student',
      review: 'role-mentor',
      completed: 'role-student',
      on_hold: 'role-student',
    };

    const statusLabels = {
      planning: 'Planning',
      in_progress: 'In Progress',
      review: 'Under Review',
      completed: 'Completed',
      on_hold: 'On Hold',
    };

    container.innerHTML = projects
      .map((p) => {
        const percent = p.progress_percent || 0;
        const total = p.total_tasks || 0;
        const completed = p.completed_tasks || 0;

        // Due date calculation
        let dueBadge = `<span class="project-due-date"><i class="fa-regular fa-calendar"></i> No deadline</span>`;
        if (p.due_date) {
          const due = new Date(p.due_date);
          const now = new Date();
          const diffDays = Math.ceil((due - now) / (1000 * 60 * 60 * 24));

          if (diffDays < 0) {
            dueBadge = `<span class="project-due-date due-overdue"><i class="fa-solid fa-circle-exclamation"></i> Overdue (${Math.abs(diffDays)}d)</span>`;
          } else if (diffDays <= 5) {
            dueBadge = `<span class="project-due-date due-soon"><i class="fa-regular fa-clock"></i> Due in ${diffDays}d</span>`;
          } else {
            const formatted = due.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            dueBadge = `<span class="project-due-date"><i class="fa-regular fa-calendar-check"></i> ${formatted}</span>`;
          }
        }

        const mentorName = p.mentor_name ? p.mentor_name : 'Unassigned';

        return `
          <div class="project-card" data-project-id="${p.id}" onclick="App.openProject(${p.id})">
            <div class="project-card-header">
              <span class="project-category-badge">${p.category || 'General'}</span>
              <span class="project-status-badge ${statusBadgeClass[p.status] || ''}">
                <i class="fa-solid fa-circle" style="font-size: 0.45rem;"></i> ${statusLabels[p.status] || p.status}
              </span>
            </div>

            <div>
              <h3 class="project-card-title">${escapeHtml(p.title)}</h3>
              <p class="project-card-desc">${escapeHtml(p.description || 'No project description provided.')}</p>
            </div>

            <div class="project-progress-wrapper">
              <div class="progress-info">
                <span>Progress: <strong>${percent}%</strong></span>
                <span>${completed} of ${total} tasks</span>
              </div>
              <div class="progress-bar-bg">
                <div class="progress-bar-fill" style="width: ${percent}%;"></div>
              </div>
            </div>

            <div class="project-card-footer">
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <i class="fa-solid fa-chalkboard-user" style="color: var(--purple); font-size: 0.9rem;"></i>
                <span style="font-size: 0.8rem; font-weight: 500;">${escapeHtml(mentorName)}</span>
              </div>
              ${dueBadge}
            </div>
          </div>
        `;
      })
      .join('');
  }

  async function handleCreateProject(formData) {
    try {
      const res = await API.post('/projects', formData);
      if (window.App) {
        window.App.showToast(`Project "${formData.title}" created successfully!`, 'success');
        window.App.closeModal('new-project-modal');
      }
      await loadDashboard();
      return res.data;
    } catch (err) {
      if (window.App) window.App.showToast(err.message, 'error');
      throw err;
    }
  }

  function escapeHtml(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  return {
    loadDashboard,
    filterProjects,
    setFilter: (status) => {
      currentFilter = status;
      filterProjects();
    },
    setCategory: (cat) => {
      currentCategory = cat;
      filterProjects();
    },
    setSearch: (query) => {
      searchQuery = query;
      filterProjects();
    },
    handleCreateProject,
  };
})();

window.Dashboard = Dashboard;

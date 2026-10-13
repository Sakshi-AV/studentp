/**
 * Faculty Mentor Dashboard & Operations Module - ProjectNest
 */

const Mentor = (function () {
  let overviewData = null;
  let activeTab = 'projects';
  let mentorTasksList = [];
  let currentTasksFilter = {
    status: 'all',
    project_id: '',
    student_id: '',
    priority: 'all',
    search: '',
  };

  /**
   * Main Loader for Mentor Dashboard
   */
  async function loadMentorDashboard() {
    try {
      const user = window.Auth ? window.Auth.getUser() : null;
      if (!user || (user.role !== 'mentor' && user.role !== 'admin')) {
        if (window.App) window.App.showToast('Access restricted to faculty mentors', 'error');
        if (window.App) window.App.showScreen('dashboard');
        return;
      }

      // Fetch aggregated overview data
      const res = await API.get('/mentor/overview');
      overviewData = res.data;

      // Update KPI Statistics
      updateKPIs(overviewData.stats);

      // Render Active Tab Content
      renderActiveTabContent();

      // Also fetch tasks for task monitor
      await loadMentorTasks();

      // Populate Project & Student selectors for modals
      populateModalSelectors(overviewData);
    } catch (err) {
      console.error('Failed to load mentor dashboard:', err);
      if (window.App) window.App.showToast(`Error loading mentor hub: ${err.message}`, 'error');
    }
  }

  function updateKPIs(stats) {
    if (!stats) return;

    const elProjects = document.getElementById('mentor-stat-projects');
    const elStudents = document.getElementById('mentor-stat-students');
    const elReviews = document.getElementById('mentor-stat-reviews');
    const elTasks = document.getElementById('mentor-stat-tasks');
    const elVelocity = document.getElementById('mentor-stat-velocity');
    const headerReviewBadge = document.getElementById('mentor-header-pending-badge');
    const navReviewBadge = document.getElementById('nav-mentor-badge');

    if (elProjects) elProjects.textContent = stats.mentored_projects_count || 0;
    if (elStudents) elStudents.textContent = stats.assigned_students_count || 0;
    if (elReviews) elReviews.textContent = stats.pending_reviews_count || 0;
    if (elTasks) elTasks.textContent = (stats.total_tasks_count || 0) - (stats.completed_tasks_count || 0);
    if (elVelocity) elVelocity.textContent = `${stats.avg_progress_percent || 0}%`;

    // Pending review badge in tab and nav
    const pendingCount = stats.pending_reviews_count || 0;
    if (headerReviewBadge) {
      headerReviewBadge.textContent = pendingCount;
      headerReviewBadge.style.display = pendingCount > 0 ? 'inline-flex' : 'none';
    }
    if (navReviewBadge) {
      navReviewBadge.textContent = pendingCount;
      navReviewBadge.style.display = pendingCount > 0 ? 'inline-flex' : 'none';
    }
  }

  function switchTab(tabName) {
    activeTab = tabName;

    // Update Tab Buttons
    document.querySelectorAll('.mentor-tab-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
    });

    // Update Tab Panes
    document.querySelectorAll('.mentor-tab-pane').forEach((pane) => {
      pane.classList.remove('active');
    });

    const activePane = document.getElementById(`pane-mentor-${tabName}`);
    if (activePane) {
      activePane.classList.add('active');
    }

    renderActiveTabContent();
  }

  function renderActiveTabContent() {
    if (!overviewData) return;

    if (activeTab === 'projects') {
      renderMentoredProjects(overviewData.projects);
    } else if (activeTab === 'students') {
      renderAssignedStudents(overviewData.students);
    } else if (activeTab === 'reviews') {
      renderReviewQueue(overviewData.review_queue);
    } else if (activeTab === 'tasks') {
      filterAndRenderTasks();
    } else if (activeTab === 'feedback') {
      renderFeedbackStream(overviewData.recent_feedbacks);
    }
  }

  /**
   * 1. Render Mentored Projects
   */
  function renderMentoredProjects(projects) {
    const container = document.getElementById('mentor-projects-list');
    if (!container) return;

    if (!projects || projects.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 3rem 1.5rem; color: var(--text-muted); background: var(--bg-surface); border: 1px dashed var(--border-subtle); border-radius: var(--radius-xl); grid-column: 1 / -1;">
          <i class="fa-solid fa-folder-open" style="font-size: 2.8rem; margin-bottom: 1rem; color: #C084FC;"></i>
          <h3 style="font-size: 1.25rem; font-weight: 700; color: var(--text-primary);">No Assigned Projects Yet</h3>
          <p style="font-size: 0.92rem; margin-top: 0.5rem; max-width: 480px; margin-left: auto; margin-right: auto;">
            You currently have no student capstone projects under faculty mentorship. When students select you as their mentor, their projects will appear here.
          </p>
        </div>
      `;
      return;
    }

    const statusMap = {
      planning: { label: 'Planning', class: 'role-student' },
      in_progress: { label: 'In Progress', class: 'role-student' },
      review: { label: 'Under Review', class: 'role-mentor' },
      completed: { label: 'Completed', class: 'role-admin' },
      on_hold: { label: 'On Hold', class: 'role-student' },
    };

    container.innerHTML = projects.map((p) => {
      const st = statusMap[p.status] || { label: p.status, class: 'role-student' };
      const deadlineText = p.due_date ? new Date(p.due_date).toLocaleDateString() : 'No deadline';

      return `
        <div class="project-card">
          <div class="project-card-header">
            <div>
              <span class="project-card-category">${escapeHtml(p.category || 'General')}</span>
              <h3 class="project-card-title" onclick="App.openProject(${p.id})">${escapeHtml(p.title)}</h3>
            </div>
            <span class="user-role-pill ${st.class}">${st.label}</span>
          </div>

          <p class="project-card-desc">${escapeHtml(p.description || 'No description provided.')}</p>

          <div class="project-progress-wrapper">
            <div class="project-progress-header">
              <span>Milestone Progress</span>
              <span style="font-weight: 700; color: var(--primary-400);">${p.progress_percent}%</span>
            </div>
            <div class="progress-bar-bg">
              <div class="progress-bar-fill" style="width: ${p.progress_percent}%;"></div>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.82rem; color: var(--text-muted); margin-bottom: 1.25rem;">
            <span><i class="fa-solid fa-list-check"></i> ${p.completed_tasks} / ${p.total_tasks} Tasks Done</span>
            <span><i class="fa-regular fa-calendar"></i> ${deadlineText}</span>
          </div>

          <div class="project-card-footer">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <img src="${p.creator_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.creator_name || 'Student')}`}" class="user-avatar" style="width: 26px; height: 26px;" title="Lead Student: ${escapeHtml(p.creator_name || 'Student')}">
              <span style="font-size: 0.8rem; color: var(--text-secondary);">${escapeHtml(p.creator_name || 'Student')}</span>
            </div>

            <div style="display: flex; gap: 0.4rem;">
              <button class="btn-secondary" style="padding: 0.35rem 0.75rem; font-size: 0.8rem;" onclick="Mentor.openAssignTaskModal(null, ${p.id})" title="Assign task to this project">
                <i class="fa-solid fa-plus"></i> Task
              </button>
              <button class="btn-primary" style="padding: 0.35rem 0.85rem; font-size: 0.8rem; width: auto;" onclick="App.openProject(${p.id})">
                <i class="fa-solid fa-kanban"></i> Kanban
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  /**
   * 2. Render Assigned Students
   */
  function renderAssignedStudents(students) {
    const container = document.getElementById('mentor-students-grid');
    if (!container) return;

    if (!students || students.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 3rem 1.5rem; color: var(--text-muted); background: var(--bg-surface); border: 1px dashed var(--border-subtle); border-radius: var(--radius-xl); grid-column: 1 / -1;">
          <i class="fa-solid fa-user-graduate" style="font-size: 2.8rem; margin-bottom: 1rem; color: #60A5FA;"></i>
          <h3 style="font-size: 1.25rem; font-weight: 700; color: var(--text-primary);">No Students Assigned</h3>
          <p style="font-size: 0.92rem; margin-top: 0.5rem; max-width: 480px; margin-left: auto; margin-right: auto;">
            Students collaborating on your mentored capstone projects will automatically be indexed here with their sprint velocities and deliverables.
          </p>
        </div>
      `;
      return;
    }

    container.innerHTML = students.map((s) => {
      const projectsHtml = s.projects && s.projects.length > 0
        ? s.projects.map((proj) => `<span class="student-project-pill" onclick="App.openProject(${proj.id})"><i class="fa-solid fa-folder" style="margin-right: 3px;"></i>${escapeHtml(proj.title)}</span>`).join('')
        : `<span style="font-size: 0.8rem; color: var(--text-muted);">No active projects</span>`;

      return `
        <div class="student-card">
          <div class="student-card-header">
            <img src="${s.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(s.name)}`}" class="student-avatar-lg" alt="${escapeHtml(s.name)}">
            <div class="student-info-main">
              <h4>${escapeHtml(s.name)}</h4>
              <div class="student-dept-tag"><i class="fa-solid fa-building-columns"></i> ${escapeHtml(s.department || 'Computer Science')}</div>
              <a href="mailto:${escapeHtml(s.email)}" class="student-email-link"><i class="fa-regular fa-envelope"></i> ${escapeHtml(s.email)}</a>
            </div>
          </div>

          <div style="margin-bottom: 0.85rem;">
            <div style="font-size: 0.74rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 0.4rem; letter-spacing: 0.04em;">Enrolled Projects:</div>
            <div class="student-projects-list">${projectsHtml}</div>
          </div>

          <div class="student-tasks-summary">
            <div class="student-metrics-row">
              <div class="student-metric-item">
                <div class="count" style="color: var(--success);">${s.completed_tasks || 0}</div>
                <div class="label">Completed</div>
              </div>
              <div class="student-metric-item">
                <div class="count" style="color: var(--status-in_progress);">${s.in_progress_tasks || 0}</div>
                <div class="label">In Progress</div>
              </div>
              <div class="student-metric-item">
                <div class="count" style="color: var(--warning);">${s.review_tasks || 0}</div>
                <div class="label">In Review</div>
              </div>
              <div class="student-metric-item">
                <div class="count" style="color: var(--text-muted);">${s.todo_tasks || 0}</div>
                <div class="label">To Do</div>
              </div>
            </div>

            <div style="display: flex; justify-content: space-between; font-size: 0.78rem; font-weight: 600; margin-bottom: 0.25rem;">
              <span>Student Completion</span>
              <span style="color: var(--primary-400);">${s.progress_percent}%</span>
            </div>
            <div class="progress-bar-bg" style="height: 6px;">
              <div class="progress-bar-fill" style="width: ${s.progress_percent}%;"></div>
            </div>
          </div>

          <div class="student-card-actions">
            <button class="btn-primary" style="flex: 1; padding: 0.5rem; font-size: 0.82rem;" onclick="Mentor.openAssignTaskModal(${s.id}, null)">
              <i class="fa-solid fa-plus"></i> Assign Task
            </button>
            <button class="btn-secondary" style="flex: 1; padding: 0.5rem; font-size: 0.82rem;" onclick="Mentor.openCommunicateModal(null, ${s.id})">
              <i class="fa-regular fa-paper-plane"></i> Message
            </button>
            <button class="btn-secondary" style="padding: 0.5rem 0.7rem; font-size: 0.82rem;" title="View all tasks assigned to this student" onclick="Mentor.filterTasksByStudent(${s.id})">
              <i class="fa-solid fa-list-check"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  /**
   * 3. Render Review Student Work (Review Queue)
   */
  function renderReviewQueue(queue) {
    const container = document.getElementById('mentor-reviews-list');
    if (!container) return;

    if (!queue || queue.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 3.5rem 1.5rem; color: var(--text-muted); background: var(--bg-surface); border: 1px dashed var(--border-subtle); border-radius: var(--radius-xl);">
          <i class="fa-solid fa-circle-check" style="font-size: 3rem; margin-bottom: 1rem; color: var(--success);"></i>
          <h3 style="font-size: 1.25rem; font-weight: 700; color: var(--text-primary);">All Student Work Reviewed!</h3>
          <p style="font-size: 0.92rem; margin-top: 0.5rem; max-width: 480px; margin-left: auto; margin-right: auto;">
            There are currently no milestone deliverables in the "Under Review" state waiting for faculty evaluation.
          </p>
        </div>
      `;
      return;
    }

    const priorityBadge = {
      low: 'badge-low',
      medium: 'badge-medium',
      high: 'badge-high',
      urgent: 'badge-urgent',
    };

    container.innerHTML = queue.map((t) => {
      const deadline = t.due_date ? new Date(t.due_date).toLocaleDateString() : 'No deadline';
      const prioClass = priorityBadge[t.priority] || 'badge-medium';

      return `
        <div class="review-item-card" id="review-card-${t.id}">
          <div class="review-card-top">
            <div>
              <div class="review-project-context">
                <span class="review-project-badge"><i class="fa-solid fa-folder"></i> ${escapeHtml(t.project_title)}</span>
                <span>•</span>
                <span>Milestone Deliverable</span>
              </div>
              <h3 class="review-task-title">${escapeHtml(t.title)}</h3>
            </div>

            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span class="task-priority-pill ${prioClass}">
                <i class="fa-solid fa-flag"></i> ${t.priority ? t.priority.toUpperCase() : 'MEDIUM'}
              </span>
              <span style="font-size: 0.8rem; color: var(--text-muted);"><i class="fa-regular fa-clock"></i> Due ${deadline}</span>
            </div>
          </div>

          <div style="font-size: 0.92rem; color: var(--text-secondary); line-height: 1.6; background: var(--bg-surface-elevated); padding: 0.85rem 1.15rem; border-radius: var(--radius-md); border-left: 3px solid var(--primary-400);">
            ${escapeHtml(t.description || 'No detailed instructions provided.')}
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
            <div class="review-student-meta">
              <img src="${t.assignee_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(t.assignee_name || 'Student')}`}" class="user-avatar" style="width: 32px; height: 32px;" alt="">
              <div>
                <div style="font-weight: 700; font-size: 0.88rem;">${escapeHtml(t.assignee_name || 'Unassigned')}</div>
                <div style="font-size: 0.76rem; color: var(--text-muted);">${escapeHtml(t.assignee_department || 'Computer Science')}</div>
              </div>
            </div>

            <div style="display: flex; align-items: center; gap: 0.4rem; color: var(--text-muted); font-size: 0.82rem;">
              <i class="fa-regular fa-comments"></i> <span>${t.comment_count || 0} discussion notes</span>
            </div>
          </div>

          <div class="review-actions-bar">
            <button class="btn-secondary" style="padding: 0.5rem 0.95rem; font-size: 0.85rem;" onclick="Kanban.openTaskDetail(${t.id})">
              <i class="fa-solid fa-arrow-up-right-from-square"></i> Full Task Thread
            </button>
            <button class="btn-revision" onclick="Mentor.openReviewModal(${t.id}, 'request_revision')">
              <i class="fa-solid fa-rotate-left"></i> Request Revision
            </button>
            <button class="btn-approve" onclick="Mentor.openReviewModal(${t.id}, 'approve')">
              <i class="fa-solid fa-check-double"></i> Approve & Complete
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  /**
   * 4. Load & Filter Tasks for Task Monitor
   */
  async function loadMentorTasks() {
    try {
      const res = await API.get('/mentor/tasks');
      mentorTasksList = res.data || [];
      filterAndRenderTasks();
    } catch (e) {
      console.error('Failed to load mentor tasks:', e);
    }
  }

  function filterAndRenderTasks() {
    const tbody = document.getElementById('mentor-tasks-tbody');
    if (!tbody) return;

    let filtered = [...mentorTasksList];

    if (currentTasksFilter.status !== 'all') {
      filtered = filtered.filter((t) => t.status === currentTasksFilter.status);
    }

    if (currentTasksFilter.project_id) {
      filtered = filtered.filter((t) => t.project_id == currentTasksFilter.project_id);
    }

    if (currentTasksFilter.student_id) {
      filtered = filtered.filter((t) => t.assigned_to == currentTasksFilter.student_id);
    }

    if (currentTasksFilter.priority !== 'all') {
      filtered = filtered.filter((t) => t.priority === currentTasksFilter.priority);
    }

    if (currentTasksFilter.search.trim()) {
      const q = currentTasksFilter.search.toLowerCase().trim();
      filtered = filtered.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.description && t.description.toLowerCase().includes(q)) ||
          (t.assignee_name && t.assignee_name.toLowerCase().includes(q))
      );
    }

    const taskCountEl = document.getElementById('mentor-tasks-count');
    if (taskCountEl) taskCountEl.textContent = `${filtered.length} tasks`;

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
            <i class="fa-solid fa-list-check" style="font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.5;"></i>
            <p>No tasks match the active filters.</p>
          </td>
        </tr>
      `;
      return;
    }

    const statusBadge = {
      todo: { label: 'To Do', class: 'status-badge-todo', icon: 'fa-regular fa-circle' },
      in_progress: { label: 'In Progress', class: 'status-badge-progress', icon: 'fa-solid fa-spinner' },
      review: { label: 'Under Review', class: 'status-badge-review', icon: 'fa-solid fa-eye' },
      done: { label: 'Completed', class: 'status-badge-done', icon: 'fa-solid fa-check' },
    };

    const prioBadge = {
      low: 'badge-low',
      medium: 'badge-medium',
      high: 'badge-high',
      urgent: 'badge-urgent',
    };

    tbody.innerHTML = filtered.map((t) => {
      const st = statusBadge[t.status] || { label: t.status, class: '', icon: 'fa-circle' };
      const prClass = prioBadge[t.priority] || 'badge-medium';
      const deadline = t.due_date ? new Date(t.due_date).toLocaleDateString() : '-';

      return `
        <tr>
          <td style="font-weight: 600;">
            <div style="cursor: pointer; color: var(--text-primary);" onclick="Kanban.openTaskDetail(${t.id})">
              ${escapeHtml(t.title)}
            </div>
          </td>
          <td>
            <span class="student-project-pill" onclick="App.openProject(${t.project_id})">${escapeHtml(t.project_title)}</span>
          </td>
          <td>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <img src="${t.assignee_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(t.assignee_name || 'Unassigned')}`}" class="user-avatar" style="width: 24px; height: 24px;">
              <span>${escapeHtml(t.assignee_name || 'Unassigned')}</span>
            </div>
          </td>
          <td>
            <span class="task-priority-pill ${prClass}">
              ${t.priority ? t.priority.toUpperCase() : 'MEDIUM'}
            </span>
          </td>
          <td>
            <span class="user-role-pill ${t.status === 'review' ? 'role-mentor' : 'role-student'}" style="font-size: 0.74rem;">
              <i class="${st.icon}"></i> ${st.label}
            </span>
          </td>
          <td style="color: var(--text-muted); font-size: 0.82rem;">${deadline}</td>
          <td>
            <div style="display: flex; gap: 0.35rem;">
              <button class="btn-icon-toggle" style="width: 30px; height: 30px; font-size: 0.8rem;" title="View Task Thread" onclick="Kanban.openTaskDetail(${t.id})">
                <i class="fa-regular fa-comment-dots"></i>
              </button>
              ${t.status === 'review' ? `
                <button class="btn-icon-toggle" style="width: 30px; height: 30px; font-size: 0.8rem; color: var(--success);" title="Review Student Deliverable" onclick="Mentor.openReviewModal(${t.id}, 'approve')">
                  <i class="fa-solid fa-clipboard-check"></i>
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  function filterTasksByStudent(studentId) {
    currentTasksFilter.student_id = studentId;
    const select = document.getElementById('mentor-filter-student');
    if (select) select.value = studentId;
    switchTab('tasks');
  }

  /**
   * 5. Render Feedback & Communication Stream
   */
  function renderFeedbackStream(feedbacks) {
    const container = document.getElementById('mentor-feedbacks-stream');
    if (!container) return;

    if (!feedbacks || feedbacks.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 2.5rem; color: var(--text-muted); background: var(--bg-surface); border: 1px dashed var(--border-subtle); border-radius: var(--radius-xl);">
          <i class="fa-regular fa-comments" style="font-size: 2.5rem; margin-bottom: 0.75rem; color: #C084FC;"></i>
          <p>No mentor feedback history recorded yet. Compose an announcement on the left or evaluate student deliverables.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = feedbacks.map((f) => {
      const isOfficial = f.is_mentor_feedback === true || f.is_mentor_feedback == 1;
      const dateStr = new Date(f.created_at).toLocaleString();

      return `
        <div class="feedback-stream-card ${isOfficial ? 'is-official' : ''}">
          <div class="feedback-meta-top">
            <div style="display: flex; align-items: center; gap: 0.6rem;">
              <img src="${f.user_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(f.user_name)}`}" class="user-avatar" style="width: 26px; height: 26px;">
              <span style="font-weight: 700; font-size: 0.86rem;">${escapeHtml(f.user_name)}</span>
              ${isOfficial ? `<span class="mentor-evaluation-tag" style="font-size: 0.7rem;"><i class="fa-solid fa-award"></i> Faculty Feedback</span>` : ''}
            </div>
            <span style="font-size: 0.76rem; color: var(--text-muted);">${dateStr}</span>
          </div>

          <div style="font-size: 0.78rem; color: var(--text-muted); margin-bottom: 0.5rem;">
            <span>Project: <strong style="color: var(--text-secondary);">${escapeHtml(f.project_title || '')}</strong></span>
            ${f.task_title ? ` • <span>Deliverable: <strong>${escapeHtml(f.task_title)}</strong></span>` : ''}
          </div>

          <div class="feedback-content-text">${escapeHtml(f.content)}</div>
        </div>
      `;
    }).join('');
  }

  /**
   * Modal Population
   */
  function populateModalSelectors(data) {
    if (!data) return;

    // 1. Projects Dropdowns
    const taskProjSelect = document.getElementById('mentor-task-project-select');
    const commProjSelect = document.getElementById('mentor-comm-project-select');
    const modalCommProjSelect = document.getElementById('modal-comm-project-select');
    const filterProjSelect = document.getElementById('mentor-filter-project');

    const projectOptions = `<option value="">Select Mentored Project...</option>` +
      data.projects.map((p) => `<option value="${p.id}">${escapeHtml(p.title)}</option>`).join('');

    if (taskProjSelect) taskProjSelect.innerHTML = projectOptions;
    if (commProjSelect) commProjSelect.innerHTML = projectOptions;
    if (modalCommProjSelect) modalCommProjSelect.innerHTML = projectOptions;
    if (filterProjSelect) {
      filterProjSelect.innerHTML = `<option value="">All Mentored Projects</option>` +
        data.projects.map((p) => `<option value="${p.id}">${escapeHtml(p.title)}</option>`).join('');
    }

    // 2. Students Dropdowns
    const taskStudentSelect = document.getElementById('mentor-task-student-select');
    const commStudentSelect = document.getElementById('mentor-comm-student-select');
    const modalCommStudentSelect = document.getElementById('modal-comm-student-select');
    const filterStudentSelect = document.getElementById('mentor-filter-student');

    const studentOptions = `<option value="">Select Student Assignee...</option>` +
      data.students.map((s) => `<option value="${s.id}">${escapeHtml(s.name)} (${escapeHtml(s.department || 'Student')})</option>`).join('');

    if (taskStudentSelect) taskStudentSelect.innerHTML = studentOptions;
    if (commStudentSelect) commStudentSelect.innerHTML = `<option value="">Entire Project Team (Broadcast)</option>` +
      data.students.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
    if (modalCommStudentSelect) modalCommStudentSelect.innerHTML = `<option value="">Entire Project Team (Broadcast)</option>` +
      data.students.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');

    if (filterStudentSelect) {
      filterStudentSelect.innerHTML = `<option value="">All Students</option>` +
        data.students.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
    }
  }

  /**
   * Modal Openers & Submissions
   */
  function openAssignTaskModal(studentId = null, projectId = null) {
    if (window.App) window.App.openModal('mentor-assign-task-modal');

    const projSelect = document.getElementById('mentor-task-project-select');
    const studSelect = document.getElementById('mentor-task-student-select');

    if (projectId && projSelect) projSelect.value = projectId;
    if (studentId && studSelect) studSelect.value = studentId;
  }

  async function handleAssignTaskSubmit(e) {
    e.preventDefault();
    const projectId = document.getElementById('mentor-task-project-select').value;
    const title = document.getElementById('mentor-task-title-input').value;
    const description = document.getElementById('mentor-task-desc-input').value;
    const assigned_to = document.getElementById('mentor-task-student-select').value;
    const priority = document.getElementById('mentor-task-priority-select').value;
    const due_date = document.getElementById('mentor-task-due-input').value;
    const estimated_hours = document.getElementById('mentor-task-hours-input').value;

    try {
      const res = await API.post('/mentor/assign-task', {
        project_id: parseInt(projectId, 10),
        title,
        description,
        assigned_to: assigned_to ? parseInt(assigned_to, 10) : null,
        priority,
        due_date: due_date || null,
        estimated_hours: parseFloat(estimated_hours) || 0,
      });

      if (window.App) {
        window.App.closeModal('mentor-assign-task-modal');
        window.App.showToast('Task assigned to student successfully!', 'success');
      }

      document.getElementById('mentor-assign-task-form').reset();
      await loadMentorDashboard();
    } catch (err) {
      if (window.App) window.App.showToast(`Failed to assign task: ${err.message}`, 'error');
    }
  }

  function openReviewModal(taskId, defaultAction = 'approve') {
    const task = (overviewData?.review_queue || []).find((t) => t.id === taskId) ||
      mentorTasksList.find((t) => t.id === taskId);

    if (!task) {
      if (window.App) window.App.showToast('Task not found for review', 'error');
      return;
    }

    document.getElementById('review-modal-task-id').value = task.id;
    document.getElementById('review-modal-task-title').textContent = task.title;
    document.getElementById('review-modal-project').textContent = task.project_title || '';
    document.getElementById('review-modal-assignee').textContent = task.assignee_name || 'Unassigned';
    document.getElementById('review-modal-desc').textContent = task.description || 'No description';

    const actionSelect = document.getElementById('review-modal-action');
    if (actionSelect) actionSelect.value = defaultAction;

    if (window.App) window.App.openModal('mentor-review-modal');
  }

  async function handleReviewSubmit(e) {
    e.preventDefault();
    const taskId = document.getElementById('review-modal-task-id').value;
    const action = document.getElementById('review-modal-action').value;
    const feedback = document.getElementById('review-modal-feedback').value;
    const rubric_score = document.getElementById('review-modal-score').value;

    try {
      const res = await API.post('/mentor/review-task', {
        task_id: parseInt(taskId, 10),
        action,
        feedback,
        rubric_score: rubric_score ? rubric_score.trim() : null,
      });

      if (window.App) {
        window.App.closeModal('mentor-review-modal');
        window.App.showToast(res.message || 'Evaluation submitted!', 'success');
      }

      document.getElementById('mentor-review-form').reset();
      await loadMentorDashboard();
    } catch (err) {
      if (window.App) window.App.showToast(`Failed to submit review: ${err.message}`, 'error');
    }
  }

  function openCommunicateModal(projectId = null, studentId = null) {
    if (window.App) window.App.openModal('mentor-communicate-modal');

    const modalProj = document.getElementById('modal-comm-project-select');
    const modalStud = document.getElementById('modal-comm-student-select');

    if (projectId && modalProj) modalProj.value = projectId;
    if (studentId && modalStud) modalStud.value = studentId;
  }

  async function handleCommunicateSubmit(e) {
    e.preventDefault();
    const projectId = document.getElementById('mentor-comm-project-select').value;
    const recipientId = document.getElementById('mentor-comm-student-select').value;
    const subject = document.getElementById('mentor-comm-subject-input').value;
    const message = document.getElementById('mentor-comm-message-input').value;

    try {
      const res = await API.post('/mentor/communicate', {
        project_id: parseInt(projectId, 10),
        recipient_id: recipientId ? parseInt(recipientId, 10) : null,
        subject,
        message,
      });

      if (window.App) {
        window.App.closeModal('mentor-communicate-modal');
        window.App.showToast('Mentorship guidance shared with students!', 'success');
      }

      document.getElementById('mentor-communicate-form').reset();
      await loadMentorDashboard();
    } catch (err) {
      if (window.App) window.App.showToast(`Failed to send guidance: ${err.message}`, 'error');
    }
  }

  function setupFilterListeners() {
    // Tab switching
    document.querySelectorAll('.mentor-tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        switchTab(tab);
      });
    });

    // Task monitor filters
    const filterStatus = document.getElementById('mentor-filter-status');
    if (filterStatus) {
      filterStatus.addEventListener('change', (e) => {
        currentTasksFilter.status = e.target.value;
        filterAndRenderTasks();
      });
    }

    const filterProject = document.getElementById('mentor-filter-project');
    if (filterProject) {
      filterProject.addEventListener('change', (e) => {
        currentTasksFilter.project_id = e.target.value;
        filterAndRenderTasks();
      });
    }

    const filterStudent = document.getElementById('mentor-filter-student');
    if (filterStudent) {
      filterStudent.addEventListener('change', (e) => {
        currentTasksFilter.student_id = e.target.value;
        filterAndRenderTasks();
      });
    }

    const filterPriority = document.getElementById('mentor-filter-priority');
    if (filterPriority) {
      filterPriority.addEventListener('change', (e) => {
        currentTasksFilter.priority = e.target.value;
        filterAndRenderTasks();
      });
    }

    const filterSearch = document.getElementById('mentor-task-search-input');
    if (filterSearch) {
      filterSearch.addEventListener('input', (e) => {
        currentTasksFilter.search = e.target.value;
        filterAndRenderTasks();
      });
    }

    // Forms
    const assignForm = document.getElementById('mentor-assign-task-form');
    if (assignForm) assignForm.addEventListener('submit', handleAssignTaskSubmit);

    const reviewForm = document.getElementById('mentor-review-form');
    if (reviewForm) reviewForm.addEventListener('submit', handleReviewSubmit);

    const commForm = document.getElementById('mentor-communicate-form');
    if (commForm) commForm.addEventListener('submit', handleCommunicateSubmit);

    const modalCommForm = document.getElementById('mentor-communicate-modal-form');
    if (modalCommForm) {
      modalCommForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const projectId = document.getElementById('modal-comm-project-select').value;
        const recipientId = document.getElementById('modal-comm-student-select').value;
        const subject = document.getElementById('modal-comm-subject-input').value;
        const message = document.getElementById('modal-comm-message-input').value;

        try {
          const res = await API.post('/mentor/communicate', {
            project_id: parseInt(projectId, 10),
            recipient_id: recipientId ? parseInt(recipientId, 10) : null,
            subject,
            message,
          });

          if (window.App) {
            window.App.closeModal('mentor-communicate-modal');
            window.App.showToast('Mentorship guidance shared with students!', 'success');
          }

          modalCommForm.reset();
          await loadMentorDashboard();
        } catch (err) {
          if (window.App) window.App.showToast(`Failed to send guidance: ${err.message}`, 'error');
        }
      });
    }
  }

  function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  return {
    loadMentorDashboard,
    switchTab,
    openAssignTaskModal,
    openReviewModal,
    openCommunicateModal,
    filterTasksByStudent,
    setupFilterListeners,
  };
})();

window.Mentor = Mentor;

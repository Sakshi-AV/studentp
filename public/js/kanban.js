/**
 * Interactive Kanban Board & Task Management Module
 */

const Kanban = (function () {
  let activeProject = null;
  let activeTasks = [];
  let draggedTaskId = null;

  async function loadProject(projectId) {
    try {
      const res = await API.get(`/projects/${projectId}`);
      activeProject = res.data;
      activeTasks = activeProject.tasks || [];

      renderProjectHeader(activeProject);
      renderBoard(activeTasks);
    } catch (err) {
      console.error('Failed to load project details:', err);
      if (window.App) {
        window.App.showToast(`Error: ${err.message}`, 'error');
        window.App.showScreen('dashboard');
      }
    }
  }

  function renderProjectHeader(project) {
    document.getElementById('project-detail-title').textContent = project.title;
    document.getElementById('project-detail-desc').textContent = project.description || 'No description provided.';
    document.getElementById('project-detail-category').textContent = project.category || 'General';

    // Status dropdown
    const statusSelect = document.getElementById('project-status-select');
    if (statusSelect) {
      statusSelect.value = project.status;
      statusSelect.onchange = async () => {
        try {
          await API.put(`/projects/${project.id}`, { status: statusSelect.value, title: project.title });
          if (window.App) window.App.showToast(`Project status updated to ${statusSelect.value}`, 'success');
        } catch (err) {
          if (window.App) window.App.showToast(err.message, 'error');
        }
      };
    }

    // Mentor Info
    const mentorCard = document.getElementById('project-mentor-display');
    if (mentorCard) {
      const name = project.mentor_name || 'Unassigned Mentor';
      const avatar = project.mentor_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=8b5cf6&color=fff`;
      mentorCard.innerHTML = `
        <img src="${avatar}" class="mentor-avatar-img" alt="${name}">
        <div class="mentor-info-col">
          <span class="mentor-label">Faculty Mentor</span>
          <span class="mentor-name">${escapeHtml(name)}</span>
        </div>
      `;
    }

    // Progress
    const percent = project.progress_percent || 0;
    const progressFill = document.getElementById('project-detail-progress-fill');
    const progressText = document.getElementById('project-detail-progress-text');
    if (progressFill) progressFill.style.width = `${percent}%`;
    if (progressText) progressText.textContent = `${percent}% Completed (${project.completed_tasks || 0}/${project.total_tasks || 0} tasks)`;
  }

  function renderBoard(tasks) {
    const columns = {
      todo: document.getElementById('tasks-col-todo'),
      in_progress: document.getElementById('tasks-col-progress'),
      review: document.getElementById('tasks-col-review'),
      done: document.getElementById('tasks-col-done'),
    };

    const counts = {
      todo: document.getElementById('count-col-todo'),
      in_progress: document.getElementById('count-col-progress'),
      review: document.getElementById('count-col-review'),
      done: document.getElementById('count-col-done'),
    };

    // Reset columns
    Object.values(columns).forEach((col) => {
      if (col) col.innerHTML = '';
    });

    const statusTotals = { todo: 0, in_progress: 0, review: 0, done: 0 };

    tasks.forEach((task) => {
      const colKey = task.status in columns ? task.status : 'todo';
      statusTotals[colKey]++;

      const card = createTaskCardElement(task);
      if (columns[colKey]) {
        columns[colKey].appendChild(card);
      }
    });

    // Update count badges
    Object.keys(counts).forEach((key) => {
      if (counts[key]) counts[key].textContent = statusTotals[key];
    });

    // Handle empty columns
    Object.keys(columns).forEach((key) => {
      const col = columns[key];
      if (col && col.children.length === 0) {
        col.innerHTML = `<div class="empty-col-message"><i class="fa-regular fa-clipboard"></i> No tasks</div>`;
      }
    });

    setupDragAndDrop();
  }

  function createTaskCardElement(task) {
    const card = document.createElement('div');
    card.className = 'task-card';
    card.setAttribute('draggable', 'true');
    card.setAttribute('data-task-id', task.id);
    card.id = `task-card-${task.id}`;

    // Priority
    const priorityIcon = {
      urgent: 'fa-solid fa-angles-up',
      high: 'fa-solid fa-angle-up',
      medium: 'fa-solid fa-minus',
      low: 'fa-solid fa-angle-down',
    };

    // Due Date
    let dueHtml = `<span class="task-due-badge"><i class="fa-regular fa-calendar"></i> None</span>`;
    if (task.due_date) {
      const due = new Date(task.due_date);
      const now = new Date();
      const diff = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
      if (diff < 0) {
        dueHtml = `<span class="task-due-badge" style="color: var(--danger); font-weight: 700;"><i class="fa-solid fa-circle-exclamation"></i> Overdue</span>`;
      } else if (diff <= 3) {
        dueHtml = `<span class="task-due-badge" style="color: var(--warning); font-weight: 600;"><i class="fa-regular fa-clock"></i> ${diff}d left</span>`;
      } else {
        dueHtml = `<span class="task-due-badge"><i class="fa-regular fa-calendar"></i> ${due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>`;
      }
    }

    const assigneeAvatar = task.assignee_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(task.assignee_name || 'Team')}&background=3b82f6&color=fff`;

    card.innerHTML = `
      <div class="task-card-top">
        <span class="priority-pill priority-${task.priority}">
          <i class="${priorityIcon[task.priority] || 'fa-solid fa-minus'}"></i> ${task.priority}
        </span>
        <div class="task-shift-controls" onclick="event.stopPropagation()">
          ${task.status !== 'todo' ? `<button class="btn-shift" onclick="Kanban.moveTaskStep(${task.id}, -1)" title="Move left"><i class="fa-solid fa-chevron-left"></i></button>` : ''}
          ${task.status !== 'done' ? `<button class="btn-shift" onclick="Kanban.moveTaskStep(${task.id}, 1)" title="Move right"><i class="fa-solid fa-chevron-right"></i></button>` : ''}
        </div>
      </div>

      <div onclick="Kanban.openTaskDetail(${task.id})">
        <h4 class="task-title">${escapeHtml(task.title)}</h4>
        ${task.description ? `<p class="task-snippet">${escapeHtml(task.description)}</p>` : ''}
      </div>

      <div class="task-card-bottom" onclick="Kanban.openTaskDetail(${task.id})">
        ${dueHtml}
        <div class="task-meta-right">
          <span class="task-comments-count" title="${task.comment_count || 0} comments">
            <i class="fa-regular fa-comment-dots"></i> ${task.comment_count || 0}
          </span>
          <img src="${assigneeAvatar}" class="task-assignee-avatar" title="${escapeHtml(task.assignee_name || 'Unassigned')}" alt="Assignee">
        </div>
      </div>
    `;

    return card;
  }

  function setupDragAndDrop() {
    const cards = document.querySelectorAll('.task-card');
    const columnLists = document.querySelectorAll('.kanban-tasks-list');

    cards.forEach((card) => {
      card.addEventListener('dragstart', (e) => {
        draggedTaskId = card.getAttribute('data-task-id');
        card.classList.add('dragging');
        e.dataTransfer.setData('text/plain', draggedTaskId);
        e.dataTransfer.effectAllowed = 'move';
      });

      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        draggedTaskId = null;
      });
    });

    columnLists.forEach((colList) => {
      colList.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        colList.closest('.kanban-column').classList.add('drag-over');
      });

      colList.addEventListener('dragleave', (e) => {
        if (!colList.contains(e.relatedTarget)) {
          colList.closest('.kanban-column').classList.remove('drag-over');
        }
      });

      colList.addEventListener('drop', async (e) => {
        e.preventDefault();
        colList.closest('.kanban-column').classList.remove('drag-over');

        const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
        const targetStatus = colList.getAttribute('data-status');

        if (taskId && targetStatus) {
          await updateTaskStatus(taskId, targetStatus);
        }
      });
    });
  }

  async function updateTaskStatus(taskId, newStatus) {
    try {
      const res = await API.patch(`/tasks/${taskId}/status`, { status: newStatus });
      if (window.App) window.App.showToast(res.message, 'success');

      // Refresh project & board data
      if (activeProject) {
        await loadProject(activeProject.id);
      }
    } catch (err) {
      if (window.App) window.App.showToast(err.message, 'error');
    }
  }

  async function moveTaskStep(taskId, direction) {
    const statuses = ['todo', 'in_progress', 'review', 'done'];
    const task = activeTasks.find((t) => t.id == taskId);
    if (!task) return;

    const currentIndex = statuses.indexOf(task.status);
    const nextIndex = currentIndex + direction;

    if (nextIndex >= 0 && nextIndex < statuses.length) {
      await updateTaskStatus(taskId, statuses[nextIndex]);
    }
  }

  async function openTaskDetail(taskId) {
    try {
      const res = await API.get(`/tasks/${taskId}`);
      const task = res.data;

      document.getElementById('task-modal-title-input').value = task.title;
      document.getElementById('task-modal-desc-input').value = task.description || '';
      document.getElementById('task-modal-status-select').value = task.status;
      document.getElementById('task-modal-priority-select').value = task.priority;
      document.getElementById('task-modal-due-date').value = task.due_date ? task.due_date.substring(0, 10) : '';
      document.getElementById('task-modal-est-hours').value = task.estimated_hours || 0;
      document.getElementById('task-modal-act-hours').value = task.actual_hours || 0;
      document.getElementById('task-modal-id-holder').value = task.id;

      // Populate Assignee dropdown
      const assigneeSelect = document.getElementById('task-modal-assignee-select');
      if (assigneeSelect && activeProject && activeProject.members) {
        assigneeSelect.innerHTML = `<option value="">Unassigned</option>` +
          activeProject.members.map((m) => `<option value="${m.id}" ${m.id == task.assigned_to ? 'selected' : ''}>${m.name} (${m.role})</option>`).join('');
      }

      // Load comments
      if (window.Comments) {
        window.Comments.loadTaskComments(task.id, task.comments || []);
      }

      if (window.App) window.App.openModal('task-detail-modal');
    } catch (err) {
      if (window.App) window.App.showToast(`Failed to open task: ${err.message}`, 'error');
    }
  }

  async function handleSaveTaskDetail() {
    const taskId = document.getElementById('task-modal-id-holder').value;
    const body = {
      title: document.getElementById('task-modal-title-input').value,
      description: document.getElementById('task-modal-desc-input').value,
      status: document.getElementById('task-modal-status-select').value,
      priority: document.getElementById('task-modal-priority-select').value,
      due_date: document.getElementById('task-modal-due-date').value || null,
      assigned_to: document.getElementById('task-modal-assignee-select').value || null,
      estimated_hours: parseFloat(document.getElementById('task-modal-est-hours').value) || 0,
      actual_hours: parseFloat(document.getElementById('task-modal-act-hours').value) || 0,
    };

    try {
      await API.put(`/tasks/${taskId}`, body);
      if (window.App) {
        window.App.showToast('Task updated successfully', 'success');
        window.App.closeModal('task-detail-modal');
      }
      if (activeProject) await loadProject(activeProject.id);
    } catch (err) {
      if (window.App) window.App.showToast(err.message, 'error');
    }
  }

  async function handleDeleteTask() {
    const taskId = document.getElementById('task-modal-id-holder').value;
    if (!confirm('Are you sure you want to delete this task?')) return;

    try {
      await API.delete(`/tasks/${taskId}`);
      if (window.App) {
        window.App.showToast('Task deleted', 'info');
        window.App.closeModal('task-detail-modal');
      }
      if (activeProject) await loadProject(activeProject.id);
    } catch (err) {
      if (window.App) window.App.showToast(err.message, 'error');
    }
  }

  async function handleCreateTask(formData) {
    if (!activeProject) return;
    try {
      formData.project_id = activeProject.id;
      await API.post('/tasks', formData);
      if (window.App) {
        window.App.showToast(`Task "${formData.title}" added to project!`, 'success');
        window.App.closeModal('new-task-modal');
      }
      await loadProject(activeProject.id);
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
    loadProject,
    moveTaskStep,
    openTaskDetail,
    handleSaveTaskDetail,
    handleDeleteTask,
    handleCreateTask,
    getActiveProject: () => activeProject,
  };
})();

window.Kanban = Kanban;

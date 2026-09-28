/**
 * Administrator Console & System Audit Module
 */

const Admin = (function () {
  async function loadAdminPanel() {
    const user = window.Auth ? window.Auth.getUser() : null;
    if (!user || user.role !== 'admin') {
      if (window.App) {
        window.App.showToast('Access denied: Administrator privileges required', 'error');
        window.App.showScreen('dashboard');
      }
      return;
    }

    try {
      const [usersRes, statsRes, actsRes] = await Promise.all([
        API.get('/admin/users'),
        API.get('/admin/stats'),
        API.get('/admin/activities'),
      ]);

      renderStats(statsRes.data);
      renderUsersTable(usersRes.data);
      renderActivities(actsRes.data);
    } catch (err) {
      if (window.App) window.App.showToast(`Admin load error: ${err.message}`, 'error');
    }
  }

  function renderStats(stats) {
    if (!stats) return;
    const { users, projects, tasks, feedback } = stats;

    const elTotalStudents = document.getElementById('admin-stat-students');
    const elTotalMentors = document.getElementById('admin-stat-mentors');
    const elTotalProjects = document.getElementById('admin-stat-projects');
    const elOverdueTasks = document.getElementById('admin-stat-overdue');

    if (elTotalStudents) elTotalStudents.textContent = users.student_count || 0;
    if (elTotalMentors) elTotalMentors.textContent = users.mentor_count || 0;
    if (elTotalProjects) elTotalProjects.textContent = projects.total_projects || 0;
    if (elOverdueTasks) elOverdueTasks.textContent = tasks.overdue_tasks || 0;
  }

  function renderUsersTable(users) {
    const tbody = document.getElementById('admin-users-tbody');
    if (!tbody) return;

    tbody.innerHTML = users
      .map((u) => {
        const avatar = u.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=6366f1&color=fff`;

        return `
          <tr>
            <td>
              <div class="table-user-cell">
                <img src="${avatar}" style="width: 32px; height: 32px; border-radius: 50%;" alt="${escapeHtml(u.name)}">
                <div>
                  <div style="font-weight: 600; color: var(--text-primary);">${escapeHtml(u.name)}</div>
                  <div style="font-size: 0.78rem; color: var(--text-muted);">${escapeHtml(u.email)}</div>
                </div>
              </div>
            </td>
            <td><span style="font-size: 0.85rem; color: var(--text-secondary);">${escapeHtml(u.department || 'N/A')}</span></td>
            <td>
              <select class="role-select-box" onchange="Admin.updateRole(${u.id}, this.value)">
                <option value="student" ${u.role === 'student' ? 'selected' : ''}>Student</option>
                <option value="mentor" ${u.role === 'mentor' ? 'selected' : ''}>Mentor</option>
                <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Administrator</option>
              </select>
            </td>
            <td><strong>${u.projects_created || 0}</strong> created</td>
            <td><strong>${u.tasks_completed || 0}</strong> / ${u.tasks_assigned || 0}</td>
          </tr>
        `;
      })
      .join('');
  }

  function renderActivities(activities) {
    const container = document.getElementById('admin-activities-list');
    if (!container) return;

    if (!activities || activities.length === 0) {
      container.innerHTML = `<div style="color: var(--text-muted); font-size: 0.85rem;">No recent activities logged.</div>`;
      return;
    }

    container.innerHTML = activities
      .slice(0, 15)
      .map((a) => {
        const timeStr = a.created_at ? new Date(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        return `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.65rem 0; border-bottom: 1px solid var(--border-subtle); font-size: 0.85rem;">
            <div style="display: flex; align-items: center; gap: 0.6rem;">
              <span class="user-role-pill role-${a.user_role || 'student'}">${a.user_role || 'user'}</span>
              <span>${escapeHtml(a.description)}</span>
            </div>
            <span style="font-size: 0.75rem; color: var(--text-muted);">${timeStr}</span>
          </div>
        `;
      })
      .join('');
  }

  async function updateRole(userId, newRole) {
    try {
      const res = await API.patch(`/admin/users/${userId}/role`, { role: newRole });
      if (window.App) window.App.showToast(res.message, 'success');
    } catch (err) {
      if (window.App) window.App.showToast(`Failed to update role: ${err.message}`, 'error');
      loadAdminPanel();
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
    loadAdminPanel,
    updateRole,
  };
})();

window.Admin = Admin;

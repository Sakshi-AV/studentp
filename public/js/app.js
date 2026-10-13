/**
 * Main Application Orchestrator & Screen Router
 */

const App = (function () {
  let activeScreen = 'dashboard';

  function init() {
    setupEventListeners();
    setupModals();
    if (window.Mentor && window.Mentor.setupFilterListeners) {
      window.Mentor.setupFilterListeners();
    }
    bootstrapApp();
  }

  async function bootstrapApp() {
    const user = await Auth.checkSession();
    if (user) {
      if (user.role === 'mentor') {
        showScreen('mentor');
      } else {
        showScreen('dashboard');
      }
    } else {
      showScreen('auth');
    }
  }

  function showScreen(screenName) {
    activeScreen = screenName;
    const screens = document.querySelectorAll('.view-screen');
    screens.forEach((s) => s.classList.remove('active'));

    const target = document.getElementById(`${screenName}-view`);
    if (target) {
      target.classList.add('active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Trigger screen-specific loaders
    if (screenName === 'dashboard') {
      Dashboard.loadDashboard();
    } else if (screenName === 'admin') {
      Admin.loadAdminPanel();
    } else if (screenName === 'mentor') {
      if (window.Mentor) Mentor.loadMentorDashboard();
    }
  }

  function openProject(projectId) {
    showScreen('project-detail');
    Kanban.loadProject(projectId);
  }

  function setupEventListeners() {
    // Brand click -> Go to dashboard or auth
    document.getElementById('brand-header-link').addEventListener('click', () => {
      if (Auth.isAuthenticated()) {
        showScreen('dashboard');
      } else {
        showScreen('auth');
      }
    });

    // Global Search input
    const searchInput = document.getElementById('global-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        if (activeScreen !== 'dashboard') {
          showScreen('dashboard');
        }
        Dashboard.setSearch(e.target.value);
      });
    }

    // Auth screen tabs (Sign In / Register)
    const tabBtns = document.querySelectorAll('.auth-tab-btn');
    tabBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        tabBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.getAttribute('data-tab');
        document.getElementById('login-form').style.display = tab === 'login' ? 'block' : 'none';
        document.getElementById('register-form').style.display = tab === 'register' ? 'block' : 'none';
      });
    });

    // Login Form Submit
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        try {
          await Auth.login(email, password);
          const u = Auth.getUser();
          showToast(`Welcome back, ${u.name}!`, 'success');
          if (u.role === 'mentor') {
            showScreen('mentor');
          } else {
            showScreen('dashboard');
          }
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    }

    // Register Form Submit
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
      registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('reg-name').value;
        const email = document.getElementById('reg-email').value;
        const password = document.getElementById('reg-password').value;
        const role = document.getElementById('reg-role').value;
        const department = document.getElementById('reg-dept').value;

        try {
          await Auth.register({ name, email, password, role, department });
          showToast('Account registered successfully!', 'success');
          showScreen('dashboard');
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    }

    // Dashboard Filter Pills
    const filterPills = document.querySelectorAll('.filter-pill');
    filterPills.forEach((pill) => {
      pill.addEventListener('click', () => {
        filterPills.forEach((p) => p.classList.remove('active'));
        pill.classList.add('active');
        const status = pill.getAttribute('data-status');
        Dashboard.setFilter(status);
      });
    });

    // Category Filter Select
    const categorySelect = document.getElementById('filter-category-select');
    if (categorySelect) {
      categorySelect.addEventListener('change', (e) => {
        Dashboard.setCategory(e.target.value);
      });
    }

    // New Project Modal Open
    const btnNewProject = document.getElementById('btn-new-project');
    if (btnNewProject) {
      btnNewProject.addEventListener('click', () => {
        if (!Auth.isAuthenticated()) {
          showToast('Please sign in to create a project', 'info');
          showScreen('auth');
          return;
        }
        openModal('new-project-modal');
      });
    }

    // New Project Form Submit
    const newProjectForm = document.getElementById('new-project-form');
    if (newProjectForm) {
      newProjectForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('proj-title-input').value;
        const category = document.getElementById('proj-category-input').value;
        const status = document.getElementById('proj-status-input').value;
        const due_date = document.getElementById('proj-due-date-input').value;
        const mentor_id = document.getElementById('proj-mentor-select')?.value || null;
        const description = document.getElementById('proj-desc-input').value;

        try {
          await Dashboard.handleCreateProject({
            title,
            category,
            status,
            mentor_id: mentor_id ? parseInt(mentor_id, 10) : null,
            due_date: due_date || null,
            description,
          });
          newProjectForm.reset();
        } catch {}
      });
    }

    // Quick Add Task Button
    const btnQuickAddTask = document.getElementById('btn-header-add-task');
    if (btnQuickAddTask) {
      btnQuickAddTask.addEventListener('click', () => {
        openModal('new-task-modal');
      });
    }

    // New Task Form Submit
    const newTaskForm = document.getElementById('new-task-form');
    if (newTaskForm) {
      newTaskForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('task-title-input').value;
        const description = document.getElementById('task-desc-input').value;
        const status = document.getElementById('task-status-input').value;
        const priority = document.getElementById('task-priority-input').value;
        const due_date = document.getElementById('task-due-date-input').value;
        const estimated_hours = document.getElementById('task-hours-input').value;

        try {
          await Kanban.handleCreateTask({
            title,
            description,
            status,
            priority,
            due_date: due_date || null,
            estimated_hours: parseFloat(estimated_hours) || 0,
          });
          newTaskForm.reset();
        } catch {}
      });
    }

    // Save Task Details
    const btnSaveTaskDetail = document.getElementById('btn-save-task-detail');
    if (btnSaveTaskDetail) {
      btnSaveTaskDetail.addEventListener('click', () => {
        Kanban.handleSaveTaskDetail();
      });
    }

    // Delete Task Button
    const btnDeleteTask = document.getElementById('btn-delete-task');
    if (btnDeleteTask) {
      btnDeleteTask.addEventListener('click', () => {
        Kanban.handleDeleteTask();
      });
    }

    // Comment Post Form
    const commentSubmitBtn = document.getElementById('btn-submit-comment');
    if (commentSubmitBtn) {
      commentSubmitBtn.addEventListener('click', () => {
        Comments.postComment();
      });
    }

    // Logout Button
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
      btnLogout.addEventListener('click', () => {
        Auth.logout();
      });
    }

    // Admin link in nav
    const navAdminLink = document.getElementById('nav-admin-link');
    if (navAdminLink) {
      navAdminLink.addEventListener('click', () => {
        showScreen('admin');
      });
    }

    // Mentor link in nav
    const navMentorLink = document.getElementById('nav-mentor-link');
    if (navMentorLink) {
      navMentorLink.addEventListener('click', () => {
        showScreen('mentor');
      });
    }

    // Smart breadcrumb navigation
    const breadcrumbBack = document.querySelector('.breadcrumb-link');
    if (breadcrumbBack) {
      breadcrumbBack.addEventListener('click', (e) => {
        e.preventDefault();
        const user = Auth.getUser();
        if (user && user.role === 'mentor') {
          showScreen('mentor');
        } else {
          showScreen('dashboard');
        }
      });
    }
  }

  function setupModals() {
    // Close modal on click outside or close buttons
    document.querySelectorAll('.modal-overlay').forEach((overlay) => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          closeModal(overlay.id);
        }
      });

      const closeButtons = overlay.querySelectorAll('.modal-close-btn, .btn-modal-cancel');
      closeButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
          closeModal(overlay.id);
        });
      });
    });

    // Close on Escape key
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.active').forEach((modal) => {
          closeModal(modal.id);
        });
      }
    });
  }

  function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('active');
    }
  }

  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('active');
    }
  }

  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icons = {
      success: 'fa-solid fa-circle-check',
      error: 'fa-solid fa-circle-exclamation',
      info: 'fa-solid fa-circle-info',
    };

    toast.innerHTML = `
      <i class="${icons[type] || icons.info}"></i>
      <div style="flex: 1;">${message}</div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3800);
  }

  return {
    init,
    showScreen,
    openProject,
    openModal,
    closeModal,
    showToast,
    onAuthExpired: () => {
      showToast('Session expired. Please sign in again.', 'info');
      showScreen('auth');
    },
  };
})();

window.App = App;

// Bootstrap on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

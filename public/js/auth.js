/**
 * Authentication & Session Management Module
 */

const Auth = (function () {
  let currentUser = null;

  async function checkSession() {
    const token = API.getToken();
    if (!token) {
      currentUser = null;
      updateAuthUI();
      return null;
    }

    try {
      const res = await API.get('/auth/me');
      currentUser = res.data.user;
      API.setStoredUser(currentUser);
      updateAuthUI();
      return currentUser;
    } catch {
      currentUser = null;
      API.clearSession();
      updateAuthUI();
      return null;
    }
  }

  async function login(email, password) {
    const res = await API.post('/auth/login', { email, password });
    API.setToken(res.data.token);
    API.setStoredUser(res.data.user);
    currentUser = res.data.user;
    updateAuthUI();
    return currentUser;
  }

  async function register(userData) {
    const res = await API.post('/auth/register', userData);
    API.setToken(res.data.token);
    API.setStoredUser(res.data.user);
    currentUser = res.data.user;
    updateAuthUI();
    return currentUser;
  }

  function logout() {
    API.clearSession();
    currentUser = null;
    updateAuthUI();
    if (window.App) {
      window.App.showScreen('auth');
      window.App.showToast('You have signed out.', 'info');
    }
  }

  /**
   * One-Click Instant Demo Login for Evaluators & Reviewers
   */
  async function quickLoginAs(role) {
    try {
      const emailMap = {
        student: 'alex.student@campus.edu',
        mentor: 'dr.chen@campus.edu',
        admin: 'admin@campus.edu',
      };

      const email = emailMap[role] || 'alex.student@campus.edu';
      const password = 'Password123!';

      if (window.App) window.App.showToast(`Signing in as ${role.toUpperCase()}...`, 'info');
      await login(email, password);

      if (window.App) {
        window.App.showToast(`Logged in as ${currentUser.name} (${currentUser.role})`, 'success');
        if (currentUser.role === 'mentor') {
          window.App.showScreen('mentor');
        } else {
          window.App.showScreen('dashboard');
        }
      }
    } catch (err) {
      if (window.App) window.App.showToast(`Demo sign-in failed: ${err.message}`, 'error');
    }
  }

  function updateAuthUI() {
    const navUserBadge = document.getElementById('nav-user-badge');
    const navLoginBtn = document.getElementById('nav-login-btn');
    const navAdminBtn = document.getElementById('nav-admin-link');
    const navMentorBtn = document.getElementById('nav-mentor-link');

    if (currentUser) {
      if (navUserBadge) {
        navUserBadge.style.display = 'flex';
        document.getElementById('nav-user-name').textContent = currentUser.name;
        document.getElementById('nav-user-avatar').src = currentUser.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}`;
        
        const rolePill = document.getElementById('nav-user-role');
        rolePill.textContent = currentUser.role;
        rolePill.className = `user-role-pill role-${currentUser.role}`;
      }
      if (navLoginBtn) navLoginBtn.style.display = 'none';

      // Show mentor portal button if mentor or admin
      if (navMentorBtn) {
        navMentorBtn.style.display = (currentUser.role === 'mentor' || currentUser.role === 'admin') ? 'inline-flex' : 'none';
      }

      // Show admin portal button if admin
      if (navAdminBtn) {
        navAdminBtn.style.display = currentUser.role === 'admin' ? 'inline-flex' : 'none';
      }
    } else {
      if (navUserBadge) navUserBadge.style.display = 'none';
      if (navLoginBtn) navLoginBtn.style.display = 'inline-flex';
      if (navAdminBtn) navAdminBtn.style.display = 'none';
      if (navMentorBtn) navMentorBtn.style.display = 'none';
    }
  }

  return {
    checkSession,
    login,
    register,
    logout,
    quickLoginAs,
    getUser: () => currentUser,
    isAuthenticated: () => !!currentUser,
  };
})();

window.Auth = Auth;

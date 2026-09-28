/**
 * Theme Management Module (Light & Dark Theme Toggle)
 */

(function () {
  const THEME_KEY = 'studentp_theme';

  function getPreferredTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved) return saved;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);

    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    if (themeToggleBtn) {
      themeToggleBtn.innerHTML = theme === 'dark' ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
      themeToggleBtn.setAttribute('title', `Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`);
    }

    // Trigger chart redraw if charts exist
    if (window.StudentPortalCharts && typeof window.StudentPortalCharts.redrawCurrent === 'function') {
      window.StudentPortalCharts.redrawCurrent();
    }
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
  }

  // Initial setup
  const initialTheme = getPreferredTheme();
  applyTheme(initialTheme);

  // Attach listener after DOM is ready
  document.addEventListener('DOMContentLoaded', () => {
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) {
      themeBtn.addEventListener('click', toggleTheme);
      themeBtn.innerHTML = initialTheme === 'dark' ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
    }
  });

  window.StudentPortalTheme = {
    applyTheme,
    toggleTheme,
    getCurrentTheme: () => document.documentElement.getAttribute('data-theme') || 'dark',
  };
})();

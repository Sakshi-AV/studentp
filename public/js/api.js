/**
 * REST API Client for Student Project Management Portal
 */

const API = (function () {
  const TOKEN_KEY = 'studentp_auth_token';
  const USER_KEY = 'studentp_auth_user';

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function setToken(token) {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  }

  function getStoredUser() {
    try {
      const userStr = localStorage.getItem(USER_KEY);
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  }

  function setStoredUser(user) {
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_KEY);
    }
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  async function request(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `/api${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const token = getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
      ...options,
      headers,
    };

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(url, config);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 401) {
          clearSession();
          if (window.App && typeof window.App.onAuthExpired === 'function') {
            window.App.onAuthExpired();
          }
        }
        const errorMsg = data.message || (data.errors ? data.errors.join(', ') : 'Request failed');
        const error = new Error(errorMsg);
        error.status = response.status;
        error.data = data;
        throw error;
      }

      return data;
    } catch (err) {
      console.error(`API Error [${endpoint}]:`, err.message);
      throw err;
    }
  }

  return {
    getToken,
    setToken,
    getStoredUser,
    setStoredUser,
    clearSession,
    get: (url, params) => {
      let finalUrl = url;
      if (params) {
        const query = new URLSearchParams(params).toString();
        finalUrl += (url.includes('?') ? '&' : '?') + query;
      }
      return request(finalUrl, { method: 'GET' });
    },
    post: (url, body) => request(url, { method: 'POST', body }),
    put: (url, body) => request(url, { method: 'PUT', body }),
    patch: (url, body) => request(url, { method: 'PATCH', body }),
    delete: (url) => request(url, { method: 'DELETE' }),
  };
})();

window.API = API;

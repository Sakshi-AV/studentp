/**
 * Comments & Mentor Academic Feedback Module
 */

const Comments = (function () {
  let activeTaskId = null;

  function loadTaskComments(taskId, initialComments = []) {
    activeTaskId = taskId;
    renderCommentsList(initialComments);

    // Show/hide mentor feedback toggle depending on current user role
    const mentorToggleContainer = document.getElementById('mentor-feedback-toggle-box');
    const user = window.Auth ? window.Auth.getUser() : null;

    if (mentorToggleContainer) {
      if (user && (user.role === 'mentor' || user.role === 'admin')) {
        mentorToggleContainer.style.display = 'flex';
      } else {
        mentorToggleContainer.style.display = 'none';
      }
    }
  }

  function renderCommentsList(comments) {
    const container = document.getElementById('task-comments-container');
    if (!container) return;

    if (!comments || comments.length === 0) {
      container.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 0.8rem; padding: 1rem;">No comments yet. Start the discussion or mentor review!</div>`;
      return;
    }

    container.innerHTML = comments
      .map((c) => {
        const isMentorFeedback = c.is_mentor_feedback == 1 || c.is_mentor_feedback === true;
        const avatar = c.user_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.user_name || 'User')}&background=6366f1&color=fff`;

        const feedbackBadge = isMentorFeedback
          ? `<span class="mentor-evaluation-tag"><i class="fa-solid fa-award"></i> Mentor Feedback</span>`
          : `<span class="user-role-pill role-${c.user_role || 'student'}">${c.user_role || 'member'}</span>`;

        const dateStr = c.created_at ? new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

        return `
          <div class="comment-card ${isMentorFeedback ? 'mentor-feedback-card' : ''}">
            <div class="comment-header">
              <div class="comment-author-info">
                <img src="${avatar}" class="comment-avatar" alt="${escapeHtml(c.user_name)}">
                <span class="comment-author-name">${escapeHtml(c.user_name)}</span>
                ${feedbackBadge}
              </div>
              <span class="comment-timestamp">${dateStr}</span>
            </div>
            <div class="comment-content">${escapeHtml(c.content)}</div>
          </div>
        `;
      })
      .join('');

    container.scrollTop = container.scrollHeight;
  }

  async function postComment() {
    const input = document.getElementById('comment-input');
    const content = input ? input.value.trim() : '';

    if (!content) return;
    if (!activeTaskId) return;

    const feedbackCheckbox = document.getElementById('is-mentor-feedback-check');
    const isMentorFeedback = feedbackCheckbox ? feedbackCheckbox.checked : false;

    try {
      const res = await API.post('/comments', {
        task_id: activeTaskId,
        content,
        is_mentor_feedback: isMentorFeedback,
      });

      if (input) input.value = '';
      if (feedbackCheckbox) feedbackCheckbox.checked = false;

      // Re-fetch comments for task
      const freshRes = await API.get(`/comments/task/${activeTaskId}`);
      renderCommentsList(freshRes.data || []);

      if (window.App) window.App.showToast('Comment posted', 'success');
    } catch (err) {
      if (window.App) window.App.showToast(`Failed to post comment: ${err.message}`, 'error');
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
    loadTaskComments,
    renderCommentsList,
    postComment,
  };
})();

window.Comments = Comments;

/**
 * Dynamic Progress & Status Charts Module
 * High-performance Canvas charts with responsive theme adaptation
 */

const StudentPortalCharts = (function () {
  let cachedTasksData = null;
  let cachedProjectsData = null;

  function isDarkMode() {
    return document.documentElement.getAttribute('data-theme') === 'dark';
  }

  /**
   * Render Task Distribution Donut Chart
   */
  function renderTaskStatusChart(canvasId, tasks = []) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    cachedTasksData = tasks;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    // Handle high DPI
    const rect = canvas.getBoundingClientRect();
    const width = rect.width || 280;
    const height = rect.height || 220;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    // Compute task counts
    const counts = {
      todo: 0,
      in_progress: 0,
      review: 0,
      done: 0,
    };

    tasks.forEach((t) => {
      if (counts[t.status] !== undefined) {
        counts[t.status]++;
      } else {
        counts.todo++;
      }
    });

    const total = tasks.length;
    const dark = isDarkMode();

    if (total === 0) {
      // Empty state
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = dark ? '#64748B' : '#94A3B8';
      ctx.font = '500 14px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('No tasks yet to chart', width / 2, height / 2);
      return;
    }

    const segments = [
      { label: 'Completed', count: counts.done, color: '#10B981' },
      { label: 'Review', count: counts.review, color: '#F59E0B' },
      { label: 'In Progress', count: counts.in_progress, color: '#3B82F6' },
      { label: 'To Do', count: counts.todo, color: dark ? '#475569' : '#CBD5E1' },
    ];

    const centerX = width * 0.38;
    const centerY = height * 0.5;
    const radius = Math.min(centerX, centerY) - 15;
    const innerRadius = radius * 0.65;

    let startAngle = -Math.PI / 2;

    segments.forEach((seg) => {
      if (seg.count === 0) return;
      const sliceAngle = (seg.count / total) * 2 * Math.PI;
      const endAngle = startAngle + sliceAngle;

      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.arc(centerX, centerY, innerRadius, endAngle, startAngle, true);
      ctx.closePath();
      ctx.fillStyle = seg.color;
      ctx.fill();

      // Inner divider line
      ctx.lineWidth = 2;
      ctx.strokeStyle = dark ? '#111622' : '#FFFFFF';
      ctx.stroke();

      startAngle = endAngle;
    });

    // Center Completion Metric
    const donePercent = Math.round((counts.done / total) * 100);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = dark ? '#F8FAFC' : '#0F172A';
    ctx.font = '800 20px "Outfit", sans-serif';
    ctx.fillText(`${donePercent}%`, centerX, centerY - 6);

    ctx.fillStyle = dark ? '#94A3B8' : '#64748B';
    ctx.font = '600 10px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('DONE', centerX, centerY + 14);

    // Legend on the Right
    const legendX = width * 0.68;
    let legendY = centerY - 45;

    segments.forEach((seg) => {
      // Color Dot
      ctx.beginPath();
      ctx.arc(legendX, legendY, 5, 0, 2 * Math.PI);
      ctx.fillStyle = seg.color;
      ctx.fill();

      // Label & Count
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = dark ? '#E2E8F0' : '#334155';
      ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(seg.label, legendX + 12, legendY);

      ctx.fillStyle = dark ? '#94A3B8' : '#64748B';
      ctx.font = '700 11px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(`${seg.count}`, legendX + 85, legendY);

      legendY += 22;
    });
  }

  /**
   * Render Top Projects Progress Bar Chart
   */
  function renderProjectsProgressChart(canvasId, projects = []) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    cachedProjectsData = projects;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    const rect = canvas.getBoundingClientRect();
    const width = rect.width || 480;
    const height = rect.height || 220;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);
    const dark = isDarkMode();

    const topProjects = projects.slice(0, 4);

    if (topProjects.length === 0) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = dark ? '#64748B' : '#94A3B8';
      ctx.font = '500 14px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('No projects available yet', width / 2, height / 2);
      return;
    }

    const barHeight = 14;
    const spacing = 46;
    let startY = 32;

    topProjects.forEach((proj) => {
      const percent = proj.progress_percent || 0;
      const title = proj.title.length > 30 ? proj.title.substring(0, 28) + '...' : proj.title;

      // Project Title & %
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = dark ? '#F1F5F9' : '#1E293B';
      ctx.font = '600 12px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(title, 10, startY - 14);

      ctx.textAlign = 'right';
      ctx.fillStyle = percent === 100 ? '#10B981' : (dark ? '#A5B4FC' : '#4F46E5');
      ctx.font = '700 12px "Outfit", sans-serif';
      ctx.fillText(`${percent}% (${proj.completed_tasks}/${proj.total_tasks} tasks)`, width - 10, startY - 14);

      // Track Background
      const barWidth = width - 20;
      ctx.fillStyle = dark ? 'rgba(255,255,255,0.06)' : '#E2E8F0';
      roundRect(ctx, 10, startY, barWidth, barHeight, 7);
      ctx.fill();

      // Progress Fill with Gradient
      if (percent > 0) {
        const fillWidth = Math.max(14, (barWidth * percent) / 100);
        const grad = ctx.createLinearGradient(10, startY, 10 + fillWidth, startY);
        grad.addColorStop(0, '#6366F1');
        grad.addColorStop(1, percent >= 80 ? '#10B981' : '#8B5CF6');
        ctx.fillStyle = grad;
        roundRect(ctx, 10, startY, fillWidth, barHeight, 7);
        ctx.fill();
      }

      startY += spacing;
    });
  }

  function roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  function redrawCurrent() {
    if (cachedTasksData) {
      renderTaskStatusChart('task-status-canvas', cachedTasksData);
    }
    if (cachedProjectsData) {
      renderProjectsProgressChart('projects-progress-canvas', cachedProjectsData);
    }
  }

  // Handle window resize cleanly
  window.addEventListener('resize', () => {
    redrawCurrent();
  });

  return {
    renderTaskStatusChart,
    renderProjectsProgressChart,
    redrawCurrent,
  };
})();

window.StudentPortalCharts = StudentPortalCharts;

/**
 * Toast Notification Utility for DownloadIn
 */

const Toast = (function () {
  let container = null;

  function ensureContainer() {
    if (!container) {
      container = document.getElementById('toast-container');
      if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
      }
    }
    return container;
  }

  const icons = {
    success: `<svg class="w-5 h-5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
    </svg>`,
    error: `<svg class="w-5 h-5 text-rose-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
    </svg>`,
    warning: `<svg class="w-5 h-5 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
    </svg>`,
    info: `<svg class="w-5 h-5 text-indigo-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
    </svg>`
  };

  const borders = {
    success: 'border-emerald-500/30 bg-slate-900/95 text-slate-100 shadow-emerald-950/20',
    error: 'border-rose-500/40 bg-slate-900/95 text-slate-100 shadow-rose-950/30',
    warning: 'border-amber-500/40 bg-slate-900/95 text-slate-100 shadow-amber-950/30',
    info: 'border-indigo-500/30 bg-slate-900/95 text-slate-100 shadow-indigo-950/20'
  };

  function show({ title, message, type = 'info', duration = 4000, action = null }) {
    const parent = ensureContainer();

    const toast = document.createElement('div');
    toast.className = `toast-item flex items-start gap-3 p-4 rounded-xl border backdrop-blur-md shadow-xl ${
      borders[type] || borders.info
    }`;

    let actionBtnHtml = '';
    if (action && action.label && typeof action.onClick === 'function') {
      actionBtnHtml = `<button class="toast-action-btn mt-2 inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white transition-colors">${action.label}</button>`;
    }

    toast.innerHTML = `
      ${icons[type] || icons.info}
      <div class="flex-1 min-w-0">
        ${title ? `<div class="font-semibold text-sm leading-tight">${title}</div>` : ''}
        <div class="text-xs text-slate-300 mt-0.5 leading-relaxed break-words">${message}</div>
        ${actionBtnHtml}
      </div>
      <button class="toast-close-btn p-1 text-slate-400 hover:text-slate-200 transition-colors shrink-0">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    `;

    // Action button handler
    if (action && typeof action.onClick === 'function') {
      const btn = toast.querySelector('.toast-action-btn');
      if (btn) {
        btn.addEventListener('click', () => {
          action.onClick();
          dismiss(toast);
        });
      }
    }

    // Close button handler
    const closeBtn = toast.querySelector('.toast-close-btn');
    closeBtn.addEventListener('click', () => dismiss(toast));

    parent.appendChild(toast);

    let timer = null;
    if (duration > 0) {
      timer = setTimeout(() => dismiss(toast), duration);
    }

    // Pause on hover
    toast.addEventListener('mouseenter', () => {
      if (timer) clearTimeout(timer);
    });
    toast.addEventListener('mouseleave', () => {
      if (duration > 0) timer = setTimeout(() => dismiss(toast), 2000);
    });

    return toast;
  }

  function dismiss(toast) {
    if (!toast || toast.classList.contains('toast-out')) return;
    toast.classList.add('toast-out');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 250);
  }

  return {
    success: (message, title = 'Berhasil', duration = 3500) =>
      show({ title, message, type: 'success', duration }),
    error: (message, title = 'Terjadi Kesalahan', duration = 5000, action = null) =>
      show({ title, message, type: 'error', duration, action }),
    warning: (message, title = 'Peringatan', duration = 4500, action = null) =>
      show({ title, message, type: 'warning', duration, action }),
    info: (message, title = 'Informasi', duration = 3500) =>
      show({ title, message, type: 'info', duration })
  };
})();

window.Toast = Toast;


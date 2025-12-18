/**
 * Toast Notification System
 * 
 * Provides toast notifications for user feedback.
 */

import { t } from '../i18n/index.js';
import { html as viewHtml, renderInto } from './view';
import { DOM_IDS } from '../config/domIds';

// ========================================
// Toast Icons
// ========================================

const TOAST_ICONS = {
  error: viewHtml`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  success: viewHtml`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  warning: viewHtml`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><path d="M12 8v6"/><path d="M12 17h.01"/></svg>`,
  info: viewHtml`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 12v4"/><path d="M12 8h.01"/></svg>`
};

// ========================================
// Main Toast Function
// ========================================

/**
 * Show a toast notification
 * @param {string} message - Toast message
 * @param {string} type - Toast type: 'info', 'success', 'warning', 'error'
 * @param {string} title - Optional title
 * @param {number} duration - Duration in ms (0 for no auto-dismiss)
 * @returns {HTMLElement} Toast element
 */
export function showToast(message, type = 'info', title = '', duration = 3500) {
  const container = document.getElementById(DOM_IDS.toastContainer);
  if (!container) return null;

  // Default titles based on type
  const defaultTitles = {
    error: t('common.error'),
    success: t('common.success'),
    warning: t('common.warning'),
    info: t('common.info')
  };

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  renderInto(toast, viewHtml`
    <div class="toast-icon">${TOAST_ICONS[type] || TOAST_ICONS.info}</div>
    <div class="toast-content">
      <p class="toast-title">${title || defaultTitles[type] || t('common.info')}</p>
      <p class="toast-message">${message}</p>
    </div>
    <button class="toast-close" type="button">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  `);

  // Close button event
  const closeBtn = toast.querySelector('.toast-close');
  closeBtn.addEventListener('click', () => removeToast(toast));

  container.appendChild(toast);

  // Auto-remove after duration
  if (duration > 0) {
    setTimeout(() => removeToast(toast), duration);
  }

  return toast;
}

/**
 * Remove a toast notification
 * @param {HTMLElement} toast - Toast element to remove
 */
export function removeToast(toast) {
  if (!toast || toast.classList.contains('toast--exiting')) return;
  toast.classList.add('toast--exiting');
  setTimeout(() => {
    if (toast.parentNode) toast.parentNode.removeChild(toast);
  }, 300);
}

// ========================================
// Convenience Methods
// ========================================

/**
 * Show error toast
 * @param {string} message - Error message
 * @param {string} title - Optional title
 * @returns {HTMLElement} Toast element
 */
export const showErrorToast = (message, title = '') => 
  showToast(message, 'error', title);

/**
 * Show success toast
 * @param {string} message - Success message
 * @param {string} title - Optional title
 * @returns {HTMLElement} Toast element
 */
export const showSuccessToast = (message, title = '') => 
  showToast(message, 'success', title);

/**
 * Show warning toast
 * @param {string} message - Warning message
 * @param {string} title - Optional title
 * @returns {HTMLElement} Toast element
 */
export const showWarningToast = (message, title = '') => 
  showToast(message, 'warning', title);

/**
 * Show info toast
 * @param {string} message - Info message
 * @param {string} title - Optional title
 * @returns {HTMLElement} Toast element
 */
export const showInfoToast = (message, title = '') => 
  showToast(message, 'info', title);

// ========================================
// Mini Toast
// ========================================

/**
 * Show a mini toast (smaller, shorter duration)
 * @param {string} message - Toast message
 * @param {string} type - Toast type: 'info', 'success', 'error'
 */
export function showMiniToast(message, type = 'info') {
  // Remove existing mini toast
  const existing = document.querySelector('.mini-toast');
  if (existing) existing.remove();
  
  const toast = document.createElement('div');
  toast.className = `mini-toast mini-toast--${type}`;
  renderInto(toast, viewHtml`
    <span class="mini-toast-icon">${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
    <span class="mini-toast-text">${message}</span>
  `);
  document.body.appendChild(toast);
  
  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });
  
  // Remove after 1.5 seconds
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 1500);
}

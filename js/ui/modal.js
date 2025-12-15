/**
 * Modal Dialog Module
 * 
 * Provides unified modal dialogs for loading, success, error, and confirmation states.
 */

import { t } from '../i18n/index.js';

/**
 * Show loading state in the unified overlay
 * @param {string} text - Loading text to display
 */
export function showUnifiedLoading(text) {
  const overlay = document.getElementById('actionOverlay');
  const loading = document.getElementById('unifiedLoading');
  const success = document.getElementById('unifiedSuccess');
  const textEl = document.getElementById('actionOverlayText');
  
  if (textEl) textEl.textContent = text || t('common.processing');
  if (loading) loading.classList.remove('hidden');
  if (success) success.classList.add('hidden');
  if (overlay) overlay.classList.remove('hidden');
}

/**
 * Switch to success state (smooth transition from loading)
 * @param {string} title - Success title
 * @param {string} text - Success description
 * @param {Function} onOk - OK button callback
 * @param {Function} onCancel - Cancel button callback (optional, shows cancel button if provided)
 * @param {boolean} isError - Whether this is an error state
 */
export function showUnifiedSuccess(title, text, onOk, onCancel, isError = false) {
  const loading = document.getElementById('unifiedLoading');
  const success = document.getElementById('unifiedSuccess');
  const titleEl = document.getElementById('unifiedTitle');
  const textEl = document.getElementById('unifiedText');
  const okBtn = document.getElementById('unifiedOkBtn');
  const cancelBtn = document.getElementById('unifiedCancelBtn');
  const iconWrap = document.getElementById('unifiedIconWrap');
  const successIcon = document.getElementById('unifiedSuccessIcon');
  const errorIcon = document.getElementById('unifiedErrorIcon');
  
  if (titleEl) titleEl.textContent = title || (isError ? t('modal.operationFailed') : t('common.success'));
  if (textEl) textEl.textContent = text || '';
  
  // Handle error/success state icons and styles
  if (iconWrap) {
    if (isError) {
      iconWrap.classList.add('error-state');
      if (successIcon) successIcon.classList.add('hidden');
      if (errorIcon) errorIcon.classList.remove('hidden');
    } else {
      iconWrap.classList.remove('error-state');
      if (successIcon) successIcon.classList.remove('hidden');
      if (errorIcon) errorIcon.classList.add('hidden');
    }
  }
  
  // Add/remove error mode class
  if (success) {
    if (isError) {
      success.classList.add('error-mode');
    } else {
      success.classList.remove('error-mode');
    }
  }
  
  // Hide loading, show success
  if (loading) loading.classList.add('hidden');
  if (success) {
    success.classList.remove('hidden');
    // Re-trigger animation
    success.style.animation = 'none';
    success.offsetHeight; // Trigger reflow
    success.style.animation = '';
  }
  
  // Handle cancel button
  if (cancelBtn) {
    if (onCancel) {
      cancelBtn.classList.remove('hidden');
      cancelBtn.onclick = () => {
        hideUnifiedOverlay();
        onCancel();
      };
    } else {
      cancelBtn.classList.add('hidden');
      cancelBtn.onclick = null;
    }
  }
  
  // Handle OK button
  if (okBtn) {
    okBtn.onclick = () => {
      hideUnifiedOverlay();
      if (onOk) onOk();
    };
    // Focus OK button to capture keyboard events (e.g., Space/Enter)
    // Use setTimeout to ensure the DOM is fully updated
    setTimeout(() => okBtn.focus(), 50);
  }
}

/**
 * Hide the unified overlay
 */
export function hideUnifiedOverlay() {
  const overlay = document.getElementById('actionOverlay');
  const loading = document.getElementById('unifiedLoading');
  const success = document.getElementById('unifiedSuccess');
  const successIcon = document.getElementById('successIconWrap');
  const errorIcon = document.getElementById('errorIconWrap');
  const titleEl = document.getElementById('unifiedTitle');
  
  if (overlay) overlay.classList.add('hidden');
  // Reset state
  if (loading) loading.classList.remove('hidden');
  if (success) {
    success.classList.add('hidden');
    success.classList.remove('is-error');
  }
  // Reset icon state
  if (successIcon) successIcon.classList.remove('hidden');
  if (errorIcon) errorIcon.classList.add('hidden');
  if (titleEl) titleEl.style.color = '';
}

/**
 * Get action modal elements (for backward compatibility)
 * @returns {object} Modal elements
 */
export function getActionModalElements() {
  const modal = document.getElementById('actionOverlay');
  const titleEl = document.getElementById('unifiedTitle');
  const textEl = document.getElementById('unifiedText');
  const okEl = document.getElementById('unifiedOkBtn');
  const cancelEl = document.getElementById('unifiedCancelBtn');
  
  // Prepare to show success state
  const loading = document.getElementById('unifiedLoading');
  const success = document.getElementById('unifiedSuccess');
  if (loading) loading.classList.add('hidden');
  if (success) success.classList.remove('hidden');
  
  if (cancelEl) {
    cancelEl.classList.add('hidden');
    cancelEl.onclick = null;
  }
  return { modal, titleEl, textEl, okEl, cancelEl };
}

/**
 * Show a modal tip (success or error)
 * @param {string} title - Modal title
 * @param {string} html - Modal content (HTML)
 * @param {boolean} isError - Whether this is an error
 */
export function showModalTip(title, html, isError) {
  const loading = document.getElementById('unifiedLoading');
  const success = document.getElementById('unifiedSuccess');
  const iconWrap = document.getElementById('unifiedIconWrap');
  const successIcon = document.getElementById('unifiedSuccessIcon');
  const errorIcon = document.getElementById('unifiedErrorIcon');
  
  if (loading) loading.classList.add('hidden');
  if (success) {
    success.classList.remove('hidden');
    success.style.animation = 'none';
    success.offsetHeight;
    success.style.animation = '';
    // Show different icon based on error state
    if (isError) {
      success.classList.add('error-mode');
      if (iconWrap) iconWrap.classList.add('error-state');
      if (successIcon) successIcon.classList.add('hidden');
      if (errorIcon) errorIcon.classList.remove('hidden');
    } else {
      success.classList.remove('error-mode');
      if (iconWrap) iconWrap.classList.remove('error-state');
      if (successIcon) successIcon.classList.remove('hidden');
      if (errorIcon) errorIcon.classList.add('hidden');
    }
  }
  
  const { modal, titleEl, textEl, okEl } = getActionModalElements();
  if (titleEl) {
    titleEl.textContent = title || '';
  }
  if (textEl) {
    if (isError) textEl.classList.add('tip--error'); 
    else textEl.classList.remove('tip--error');
    textEl.innerHTML = html || '';
  }
  if (modal) modal.classList.remove('hidden');
  
  const handler = () => { 
    modal.classList.add('hidden'); 
    // Reset state
    if (loading) loading.classList.remove('hidden');
    if (success) success.classList.add('hidden');
    // Reset icon state
    if (iconWrap) iconWrap.classList.remove('error-state');
    if (successIcon) successIcon.classList.remove('hidden');
    if (errorIcon) errorIcon.classList.add('hidden');
    if (success) success.classList.remove('error-mode');
    okEl && okEl.removeEventListener('click', handler); 
  };
  okEl && okEl.addEventListener('click', handler);
}

/**
 * Show a confirmation modal
 * @param {string} title - Modal title
 * @param {string} html - Modal content (HTML)
 * @param {string} okText - OK button text
 * @param {string} cancelText - Cancel button text
 * @returns {Promise<boolean>} Resolves to true if confirmed, false if cancelled
 */
export function showConfirmModal(title, html, okText, cancelText) {
  return new Promise((resolve) => {
    const modal = document.getElementById('confirmGasModal');
    const titleEl = document.getElementById('confirmGasTitle');
    const textEl = document.getElementById('confirmGasText');
    const okEl = document.getElementById('confirmGasOk');
    const cancelEl = document.getElementById('confirmGasCancel');
    
    if (!modal || !okEl || !cancelEl) {
      resolve(true);
      return;
    }
    
    if (titleEl) titleEl.textContent = title || t('modal.confirm');
    if (textEl) {
      textEl.innerHTML = html || '';
      textEl.classList.remove('tip--error');
    }
    if (okText) okEl.textContent = okText;
    if (cancelText) cancelEl.textContent = cancelText;
    
    modal.classList.remove('hidden');
    
    const cleanup = (result) => {
      modal.classList.add('hidden');
      okEl.removeEventListener('click', onOk);
      cancelEl.removeEventListener('click', onCancel);
      resolve(result);
    };
    
    const onOk = () => cleanup(true);
    const onCancel = () => cleanup(false);
    
    okEl.addEventListener('click', onOk);
    cancelEl.addEventListener('click', onCancel);
  });
}

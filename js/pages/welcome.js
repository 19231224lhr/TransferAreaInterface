/**
 * Welcome Page Module
 * 
 * Handles the welcome/landing page logic.
 */

import { loadUser } from '../utils/storage';
import { DOM_IDS } from '../config/domIds';

/**
 * Update welcome page buttons based on login state
 * Shows different buttons depending on whether user is logged in
 */
export function updateWelcomeButtons() {
  const splitContainer = document.getElementById(DOM_IDS.splitLoginContainer);
  const loginBtn = document.getElementById(DOM_IDS.loginAccountBtn);
  
  const user = loadUser();
  const isLoggedIn = !!(user && user.accountId);
  
  if (isLoggedIn) {
    // Show split buttons, hide single login button
    if (splitContainer) splitContainer.classList.remove('hidden');
    if (loginBtn) loginBtn.classList.add('hidden');
  } else {
    // Hide split buttons, show single login button
    if (splitContainer) splitContainer.classList.add('hidden');
    if (loginBtn) loginBtn.classList.remove('hidden');
  }
}

/**
 * Bind welcome page button events
 */
function bindWelcomeEvents() {
  // Register/Get Started button
  const registerAccountBtn = document.getElementById(DOM_IDS.registerAccountBtn);
  if (registerAccountBtn && !registerAccountBtn.dataset._welcomeBind) {
    registerAccountBtn.dataset._welcomeBind = 'true';
    registerAccountBtn.addEventListener('click', () => {
      if (typeof window.PanguPay?.storage?.resetOrgSelectionForNewUser === 'function') {
        window.PanguPay.storage.resetOrgSelectionForNewUser();
      }
      if (typeof window.PanguPay?.router?.routeTo === 'function') {
        window.PanguPay.router.routeTo('#/new');
      }
    });
  }
  
  // Login button (single)
  const loginAccountBtn = document.getElementById(DOM_IDS.loginAccountBtn);
  if (loginAccountBtn && !loginAccountBtn.dataset._welcomeBind) {
    loginAccountBtn.dataset._welcomeBind = 'true';
    loginAccountBtn.addEventListener('click', () => {
      if (typeof window.PanguPay?.router?.routeTo === 'function') {
        window.PanguPay.router.routeTo('#/login');
      }
    });
  }
  
  // Split login button
  const splitLoginBtn = document.getElementById(DOM_IDS.splitLoginBtn);
  if (splitLoginBtn && !splitLoginBtn.dataset._welcomeBind) {
    splitLoginBtn.dataset._welcomeBind = 'true';
    splitLoginBtn.addEventListener('click', () => {
      if (typeof window.PanguPay?.router?.routeTo === 'function') {
        window.PanguPay.router.routeTo('#/login');
      }
    });
  }
  
  // Split home button
  const splitHomeBtn = document.getElementById(DOM_IDS.splitHomeBtn);
  if (splitHomeBtn && !splitHomeBtn.dataset._welcomeBind) {
    splitHomeBtn.dataset._welcomeBind = 'true';
    splitHomeBtn.addEventListener('click', () => {
      if (typeof window.PanguPay?.router?.routeTo === 'function') {
        window.PanguPay.router.routeTo('#/main');
      }
    });
  }
}

/**
 * Initialize welcome page
 */
export function initWelcomePage() {
  updateWelcomeButtons();
  bindWelcomeEvents();
}

/**
 * Welcome Page Module
 * 
 * Handles the welcome/landing page logic.
 */

import { loadUser } from '../utils/storage.ts';

/**
 * Update welcome page buttons based on login state
 * Shows different buttons depending on whether user is logged in
 */
export function updateWelcomeButtons() {
  const splitContainer = document.getElementById('splitLoginContainer');
  const loginBtn = document.getElementById('loginAccountBtn');
  
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
  const registerAccountBtn = document.getElementById('registerAccountBtn');
  if (registerAccountBtn && !registerAccountBtn.dataset._welcomeBind) {
    registerAccountBtn.dataset._welcomeBind = 'true';
    registerAccountBtn.addEventListener('click', () => {
      if (typeof window.resetOrgSelectionForNewUser === 'function') {
        window.resetOrgSelectionForNewUser();
      }
      if (typeof window.routeTo === 'function') {
        window.routeTo('#/new');
      }
    });
  }
  
  // Login button (single)
  const loginAccountBtn = document.getElementById('loginAccountBtn');
  if (loginAccountBtn && !loginAccountBtn.dataset._welcomeBind) {
    loginAccountBtn.dataset._welcomeBind = 'true';
    loginAccountBtn.addEventListener('click', () => {
      if (typeof window.routeTo === 'function') {
        window.routeTo('#/login');
      }
    });
  }
  
  // Split login button
  const splitLoginBtn = document.getElementById('splitLoginBtn');
  if (splitLoginBtn && !splitLoginBtn.dataset._welcomeBind) {
    splitLoginBtn.dataset._welcomeBind = 'true';
    splitLoginBtn.addEventListener('click', () => {
      if (typeof window.routeTo === 'function') {
        window.routeTo('#/login');
      }
    });
  }
  
  // Split home button
  const splitHomeBtn = document.getElementById('splitHomeBtn');
  if (splitHomeBtn && !splitHomeBtn.dataset._welcomeBind) {
    splitHomeBtn.dataset._welcomeBind = 'true';
    splitHomeBtn.addEventListener('click', () => {
      if (typeof window.routeTo === 'function') {
        window.routeTo('#/main');
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

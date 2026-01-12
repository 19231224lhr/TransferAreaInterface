/**
 * Welcome Page Module
 * 
 * Handles the welcome/landing page logic.
 */

import { loadUser, setSessionIgnoreUser, loadUserProfile, hasStoredUser } from '../utils/storage';
import { DOM_IDS } from '../config/domIds';
import { html as viewHtml, renderInto } from '../utils/view';
import { t } from '../i18n/index.js';

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
 * Check for existing login and show Welcome Back modal if needed
 */
function checkWelcomeBack() {
  // Use hasStoredUser to check for physical existence of a user, ignoring session flag
  // This ensures we can detect a "logged in" user even if this new tab has no session yet
  if (!hasStoredUser()) return;

  // If session is already validated (user made a choice), don't show again
  if (sessionStorage.getItem('pangu_session_validated') === 'true') return;

  const modalId = 'welcome-back-modal';
  if (document.getElementById(modalId)) return;

  // Load profile directly for display
  const profile = loadUserProfile();
  let accountId = localStorage.getItem('activeAccountId');
  if (!accountId) return;

  const avatarUrl = profile?.avatar || 'assets/avatar.png';
  const displayName = profile?.nickname || accountId;

  // Inject Styles if not present
  if (!document.getElementById('wb-modal-style')) {
    const style = document.createElement('style');
    style.id = 'wb-modal-style';
    style.textContent = `
      .wb-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.4s ease;
      }
      
      .wb-backdrop {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.4);
        backdrop-filter: blur(24px);
        -webkit-backdrop-filter: blur(24px);
      }

      /* Light Mode Overrides */
      html[data-theme="light"] .wb-card {
        background: rgba(255, 255, 255, 0.75);
        border: 1px solid rgba(255, 255, 255, 0.8);
        box-shadow: 0 25px 50px -12px rgba(148, 163, 184, 0.5);
      }
      
      html[data-theme="light"] .wb-title {
        color: #1e293b;
      }
      
      html[data-theme="light"] .wb-desc {
        color: #64748b;
      }

      html[data-theme="light"] .wb-avatar {
        border-color: #ffffff;
      }

      html[data-theme="light"] .wb-status-dot {
        border-color: #ffffff;
      }
      
      html[data-theme="light"] .wb-btn-secondary {
        border-color: rgba(148, 163, 184, 0.4);
        color: #475569;
      }

      html[data-theme="light"] .wb-btn-secondary:hover {
        background: rgba(0, 0, 0, 0.05);
        color: #1e293b;
        border-color: rgba(148, 163, 184, 0.8);
      }

      html[data-theme="light"] .wb-icon-circle {
        background: rgba(0, 0, 0, 0.05);
        color: #64748b;
      }

      html[data-theme="light"] .wb-footer-text {
        color: #94a3b8;
      }

      html[data-theme="light"] .wb-icon-box {
          background: rgba(255, 255, 255, 0.3);
      }

      .wb-card {
        position: relative;
        width: 100%;
        max-width: 360px;
        background: rgba(30, 41, 59, 0.85); /* Dark mode default */
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 24px;
        padding: 32px;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        transform: scale(0.95) translateY(10px);
        opacity: 0;
        transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        overflow: hidden;
        backdrop-filter: blur(12px);
      }

      /* Animated Glows */
      .wb-glow {
        position: absolute;
        border-radius: 50%;
        filter: blur(60px);
        z-index: -1;
        opacity: 0.4;
        animation: wb-pulse 8s infinite alternate;
      }
      .wb-glow-1 { top: -20%; right: -20%; width: 200px; height: 200px; background: #3b82f6; }
      .wb-glow-2 { bottom: -20%; left: -20%; width: 200px; height: 200px; background: #8b5cf6; animation-delay: 1s; }

      @keyframes wb-pulse {
        0% { transform: scale(1); opacity: 0.4; }
        100% { transform: scale(1.1); opacity: 0.6; }
      }

      .wb-avatar-container {
        position: relative;
        width: 80px;
        height: 80px;
        margin: 0 auto 20px;
        border-radius: 50%;
        padding: 4px;
        background: linear-gradient(135deg, rgba(59, 130, 246, 0.5), rgba(139, 92, 246, 0.5));
      }
      
      .wb-avatar {
        width: 100%;
        height: 100%;
        border-radius: 50%;
        object-fit: cover;
        border: 3px solid rgba(30, 41, 59, 1);
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      }

      .wb-status-dot {
        position: absolute;
        bottom: 2px;
        right: 2px;
        width: 16px;
        height: 16px;
        background: #22c55e;
        border: 3px solid rgba(30, 41, 59, 1);
        border-radius: 50%;
      }

      .wb-title {
        color: white;
        font-size: 24px;
        font-weight: 700;
        margin-bottom: 8px;
        letter-spacing: -0.5px;
      }

      .wb-desc {
        color: rgba(255, 255, 255, 0.6);
        font-size: 14px;
        margin-bottom: 32px;
        line-height: 1.5;
      }

      .wb-btn-primary {
        display: flex;
        align-items: center;
        width: 100%;
        padding: 16px;
        background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
        border: none;
        border-radius: 16px;
        color: white;
        cursor: pointer;
        transition: transform 0.2s, box-shadow 0.2s;
        box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
        margin-bottom: 12px;
        position: relative;
        overflow: hidden;
      }

      .wb-btn-primary:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 20px rgba(37, 99, 235, 0.4);
      }
      
      .wb-btn-primary:active {
        transform: translateY(0);
      }

      .wb-icon-box {
        width: 40px;
        height: 40px;
        background: rgba(255, 255, 255, 0.2);
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-right: 14px;
      }

      .wb-info {
        text-align: left;
        flex: 1;
        min-width: 0;
      }

      .wb-label {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        opacity: 0.8;
        font-weight: 600;
        margin-bottom: 2px;
        display: block;
      }
      
      .wb-username {
        font-size: 15px;
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        display: block;
      }

      .wb-arrow {
        opacity: 0.7;
        margin-left: 8px;
        transition: transform 0.2s;
      }
      .wb-btn-primary:hover .wb-arrow {
        transform: translateX(4px);
        opacity: 1;
      }

      .wb-btn-secondary {
        display: flex;
        align-items: center;
        width: 100%;
        padding: 16px;
        background: transparent;
        border: 1px dashed rgba(255, 255, 255, 0.3);
        border-radius: 16px;
        color: rgba(255, 255, 255, 0.7);
        cursor: pointer;
        transition: all 0.2s;
        margin-bottom: 8px;
      }

      .wb-btn-secondary:hover {
        background: rgba(255, 255, 255, 0.05);
        color: white;
        border-color: rgba(255, 255, 255, 0.5);
      }

      .wb-icon-circle {
        width: 40px;
        height: 40px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-right: 14px;
      }

      .wb-footer-text {
        color: rgba(255, 255, 255, 0.4);
        font-size: 12px;
      }

      /* Active State for JS */
      .wb-visible {
        opacity: 1 !important;
      }
      .wb-visible .wb-card {
        transform: scale(1) translateY(0) !important;
        opacity: 1 !important;
      }
    `;
    document.head.appendChild(style);
  }

  const modal = document.createElement('div');
  modal.id = modalId;
  modal.className = 'wb-overlay';

  renderInto(modal, viewHtml`
    <div class="wb-backdrop"></div>
    <div class="wb-card">
      <div class="wb-glow wb-glow-1"></div>
      <div class="wb-glow wb-glow-2"></div>

      <div class="wb-avatar-container">
        <img src="${avatarUrl}" alt="Avatar" class="wb-avatar">
        <div class="wb-status-dot"></div>
      </div>
      
      <div style="text-align:center;">
        <h2 class="wb-title">${t('welcome.back', '欢迎回来')}</h2>
        <p class="wb-desc">${t('welcome.backDesc', '我们要如何开始本次会话？')}</p>
      </div>

      <button id="wb-continue-btn" class="wb-btn-primary">
        <div class="wb-icon-box">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <div class="wb-info">
          <span class="wb-label">${t('welcome.continueAs', '继续使用身份')}</span>
          <span class="wb-username">${displayName}</span>
        </div>
        <svg class="wb-arrow" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      <button id="wb-new-btn" class="wb-btn-secondary">
        <div class="wb-icon-circle">
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
        </div>
        <div class="wb-info">
          <span style="font-size:14px; font-weight:500;">${t('welcome.useOther', '使用其他账户')}</span>
        </div>
      </button>
      
      <div style="text-align:center;">
        <span class="wb-footer-text">${t('welcome.useOtherDesc', '本次会话将独立运行')}</span>
      </div>
    </div>
  `);

  document.body.appendChild(modal);

  // Trigger Animation
  requestAnimationFrame(() => {
    // Add visible class to trigger CSS transitions
    modal.classList.add('wb-visible');
  });

  // Bind Events
  document.getElementById('wb-continue-btn')?.addEventListener('click', () => {
    sessionStorage.setItem('pangu_session_validated', 'true');
    closeModal(() => {
      if (typeof window.PanguPay?.router?.routeTo === 'function') {
        window.PanguPay.router.routeTo('#/main');
      }
    });
  });

  document.getElementById('wb-new-btn')?.addEventListener('click', () => {
    setSessionIgnoreUser(true);
    sessionStorage.setItem('pangu_session_validated', 'true');
    closeModal(() => {
      updateWelcomeButtons();
    });
  });

  function closeModal(callback) {
    modal.classList.remove('wb-visible');
    setTimeout(() => {
      modal.remove();
      if (callback) callback();
    }, 400); // Match CSS transition duration
  }
}

/**
 * Initialize welcome page
 */
export function initWelcomePage() {
  updateWelcomeButtons();
  bindWelcomeEvents();

  // Check for auto-login / welcome back scenario
  // Delay slightly to ensure DOM is ready and transitions are smooth
  setTimeout(checkWelcomeBack, 100);
}

/**
 * New User Page Module
 * 
 * Handles the new user/account creation page logic.
 * Flow: 1. Generate keypair -> 2. Show keypair info -> 3. Click next -> 4. Set password page
 */

import { newUser } from '../services/account';
import { showErrorToast } from '../utils/toast.js';
import { t } from '../i18n/index.js';
import { wait, copyToClipboard } from '../utils/helpers.js';
import { showSuccessToast } from '../utils/toast.js';
import { secureFetchWithRetry } from '../utils/security';
import { DOM_IDS } from '../config/domIds';

// Flag to prevent duplicate key generation
let isGeneratingKeys = false;

// Store generated account data temporarily
let pendingAccountData = null;

/**
 * Generate keypair and display it
 * Called automatically when page loads
 */
async function generateAndDisplayKeypair() {
  if (isGeneratingKeys || pendingAccountData) return;

  isGeneratingKeys = true;

  const loader = document.getElementById(DOM_IDS.newLoader);
  const resultEl = document.getElementById(DOM_IDS.result);
  const nextBtn = document.getElementById(DOM_IDS.newNextBtn);
  const keyTip = document.getElementById(DOM_IDS.newKeyTip);

  // Show loader, hide everything else
  if (loader) loader.classList.remove('hidden');
  if (resultEl) resultEl.classList.add('hidden');
  if (nextBtn) nextBtn.classList.add('hidden');
  if (keyTip) keyTip.classList.add('hidden');

  try {
    const t0 = Date.now();
    let data;

    // Try backend API first, fall back to local generation
    try {
      const res = await secureFetchWithRetry('/api/account/new', {
        method: 'POST'
      }, { timeout: 10000, retries: 2 });
      if (res.ok) {
        data = await res.json();
      } else {
        data = await newUser();
      }
    } catch (_) {
      data = await newUser();
    }

    // Ensure minimum loading time for UX
    const elapsed = Date.now() - t0;
    if (elapsed < 800) await wait(800 - elapsed);

    // Store pending data
    pendingAccountData = data;

    // Also store in window for set-password page
    window.__pendingAccountData = data;

    // Hide loader
    if (loader) loader.classList.add('hidden');

    // Display keypair info
    const accountIdEl = document.getElementById(DOM_IDS.accountId);
    const addressEl = document.getElementById(DOM_IDS.address);
    const privHexEl = document.getElementById(DOM_IDS.privHex);
    const pubXEl = document.getElementById(DOM_IDS.pubX);
    const pubYEl = document.getElementById(DOM_IDS.pubY);

    if (accountIdEl) accountIdEl.textContent = data.accountId;
    if (addressEl) addressEl.textContent = data.address;
    if (privHexEl) privHexEl.textContent = data.privHex;
    if (pubXEl) pubXEl.textContent = data.pubXHex;
    if (pubYEl) pubYEl.textContent = data.pubYHex;

    // Hide success banner
    const successBanner = resultEl?.querySelector('.new-result-success');
    if (successBanner) {
      successBanner.style.display = 'none';
    }

    // Show keypair result with animation
    if (resultEl) {
      resultEl.classList.remove('hidden');
      resultEl.classList.remove('reveal');
      requestAnimationFrame(() => resultEl.classList.add('reveal'));
    }

    // Show tip and next button
    if (keyTip) keyTip.classList.remove('hidden');
    if (nextBtn) nextBtn.classList.remove('hidden');

  } catch (err) {
    showErrorToast(t('new.generateFailed', '生成密钥失败') + ': ' + err.message, t('common.error', '错误'));
    console.error(err);
    if (loader) loader.classList.add('hidden');
  } finally {
    isGeneratingKeys = false;
  }
}

/**
 * Reset page state
 */
function resetPageState() {
  const resultEl = document.getElementById(DOM_IDS.result);
  const loader = document.getElementById(DOM_IDS.newLoader);
  const nextBtn = document.getElementById(DOM_IDS.newNextBtn);
  const keyTip = document.getElementById(DOM_IDS.newKeyTip);

  // Hide everything initially
  if (resultEl) resultEl.classList.add('hidden');
  if (loader) loader.classList.add('hidden');
  if (nextBtn) nextBtn.classList.add('hidden');
  if (keyTip) keyTip.classList.add('hidden');

  // Reset pending data and flags
  pendingAccountData = null;
  isGeneratingKeys = false;
}

/**
 * Initialize new user page
 */
export function initNewUserPage() {
  isGeneratingKeys = false;
  resetPageState();

  // Bind back button
  const newBackBtn = document.getElementById(DOM_IDS.newBackBtn);
  if (newBackBtn && !newBackBtn.dataset._newUserBind) {
    newBackBtn.dataset._newUserBind = 'true';
    newBackBtn.addEventListener('click', () => {
      if (typeof window.PanguPay?.router?.routeTo === 'function') {
        window.PanguPay.router.routeTo('#/welcome');
      }
    });
  }

  // Bind copy buttons
  const copyBtns = document.querySelectorAll('#newUserCard .copy-btn');
  copyBtns.forEach(btn => {
    // Avoid duplicate binding
    if (btn.dataset.bound) return;
    btn.dataset.bound = 'true';

    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const targetId = btn.dataset.copy;
      const targetEl = document.getElementById(targetId);

      if (targetEl && targetEl.textContent) {
        const text = targetEl.textContent.trim();
        const start = Date.now();
        await copyToClipboard(text);

        // Ensure at least 200ms feedback delay
        if (Date.now() - start < 100) await new Promise(r => setTimeout(r, 100));

        showSuccessToast(t('wallet.copied'));
      }
    });
  });

  // Bind next button - navigate to set password page
  const newNextBtn = document.getElementById(DOM_IDS.newNextBtn);
  if (newNextBtn && !newNextBtn.dataset._newUserBind) {
    newNextBtn.dataset._newUserBind = 'true';
    newNextBtn.addEventListener('click', () => {
      if (!pendingAccountData) {
        showErrorToast(t('new.noKeypair', '请先等待密钥生成完成'), t('common.error', '错误'));
        return;
      }

      // Store data for set-password page
      window.__pendingAccountData = pendingAccountData;

      // Navigate to set password page
      if (typeof window.PanguPay?.router?.routeTo === 'function') {
        window.PanguPay.router.routeTo('#/set-password');
      }
    });
  }

  // Bind private key toggle (expand/collapse)
  const privateKeyToggle = document.getElementById(DOM_IDS.privateKeyToggle);
  const privateKeyItem = document.getElementById(DOM_IDS.privateKeyItem);
  if (privateKeyToggle && privateKeyItem && !privateKeyToggle.dataset._newUserBind) {
    privateKeyToggle.dataset._newUserBind = 'true';
    privateKeyToggle.addEventListener('click', () => {
      privateKeyItem.classList.toggle('new-key-card--collapsed');
    });
  }

  // Auto-generate keypair when page loads
  setTimeout(() => {
    generateAndDisplayKeypair();
  }, 100);
}

/**
 * Get pending account data
 */
export function getPendingAccountData() {
  return pendingAccountData;
}

/**
 * Reset the creating account flag (for backward compatibility)
 */
export function resetCreatingFlag() {
  isGeneratingKeys = false;
}

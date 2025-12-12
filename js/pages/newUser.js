/**
 * New User Page Module
 * 
 * Handles the new user/account creation page logic.
 */

import { saveUser, loadUser } from '../utils/storage.ts';
import { newUser } from '../services/account.ts';
import { showSuccessToast } from '../utils/toast.js';
import { t } from '../i18n/index.js';
import { wait } from '../utils/helpers.js';
import { updateHeaderUser } from '../ui/header.js';

// Flag to prevent duplicate account creation
let isCreatingAccount = false;

/**
 * Handle account creation
 * @param {boolean} showToast - Whether to show success toast notification
 */
export async function handleCreate(showToast = true) {
  // Prevent duplicate calls
  if (isCreatingAccount) return;
  isCreatingAccount = true;
  
  const btn = document.getElementById('createBtn');
  if (btn) btn.disabled = true;
  
  try {
    const loader = document.getElementById('newLoader');
    const resultEl = document.getElementById('result');
    const nextBtn = document.getElementById('newNextBtn');
    
    if (btn) btn.classList.add('hidden');
    if (nextBtn) nextBtn.classList.add('hidden');
    if (resultEl) resultEl.classList.add('hidden');
    if (loader) loader.classList.remove('hidden');
    
    const t0 = Date.now();
    let data;
    
    try {
      const res = await fetch('/api/account/new', { method: 'POST' });
      if (res.ok) {
        data = await res.json();
      } else {
        data = await newUser();
      }
    } catch (_) {
      data = await newUser();
    }
    
    const elapsed = Date.now() - t0;
    if (elapsed < 1000) await wait(1000 - elapsed);
    if (loader) loader.classList.add('hidden');
    
    // Hide success banner, use top toast notification instead
    const successBanner = resultEl ? resultEl.querySelector('.new-result-success') : null;
    if (successBanner) {
      successBanner.style.display = 'none';
    }
    
    if (resultEl) {
      resultEl.classList.remove('hidden');
      resultEl.classList.remove('fade-in');
      resultEl.classList.remove('reveal');
      requestAnimationFrame(() => resultEl.classList.add('reveal'));
    }
    
    const accountIdEl = document.getElementById('accountId');
    const addressEl = document.getElementById('address');
    const privHexEl = document.getElementById('privHex');
    const pubXEl = document.getElementById('pubX');
    const pubYEl = document.getElementById('pubY');
    
    if (accountIdEl) accountIdEl.textContent = data.accountId;
    if (addressEl) addressEl.textContent = data.address;
    if (privHexEl) privHexEl.textContent = data.privHex;
    if (pubXEl) pubXEl.textContent = data.pubXHex;
    if (pubYEl) pubYEl.textContent = data.pubYHex;
    
    // Clear old account data before saving new account
    const oldUser = loadUser();
    if (!oldUser || oldUser.accountId !== data.accountId) {
      // Different account, clear old data
      if (typeof window.clearAccountStorage === 'function') {
        window.clearAccountStorage();
      }
    }
    
    saveUser({ 
      accountId: data.accountId, 
      address: data.address, 
      privHex: data.privHex, 
      pubXHex: data.pubXHex, 
      pubYHex: data.pubYHex, 
      flowOrigin: 'new' 
    });
    
    // Update header to show logged in user
    const user = loadUser();
    updateHeaderUser(user);
    
    if (btn) btn.classList.remove('hidden');
    if (nextBtn) nextBtn.classList.remove('hidden');
    
    // Only show top success notification when needed
    if (showToast) {
      showSuccessToast(t('toast.account.created'), t('toast.account.createTitle'));
    }
  } catch (err) {
    alert('创建用户失败：' + err);
    console.error(err);
    const nextBtn = document.getElementById('newNextBtn');
    if (btn) btn.classList.remove('hidden');
    if (nextBtn) nextBtn.classList.remove('hidden');
  } finally {
    if (btn) btn.disabled = false;
    isCreatingAccount = false;
    const loader = document.getElementById('newLoader');
    if (loader) loader.classList.add('hidden');
  }
}

/**
 * Reset the creating account flag
 */
export function resetCreatingFlag() {
  isCreatingAccount = false;
}

/**
 * Initialize new user page
 */
export function initNewUserPage() {
  isCreatingAccount = false;
  
  // Bind create button event
  const createBtn = document.getElementById('createBtn');
  if (createBtn && !createBtn.dataset._newUserBind) {
    createBtn.dataset._newUserBind = 'true';
    
    // Add ripple effect
    createBtn.addEventListener('click', (evt) => {
      const btn = evt.currentTarget;
      const rect = btn.getBoundingClientRect();
      const ripple = document.createElement('span');
      ripple.className = 'ripple';
      ripple.style.left = (evt.clientX - rect.left) + 'px';
      ripple.style.top = (evt.clientY - rect.top) + 'px';
      btn.appendChild(ripple);
      setTimeout(() => ripple.remove(), 600);
    });
    
    createBtn.addEventListener('click', () => handleCreate());
  }
  
  // Bind back button
  const newBackBtn = document.getElementById('newBackBtn');
  if (newBackBtn && !newBackBtn.dataset._newUserBind) {
    newBackBtn.dataset._newUserBind = 'true';
    newBackBtn.addEventListener('click', () => {
      if (typeof window.routeTo === 'function') {
        window.routeTo('#/welcome');
      }
    });
  }
  
  // Bind next button
  const newNextBtn = document.getElementById('newNextBtn');
  if (newNextBtn && !newNextBtn.dataset._newUserBind) {
    newNextBtn.dataset._newUserBind = 'true';
    newNextBtn.addEventListener('click', () => {
      const ov = document.getElementById('actionOverlay');
      const ovt = document.getElementById('actionOverlayText');
      if (ovt && typeof window.t === 'function') {
        ovt.textContent = window.t('modal.enteringWalletPage');
      }
      if (ov) ov.classList.remove('hidden');
      window.__skipExitConfirm = true;
      setTimeout(() => {
        if (ov) ov.classList.add('hidden');
        if (typeof window.routeTo === 'function') {
          window.routeTo('#/entry');
        }
      }, 600);
    });
  }
  
  // Bind private key toggle (expand/collapse)
  const privateKeyToggle = document.getElementById('privateKeyToggle');
  const privateKeyItem = document.getElementById('privateKeyItem');
  if (privateKeyToggle && privateKeyItem && !privateKeyToggle.dataset._newUserBind) {
    privateKeyToggle.dataset._newUserBind = 'true';
    privateKeyToggle.addEventListener('click', () => {
      privateKeyItem.classList.toggle('new-key-card--collapsed');
    });
  }
}

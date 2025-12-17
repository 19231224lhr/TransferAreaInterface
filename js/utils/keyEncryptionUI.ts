/**
 * Private Key Encryption UI Integration Module
 * 
 * Provides UI-integrated functions for encrypting/decrypting private keys
 * with password prompts and migration workflows.
 * 
 * This module bridges keyEncryption.ts with the application UI.
 */

import { t } from '../i18n/index.js';
import { showSuccessToast, showErrorToast, showWarningToast } from './toast.js';
import { 
  encryptPrivateKey,
  saveEncryptedKey,
  hasEncryptedKey,
  hasLegacyKey,
  migrateToEncrypted,
  clearLegacyKey,
  getPrivateKey,
  checkEncryptionStatus
} from './keyEncryption';
import { loadUser, saveUser, User } from './storage';
import { html as viewHtml, nothing, renderInto } from './view';

// ========================================
// Password Prompt Functions
// ========================================

/**
 * Show a password prompt modal
 * @param options - Prompt options
 * @returns Promise resolving to password or null if cancelled
 */
export function showPasswordPrompt(options: {
  title: string;
  description: string;
  confirmMode?: boolean;
  placeholder?: string;
}): Promise<string | null> {
  return new Promise((resolve) => {
    const { title, description, confirmMode = false, placeholder = '' } = options;
    
    // Check if modal already exists, remove it
    const existingModal = document.getElementById('passwordPromptModal');
    if (existingModal) {
      existingModal.remove();
    }
    
    // Create modal HTML
    const modal = document.createElement('div');
    modal.id = 'passwordPromptModal';
    modal.className = 'modal';
    renderInto(modal, viewHtml`
      <div class="modal-overlay"></div>
      <div class="modal-content password-prompt-modal">
        <h3 class="modal-title">${title}</h3>
        <p class="modal-desc">${description}</p>
        <div class="password-input-group">
          <input
            type="password"
            id="pwdPromptInput"
            class="modal-input"
            placeholder=${placeholder || t('encryption.enterPassword')}
            autocomplete="off"
          />
          <button type="button" class="pwd-toggle-btn" id="pwdToggleBtn">
            <svg class="eye-open hidden" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
            <svg class="eye-closed" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
              <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"></path>
              <line x1="1" y1="1" x2="23" y2="23"></line>
            </svg>
          </button>
        </div>

        ${confirmMode
          ? viewHtml`
              <div class="password-input-group" style="margin-top: 12px;">
                <input
                  type="password"
                  id="pwdConfirmInput"
                  class="modal-input"
                  placeholder=${t('encryption.confirmPassword')}
                  autocomplete="off"
                />
              </div>
            `
          : nothing}

        <div class="modal-error hidden" id="pwdPromptError"></div>
        <div class="modal-actions">
          <button class="modal-btn modal-btn--secondary" id="pwdCancelBtn">${t('common.cancel')}</button>
          <button class="modal-btn modal-btn--primary" id="pwdConfirmBtn">${t('common.confirm')}</button>
        </div>
      </div>
    `);
    
    document.body.appendChild(modal);
    
    // Get elements
    const input = document.getElementById('pwdPromptInput') as HTMLInputElement;
    const confirmInput = document.getElementById('pwdConfirmInput') as HTMLInputElement | null;
    const toggleBtn = document.getElementById('pwdToggleBtn');
    const cancelBtn = document.getElementById('pwdCancelBtn');
    const confirmBtn = document.getElementById('pwdConfirmBtn');
    const errorEl = document.getElementById('pwdPromptError');
    
    // Show modal with animation
    requestAnimationFrame(() => {
      modal.classList.add('visible');
      input?.focus();
    });
    
    // Toggle password visibility
    toggleBtn?.addEventListener('click', () => {
      const eyeOpen = toggleBtn.querySelector('.eye-open');
      const eyeClosed = toggleBtn.querySelector('.eye-closed');
      if (input.type === 'password') {
        input.type = 'text';
        if (confirmInput) confirmInput.type = 'text';
        eyeOpen?.classList.remove('hidden');
        eyeClosed?.classList.add('hidden');
      } else {
        input.type = 'password';
        if (confirmInput) confirmInput.type = 'password';
        eyeOpen?.classList.add('hidden');
        eyeClosed?.classList.remove('hidden');
      }
    });
    
    // Show error message
    const showError = (msg: string) => {
      if (errorEl) {
        errorEl.textContent = msg;
        errorEl.classList.remove('hidden');
      }
    };
    
    // Hide and cleanup
    const closeModal = (result: string | null) => {
      modal.classList.remove('visible');
      setTimeout(() => modal.remove(), 200);
      resolve(result);
    };
    
    // Cancel handler
    cancelBtn?.addEventListener('click', () => closeModal(null));
    
    // Confirm handler
    confirmBtn?.addEventListener('click', () => {
      const password = input?.value || '';
      
      // Validation
      if (!password) {
        showError(t('encryption.passwordRequired'));
        input?.focus();
        return;
      }
      
      if (password.length < 6) {
        showError(t('encryption.passwordTooShort'));
        input?.focus();
        return;
      }
      
      if (confirmMode && confirmInput) {
        if (password !== confirmInput.value) {
          showError(t('encryption.passwordMismatch'));
          confirmInput.focus();
          return;
        }
      }
      
      closeModal(password);
    });
    
    // Enter key to confirm
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        confirmBtn?.click();
      } else if (e.key === 'Escape') {
        closeModal(null);
      }
    };
    
    input?.addEventListener('keydown', handleKeydown);
    confirmInput?.addEventListener('keydown', handleKeydown);
    
    // Click overlay to close
    modal.querySelector('.modal-overlay')?.addEventListener('click', () => closeModal(null));
  });
}

// ========================================
// Encryption Workflow Functions
// ========================================

/**
 * Encrypt and save a private key with user-provided password
 * Used when creating or importing a new account
 * @param accountId - Account identifier
 * @param privHex - Private key to encrypt
 * @returns Whether encryption was successful
 */
export async function encryptAndSavePrivateKey(
  accountId: string,
  privHex: string
): Promise<boolean> {
  // Prompt for password
  const password = await showPasswordPrompt({
    title: t('encryption.setPassword'),
    description: t('encryption.setPasswordDesc'),
    confirmMode: true
  });
  
  if (!password) {
    // User cancelled - save without encryption for now (backward compatible)
    return false;
  }
  
  try {
    const encryptedData = await encryptPrivateKey(privHex, password);
    saveEncryptedKey(accountId, encryptedData);
    showSuccessToast(t('encryption.encryptSuccess'));
    return true;
  } catch (err) {
    console.error('Encryption failed:', err);
    showErrorToast((err as Error).message || 'Encryption failed');
    return false;
  }
}

/**
 * Get decrypted private key with password prompt
 * Used when signing transactions
 * @param accountId - Account identifier
 * @returns Decrypted private key or null if failed/cancelled
 */
export async function getDecryptedPrivateKey(accountId: string): Promise<string | null> {
  // Check if we have encrypted key
  if (!hasEncryptedKey(accountId)) {
    // Check legacy storage
    const user = loadUser();
    if (user && hasLegacyKey(user as any)) {
      // Return legacy key directly (not encrypted)
      return user.keys?.privHex || user.privHex || null;
    }
    return null;
  }
  
  // Prompt for password
  const password = await showPasswordPrompt({
    title: t('encryption.enterPassword'),
    description: t('encryption.enterPasswordDesc')
  });
  
  if (!password) {
    return null;
  }
  
  try {
    return await getPrivateKey(accountId, password);
  } catch (err) {
    showErrorToast(t('encryption.decryptFailed'));
    return null;
  }
}

/**
 * Check and prompt for migration if needed
 * Should be called on app initialization or login
 * @returns Whether migration was completed
 */
export async function checkAndPromptMigration(): Promise<boolean> {
  const user = loadUser();
  if (!user || !user.accountId) {
    return false;
  }
  
  const status = checkEncryptionStatus(user as any);
  
  if (!status.needsMigration) {
    return false; // No migration needed
  }
  
  // Show migration prompt
  const password = await showPasswordPrompt({
    title: t('encryption.migrationTitle'),
    description: t('encryption.migrationDesc'),
    confirmMode: true
  });
  
  if (!password) {
    // User declined migration
    showWarningToast(t('encryption.migrationDesc'));
    return false;
  }
  
  try {
    const result = await migrateToEncrypted(user as any, password);
    
    if (result.success) {
      // Clear plaintext key from storage
      const updatedUser = clearLegacyKey(user as any);
      if (updatedUser) {
        saveUser(updatedUser as any);
      }
      showSuccessToast(t('encryption.encryptSuccess'));
      return true;
    } else {
      showErrorToast(result.error || 'Migration failed');
      return false;
    }
  } catch (err) {
    console.error('Migration error:', err);
    showErrorToast((err as Error).message || 'Migration failed');
    return false;
  }
}

/**
 * Save user with optional encryption prompt for new accounts
 * This is a wrapper around saveUser that adds encryption workflow
 * @param userData - User data to save
 * @param promptEncryption - Whether to prompt for encryption (default: true for new accounts)
 */
export async function saveUserWithEncryption(
  userData: Partial<User>,
  promptEncryption: boolean = true
): Promise<void> {
  // Save basic user data first
  saveUser(userData);
  
  // If this is a new account with private key and encryption is enabled
  if (promptEncryption && userData.accountId && userData.privHex) {
    // Check if already encrypted
    if (!hasEncryptedKey(userData.accountId)) {
      // Prompt for encryption (non-blocking - user can skip)
      const encrypted = await encryptAndSavePrivateKey(
        userData.accountId,
        userData.privHex
      );
      
      if (encrypted) {
        // Clear plaintext key from storage
        const user = loadUser();
        if (user) {
          const updatedUser = clearLegacyKey(user as any);
          if (updatedUser) {
            saveUser(updatedUser as any);
          }
        }
      }
    }
  }
}

// ========================================
// Utility Exports
// ========================================

export {
  hasEncryptedKey,
  hasLegacyKey,
  checkEncryptionStatus
};

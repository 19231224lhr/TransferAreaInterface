/**
 * Internationalization (i18n) Core Module
 * 
 * Provides translation functions and language management for the application.
 */

import zhCN from './zh-CN.js';
import en from './en.js';
import { I18N_STORAGE_KEY } from '../config/constants.ts';

// Translation dictionaries
const translations = {
  'zh-CN': zhCN,
  'en': en
};

// Current language state
let currentLanguage = 'zh-CN';

/**
 * Get the current language code
 * @returns {string} Current language code (e.g., 'zh-CN', 'en')
 */
export function getCurrentLanguage() {
  return currentLanguage;
}

/**
 * Load saved language setting from localStorage
 * @returns {string} The loaded language code
 */
export function loadLanguageSetting() {
  try {
    const saved = localStorage.getItem(I18N_STORAGE_KEY);
    if (saved && translations[saved]) {
      currentLanguage = saved;
    }
  } catch (e) {
    console.warn('Failed to load language setting', e);
  }
  return currentLanguage;
}

/**
 * Save language setting to localStorage
 * @param {string} lang - Language code to save
 */
export function saveLanguageSetting(lang) {
  try {
    localStorage.setItem(I18N_STORAGE_KEY, lang);
  } catch (e) {
    console.warn('Failed to save language setting', e);
  }
}

/**
 * Set the current language
 * @param {string} lang - Language code to set
 * @returns {boolean} True if language was set successfully
 */
export function setLanguage(lang) {
  if (!translations[lang]) {
    console.warn('Unsupported language:', lang);
    return false;
  }
  currentLanguage = lang;
  saveLanguageSetting(lang);
  updatePageTranslations();
  
  // Update welcome page buttons if on welcome page
  const currentHash = (location.hash || '#/welcome').replace(/^#/, '');
  if (currentHash === '/welcome') {
    // This will be handled by the page module when it's created
    if (typeof window.updateWelcomeButtons === 'function') {
      window.updateWelcomeButtons();
    }
  }
  
  return true;
}

/**
 * Get translated text for a key
 * @param {string} key - Translation key
 * @param {object} params - Optional parameters for string interpolation
 * @returns {string} Translated text
 */
export function t(key, params = {}) {
  const dict = translations[currentLanguage] || translations['zh-CN'];
  let text = dict[key] || translations['zh-CN'][key] || key;
  
  // Replace parameters {param}
  Object.keys(params).forEach(param => {
    text = text.replace(new RegExp(`\\{${param}\\}`, 'g'), params[param]);
  });
  
  return text;
}

/**
 * Update all elements with data-i18n attributes on the page
 */
export function updatePageTranslations() {
  // Update elements with data-i18n attribute (text content)
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (key) {
      el.textContent = t(key);
    }
  });
  
  // Update elements with data-i18n-placeholder attribute (input placeholders)
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (key) {
      el.placeholder = t(key);
    }
  });
  
  // Update elements with data-i18n-title attribute (tooltips)
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    if (key) {
      el.title = t(key);
      // Also update data-tooltip if it exists
      if (el.hasAttribute('data-tooltip')) {
        el.setAttribute('data-tooltip', t(key));
      }
    }
  });
  
  // Update dynamically generated recipient cards
  updateRecipientCardTranslations();
  
  // Update "no address available" text in dropdowns
  document.querySelectorAll('.custom-select__item.disabled').forEach(item => {
    if (item.textContent.includes('无可用地址') || item.textContent.includes('No address available')) {
      item.textContent = t('transfer.noAddressAvailable');
    }
  });
  
  // Update language selector UI
  updateLanguageSelectorUI();
}

/**
 * Update translations in dynamically generated recipient cards
 */
function updateRecipientCardTranslations() {
  document.querySelectorAll('.recipient-card').forEach(card => {
    // Update field labels
    const labels = card.querySelectorAll('.recipient-field-label');
    if (labels.length >= 5) {
      labels[0].textContent = t('transfer.recipientAddress');
      labels[1].textContent = t('transfer.amount');
      labels[2].textContent = t('transfer.currency');
      labels[3].textContent = t('transfer.publicKey');
      labels[4].textContent = t('transfer.guarantorOrgId');
      if (labels[5]) labels[5].textContent = t('transfer.transferGas');
    }
    
    // Update button text
    const expandBtn = card.querySelector('[data-role="expand"] span');
    if (expandBtn) {
      const isExpanded = card.querySelector('.recipient-details')?.classList.contains('expanded');
      expandBtn.textContent = isExpanded ? t('transfer.collapseOptions') : t('wallet.advancedOptions');
    }
    
    const removeBtn = card.querySelector('[data-role="remove"] span');
    if (removeBtn) removeBtn.textContent = t('transfer.delete');
    
    const addBtn = card.querySelector('[data-role="add"] span');
    if (addBtn) addBtn.textContent = t('transfer.addRecipient');
    
    // Update placeholders
    const addrInput = card.querySelector('[data-name="to"]');
    if (addrInput) addrInput.placeholder = t('transfer.enterRecipientAddress');
    
    const gidInput = card.querySelector('[data-name="gid"]');
    if (gidInput) gidInput.placeholder = t('transfer.optional');
  });
}

/**
 * Update language selector UI to reflect current language
 */
export function updateLanguageSelectorUI() {
  const selector = document.getElementById('languageSelector');
  if (!selector) return;
  
  const options = selector.querySelectorAll('.language-option');
  options.forEach(opt => {
    const lang = opt.getAttribute('data-lang');
    if (lang === currentLanguage) {
      opt.classList.add('active');
    } else {
      opt.classList.remove('active');
    }
  });
}

/**
 * Get all available languages
 * @returns {string[]} Array of available language codes
 */
export function getAvailableLanguages() {
  return Object.keys(translations);
}

/**
 * Check if a language is supported
 * @param {string} lang - Language code to check
 * @returns {boolean} True if language is supported
 */
export function isLanguageSupported(lang) {
  return !!translations[lang];
}

// Initialize language setting on module load
loadLanguageSetting();

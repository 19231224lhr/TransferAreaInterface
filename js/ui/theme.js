/**
 * Theme Management Module
 * 
 * Provides theme switching functionality (light/dark mode).
 */

import { t } from '../i18n/index.js';
import { showSuccessToast } from '../utils/toast.js';
import { THEME_STORAGE_KEY } from '../config/constants.js';

// Current theme state
let currentTheme = 'light';

/**
 * Get the current theme
 * @returns {string} Current theme ('light' or 'dark')
 */
export function getCurrentTheme() {
  return currentTheme;
}

/**
 * Set the theme
 * @param {string} theme - Theme to set ('light' or 'dark')
 * @param {boolean} showNotification - Whether to show toast notification
 */
export function setTheme(theme, showNotification = true) {
  // Validate theme value
  if (theme !== 'light' && theme !== 'dark') {
    console.warn('Invalid theme:', theme);
    return;
  }
  
  // Update current theme
  currentTheme = theme;
  
  // Update DOM
  document.documentElement.setAttribute('data-theme', theme);
  
  // Save to localStorage
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch (e) {
    console.warn('Failed to save theme setting:', e);
  }
  
  // Update theme selector UI
  updateThemeSelectorUI();
  
  // Show toast notification
  if (showNotification) {
    const message = theme === 'dark' 
      ? t('toast.theme.darkEnabled') 
      : t('toast.theme.lightEnabled');
    showSuccessToast(message, t('common.success'));
  }
}

/**
 * Toggle between light and dark theme
 */
export function toggleTheme() {
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  setTheme(newTheme);
}

/**
 * Load saved theme setting from localStorage
 */
export function loadThemeSetting() {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved && (saved === 'light' || saved === 'dark')) {
      currentTheme = saved;
    } else {
      // Detect system theme preference
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        currentTheme = 'dark';
      } else {
        currentTheme = 'light';
      }
    }
    document.documentElement.setAttribute('data-theme', currentTheme);
  } catch (e) {
    console.warn('Failed to load theme setting:', e);
    currentTheme = 'light';
  }
}

/**
 * Update theme selector UI to reflect current theme
 */
export function updateThemeSelectorUI() {
  const selector = document.getElementById('themeSelector');
  if (!selector) return;
  
  const options = selector.querySelectorAll('.theme-option');
  options.forEach(opt => {
    const theme = opt.getAttribute('data-theme');
    if (theme === currentTheme) {
      opt.classList.add('active');
    } else {
      opt.classList.remove('active');
    }
  });
}

/**
 * Initialize theme selector events
 */
export function initThemeSelector() {
  const selector = document.getElementById('themeSelector');
  if (!selector || selector.dataset._bind) return;
  
  selector.addEventListener('click', (e) => {
    const option = e.target.closest('.theme-option');
    if (!option) return;
    
    const theme = option.getAttribute('data-theme');
    if (theme && theme !== getCurrentTheme()) {
      setTheme(theme);
    }
  });
  
  selector.dataset._bind = '1';
}

// Initialize theme setting on module load
loadThemeSetting();

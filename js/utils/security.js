/**
 * Security Utility Functions
 * 
 * Provides security-related utilities including:
 * - XSS protection (HTML escaping)
 * - Input validation
 * - Secure fetch with timeout/retry/CSRF
 * - Error boundary helpers
 */

import { t } from '../i18n/index.js';

// ========================================
// Constants
// ========================================

/** Default fetch timeout in milliseconds */
export const DEFAULT_FETCH_TIMEOUT = 10000;

/** Default retry count for failed requests */
export const DEFAULT_RETRY_COUNT = 3;

/** Address hex length */
export const ADDRESS_HEX_LENGTH = 40;

/** Private key hex length */
export const PRIVATE_KEY_HEX_LENGTH = 64;

/** Maximum decimal places for transfer amounts */
export const MAX_AMOUNT_DECIMALS = 8;

// ========================================
// XSS Protection
// ========================================

/**
 * Escape HTML special characters to prevent XSS attacks
 * @param {string} unsafe - Potentially unsafe string
 * @returns {string} Safe string with HTML entities escaped
 */
export function escapeHtml(unsafe) {
  if (typeof unsafe !== 'string') {
    return String(unsafe ?? '');
  }
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Create a text node safely (alternative to innerHTML)
 * @param {string} text - Text content
 * @returns {Text} Text node
 */
export function createTextNode(text) {
  return document.createTextNode(text);
}

/**
 * Set element text content safely
 * @param {HTMLElement} element - Target element
 * @param {string} text - Text to set
 */
export function setTextContent(element, text) {
  if (element) {
    element.textContent = text;
  }
}

/**
 * Create element with safe text content
 * @param {string} tagName - HTML tag name
 * @param {string} className - CSS class name
 * @param {string} textContent - Text content (will be escaped)
 * @param {Object} attributes - Additional attributes
 * @returns {HTMLElement} Created element
 */
export function createElement(tagName, className = '', textContent = '', attributes = {}) {
  const el = document.createElement(tagName);
  if (className) el.className = className;
  if (textContent) el.textContent = textContent;
  for (const [key, value] of Object.entries(attributes)) {
    if (key === 'data') {
      for (const [dataKey, dataValue] of Object.entries(value)) {
        el.dataset[dataKey] = dataValue;
      }
    } else {
      el.setAttribute(key, value);
    }
  }
  return el;
}

// ========================================
// Input Validation
// ========================================

/**
 * Validate transfer amount with detailed error messages
 * @param {string|number} amount - Amount to validate
 * @param {Object} [options] - Validation options
 * @param {number} [options.min] - Minimum allowed value (default: 0)
 * @param {number} [options.max] - Maximum allowed value (default: Number.MAX_SAFE_INTEGER)
 * @param {number} [options.decimals] - Maximum decimal places (default: 8)
 * @returns {{valid: boolean, value?: number, error?: string}} Validation result
 */
export function validateTransferAmount(amount, options = {}) {
  const { min = 0, max = Number.MAX_SAFE_INTEGER, decimals = MAX_AMOUNT_DECIMALS } = options;
  
  // Handle empty input
  if (amount === '' || amount === null || amount === undefined) {
    return { valid: false, error: t('validation.amountRequired') || '请输入金额' };
  }
  
  // Convert to number
  const num = typeof amount === 'number' ? amount : parseFloat(String(amount).trim());
  
  // Check if valid number
  if (!Number.isFinite(num)) {
    return { valid: false, error: t('validation.amountInvalid') || '无效的金额' };
  }
  
  // Check minimum (use <= to ensure amount must be > min)
  if (num <= min) {
    if (min === 0 || min < 0.00000001) {
      return { valid: false, error: t('validation.amountPositive') || '金额必须大于0' };
    }
    return { valid: false, error: (t('validation.amountMin') || '金额必须大于 {min}').replace('{min}', String(min)) };
  }
  
  // Check maximum (safety check)
  if (num > max) {
    return { valid: false, error: t('validation.amountTooLarge') || '金额超出安全范围' };
  }
  
  // Check decimal places
  const strAmount = String(amount);
  const decimalPart = strAmount.split('.')[1];
  if (decimalPart && decimalPart.length > decimals) {
    return { 
      valid: false, 
      error: (t('validation.amountDecimals') || '最多支持 {decimals} 位小数').replace('{decimals}', String(decimals)) 
    };
  }
  
  return { valid: true, value: num };
}

/**
 * Validate blockchain address format
 * @param {string} address - Address to validate
 * @param {Object} [options] - Validation options
 * @param {boolean} [options.required] - Whether address is required (default: true)
 * @returns {{valid: boolean, value?: string, error?: string}} Validation result
 */
export function validateAddress(address, options = {}) {
  const { required = true } = options;
  
  // Handle empty input
  if (!address || typeof address !== 'string' || !address.trim()) {
    if (required) {
      return { valid: false, error: t('validation.addressRequired') || '请输入地址' };
    }
    return { valid: true, value: '' };
  }
  
  // Normalize: remove 0x prefix, lowercase
  const normalized = address.trim().replace(/^0x/i, '').toLowerCase();
  
  // Check length
  if (normalized.length !== ADDRESS_HEX_LENGTH) {
    return { valid: false, error: t('validation.addressLength') || '地址长度必须为40位十六进制字符' };
  }
  
  // Check hex format
  if (!/^[0-9a-f]+$/i.test(normalized)) {
    return { valid: false, error: t('validation.addressFormat') || '地址格式错误，必须为十六进制字符' };
  }
  
  return { valid: true, value: normalized };
}

/**
 * Validate private key format
 * @param {string} privateKey - Private key to validate
 * @returns {{valid: boolean, value?: string, error?: string}} Validation result
 */
export function validatePrivateKey(privateKey) {
  // Handle empty input
  if (!privateKey || typeof privateKey !== 'string' || !privateKey.trim()) {
    return { valid: false, error: t('validation.privateKeyRequired') || '请输入私钥' };
  }
  
  // Normalize: remove 0x prefix
  const normalized = privateKey.trim().replace(/^0x/i, '');
  
  // Check length
  if (normalized.length !== PRIVATE_KEY_HEX_LENGTH) {
    return { valid: false, error: t('validation.privateKeyLength') || '私钥长度必须为64位十六进制字符' };
  }
  
  // Check hex format
  if (!/^[0-9a-f]+$/i.test(normalized)) {
    return { valid: false, error: t('validation.privateKeyFormat') || '私钥格式错误，必须为十六进制字符' };
  }
  
  return { valid: true, value: normalized };
}

/**
 * Validate guarantor organization ID
 * @param {string} orgId - Organization ID to validate
 * @param {Object} [options] - Validation options
 * @param {boolean} [options.required] - Whether org ID is required (default: false)
 * @returns {{valid: boolean, value?: string, error?: string}} Validation result
 */
export function validateOrgId(orgId, options = {}) {
  const { required = false } = options;
  
  if (!orgId || !orgId.trim()) {
    if (required) {
      return { valid: false, error: t('validation.orgIdRequired') || '请输入担保组织ID' };
    }
    return { valid: true, value: '' };
  }
  
  const trimmed = orgId.trim();
  
  // Check 8-digit format
  if (!/^\d{8}$/.test(trimmed)) {
    return { valid: false, error: t('validation.orgIdFormat') || '担保组织ID必须为8位数字' };
  }
  
  return { valid: true, value: trimmed };
}

// ========================================
// Submission Guard
// ========================================

/** Map to track submission states */
const submissionGuards = new Map();

/**
 * Create a submission guard to prevent duplicate submissions
 * @param {string} key - Unique key for this submission type
 * @returns {{isSubmitting: () => boolean, start: () => boolean, end: () => void}} Guard object
 */
export function createSubmissionGuard(key) {
  if (!submissionGuards.has(key)) {
    submissionGuards.set(key, false);
  }
  
  return {
    /** Check if currently submitting */
    isSubmitting: () => submissionGuards.get(key),
    
    /** Start submission (returns false if already submitting) */
    start: () => {
      if (submissionGuards.get(key)) {
        return false;
      }
      submissionGuards.set(key, true);
      return true;
    },
    
    /** End submission */
    end: () => {
      submissionGuards.set(key, false);
    }
  };
}

/**
 * Wrap an async function with submission guard
 * @param {string} key - Unique key for this submission type
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Wrapped function that prevents duplicate calls
 */
export function withSubmissionGuard(key, fn) {
  const guard = createSubmissionGuard(key);
  
  return async (...args) => {
    if (!guard.start()) {
      console.warn(`Submission guard triggered: ${key} is already in progress`);
      return;
    }
    
    try {
      return await fn(...args);
    } finally {
      guard.end();
    }
  };
}

// ========================================
// Secure Fetch
// ========================================

/**
 * Fetch with timeout support
 * @param {string} url - Request URL
 * @param {Object} options - Fetch options
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<Response>} Fetch response
 */
export async function fetchWithTimeout(url, options = {}, timeout = DEFAULT_FETCH_TIMEOUT) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(t('error.requestTimeout') || '请求超时，请重试');
    }
    throw error;
  }
}

/**
 * Fetch with retry support
 * @param {string} url - Request URL
 * @param {Object} options - Fetch options
 * @param {number} retries - Number of retries
 * @param {number} timeout - Timeout per request in milliseconds
 * @returns {Promise<Response>} Fetch response
 */
export async function fetchWithRetry(url, options = {}, retries = DEFAULT_RETRY_COUNT, timeout = DEFAULT_FETCH_TIMEOUT) {
  let lastError;
  
  for (let i = 0; i < retries; i++) {
    try {
      return await fetchWithTimeout(url, options, timeout);
    } catch (error) {
      lastError = error;
      
      // Don't retry on certain errors
      if (error.message?.includes('请求超时') || error.name === 'AbortError') {
        // Allow retry on timeout
      } else if (error.message?.includes('NetworkError') || error.message?.includes('Failed to fetch')) {
        // Allow retry on network errors
      } else {
        // Don't retry on other errors (e.g., 4xx responses)
        throw error;
      }
      
      // Wait before retry (exponential backoff)
      if (i < retries - 1) {
        await new Promise(r => setTimeout(r, 1000 * (i + 1)));
      }
    }
  }
  
  throw lastError;
}

/**
 * Secure fetch with CSRF token support
 * @param {string} url - Request URL
 * @param {RequestInit} [options] - Fetch options
 * @returns {Promise<Response>} Fetch response
 */
export async function secureFetch(url, options = {}) {
  // Get CSRF token from meta tag if available
  const csrfMeta = /** @type {HTMLMetaElement | null} */ (document.querySelector('meta[name="csrf-token"]'));
  const csrfToken = csrfMeta?.content || '';
  
  const secureHeaders = {
    'Content-Type': 'application/json',
    ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
    ...options.headers
  };
  
  return fetchWithTimeout(url, {
    ...options,
    headers: secureHeaders,
    credentials: 'same-origin'
  });
}

/**
 * Secure fetch with all protections (timeout, retry, CSRF)
 * @param {string} url - Request URL
 * @param {RequestInit} [options] - Fetch options
 * @param {Object} [config] - Configuration
 * @param {number} [config.timeout] - Timeout in milliseconds
 * @param {number} [config.retries] - Number of retries
 * @returns {Promise<Response>} Fetch response
 */
export async function secureFetchWithRetry(url, options = {}, config = {}) {
  const { timeout = DEFAULT_FETCH_TIMEOUT, retries = DEFAULT_RETRY_COUNT } = config;
  
  // Get CSRF token from meta tag if available
  const csrfMeta = /** @type {HTMLMetaElement | null} */ (document.querySelector('meta[name="csrf-token"]'));
  const csrfToken = csrfMeta?.content || '';
  
  const secureHeaders = {
    'Content-Type': 'application/json',
    ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
    ...options.headers
  };
  
  return fetchWithRetry(url, {
    ...options,
    headers: secureHeaders,
    credentials: 'same-origin'
  }, retries, timeout);
}

// ========================================
// Error Boundary
// ========================================

/** Error handlers registry */
const errorHandlers = [];

/**
 * Register a custom error handler
 * @param {Function} handler - Error handler function
 * @returns {Function} Unregister function
 */
export function registerErrorHandler(handler) {
  errorHandlers.push(handler);
  return () => {
    const index = errorHandlers.indexOf(handler);
    if (index > -1) {
      errorHandlers.splice(index, 1);
    }
  };
}

/**
 * Report error to registered handlers
 * @param {Object} errorInfo - Error information
 */
export function reportError(errorInfo) {
  for (const handler of errorHandlers) {
    try {
      handler(errorInfo);
    } catch (e) {
      console.error('Error handler failed:', e);
    }
  }
}

/**
 * Initialize global error boundary
 * Should be called once during app initialization
 * @param {Object} [options] - Configuration options
 * @param {Function} [options.showError] - Function to show error to user
 * @param {boolean} [options.logToConsole] - Whether to log to console (default: true)
 */
export function initErrorBoundary(options = {}) {
  const { showError, logToConsole = true } = options;
  
  // Global error handler
  window.addEventListener('error', (event) => {
    const { message, filename, lineno, colno, error } = event;
    
    // Skip empty/undefined errors
    if (!message && !filename && !error) {
      event.preventDefault();
      return true;
    }
    
    // Skip browser extension errors
    const msgStr = String(message || '');
    const fileStr = String(filename || '');
    
    if (msgStr.includes('Cannot redefine property: ethereum') ||
        fileStr.includes('evmAsk.js') ||
        fileStr.includes('solanaActionsContentScript.js') ||
        msgStr.includes('Could not establish connection')) {
      event.preventDefault();
      return true;
    }
    
    // Skip HTTP/API related errors (since backend is not yet connected)
    if (msgStr.includes('fetch') ||
        msgStr.includes('HTTP') ||
        msgStr.includes('api/') ||
        msgStr.includes('POST') ||
        msgStr.includes('GET') ||
        msgStr.includes('404') ||
        msgStr.includes('401') ||
        msgStr.includes('500')) {
      event.preventDefault();
      if (logToConsole) {
        console.warn('HTTP/API error (suppressed, backend not connected):', msgStr);
      }
      return true;
    }
    
    // Only log if error has meaningful content
    if (logToConsole && (msgStr || fileStr || error)) {
      console.error('Global error caught:', { message: msgStr, filename: fileStr, lineno, colno, error });
    }
    
    // Only report error if it has meaningful content
    if (message || error) {
      reportError({
        type: 'error',
        message: msgStr,
        filename: fileStr,
        lineno,
        colno,
        stack: error?.stack,
        timestamp: Date.now()
      });
    }
    
    // Don't show error to user for now (backend not connected)
    // if (showError && typeof showError === 'function') {
    //   showError(
    //     t('error.unexpected') || '发生意外错误',
    //     t('error.pleaseRefresh') || '请刷新页面后重试'
    //   );
    // }
    
    return false;
  }, true);
  
  // Unhandled promise rejection handler
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const reasonStr = String(reason || '');
    
    // Skip browser extension errors
    if (reasonStr.includes('Could not establish connection') ||
        reasonStr.includes('Receiving end does not exist') ||
        reasonStr.includes('Something went wrong')) {
      event.preventDefault();
      return;
    }
    
    // Skip ALL HTTP/API/fetch related errors (backend not yet connected)
    if (reasonStr.includes('fetch') ||
        reasonStr.includes('HTTP') ||
        reasonStr.includes('api/') ||
        reasonStr.includes('POST') ||
        reasonStr.includes('GET') ||
        reasonStr.includes('PUT') ||
        reasonStr.includes('DELETE') ||
        reasonStr.includes('404') ||
        reasonStr.includes('401') ||
        reasonStr.includes('403') ||
        reasonStr.includes('500') ||
        reasonStr.includes('Not Found') ||
        reasonStr.includes('Unauthorized') ||
        reasonStr.includes('NetworkError') ||
        reasonStr.includes('Failed to fetch') ||
        reasonStr.includes('请求超时') ||
        reasonStr.includes('localhost:8081') ||
        reasonStr.includes('localhost:3000')) {
      event.preventDefault();
      if (logToConsole) {
        console.warn('HTTP/API error (suppressed, backend not connected):', reasonStr);
      }
      return;
    }
    
    // Log error
    if (logToConsole) {
      console.error('Unhandled promise rejection:', reason);
    }
    
    // Only report error if it has meaningful content
    if (reasonStr && reasonStr !== '[object Object]') {
      reportError({
        type: 'unhandledrejection',
        message: reasonStr,
        stack: reason?.stack,
        timestamp: Date.now()
      });
    }
    
    // Don't show error to user for now (backend not connected)
    // if (showError && typeof showError === 'function') {
    //   if (reasonStr.includes('NetworkError') || 
    //       reasonStr.includes('Failed to fetch') ||
    //       reasonStr.includes('请求超时')) {
    //     showError(
    //       t('error.networkError') || '网络错误',
    //       t('error.checkNetwork') || '请检查网络连接后重试'
    //     );
    //   }
    // }
  }, true);
  
  console.log('Error boundary initialized');
}

/**
 * Wrap async function with error boundary
 * @param {Function} fn - Async function to wrap
 * @param {Object} [options] - Options
 * @param {Function} [options.onError] - Custom error handler
 * @param {*} [options.fallback] - Fallback value on error
 * @returns {Function} Wrapped function
 */
export function withErrorBoundary(fn, options = {}) {
  const { onError, fallback } = options;
  
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      console.error('Error in wrapped function:', error);
      
      reportError({
        type: 'caught',
        message: error.message,
        stack: error.stack,
        timestamp: Date.now()
      });
      
      if (onError && typeof onError === 'function') {
        onError(error);
      }
      
      return fallback;
    }
  };
}

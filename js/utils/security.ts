/**
 * Security Utility Functions
 * 
 * Provides security-related utilities including:
 * - XSS protection (HTML escaping)
 * - Input validation
 * - Secure fetch with timeout/retry/CSRF
 * - Error boundary helpers
 */

// Lazy import for i18n to avoid circular dependency
let _t: ((key: string, fallback?: string) => string) | null = null;

/**
 * Get translation function lazily to avoid circular dependency
 */
function getT(): (key: string, fallback?: string) => string {
  if (!_t) {
    try {
      // Dynamic import would be better but we use lazy evaluation
      const i18n = (window as any).t;
      if (typeof i18n === 'function') {
        _t = i18n;
      }
    } catch {
      // Ignore
    }
  }
  return _t || ((key: string, fallback?: string) => fallback || key);
}

// Helper to get translation
const t = (key: string, fallback?: string): string => getT()(key, fallback);

// ========================================
// Constants
// ========================================

/** Default fetch timeout in milliseconds */
export const DEFAULT_FETCH_TIMEOUT: number = 10000;

/** Default retry count for failed requests */
export const DEFAULT_RETRY_COUNT: number = 3;

/** Address hex length */
export const ADDRESS_HEX_LENGTH: number = 40;

/** Private key hex length */
export const PRIVATE_KEY_HEX_LENGTH: number = 64;

/** Maximum decimal places for transfer amounts */
export const MAX_AMOUNT_DECIMALS: number = 8;

// ========================================
// Type Definitions
// ========================================

/** Validation result with typed value */
export interface ValidationResult<T = string> {
  valid: boolean;
  value?: T;
  error?: string;
}

/** Amount validation options */
export interface AmountValidationOptions {
  min?: number;
  max?: number;
  decimals?: number;
}

/** Address validation options */
export interface AddressValidationOptions {
  required?: boolean;
}

/** Organization ID validation options */
export interface OrgIdValidationOptions {
  required?: boolean;
}

/** Element attributes for createElement */
export interface ElementAttributes {
  data?: Record<string, string>;
  [key: string]: any;
}

/** Submission guard interface */
export interface SubmissionGuard {
  isSubmitting: () => boolean;
  start: () => boolean;
  end: () => void;
}

/** Error information for reporting */
export interface ErrorInfo {
  type: 'error' | 'unhandledrejection' | 'caught';
  message: string;
  filename?: string;
  lineno?: number;
  colno?: number;
  stack?: string;
  timestamp: number;
}

/** Error handler function type */
export type ErrorHandler = (errorInfo: ErrorInfo) => void;

/** Error boundary initialization options */
export interface ErrorBoundaryOptions {
  showError?: (title: string, message: string) => void;
  logToConsole?: boolean;
}

/** Secure fetch configuration */
export interface SecureFetchConfig {
  timeout?: number;
  retries?: number;
}

/** Options for withErrorBoundary wrapper */
export interface ErrorBoundaryWrapperOptions<T> {
  onError?: (error: Error) => void;
  fallback?: T;
}

// ========================================
// XSS Protection
// ========================================

/**
 * Escape HTML special characters to prevent XSS attacks
 */
export function escapeHtml(unsafe: unknown): string {
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
 */
export function createTextNode(text: string): Text {
  return document.createTextNode(text);
}

/**
 * Set element text content safely
 */
export function setTextContent(element: HTMLElement | null, text: string): void {
  if (element) {
    element.textContent = text;
  }
}

/**
 * Create element with safe text content
 */
export function createElement(
  tagName: string,
  className: string = '',
  textContent: string = '',
  attributes: ElementAttributes = {}
): HTMLElement {
  const el = document.createElement(tagName);
  if (className) el.className = className;
  if (textContent) el.textContent = textContent;
  for (const [key, value] of Object.entries(attributes)) {
    if (key === 'data' && typeof value === 'object') {
      for (const [dataKey, dataValue] of Object.entries(value as Record<string, string>)) {
        el.dataset[dataKey] = dataValue;
      }
    } else {
      el.setAttribute(key, String(value));
    }
  }
  return el;
}

// ========================================
// Input Validation
// ========================================

/**
 * Validate transfer amount with detailed error messages
 */
export function validateTransferAmount(
  amount: string | number | null | undefined,
  options: AmountValidationOptions = {}
): ValidationResult<number> {
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
 */
export function validateAddress(
  address: string | null | undefined,
  options: AddressValidationOptions = {}
): ValidationResult<string> {
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
 */
export function validatePrivateKey(privateKey: string | null | undefined): ValidationResult<string> {
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
 */
export function validateOrgId(
  orgId: string | null | undefined,
  options: OrgIdValidationOptions = {}
): ValidationResult<string> {
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
const submissionGuards: Map<string, boolean> = new Map();

/**
 * Create a submission guard to prevent duplicate submissions
 */
export function createSubmissionGuard(key: string): SubmissionGuard {
  if (!submissionGuards.has(key)) {
    submissionGuards.set(key, false);
  }
  
  return {
    /** Check if currently submitting */
    isSubmitting: (): boolean => submissionGuards.get(key) ?? false,
    
    /** Start submission (returns false if already submitting) */
    start: (): boolean => {
      if (submissionGuards.get(key)) {
        return false;
      }
      submissionGuards.set(key, true);
      return true;
    },
    
    /** End submission */
    end: (): void => {
      submissionGuards.set(key, false);
    }
  };
}

/**
 * Wrap an async function with submission guard
 */
export function withSubmissionGuard<T extends (...args: any[]) => Promise<any>>(
  key: string,
  fn: T
): (...args: Parameters<T>) => Promise<ReturnType<T> | undefined> {
  const guard = createSubmissionGuard(key);
  
  return async (...args: Parameters<T>): Promise<ReturnType<T> | undefined> => {
    if (!guard.start()) {
      console.warn(`Submission guard triggered: ${key} is already in progress`);
      return undefined;
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
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout: number = DEFAULT_FETCH_TIMEOUT
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(t('error.requestTimeout') || '请求超时，请重试');
    }
    throw error;
  }
}

/**
 * Fetch with retry support
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retries: number = DEFAULT_RETRY_COUNT,
  timeout: number = DEFAULT_FETCH_TIMEOUT
): Promise<Response> {
  let lastError: Error | undefined;
  
  for (let i = 0; i < retries; i++) {
    try {
      return await fetchWithTimeout(url, options, timeout);
    } catch (error: any) {
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
 */
export async function secureFetch(url: string, options: RequestInit = {}): Promise<Response> {
  // Get CSRF token from meta tag if available
  const csrfMeta = document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement | null;
  const csrfToken = csrfMeta?.content || '';
  
  const secureHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
    ...(options.headers as Record<string, string>)
  };
  
  return fetchWithTimeout(url, {
    ...options,
    headers: secureHeaders,
    credentials: 'same-origin'
  });
}

/**
 * Secure fetch with all protections (timeout, retry, CSRF)
 */
export async function secureFetchWithRetry(
  url: string,
  options: RequestInit = {},
  config: SecureFetchConfig = {}
): Promise<Response> {
  const { timeout = DEFAULT_FETCH_TIMEOUT, retries = DEFAULT_RETRY_COUNT } = config;
  
  // Get CSRF token from meta tag if available
  const csrfMeta = document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement | null;
  const csrfToken = csrfMeta?.content || '';
  
  const secureHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
    ...(options.headers as Record<string, string>)
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
const errorHandlers: ErrorHandler[] = [];

/**
 * Register a custom error handler
 */
export function registerErrorHandler(handler: ErrorHandler): () => void {
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
 */
export function reportError(errorInfo: ErrorInfo): void {
  for (const handler of errorHandlers) {
    try {
      handler(errorInfo);
    } catch (e) {
      console.error('Error handler failed:', e);
    }
  }
}

// ========================================
// Error Filter Configuration
// ========================================

/**
 * Patterns for errors that should be silently ignored
 * These are typically browser extension errors or expected network errors
 */
const IGNORED_ERROR_PATTERNS: RegExp[] = [
  // Browser extension errors (Metamask, Phantom, Solana, etc.)
  /Cannot redefine property: ethereum/i,
  /evmAsk\.js/i,
  /solanaActionsContentScript\.js/i,
  /Could not establish connection/i,
  /Receiving end does not exist/i,
  /Extension context invalidated/i,
  /chrome-extension:/i,
  /moz-extension:/i,
  /runtime\.lastError/i,
  /Something went wrong/i,  // Generic extension error
  /Unchecked runtime/i,
  
  // WebSocket connection errors (Vite HMR in dev)
  /WebSocket connection.*failed/i,
  /ws:\/\/localhost/i,
  /token=\w+.*failed/i,  // Vite HMR token errors
  
  // Service Worker fetch errors (expected when offline or during dev)
  /FetchEvent.*network error/i,
  /FetchEvent.*promise was rejected/i,
  /cacheFirst/i,
  /net::ERR_FAILED/i,
  /Failed to fetch/i,
  /NetworkError/i,
  /Load failed/i,
  /sw\.js/i,  // Service worker errors
  
  // API errors (backend not connected during development)
  /\/api\//i,
  /localhost:8081/i,
  /localhost:3000.*\.js\?t=/i,  // Vite cache-busted requests
  
  // Generic network errors
  /请求超时/i,
  /ECONNREFUSED/i,
  /ERR_CONNECTION_REFUSED/i,
  /TypeError: Failed to fetch/i,
];

/**
 * Check if an error should be ignored based on patterns
 * Handles null/undefined inputs gracefully
 */
function shouldIgnoreError(errorStr: string | null | undefined, filenameStr?: string | null): boolean {
  // Handle null/undefined inputs
  const safeErrorStr = String(errorStr || '');
  const safeFilenameStr = String(filenameStr || '');
  
  // Skip empty errors
  if (!safeErrorStr && !safeFilenameStr) {
    return true;
  }
  
  const combined = `${safeErrorStr} ${safeFilenameStr}`;
  return IGNORED_ERROR_PATTERNS.some(pattern => pattern.test(combined));
}

/**
 * Initialize global error boundary
 * Should be called once during app initialization
 */
export function initErrorBoundary(options: ErrorBoundaryOptions = {}): void {
  const { showError: _showError, logToConsole = false } = options; // Default to false to reduce console noise
  // Note: _showError is reserved for future use (e.g., showing error UI to users)
  
  // Global error handler
  window.addEventListener('error', (event: ErrorEvent) => {
    const { message, filename, lineno, colno, error } = event;
    
    // Skip empty/undefined errors
    if (!message && !filename && !error) {
      event.preventDefault();
      return true;
    }
    
    const msgStr = String(message || '');
    const fileStr = String(filename || '');
    
    // Check against ignore patterns
    if (shouldIgnoreError(msgStr, fileStr)) {
      event.preventDefault();
      return true;
    }
    
    // Only log meaningful application errors
    if (logToConsole && msgStr && !msgStr.includes('[object')) {
      console.error('Application error:', { message: msgStr, filename: fileStr, lineno, colno });
    }
    
    // Report to error handlers
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
    
    return false;
  }, true);
  
  // Unhandled promise rejection handler
  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const reasonStr = String(reason || '');
    
    // Check against ignore patterns
    if (shouldIgnoreError(reasonStr)) {
      event.preventDefault();
      return;
    }
    
    // Only log meaningful errors
    if (logToConsole && reasonStr && reasonStr !== '[object Object]') {
      console.error('Unhandled promise rejection:', reason);
    }
    
    // Report to error handlers
    if (reasonStr && reasonStr !== '[object Object]') {
      reportError({
        type: 'unhandledrejection',
        message: reasonStr,
        stack: reason?.stack,
        timestamp: Date.now()
      });
    }
  }, true);
}

/**
 * Wrap async function with error boundary
 */
export function withErrorBoundary<T, Args extends any[]>(
  fn: (...args: Args) => Promise<T>,
  options: ErrorBoundaryWrapperOptions<T> = {}
): (...args: Args) => Promise<T | undefined> {
  const { onError, fallback } = options;
  
  return async (...args: Args): Promise<T | undefined> => {
    try {
      return await fn(...args);
    } catch (error: any) {
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

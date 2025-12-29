/**
 * API Client Core Module
 * 
 * High-performance, type-safe HTTP client for Gateway API communication.
 * Features:
 * - Automatic timeout handling
 * - Retry with exponential backoff
 * - Structured error handling
 * - Request/response interceptors
 * - AbortController support for cancellation
 * - BigInt-safe JSON parsing for large integers
 * 
 * @module services/api
 */

import { API_BASE_URL, DEFAULT_TIMEOUT, DEFAULT_RETRY_COUNT, RETRY_DELAY } from '../config/api';
import { parseBigIntJson } from '../utils/bigIntJson';

// ============================================================================
// Types
// ============================================================================

/**
 * HTTP request methods
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

/**
 * API request options
 */
export interface ApiRequestOptions {
  /** Request method */
  method?: HttpMethod;
  /** Request body (will be JSON stringified) */
  body?: unknown;
  /** Request headers */
  headers?: Record<string, string>;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Number of retry attempts */
  retries?: number;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
  /** Skip error toast on failure */
  silent?: boolean;
  /** Use BigInt-safe JSON parsing (for responses with large integers like PublicKeyNew X/Y) */
  useBigIntParsing?: boolean;
}

/**
 * API response wrapper
 */
export interface ApiResponse<T> {
  /** Response data */
  data: T;
  /** HTTP status code */
  status: number;
  /** Response headers */
  headers: Headers;
  /** Whether request was successful */
  ok: boolean;
}

/**
 * API error structure
 */
export interface ApiError {
  /** Error message */
  message: string;
  /** HTTP status code (if applicable) */
  status?: number;
  /** Error code from backend */
  code?: string;
  /** Original error */
  cause?: Error;
}

/**
 * Backend error response format
 */
export interface BackendErrorResponse {
  error?: string;
  message?: string;
  code?: string;
}

// ============================================================================
// Custom Error Classes
// ============================================================================

/**
 * Custom API Error class with rich error information
 */
export class ApiRequestError extends Error {
  public readonly status?: number;
  public readonly code?: string;
  public readonly isTimeout: boolean;
  public readonly isNetworkError: boolean;
  public readonly isAborted: boolean;
  public readonly response?: Response;
  public cause?: Error;

  constructor(
    message: string,
    options: {
      status?: number;
      code?: string;
      isTimeout?: boolean;
      isNetworkError?: boolean;
      isAborted?: boolean;
      response?: Response;
      cause?: Error;
    } = {}
  ) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = options.status;
    this.code = options.code;
    this.isTimeout = options.isTimeout ?? false;
    this.isNetworkError = options.isNetworkError ?? false;
    this.isAborted = options.isAborted ?? false;
    this.response = options.response;
    
    if (options.cause) {
      this.cause = options.cause;
    }
    
    // Maintain proper stack trace (V8 specific)
    const captureStackTrace = (Error as unknown as { captureStackTrace?: (target: unknown, ctor?: Function) => void })
      .captureStackTrace;
    if (typeof captureStackTrace === 'function') {
      captureStackTrace(this, ApiRequestError);
    }
  }

  /**
   * Create error for timeout
   */
  static timeout(timeoutMs: number): ApiRequestError {
    return new ApiRequestError(`Request timed out after ${timeoutMs}ms`, {
      isTimeout: true,
      code: 'TIMEOUT'
    });
  }

  /**
   * Create error for network failure
   */
  static networkError(cause?: Error): ApiRequestError {
    return new ApiRequestError('Network error - unable to reach server', {
      isNetworkError: true,
      code: 'NETWORK_ERROR',
      cause
    });
  }

  /**
   * Create error for aborted request
   */
  static aborted(): ApiRequestError {
    return new ApiRequestError('Request was aborted', {
      isAborted: true,
      code: 'ABORTED'
    });
  }
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate backoff delay for retry
 */
function getBackoffDelay(attempt: number, baseDelay: number): number {
  // Exponential backoff with jitter
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  const jitter = Math.random() * 0.3 * exponentialDelay;
  return Math.min(exponentialDelay + jitter, 30000); // Max 30 seconds
}

/**
 * Build full URL from path
 */
function buildUrl(path: string, baseUrl: string = API_BASE_URL): string {
  // Handle absolute URLs
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  
  // Remove trailing slash from base
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  
  return `${normalizedBase}${normalizedPath}`;
}

/**
 * Parse error response from backend
 */
async function parseErrorResponse(response: Response): Promise<string> {
  try {
    const contentType = response.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      const data = await response.json() as BackendErrorResponse;
      return data.error || data.message || `HTTP ${response.status}`;
    }
    
    const text = await response.text();
    return text || `HTTP ${response.status}`;
  } catch {
    return `HTTP ${response.status}: ${response.statusText}`;
  }
}

// ============================================================================
// Core API Client
// ============================================================================

/**
 * Make API request with retry and timeout support
 */
async function makeRequest<T>(
  url: string,
  options: ApiRequestOptions = {}
): Promise<ApiResponse<T>> {
  const {
    method = 'GET',
    body,
    headers = {},
    timeout = DEFAULT_TIMEOUT,
    signal
  } = options;

  // Create abort controller for timeout + external cancellation
  const controller = new AbortController();

  const abortFromExternal = () => controller.abort();
  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener('abort', abortFromExternal, { once: true });
    }
  }

  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const requestInit: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...headers
      },
      signal: controller.signal
    };

    // Add body for non-GET requests
    if (body && method !== 'GET') {
      requestInit.body = JSON.stringify(body);
    }

    const response = await fetch(url, requestInit);

    // Clear timeout
    clearTimeout(timeoutId);
    if (signal) {
      signal.removeEventListener('abort', abortFromExternal);
    }

    // Handle error responses
    if (!response.ok) {
      const errorMessage = await parseErrorResponse(response);
      throw new ApiRequestError(errorMessage, {
        status: response.status,
        response
      });
    }

    // Parse JSON response
    // Use BigInt-safe parsing if requested (for responses containing large integers like PublicKeyNew X/Y)
    let data: T;
    if (options.useBigIntParsing) {
      const text = await response.text();
      data = parseBigIntJson<T>(text);
    } else {
      data = await response.json() as T;
    }

    return {
      data,
      status: response.status,
      headers: response.headers,
      ok: true
    };
  } catch (error) {
    // Clear timeout
    clearTimeout(timeoutId);
    if (signal) {
      signal.removeEventListener('abort', abortFromExternal);
    }

    // Handle abort
    if (error instanceof DOMException && error.name === 'AbortError') {
      if (signal?.aborted) {
        throw ApiRequestError.aborted();
      }
      throw ApiRequestError.timeout(timeout);
    }

    // Re-throw ApiRequestError
    if (error instanceof ApiRequestError) {
      throw error;
    }

    // Network error
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw ApiRequestError.networkError(error);
    }

    // Unknown error
    throw new ApiRequestError(
      error instanceof Error ? error.message : 'Unknown error',
      { cause: error instanceof Error ? error : undefined }
    );
  }
}

/**
 * Make API request with automatic retry
 */
async function makeRequestWithRetry<T>(
  url: string,
  options: ApiRequestOptions = {}
): Promise<ApiResponse<T>> {
  const { retries = DEFAULT_RETRY_COUNT, ...requestOptions } = options;
  
  let lastError: ApiRequestError | null = null;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await makeRequest<T>(url, requestOptions);
    } catch (error) {
      if (!(error instanceof ApiRequestError)) {
        throw error;
      }
      
      lastError = error;
      
      // Don't retry on certain conditions
      const shouldNotRetry =
        error.isAborted ||
        (error.status && error.status >= 400 && error.status < 500) ||
        attempt >= retries;
      
      if (shouldNotRetry) {
        throw error;
      }
      
      // Wait before retry
      const delay = getBackoffDelay(attempt, RETRY_DELAY);
      console.warn(`[API] Request failed (attempt ${attempt + 1}/${retries + 1}), retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }
  
  // Should not reach here, but just in case
  throw lastError || new ApiRequestError('Request failed after retries');
}

// ============================================================================
// Public API Client Interface
// ============================================================================

/**
 * API Client with typed request methods
 */
export const apiClient = {
  /**
   * Make GET request
   */
  async get<T>(path: string, options?: Omit<ApiRequestOptions, 'method' | 'body'>): Promise<T> {
    const url = buildUrl(path);
    const response = await makeRequestWithRetry<T>(url, { ...options, method: 'GET' });
    return response.data;
  },

  /**
   * Make POST request
   */
  async post<T>(path: string, body?: unknown, options?: Omit<ApiRequestOptions, 'method' | 'body'>): Promise<T> {
    const url = buildUrl(path);
    const response = await makeRequestWithRetry<T>(url, { ...options, method: 'POST', body });
    return response.data;
  },

  /**
   * Make PUT request
   */
  async put<T>(path: string, body?: unknown, options?: Omit<ApiRequestOptions, 'method' | 'body'>): Promise<T> {
    const url = buildUrl(path);
    const response = await makeRequestWithRetry<T>(url, { ...options, method: 'PUT', body });
    return response.data;
  },

  /**
   * Make DELETE request
   */
  async delete<T>(path: string, options?: Omit<ApiRequestOptions, 'method' | 'body'>): Promise<T> {
    const url = buildUrl(path);
    const response = await makeRequestWithRetry<T>(url, { ...options, method: 'DELETE' });
    return response.data;
  },

  /**
   * Make raw request with full response
   */
  async request<T>(path: string, options?: ApiRequestOptions): Promise<ApiResponse<T>> {
    const url = buildUrl(path);
    return makeRequestWithRetry<T>(url, options);
  }
};

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Check if error is an API error
 */
export function isApiError(error: unknown): error is ApiRequestError {
  return error instanceof ApiRequestError;
}

/**
 * Check if error is a network error
 */
export function isNetworkError(error: unknown): boolean {
  return error instanceof ApiRequestError && error.isNetworkError;
}

/**
 * Check if error is a timeout error
 */
export function isTimeoutError(error: unknown): boolean {
  return error instanceof ApiRequestError && error.isTimeout;
}

/**
 * Get user-friendly error message from error
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    // Handle specific status codes
    if (error.status === 404) {
      return '资源未找到';
    }
    if (error.status === 401) {
      return '身份验证失败';
    }
    if (error.status === 403) {
      return '权限不足';
    }
    if (error.status === 500) {
      return '服务器内部错误';
    }
    if (error.isTimeout) {
      return '请求超时，请检查网络连接';
    }
    if (error.isNetworkError) {
      return '网络连接失败，请检查后端服务是否运行';
    }
    return error.message;
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  return '未知错误';
}

// ============================================================================
// Gateway Health Check Functions
// ============================================================================

/** Health check response */
export interface HealthResponse {
  status: string;
}

/** Gateway connection status */
export interface GatewayStatus {
  isOnline: boolean;
  lastCheck: number;
  errorMessage?: string;
}

// Module-level status cache
let gatewayStatus: GatewayStatus = {
  isOnline: false,
  lastCheck: 0
};

type StatusChangeListener = (status: GatewayStatus) => void;
const statusListeners: Set<StatusChangeListener> = new Set();

function notifyStatusChange(status: GatewayStatus): void {
  statusListeners.forEach((listener) => {
    try {
      listener(status);
    } catch (e) {
      console.error('[Gateway] Status listener error:', e);
    }
  });
}

/**
 * Check if backend Gateway is healthy
 * @returns true if backend is healthy, false otherwise
 */
export async function checkGatewayHealth(): Promise<boolean> {
  try {
    const response = await apiClient.get<HealthResponse>('/health', {
      timeout: 5000,
      retries: 1,
      silent: true
    });

    const isHealthy = response.status === 'ok';

    gatewayStatus = {
      isOnline: isHealthy,
      lastCheck: Date.now(),
      errorMessage: isHealthy ? undefined : 'Unhealthy response from server'
    };
    notifyStatusChange(gatewayStatus);

    return isHealthy;
  } catch (error) {
    gatewayStatus = {
      isOnline: false,
      lastCheck: Date.now(),
      errorMessage: error instanceof ApiRequestError ? error.message : '无法连接到后端服务'
    };
    notifyStatusChange(gatewayStatus);

    if (isNetworkError(error)) {
      console.warn('[Gateway] Health check failed: Network error - is the backend running?');
    } else {
      console.warn('[Gateway] Health check failed:', error);
    }

    return false;
  }
}

/**
 * Get current gateway status
 * @returns Current gateway status (cloned to prevent mutation)
 */
export function getGatewayStatus(): GatewayStatus {
  return { ...gatewayStatus };
}

/**
 * Subscribe to gateway status changes
 * @param listener - Callback function to be called when status changes
 * @returns Unsubscribe function
 */
export function onGatewayStatusChange(listener: StatusChangeListener): () => void {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
}

/**
 * Perform initial health check on application startup
 * @returns true if backend is healthy, false otherwise
 */
export async function performStartupHealthCheck(): Promise<boolean> {
  console.log('[Gateway] Performing startup health check...');

  const isHealthy = await checkGatewayHealth();

  if (isHealthy) {
    console.log('[Gateway] ✓ Backend service is healthy');
  } else {
    console.warn('[Gateway] ✗ Backend service is unavailable');
  }

  return isHealthy;
}

// Export default client
export default apiClient;

/**
 * API Configuration
 * 
 * Centralized configuration for backend Gateway API endpoints.
 * 
 * @module config/api
 */

// ============================================================================
// Environment Configuration
// ============================================================================

/**
 * Get API base URL from environment or default
 * In development: localhost:8080
 * In production: can be configured via environment variables or build-time config
 */
function getApiBaseUrl(): string {
  // Check for custom configuration in window (can be set by build process)
  if (typeof window !== 'undefined' && (window as any).__API_BASE_URL__) {
    return (window as any).__API_BASE_URL__;
  }
  
  // Default to localhost for development
  return 'http://localhost:8080';
}

// ============================================================================
// API Configuration Constants
// ============================================================================

/**
 * API base URL for Gateway server
 */
export const API_BASE_URL = getApiBaseUrl();

/**
 * Default request timeout in milliseconds
 */
export const DEFAULT_TIMEOUT = 10000; // 10 seconds

/**
 * Default retry count for failed requests
 */
export const DEFAULT_RETRY_COUNT = 2;

/**
 * Retry delay in milliseconds
 */
export const RETRY_DELAY = 1000; // 1 second

// ============================================================================
// API Endpoints
// ============================================================================

/**
 * API endpoint paths (relative to base URL)
 */
export const API_ENDPOINTS = {
  // Health check
  HEALTH: '/health',
  
  // BootNode endpoints
  GROUP_INFO: (groupId: string) => `/api/v1/group/${groupId}`,
  
  // AssignNode endpoints (to be implemented)
  USER_NEW_ADDRESS: '/api/v1/assign/user-new-address',
  USER_FLOW: '/api/v1/assign/user-flow',
  USER_TX: '/api/v1/assign/user-tx',
  USER_REONLINE: '/api/v1/assign/user-reonline',
  ASSIGN_GROUP_INFO: (groupId: string) => `/api/v1/assign/group/${groupId}`,
  ACCOUNT_UPDATE: '/api/v1/assign/account-update',
  TXCER_CHANGE: '/api/v1/assign/txcer-change',
  
  // AggrNode endpoints (to be implemented)
  TXCER: '/api/v1/aggr/txcer',
  
  // ComNode endpoints (to be implemented)
  QUERY_ADDRESS: '/api/v1/com/query-address',
  QUERY_ADDRESS_GROUP: '/api/v1/com/query-address-group',
  SUBMIT_NOGUARGROUP_TX: '/api/v1/com/submit-noguargroup-tx',
  UTXO_CHANGE: '/api/v1/com/utxo-change'
} as const;

// ============================================================================
// Type Exports
// ============================================================================

/**
 * API endpoint keys type
 */
export type ApiEndpointKey = keyof typeof API_ENDPOINTS;

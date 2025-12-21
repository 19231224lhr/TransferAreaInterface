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
  GROUPS_LIST: '/api/v1/groups',  // 列出所有担保组织
  GROUP_INFO: (groupId: string) => `/api/v1/groups/${groupId}`,  // 查询指定组织详情
  
  // AssignNode endpoints (动态路由: /api/v1/{groupID}/assign/*)
  ASSIGN_HEALTH: (groupId: string) => `/api/v1/${groupId}/assign/health`,
  ASSIGN_NEW_ADDRESS: (groupId: string) => `/api/v1/${groupId}/assign/new-address`,
  ASSIGN_FLOW_APPLY: (groupId: string) => `/api/v1/${groupId}/assign/flow-apply`,
  ASSIGN_SUBMIT_TX: (groupId: string) => `/api/v1/${groupId}/assign/submit-tx`,
  ASSIGN_RE_ONLINE: (groupId: string) => `/api/v1/${groupId}/assign/re-online`,
  ASSIGN_GROUP_INFO: (groupId: string) => `/api/v1/${groupId}/assign/group-info`,
  ASSIGN_ACCOUNT_UPDATE: (groupId: string) => `/api/v1/${groupId}/assign/account-update`,
  ASSIGN_TXCER_CHANGE: (groupId: string) => `/api/v1/${groupId}/assign/txcer-change`,
  
  // AggrNode endpoints (动态路由: /api/v1/{groupID}/aggr/*)
  AGGR_TXCER: (groupId: string) => `/api/v1/${groupId}/aggr/txcer`,
  
  // ComNode endpoints (动态路由: /api/v1/{committeeID}/com/*)
  COM_QUERY_ADDRESS: (committeeId: string) => `/api/v1/${committeeId}/com/query-address`,
  COM_QUERY_ADDRESS_GROUP: (committeeId: string) => `/api/v1/${committeeId}/com/query-address-group`,
  COM_SUBMIT_NOGUARGROUP_TX: (committeeId: string) => `/api/v1/${committeeId}/com/submit-noguargroup-tx`,
  COM_UTXO_CHANGE: (committeeId: string) => `/api/v1/${committeeId}/com/utxo-change`
} as const;

// ============================================================================
// Type Exports
// ============================================================================

/**
 * API endpoint keys type
 */
export type ApiEndpointKey = keyof typeof API_ENDPOINTS;

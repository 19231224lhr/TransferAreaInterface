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
  COMMITTEE_ENDPOINT: '/api/v1/committee/endpoint',  // 查询 ComNode 端点

  // AssignNode endpoints (动态路由: /api/v1/{groupID}/assign/*)
  ASSIGN_HEALTH: (groupId: string) => `/api/v1/${groupId}/assign/health`,
  ASSIGN_NEW_ADDRESS: (groupId: string) => `/api/v1/${groupId}/assign/new-address`,
  ASSIGN_UNBIND_ADDRESS: (groupId: string) => `/api/v1/${groupId}/assign/unbind-address`,
  ASSIGN_CAPSULE_GENERATE: (groupId: string) => `/api/v1/${groupId}/assign/capsule/generate`,
  ASSIGN_FLOW_APPLY: (groupId: string) => `/api/v1/${groupId}/assign/flow-apply`,
  ASSIGN_SUBMIT_TX: (groupId: string) => `/api/v1/${groupId}/assign/submit-tx`,
  ASSIGN_TX_STATUS: (groupId: string, txId: string) => `/api/v1/${groupId}/assign/tx-status/${txId}`,
  ASSIGN_RE_ONLINE: (groupId: string) => `/api/v1/${groupId}/assign/re-online`,
  ASSIGN_GROUP_INFO: (groupId: string) => `/api/v1/${groupId}/assign/group-info`,
  ASSIGN_ACCOUNT_UPDATE: (groupId: string) => `/api/v1/${groupId}/assign/account-update`,
  ASSIGN_TXCER_CHANGE: (groupId: string) => `/api/v1/${groupId}/assign/txcer-change`,
  /** 跨组织TXCer轮询 - 接收从其他组织发送过来的TXCer */
  ASSIGN_CROSS_ORG_TXCER: (groupId: string) => `/api/v1/${groupId}/assign/poll-cross-org-txcers`,

  // AggrNode endpoints (动态路由: /api/v1/{groupID}/aggr/*)
  AGGR_TXCER: (groupId: string) => `/api/v1/${groupId}/aggr/txcer`,

  // ComNode endpoints (static paths for committee-level operations)
  COM_HEALTH: '/api/v1/com/health',
  COM_QUERY_ADDRESS: '/api/v1/com/query-address',
  COM_QUERY_ADDRESS_GROUP: '/api/v1/com/query-address-group',
  COM_REGISTER_ADDRESS: '/api/v1/com/register-address',
  COM_CAPSULE_GENERATE: '/api/v1/com/capsule/generate',
  COM_PUBLIC_KEY: '/api/v1/com/public-key',
  COM_SUBMIT_NOGUARGROUP_TX: '/api/v1/com/submit-noguargroup-tx',
  COM_UTXO_CHANGE: (committeeId: string) => `/api/v1/${committeeId}/com/utxo-change`,
  ORG_PUBLIC_KEY: '/api/v1/org/publickey'
} as const;

// ============================================================================
// Type Exports
// ============================================================================

/**
 * API endpoint keys type
 */
export type ApiEndpointKey = keyof typeof API_ENDPOINTS;

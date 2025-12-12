# Requirements Document

## Introduction

本文档定义了 PanguPay 应用的代码优化需求，主要涵盖三个方面：
1. 循环依赖修复（security.ts 和 i18n 模块）
2. Service Worker 缓存策略优化（区分静态资源和 API 请求）
3. 错误边界优化（减少控制台错误噪音，改进错误过滤机制）

## Glossary

- **Security Module**: `js/utils/security.ts` - 提供安全相关工具函数的模块
- **i18n Module**: `js/i18n/index.js` - 国际化翻译模块
- **Service Worker**: `sw.js` - 提供离线支持和缓存功能的 Worker
- **Error Boundary**: 全局错误捕获和处理机制
- **Cache-First Strategy**: 优先从缓存获取资源的策略
- **Network-First Strategy**: 优先从网络获取资源的策略
- **Browser Extension Errors**: 浏览器扩展（如 MetaMask、Phantom）产生的错误

## Requirements

### Requirement 1

**User Story:** As a developer, I want the security module to not have circular dependencies with i18n, so that the application loads reliably without import order issues.

#### Acceptance Criteria

1. WHEN the security module needs translation functions THEN the Security_Module SHALL obtain translations via lazy evaluation from window.t without direct import of i18n module
2. WHEN the i18n module is not yet loaded THEN the Security_Module SHALL provide fallback text for all validation messages
3. WHEN the application initializes THEN the Security_Module SHALL not cause import errors due to circular dependencies

### Requirement 2

**User Story:** As a user, I want the Service Worker to use appropriate caching strategies for different resource types, so that I get fresh API data while still benefiting from cached static assets.

#### Acceptance Criteria

1. WHEN the Service Worker intercepts an API request (paths starting with /api/) THEN the Service_Worker SHALL use Network-First strategy
2. WHEN the Service Worker intercepts a static asset request (CSS, images, fonts) THEN the Service_Worker SHALL use Cache-First strategy
3. WHEN the Service Worker intercepts a JavaScript file request THEN the Service_Worker SHALL use Network-First strategy to ensure fresh code
4. WHEN the Service Worker intercepts Vite development requests (HMR, cache-busted URLs) THEN the Service_Worker SHALL bypass caching entirely
5. WHEN a network request fails THEN the Service_Worker SHALL return cached response as fallback without throwing errors
6. WHEN the Service Worker encounters fetch errors THEN the Service_Worker SHALL return graceful error responses instead of rejecting promises

### Requirement 3

**User Story:** As a developer, I want the error boundary to filter out irrelevant errors intelligently, so that I can focus on real application errors without console noise.

#### Acceptance Criteria

1. WHEN a browser extension error occurs (MetaMask, Phantom, Solana) THEN the Error_Boundary SHALL silently suppress the error without logging
2. WHEN a Vite HMR or development-related error occurs THEN the Error_Boundary SHALL silently suppress the error
3. WHEN a Service Worker fetch error occurs during development THEN the Error_Boundary SHALL silently suppress the error
4. WHEN a WebSocket connection error occurs (Vite dev server) THEN the Error_Boundary SHALL silently suppress the error
5. WHEN a genuine application error occurs THEN the Error_Boundary SHALL log and report the error appropriately
6. WHEN the error boundary initializes THEN the Error_Boundary SHALL use a configurable pattern-based filter system
7. WHEN duplicate error suppression handlers exist in app.js THEN the Application SHALL remove redundant handlers and rely on centralized error boundary

### Requirement 4

**User Story:** As a user, I want the application to load without showing irrelevant error messages in the console, so that I have a clean development experience.

#### Acceptance Criteria

1. WHEN the page loads or refreshes THEN the Application SHALL not display browser extension errors in console
2. WHEN the page loads THEN the Application SHALL not display Service Worker fetch errors for development resources
3. WHEN the page loads THEN the Application SHALL not display WebSocket connection errors from Vite HMR

# Technology Stack

## Backend

- **Language**: Go 1.18+
- **Module**: `TransferAreaInterface`
- **Cryptography**: ECDSA P-256 (secp256r1) elliptic curve
- **Serialization**: JSON for struct serialization and hashing

## Frontend

- **Build Tool**: Vite 5.4 (ES Module bundler with HMR)
- **Language**: TypeScript 5.9 + JavaScript (渐进式迁移)
- **Framework**: Vanilla HTML/CSS/JavaScript (no framework)
- **Crypto API**: WebCrypto API for client-side key generation and AES-256-GCM encryption
- **Storage**: localStorage for account persistence (with encrypted private key support)
- **Design**: Glassmorphism style with CSS gradients and backdrop-filter
- **Internationalization**: Built-in i18n system supporting Chinese (zh-CN) and English (en)
- **Offline Support**: Service Worker with Cache-First strategy

## Development Server

- **Primary**: Vite dev server (port 3000, with HMR)
- **Legacy**: Go HTTP server (port 8081, for API testing only)

## Common Commands

### Start Development Server (Recommended)

```bash
npm install        # Install dependencies (first time only)
npm run dev        # Start Vite dev server with HMR
```

Access at: http://localhost:3000/

### Build for Production

```bash
npm run build      # Build to dist/ directory (runs postbuild automatically)
npm run preview    # Preview production build
```

**Build Process:**
1. Vite builds the application to `dist/`
2. `postbuild` script runs automatically (`node scripts/copy-sw.js`)
3. Service Worker (`sw.js`) is copied to `dist/` for offline support

### Type Checking

```bash
npm run typecheck  # Run TypeScript type checking (TS files only)
```

**Note:** JavaScript files are excluded from type checking (`checkJs: false`) to prevent false errors during gradual migration.

### Run Go Tests (if any)

```bash
go test ./...
```

### Build Backend

```bash
go build ./backend/cmd/webserver
```

### Backend Testing Tools

```bash
# Serialization testing
go run ./backend/test_serialize

# Transaction verification
go run ./backend/verify_tx
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/account/new` | POST | Create new account with keypair |
| `/api/keys/from-priv` | POST | Derive account from private key |

## Key Libraries/Dependencies

### Frontend (npm)
- `vite` - Build tool and dev server
- `typescript` - Type checking and compilation

### Backend (Go)
- Standard Go crypto packages (`crypto/ecdsa`, `crypto/elliptic`, `crypto/sha256`)
- No external Go dependencies (pure stdlib)

## TypeScript Configuration

### Module System
- **Target**: ES2020
- **Module**: ESNext with bundler resolution
- **Strict Mode**: Disabled (for gradual migration)
- **JS Support**: 
  - `tsconfig.json`: `allowJs: true`, `checkJs: false` (TS files only)
  - `jsconfig.json`: `checkJs: false` (no type checking for JS files)

### Key Files
- `tsconfig.json` - TypeScript compiler options (TS files only)
- `jsconfig.json` - JavaScript configuration (checkJs disabled to prevent false errors)
- `js/globals.d.ts` - Global type declarations
- `js/types.js` - JSDoc type definitions

### TypeScript Modules (已迁移)

**Core (核心模块):** 🆕
- `js/core/namespace.ts` - PanguPay 命名空间定义
- `js/core/eventDelegate.ts` - 全局事件委托系统
- `js/core/types.ts` - 命名空间类型定义
- `js/core/index.ts` - 模块导出

**Bootstrap (启动模块):** 🆕
- `js/bootstrap.ts` - 应用启动和生命周期管理
- `js/router.ts` - 路由系统 (从 router.js 迁移)

**Config:**
- `js/config/constants.ts` - 配置常量和类型定义
- `js/config/pageTemplates.ts` - 页面模板配置

**Utils:**
- `js/utils/crypto.ts` - 加密/哈希/签名工具
- `js/utils/keyEncryption.ts` - 私钥加密核心逻辑
- `js/utils/keyEncryptionUI.ts` - 私钥加密 UI 集成
- `js/utils/security.ts` - 安全工具 (XSS, CSRF, 验证)
- `js/utils/storage.ts` - 本地存储管理
- `js/utils/statePersistence.ts` - 🆕 Store 状态持久化
- `js/utils/view.ts` - 🆕 安全 DOM 渲染 (lit-html)
- `js/utils/accessibility.ts` - 无障碍工具
- `js/utils/loading.ts` - 加载状态管理
- `js/utils/formValidator.ts` - 表单验证器
- `js/utils/enhancedRouter.ts` - 增强路由系统
- `js/utils/lazyLoader.ts` - 懒加载管理
- `js/utils/serviceWorker.ts` - Service Worker 管理
- `js/utils/transaction.ts` - 事务操作和自动保存
- `js/utils/reactive.ts` - 响应式 UI 绑定系统
- `js/utils/screenLock.ts` - 🆕 屏幕锁定功能
- `js/utils/templateLoader.ts` - 模板加载器
- `js/utils/pageManager.ts` - 页面管理器

**Services:**
- `js/services/account.ts` - 账户服务
- `js/services/transaction.ts` - 交易构建服务
- `js/services/transfer.ts` - 转账表单逻辑
- `js/services/transferDraft.ts` - 转账草稿持久化
- `js/services/wallet.ts` - 🆕 钱包操作 (响应式绑定)

**Pages (响应式绑定):**
- `js/pages/login.ts` - 🆕 登录页面
- `js/pages/import.ts` - 🆕 导入钱包页面
- `js/pages/joinGroup.ts` - 🆕 加入组织页面
- `js/pages/setPassword.ts` - 🆕 设置密码页面
- `js/pages/entry.ts` - 🆕 钱包入口页面

**UI Components (响应式绑定):**
- `js/ui/header.ts` - 🆕 头部组件
- `js/ui/modal.ts` - 🆕 模态对话框
- `js/ui/profile.ts` - 🆕 用户资料页面

### JavaScript Modules (保持现状)

**Pages:** (不需要迁移)
- `js/pages/welcome.js` - 欢迎页面 (简单展示)
- `js/pages/newUser.js` - 新用户注册
- `js/pages/main.js` - 主钱包页面 (调用其他模块)
- `js/pages/history.js` - 交易历史
- `js/pages/groupDetail.js` - 组织详情

**UI Components:** (不需要迁移)
- `js/ui/footer.js` - 页脚组件 (静态内容)
- `js/ui/charts.js` - 图表组件 (Canvas 操作)
- `js/ui/networkChart.js` - 网络图表 (Canvas 操作)
- `js/ui/theme.js` - 主题管理
- `js/ui/walletStruct.js` - 钱包结构 UI
- `js/ui/toast.js` - Toast 提示

**Services:** (不需要迁移)
- `js/services/walletStruct.js` - 钱包结构显示
- `js/services/recipient.js` - 收款人管理

**Utils:** (不需要迁移)
- `js/utils/store.js` - 状态管理
- `js/utils/toast.js` - Toast 提示
- `js/utils/helpers.js` - 通用辅助函数
- `js/utils/eventUtils.js` - 事件管理
- `js/utils/performanceMode.js` - 性能优化模式
- `js/utils/performanceMonitor.js` - 性能监控

**i18n:** (纯数据文件)
- `js/i18n/*.js` - 国际化系统

## PanguPay Namespace System (命名空间系统) 🆕

### Overview

项目使用统一的 `window.PanguPay` 命名空间暴露所有公共 API，减少全局变量污染。

### Core Files

- `js/core/namespace.ts` - 命名空间定义和初始化
- `js/core/types.ts` - TypeScript 类型定义
- `js/core/eventDelegate.ts` - 事件委托系统
- `js/core/index.ts` - 模块导出

### Namespace Structure

```typescript
window.PanguPay = {
  router: { routeTo, router, showCard, initRouter },
  i18n: { t, setLanguage, getCurrentLanguage, updatePageTranslations },
  theme: { loadThemeSetting, initThemeSelector },
  account: { generateKeyPair, deriveAccountId, deriveAddress },
  storage: { loadUser, saveUser, clearUser, ... },
  wallet: { renderWallet, refreshOrgPanel, refreshSrcAddrList, ... },
  ui: { showToast, showErrorToast, showModal, closeModal, ... },
  crypto: { sha256Hex, signData, verifySignature, ... },
  charts: { updateWalletChart, cleanupWalletChart, ... }
}
```

### Usage

```typescript
// ✅ 新代码使用命名空间
window.PanguPay.router.routeTo('#/main');
window.PanguPay.ui.showToast('操作成功');
window.PanguPay.i18n.t('common.confirm');

// ❌ 避免直接使用 window（仅兼容旧代码）
window.routeTo('#/main');
```

---

## Event Delegation System (事件委托系统) 🆕

### Overview

使用 `data-action` 属性实现全局事件委托，替代内联 `onclick`，提高 CSP 合规性。

### Core API

| Function | Purpose |
|----------|---------|
| `registerAction(name, handler)` | 注册动作处理器 |
| `unregisterAction(name)` | 注销动作处理器 |
| `initEventDelegation()` | 初始化事件委托（自动调用） |

### Usage

**HTML (动态生成):**
```html
<button data-action="showUtxoDetail" data-addr="xxx" data-key="yyy">详情</button>
```

**JavaScript:**
```typescript
import { registerAction } from './core';

registerAction('showUtxoDetail', (el, data) => {
  // data = { addr: 'xxx', key: 'yyy' }
  showUtxoDetail(data.addr, data.key);
});
```

### Benefits

- ✅ CSP 合规（无内联脚本）
- ✅ 自动处理动态内容
- ✅ 集中管理事件处理器
- ✅ 类型安全的参数传递

---

## State Persistence System (状态持久化系统) 🆕

### Overview

解决状态管理"脑裂"问题：Store 是唯一的事实来源，localStorage 仅用于持久化。

### Core File

`js/utils/statePersistence.ts`

### Key Functions

| Function | Purpose |
|----------|---------|
| `initUserPersistence()` | 启动 Store → localStorage 自动同步 |
| `flushUserPersistence()` | 立即刷新持久化（用于 beforeunload） |
| `stopUserPersistence()` | 停止持久化监听 |

### Design Principles

1. **Single Source of Truth**: Store 是唯一的事实来源
2. **Hydration Once**: 启动时从 localStorage 水合一次
3. **Debounced Persistence**: 防抖写入，避免频繁 I/O
4. **Lifecycle Hooks**: beforeunload/visibilitychange 时刷新

### Usage

```typescript
// 在 bootstrap.ts 中初始化
import { initUserPersistence } from './utils/statePersistence';

// 1. 从 localStorage 水合 Store（一次性）
const hydratedUser = initUserStateFromStorage();

// 2. 启动自动持久化
initUserPersistence();

// 之后所有状态变更通过 Store
store.setState({ user: newUser });
// localStorage 自动同步（防抖 200ms）
```

---

## View Utilities (视图工具) 🆕

### Overview

封装 `lit-html` 提供安全的 DOM 渲染，替代不安全的 `innerHTML` 拼接。

### Core File

`js/utils/view.ts`

### Key Exports

| Export | Purpose |
|--------|---------|
| `html` | lit-html 模板标签 |
| `svg` | SVG 模板标签 |
| `render` | 渲染到容器 |
| `nothing` | 空内容占位符 |
| `renderInto(target, content)` | 安全渲染封装 |

### Usage

```typescript
import { html, renderInto } from './utils/view';

// 安全渲染（自动转义）
renderInto(container, html`
  <div class="card">
    <h2>${userName}</h2>
    <p>${userBio}</p>
    <button data-action="edit">编辑</button>
  </div>
`);
```

### Benefits

- ✅ 自动 XSS 防护（变量自动转义）
- ✅ 高效 DOM 更新（差异更新）
- ✅ 类型安全的模板
- ✅ 与事件委托系统配合使用

---

## Reactive UI Binding System (响应式 UI 绑定系统)

### Overview

项目使用自研的轻量级响应式绑定系统 (`js/utils/reactive.ts`)，实现声明式 UI 更新。

### Core Features

- **状态驱动**: UI 是状态的纯函数，状态变化自动同步 DOM
- **声明式绑定**: 通过配置定义状态与 DOM 的映射关系
- **动画支持**: 内置动画序列和并行动画 API
- **类型安全**: 完整的 TypeScript 类型定义

### Key Functions

| Function | Purpose |
|----------|---------|
| `createReactiveState(initial, bindings)` | 创建响应式状态对象 |
| `state.set(partial)` | 更新状态，自动同步 UI |
| `state.get()` | 获取当前状态 |
| `runAnimationSequence(config)` | 执行动画序列 |
| `runParallelAnimations(configs)` | 并行执行多个动画 |
| `resetWalletBindings()` | 重置钱包模块绑定标记 |

### Binding Types

| Type | Description | Example |
|------|-------------|---------|
| `text` | 设置 textContent | `{ selector: '#name', type: 'text' }` |
| `html` | 设置 innerHTML | `{ selector: '#content', type: 'html' }` |
| `visible` | 控制 hidden class | `{ selector: '#loader', type: 'visible' }` |
| `class` | 切换指定 class | `{ selector: '#card', type: 'class', name: 'active' }` |
| `attr` | 设置/移除属性 | `{ selector: '#input', type: 'attr', name: 'disabled' }` |
| `prop` | 设置 DOM 属性 | `{ selector: '#btn', type: 'prop', name: 'disabled' }` |
| `value` | 设置表单元素值 | `{ selector: '#input', type: 'value' }` |

### Usage Example

```typescript
import { createReactiveState } from '../utils/reactive';

interface PageState {
  isLoading: boolean;
  errorMessage: string;
}

const bindings = {
  isLoading: [
    { selector: '#loader', type: 'visible' },
    { selector: '#submitBtn', type: 'prop', name: 'disabled' }
  ],
  errorMessage: [
    { selector: '#error', type: 'text' }
  ]
};

const state = createReactiveState<PageState>(
  { isLoading: false, errorMessage: '' },
  bindings
);

// 更新状态，UI 自动同步
state.set({ isLoading: true });
state.set({ isLoading: false, errorMessage: '操作失败' });
```

## Internationalization (i18n)

### Supported Languages

- **Chinese (Simplified)**: `zh-CN` (default)
- **English**: `en`

### Implementation

- **Storage Key**: `appLanguage` in localStorage
- **Translation Function**: `t(key, params)` for dynamic text
- **HTML Attributes**: 
  - `data-i18n` for text content
  - `data-i18n-placeholder` for input placeholders
  - `data-i18n-title` for tooltips and titles
- **Auto-update**: `updatePageTranslations()` called on route changes
- **Language Selector**: Available in Profile page with flag emojis (🇨🇳/🇺🇸)

### Key Functions

| Function | Purpose |
|----------|---------|
| `t(key, params)` | Get translated text with optional parameter substitution |
| `setLanguage(lang)` | Change current language and update UI |
| `getCurrentLanguage()` | Get current language code |
| `updatePageTranslations()` | Update all elements with i18n attributes |

### Translation Keys Structure (260+ keys)

- `common.*` - Common UI elements (buttons, labels)
- `header.*` - Header and navigation
- `welcome.*` - Welcome/landing page
- `wallet.*` - Wallet management
- `transfer.*` - Transaction forms
- `modal.*` - Modal dialogs
- `toast.*` - Toast notifications
- `profile.*` - User profile settings
- `validation.*` - Form validation messages
- `error.*` - Error messages
- `a11y.*` - Accessibility labels

## Security Features

### Private Key Encryption
- **Algorithm**: AES-256-GCM with PBKDF2 key derivation
- **Iterations**: 100,000 (anti-brute-force)
- **Salt**: Random 16-byte salt per encryption
- **IV**: Random 12-byte initialization vector per encryption
- **Core Module**: `js/utils/keyEncryption.ts`
- **UI Integration**: `js/utils/keyEncryptionUI.ts`

**Key Functions:**
- `encryptPrivateKey(privHex, password)` - Encrypt private key with password
- `decryptPrivateKey(encryptedData, password)` - Decrypt private key
- `saveEncryptedKey(accountId, encryptedData)` - Save to localStorage
- `getPrivateKey(accountId, password)` - Retrieve and decrypt
- `migrateToEncrypted(user, password)` - Migrate legacy plaintext keys
- `checkEncryptionStatus(user)` - Check if migration needed

**UI Functions:**
- `showPasswordPrompt(options)` - Modal password input
- `encryptAndSavePrivateKey(accountId, privHex)` - Full encryption workflow
- `getDecryptedPrivateKey(accountId)` - Full decryption workflow with prompt
- `checkAndPromptMigration()` - Auto-migration on app start

### XSS Protection
- `escapeHtml()` - HTML entity encoding
- `createElement()` - Safe DOM creation
- `setTextContent()` - Safe text setting

### CSRF Protection
- `secureFetch()` - Auto-adds CSRF token
- `secureFetchWithRetry()` - With timeout and retry

### Input Validation
- `validateTransferAmount()` - Amount validation
- `validateAddress()` - Address format validation
- `validatePrivateKey()` - Private key validation
- `validateOrgId()` - Organization ID validation

## Accessibility (A11y)

### Features
- ARIA labels and roles
- Keyboard navigation support
- Focus trap for modals
- Screen reader announcements
- Skip links
- Color contrast checking

### Key Functions
- `createFocusTrap()` - Modal focus management
- `announce()` - Screen reader announcements
- `enableKeyboardNavigation()` - Arrow key navigation
- `initSkipLinks()` - Skip link initialization

## Development Guidelines (开发规范)

### TypeScript Migration Rules (TypeScript 迁移规则)

**CRITICAL: All new code MUST be written in TypeScript (.ts files)**

项目正在从 JavaScript 逐步迁移到 TypeScript。为确保代码质量和类型安全，所有新开发的代码必须遵循以下规则：

#### 1. 新文件创建规则

**✅ MUST DO (必须遵守):**
- 所有新创建的模块文件必须使用 `.ts` 扩展名
- 所有新创建的工具函数必须使用 TypeScript
- 所有新创建的服务模块必须使用 TypeScript
- 所有新创建的配置文件必须使用 TypeScript

**❌ DO NOT (禁止):**
- 不要创建新的 `.js` 文件（除非是临时测试或特殊情况）
- 不要在新代码中使用 `any` 类型（除非确实无法推断类型）
- 不要忽略 TypeScript 编译错误

**Examples (示例):**
```typescript
// ✅ GOOD: 新建工具模块
// js/utils/newFeature.ts
export interface NewFeatureConfig {
  enabled: boolean;
  timeout: number;
}

export function createNewFeature(config: NewFeatureConfig): void {
  // Implementation
}

// ❌ BAD: 不要创建新的 .js 文件
// js/utils/newFeature.js  // 错误！
```

#### 2. 现有 JavaScript 文件修改规则

**When modifying existing .js files (修改现有 JS 文件时):**
- 可以继续使用 JavaScript 语法
- 建议添加 JSDoc 类型注释以提供类型提示
- 如果大幅修改（超过 50% 代码），考虑迁移到 TypeScript

**Example (示例):**
```javascript
// js/pages/example.js (现有文件)
/**
 * @param {string} userId - User ID
 * @param {number} amount - Transfer amount
 * @returns {Promise<boolean>} Success status
 */
export async function processTransfer(userId, amount) {
  // Implementation
}
```

#### 3. 类型定义规则

**Type definitions (类型定义):**
- 所有公共接口必须定义 TypeScript 接口
- 复杂数据结构必须定义类型
- 使用 `js/types.js` 或创建专门的 `.d.ts` 文件定义共享类型

**Example (示例):**
```typescript
// js/types/api.ts
export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}

export interface TransferRequest {
  fromAddress: string;
  toAddress: string;
  amount: number;
  currency: 'PGC' | 'BTC' | 'ETH';
}
```

### API Integration Guidelines (API 对接规范)

**CRITICAL: All API integration code MUST be isolated in dedicated TypeScript modules**

为了保持代码的可维护性和可测试性，所有前后端 API 对接代码必须遵循以下规范：

#### 1. API 模块隔离原则

**✅ MUST DO (必须遵守):**
- 创建专门的 API 客户端模块（推荐路径：`js/api/` 目录）
- 每个 API 端点或功能域创建独立的 TypeScript 文件
- 使用统一的请求/响应类型定义
- 使用 `secureFetch` 或 `secureFetchWithRetry` 进行所有 API 调用

**❌ DO NOT (禁止):**
- 不要在 UI 组件中直接调用 `fetch`
- 不要在多个文件中重复 API 调用逻辑
- 不要硬编码 API 端点 URL
- 不要忽略错误处理

#### 2. 推荐的 API 模块结构

```
js/
├── api/                    # API 客户端模块目录（新建）
│   ├── client.ts          # 基础 API 客户端配置
│   ├── account.ts         # 账户相关 API
│   ├── transaction.ts     # 交易相关 API
│   ├── wallet.ts          # 钱包相关 API
│   └── types.ts           # API 类型定义
```

#### 3. API 客户端实现示例

**Base API Client (基础客户端):**
```typescript
// js/api/client.ts
import { secureFetchWithRetry } from '../utils/security';

export const API_BASE_URL = '/api';

export interface APIConfig {
  timeout?: number;
  retries?: number;
  headers?: Record<string, string>;
}

export class APIClient {
  private baseURL: string;
  private defaultConfig: APIConfig;

  constructor(baseURL: string = API_BASE_URL, config: APIConfig = {}) {
    this.baseURL = baseURL;
    this.defaultConfig = {
      timeout: 10000,
      retries: 3,
      ...config
    };
  }

  async get<T>(endpoint: string, config?: APIConfig): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const response = await secureFetchWithRetry(url, {
      method: 'GET'
    }, { ...this.defaultConfig, ...config });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }
    
    return response.json();
  }

  async post<T>(endpoint: string, data: any, config?: APIConfig): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const response = await secureFetchWithRetry(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    }, { ...this.defaultConfig, ...config });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }
    
    return response.json();
  }
}

export const apiClient = new APIClient();
```

**Domain-Specific API Module (特定功能域 API):**
```typescript
// js/api/account.ts
import { apiClient } from './client';
import type { APIResponse } from './types';

export interface CreateAccountRequest {
  publicKey: {
    x: string;
    y: string;
  };
}

export interface CreateAccountResponse {
  accountId: string;
  address: string;
}

export async function createAccount(
  request: CreateAccountRequest
): Promise<APIResponse<CreateAccountResponse>> {
  return apiClient.post<APIResponse<CreateAccountResponse>>(
    '/account/new',
    request
  );
}

export async function getAccountInfo(
  accountId: string
): Promise<APIResponse<any>> {
  return apiClient.get<APIResponse<any>>(
    `/account/${accountId}`
  );
}
```

**API Types Definition (API 类型定义):**
```typescript
// js/api/types.ts
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp?: number;
}

export interface PaginatedResponse<T> extends APIResponse<T[]> {
  page: number;
  pageSize: number;
  total: number;
}

export interface APIError {
  code: string;
  message: string;
  details?: any;
}
```

#### 4. 在业务代码中使用 API

**✅ GOOD (正确示例):**
```typescript
// js/services/account.ts
import { createAccount } from '../api/account';
import type { CreateAccountRequest } from '../api/account';

export async function registerNewAccount(pubX: string, pubY: string) {
  try {
    const request: CreateAccountRequest = {
      publicKey: { x: pubX, y: pubY }
    };
    
    const response = await createAccount(request);
    
    if (response.success && response.data) {
      return response.data;
    } else {
      throw new Error(response.error || 'Account creation failed');
    }
  } catch (error) {
    console.error('Failed to create account:', error);
    throw error;
  }
}
```

**❌ BAD (错误示例):**
```typescript
// js/services/account.ts
// 不要直接在业务代码中调用 fetch！
export async function registerNewAccount(pubX: string, pubY: string) {
  const response = await fetch('/api/account/new', {  // ❌ 错误！
    method: 'POST',
    body: JSON.stringify({ publicKey: { x: pubX, y: pubY } })
  });
  return response.json();
}
```

#### 5. API 模块的优势

**Benefits (优势):**
- ✅ **类型安全**: 所有 API 请求和响应都有明确的类型定义
- ✅ **集中管理**: API 端点和配置集中在一个地方，易于维护
- ✅ **错误处理**: 统一的错误处理逻辑，减少重复代码
- ✅ **可测试性**: 可以轻松 mock API 模块进行单元测试
- ✅ **安全性**: 自动应用 CSRF 保护、超时控制、重试机制
- ✅ **可维护性**: API 变更只需修改 API 模块，不影响业务代码

#### 6. Migration Checklist (迁移检查清单)

When adding new API integration (添加新的 API 对接时):
- [ ] 在 `js/api/` 目录创建对应的 TypeScript 文件
- [ ] 定义请求和响应的 TypeScript 接口
- [ ] 使用 `apiClient` 或 `secureFetch` 进行 API 调用
- [ ] 添加完整的错误处理逻辑
- [ ] 在业务代码中导入并使用 API 模块
- [ ] 添加 JSDoc 注释说明 API 用途
- [ ] 测试 API 调用是否正常工作

### Code Review Checklist (代码审查清单)

Before submitting code (提交代码前检查):
- [ ] 新文件是否使用 `.ts` 扩展名？
- [ ] 是否定义了所有必要的类型接口？
- [ ] API 调用是否隔离在专门的 API 模块中？
- [ ] 是否使用了 `secureFetch` 或 `secureFetchWithRetry`？
- [ ] 是否添加了完整的错误处理？
- [ ] 是否通过了 `npm run typecheck` 检查？
- [ ] 是否添加了必要的注释和文档？

## Environment Variables

- `PORT`: Server port (default: 8081 for Go, 3000 for Vite)

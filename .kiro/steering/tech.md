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

**Config:**
- `js/config/constants.ts` - 配置常量和类型定义

**Utils:**
- `js/utils/crypto.ts` - 加密/哈希/签名工具
- `js/utils/keyEncryption.ts` - 私钥加密核心逻辑
- `js/utils/keyEncryptionUI.ts` - 私钥加密 UI 集成
- `js/utils/security.ts` - 安全工具 (XSS, CSRF, 验证)
- `js/utils/storage.ts` - 本地存储管理
- `js/utils/accessibility.ts` - 无障碍工具
- `js/utils/loading.ts` - 加载状态管理
- `js/utils/formValidator.ts` - 表单验证器
- `js/utils/enhancedRouter.ts` - 增强路由系统
- `js/utils/lazyLoader.ts` - 懒加载管理
- `js/utils/serviceWorker.ts` - Service Worker 管理
- `js/utils/transaction.ts` - 事务操作和自动保存

**Services:**
- `js/services/account.ts` - 账户服务
- `js/services/transaction.ts` - 交易构建服务
- `js/services/transfer.ts` - 转账表单逻辑
- `js/services/transferDraft.ts` - 转账草稿持久化

### JavaScript Modules (未迁移)

**Pages:** (all JavaScript)
- `js/pages/*.js` - 所有页面组件

**UI Components:** (all JavaScript)
- `js/ui/*.js` - 所有 UI 组件

**Services:** (partial)
- `js/services/wallet.js` - 钱包操作
- `js/services/walletStruct.js` - 钱包结构显示
- `js/services/recipient.js` - 收款人管理

**Utils:** (partial)
- `js/utils/store.js` - 状态管理
- `js/utils/toast.js` - Toast 提示
- `js/utils/helpers.js` - 通用辅助函数
- `js/utils/eventUtils.js` - 事件管理
- `js/utils/performanceMode.js` - 性能优化模式
- `js/utils/performanceMonitor.js` - 性能监控

**i18n:**
- `js/i18n/*.js` - 国际化系统

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

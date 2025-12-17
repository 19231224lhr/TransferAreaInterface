# Development Rules (开发规范)

> **重要提示**: 本文档定义了项目的核心开发规范，所有开发者和 AI 助手必须严格遵守。

---

## 🎯 核心原则

### 1. TypeScript First (TypeScript 优先)

**所有新代码必须使用 TypeScript 编写**

项目正在从 JavaScript 逐步迁移到 TypeScript。为确保代码质量和类型安全：

- ✅ **所有新文件必须使用 `.ts` 扩展名**
- ✅ **所有新功能必须定义完整的类型接口**
- ✅ **禁止使用 `any` 类型（除非确实无法推断）**
- ✅ **必须通过 `npm run typecheck` 检查**

### 2. API Isolation (API 隔离)

**所有 API 对接代码必须隔离在专门的模块中**

为了保持代码的可维护性和可测试性：

- ✅ **所有 API 调用必须通过 `js/api/` 模块**
- ✅ **禁止在 UI 组件中直接调用 `fetch`**
- ✅ **必须使用 `secureFetch` 或 `secureFetchWithRetry`**
- ✅ **必须定义请求和响应的 TypeScript 接口**

### 3. PanguPay Namespace (命名空间规范) ✅ NEW

**所有公共 API 必须通过 `window.PanguPay` 命名空间暴露**

为了减少全局变量污染、提高可维护性：

- ✅ **新代码使用 `window.PanguPay.xxx` 调用公共 API**
- ✅ **API 按功能分组：`router`, `i18n`, `theme`, `account`, `storage`, `wallet`, `ui`, `crypto` 等**
- ✅ **旧的 `window.xxx` 别名保留用于兼容，但新代码不应使用**
- ✅ **命名空间定义在 `js/core/namespace.ts`，类型定义在 `js/core/types.ts`**

```typescript
// ✅ 正确（新代码）
window.PanguPay.router.routeTo('#/main');
window.PanguPay.ui.showToast('Success!');
window.PanguPay.i18n.t('common.confirm');

// ❌ 避免（仅兼容旧代码）
window.routeTo('#/main');
window.showToast('Success!');
```

### 4. Event Delegation (事件委托规范) ✅ NEW

**动态生成的 HTML 必须使用事件委托，禁止内联 onclick**

为了更好的 CSP 合规性和可维护性：

- ✅ **使用 `data-action` 属性指定动作名**
- ✅ **使用 `data-*` 属性传递参数**
- ✅ **在 `js/app.js` 中通过 `registerAction()` 注册处理器**
- ❌ **禁止在动态生成的 HTML 中使用 `onclick="..."`**

```html
<!-- ✅ 正确 -->
<button data-action="showUtxoDetail" data-addr="xxx" data-key="yyy">详情</button>

<!-- ❌ 错误 -->
<button onclick="window.showUtxoDetail('xxx', 'yyy')">详情</button>
```

```typescript
// 在 app.js 中注册 action
import { registerAction } from './core';

registerAction('showUtxoDetail', (el, data) => {
  showUtxoDetail(data.addr, data.key);
});
```

### 5. State Persistence (状态持久化规范) ✅ NEW

**Store 是唯一的事实来源，禁止直接读写 localStorage 管理用户状态**

为了解决状态管理"脑裂"问题：

- ✅ **使用 `store.setState()` 更新用户状态**
- ✅ **使用 `selectUser(store.getState())` 读取用户状态**
- ✅ **状态持久化由 `statePersistence.ts` 自动处理**
- ❌ **禁止直接调用 `localStorage.setItem('user', ...)` 管理用户状态**

```typescript
// ✅ 正确（通过 Store）
import { store, selectUser } from './utils/store.js';

// 读取
const user = selectUser(store.getState());

// 更新（自动持久化到 localStorage）
store.setState({ user: newUser });

// ❌ 错误（直接操作 localStorage）
localStorage.setItem('user', JSON.stringify(user));  // 禁止！
const user = JSON.parse(localStorage.getItem('user'));  // 禁止！
```

### 6. Safe DOM Rendering (安全 DOM 渲染规范) ✅ NEW

**使用 `view.ts` 模块进行 DOM 渲染，禁止直接拼接 innerHTML**

为了防止 XSS 攻击和提高渲染效率：

- ✅ **使用 `html` 模板标签和 `renderInto()` 函数**
- ✅ **变量自动转义，无需手动调用 `escapeHtml()`**
- ❌ **禁止使用 `element.innerHTML = '<div>' + userInput + '</div>'`**

```typescript
// ✅ 正确（使用 view.ts）
import { html, renderInto } from './utils/view';

renderInto(container, html`
  <div class="card">
    <h2>${userName}</h2>
    <button data-action="edit">编辑</button>
  </div>
`);

// ❌ 错误（直接拼接 innerHTML）
container.innerHTML = `<div class="card"><h2>${userName}</h2></div>`;  // XSS 风险！
```

---

## 📁 文件创建规则

### 新建文件时必须遵守的规则

#### ✅ MUST DO (必须遵守)

1. **工具函数模块**
   ```
   js/utils/newFeature.ts  ✅ 正确
   js/utils/newFeature.js  ❌ 错误
   ```

2. **服务模块**
   ```
   js/services/newService.ts  ✅ 正确
   js/services/newService.js  ❌ 错误
   ```

3. **API 客户端模块**
   ```
   js/api/newEndpoint.ts  ✅ 正确
   js/api/newEndpoint.js  ❌ 错误
   ```

4. **配置文件**
   ```
   js/config/newConfig.ts  ✅ 正确
   js/config/newConfig.js  ❌ 错误
   ```

#### ❌ DO NOT (禁止)

- ❌ 不要创建新的 `.js` 文件（除非是临时测试）
- ❌ 不要在新代码中使用 `any` 类型
- ❌ 不要忽略 TypeScript 编译错误
- ❌ 不要在 UI 组件中直接调用 API

---

## 🔌 API 对接规范

### 目录结构

```
js/api/
├── client.ts          # 基础 API 客户端（必须）
├── account.ts         # 账户相关 API
├── transaction.ts     # 交易相关 API
├── wallet.ts          # 钱包相关 API
└── types.ts           # API 类型定义（必须）
```

### 实现模板

#### 1. 基础 API 客户端 (`js/api/client.ts`)

```typescript
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

// 导出单例实例
export const apiClient = new APIClient();
```

#### 2. API 类型定义 (`js/api/types.ts`)

```typescript
/**
 * 标准 API 响应格式
 */
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp?: number;
}

/**
 * 分页响应格式
 */
export interface PaginatedResponse<T> extends APIResponse<T[]> {
  page: number;
  pageSize: number;
  total: number;
}

/**
 * API 错误格式
 */
export interface APIError {
  code: string;
  message: string;
  details?: any;
}
```

#### 3. 特定功能域 API (`js/api/account.ts`)

```typescript
import { apiClient } from './client';
import type { APIResponse } from './types';

/**
 * 创建账户请求参数
 */
export interface CreateAccountRequest {
  publicKey: {
    x: string;
    y: string;
  };
}

/**
 * 创建账户响应数据
 */
export interface CreateAccountResponse {
  accountId: string;
  address: string;
}

/**
 * 创建新账户
 * @param request - 账户创建请求参数
 * @returns API 响应，包含账户 ID 和地址
 */
export async function createAccount(
  request: CreateAccountRequest
): Promise<APIResponse<CreateAccountResponse>> {
  return apiClient.post<APIResponse<CreateAccountResponse>>(
    '/account/new',
    request
  );
}

/**
 * 获取账户信息
 * @param accountId - 账户 ID
 * @returns API 响应，包含账户详细信息
 */
export async function getAccountInfo(
  accountId: string
): Promise<APIResponse<any>> {
  return apiClient.get<APIResponse<any>>(
    `/account/${accountId}`
  );
}
```

#### 4. 在业务代码中使用 API

```typescript
// js/services/account.ts
import { createAccount } from '../api/account';
import type { CreateAccountRequest } from '../api/account';

/**
 * 注册新账户（业务逻辑层）
 */
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

### ✅ 正确示例 vs ❌ 错误示例

#### ✅ GOOD (正确)

```typescript
// js/services/wallet.ts
import { getWalletBalance } from '../api/wallet';

export async function fetchBalance(address: string) {
  const response = await getWalletBalance(address);
  return response.data;
}
```

#### ❌ BAD (错误)

```typescript
// js/services/wallet.ts
// 不要直接在业务代码中调用 fetch！
export async function fetchBalance(address: string) {
  const response = await fetch(`/api/wallet/${address}`);  // ❌ 错误！
  return response.json();
}
```

---

## 📝 类型定义规范

### 接口命名规则

- **请求参数**: `{Feature}Request`
  - 例如: `CreateAccountRequest`, `TransferRequest`
  
- **响应数据**: `{Feature}Response`
  - 例如: `CreateAccountResponse`, `TransferResponse`
  
- **配置选项**: `{Feature}Config` 或 `{Feature}Options`
  - 例如: `APIConfig`, `ValidationOptions`

### 类型导出规则

```typescript
// ✅ 正确：使用 export interface
export interface User {
  id: string;
  name: string;
}

// ✅ 正确：使用 export type
export type CoinType = 'PGC' | 'BTC' | 'ETH';

// ❌ 错误：不要使用 export default 导出类型
export default interface User { ... }  // ❌
```

---

## 🔍 代码审查清单

### 提交代码前必须检查

- [ ] **文件扩展名**: 新文件是否使用 `.ts` 扩展名？
- [ ] **类型定义**: 是否定义了所有必要的接口和类型？
- [ ] **API 隔离**: API 调用是否在 `js/api/` 模块中？
- [ ] **安全请求**: 是否使用 `secureFetch` 或 `secureFetchWithRetry`？
- [ ] **错误处理**: 是否添加了完整的 try-catch 和错误处理？
- [ ] **类型检查**: 是否通过 `npm run typecheck` 检查？
- [ ] **注释文档**: 是否添加了 JSDoc 注释？
- [ ] **导入路径**: 是否使用相对路径导入（`../api/account`）？

### TypeScript 检查命令

```bash
# 运行类型检查
npm run typecheck

# 如果有错误，必须修复后才能提交
```

---

## 🚫 常见错误和解决方案

### 错误 1: 在 UI 组件中直接调用 API

```typescript
// ❌ 错误
async function handleSubmit() {
  const response = await fetch('/api/account/new', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

// ✅ 正确
import { createAccount } from '../api/account';

async function handleSubmit() {
  const response = await createAccount(data);
}
```

### 错误 2: 使用 any 类型

```typescript
// ❌ 错误
function processData(data: any) {
  return data.value;
}

// ✅ 正确
interface DataType {
  value: number;
}

function processData(data: DataType) {
  return data.value;
}
```

### 错误 3: 创建新的 .js 文件

```typescript
// ❌ 错误
// js/utils/newHelper.js

// ✅ 正确
// js/utils/newHelper.ts
```

---

## 📚 参考资源

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/)
- [Vite Documentation](https://vitejs.dev/)
- [项目 tech.md](./tech.md) - 技术栈详细说明
- [项目 structure.md](./structure.md) - 项目结构说明

---

## 🔄 迁移策略

### 现有 JavaScript 文件

**可以继续使用 JavaScript，但建议：**
- 添加 JSDoc 类型注释
- 如果大幅修改（超过 50% 代码），考虑迁移到 TypeScript

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

### 迁移优先级

1. **高优先级** (必须使用 TypeScript):
   - 新的工具函数 (`js/utils/`)
   - 新的服务模块 (`js/services/`)
   - 所有 API 客户端 (`js/api/`)
   - 配置文件 (`js/config/`)

2. **中优先级** (建议使用 TypeScript):
   - UI 组件 (`js/ui/`)
   - 页面组件 (`js/pages/`)

3. **低优先级** (可以保持 JavaScript):
   - 国际化文件 (`js/i18n/`)
   - 临时测试文件

---

## 🔄 响应式 UI 绑定规范 (Reactive UI Binding)

### 背景

项目中存在大量命令式 DOM 操作，导致：
- 状态与 UI 同步容易遗漏
- 代码冗长，充斥 `if (el) el.xxx` 的防御性代码
- 状态和 UI 的对应关系分散在各处，难以追踪

### 解决方案

使用 `js/utils/reactive.ts` 提供的轻量级响应式绑定系统，让 **View 成为 State 的纯函数**。

### 核心 API

```typescript
import { createReactiveState } from '../utils/reactive';

// 1. 定义状态类型
interface PageState {
  isLoading: boolean;
  showResult: boolean;
  username: string;
}

// 2. 定义初始状态
const initialState: PageState = {
  isLoading: false,
  showResult: false,
  username: ''
};

// 3. 定义状态到 DOM 的绑定
const bindings = {
  isLoading: [
    { selector: '#loader', type: 'visible' },
    { selector: '#submitBtn', type: 'prop', name: 'disabled' }
  ],
  showResult: [
    { selector: '#result', type: 'visible' }
  ],
  username: [
    { selector: '#usernameDisplay', type: 'text' }
  ]
};

// 4. 创建响应式状态
const state = createReactiveState(initialState, bindings);

// 5. 更新状态，UI 自动同步
state.set({ isLoading: true });
state.set({ isLoading: false, showResult: true, username: 'John' });
```

### 绑定类型

| 类型 | 说明 | 示例 |
|------|------|------|
| `text` | 设置 textContent | `{ selector: '#name', type: 'text' }` |
| `html` | 设置 innerHTML (需确保安全) | `{ selector: '#content', type: 'html' }` |
| `visible` | 控制 hidden class | `{ selector: '#loader', type: 'visible' }` |
| `class` | 切换指定 class | `{ selector: '#card', type: 'class', name: 'active' }` |
| `attr` | 设置/移除属性 | `{ selector: '#input', type: 'attr', name: 'disabled' }` |
| `prop` | 设置 DOM 属性 | `{ selector: '#btn', type: 'prop', name: 'disabled' }` |
| `value` | 设置表单元素值 | `{ selector: '#input', type: 'value' }` |

### 动画序列

```typescript
import { runAnimationSequence, runParallelAnimations } from '../utils/reactive';

// 单个动画序列
await runAnimationSequence({
  selector: '.card',
  phases: [
    { addClass: 'collapsing', duration: 250 },
    { removeClass: 'collapsing', addClass: 'collapsed', duration: 0 }
  ]
});

// 并行动画
await runParallelAnimations([
  { selector: '.form', phases: [...] },
  { selector: '.tip', phases: [...] }
]);
```

### 迁移指南

**改造前 (命令式):**
```javascript
// ❌ 大量重复的 DOM 操作
const loader = document.getElementById('loader');
const result = document.getElementById('result');
const username = document.getElementById('username');

if (loader) loader.classList.add('hidden');
if (result) result.classList.remove('hidden');
if (username) username.textContent = data.name;
```

**改造后 (声明式):**
```typescript
// ✅ 状态驱动，自动同步
state.set({
  isLoading: false,
  showResult: true,
  username: data.name
});
```

### 迁移优先级

按 DOM 操作密度排序，建议迁移顺序：

1. **高优先级** (100+ DOM 操作): ✅ 全部完成
   - `js/services/wallet.js` → `wallet.ts` ✅ 已完成
   - `js/ui/header.js` → `header.ts` ✅ 已完成
   - `js/pages/login.js` → `login.ts` ✅ 已完成
   - `js/pages/joinGroup.js` → `joinGroup.ts` ✅ 已完成

2. **中优先级** (50-100 DOM 操作): ✅ 全部完成
   - `js/pages/import.js` → `import.ts` ✅ 已完成
   - `js/pages/setPassword.js` → `setPassword.ts` ✅ 已完成
   - `js/pages/entry.js` → `entry.ts` ✅ 已完成
   - `js/ui/modal.js` → `modal.ts` ✅ 已完成
   - `js/ui/profile.js` → `profile.ts` ✅ 已完成

3. **低优先级** (<50 DOM 操作):
   - `js/pages/welcome.js` - 欢迎页面
   - `js/pages/newUser.js` - 新用户注册
   - `js/pages/main.js` - 主钱包页面
   - `js/pages/history.js` - 交易历史
   - `js/pages/groupDetail.js` - 组织详情
   - `js/ui/footer.js` - 页脚组件
   - `js/ui/toast.js` - Toast 提示
   - `js/ui/charts.js` - 图表组件
   - `js/services/walletStruct.js` - 钱包结构
   - `js/services/recipient.js` - 收款人管理

### 规则

- ✅ **新页面必须使用响应式绑定**
- ✅ **重构现有页面时，优先迁移到响应式模式**
- ✅ **状态变化必须通过 `state.set()` 而非直接操作 DOM**
- ✅ **动画序列使用 `runAnimationSequence` 而非手动 setTimeout**
- ❌ **禁止在新代码中使用 `document.getElementById().classList.xxx` 模式**

---

## ✅ 总结

**记住这六个核心原则：**

1. 🎯 **新代码 = TypeScript**
   - 所有新文件必须是 `.ts`
   - 必须定义完整的类型

2. 🔌 **API 调用 = 隔离模块**
   - 创建 `js/api/` 模块
   - 使用 `secureFetch`

3. 🔄 **UI 更新 = 响应式绑定**
   - 使用 `createReactiveState`
   - 状态驱动 UI，禁止命令式 DOM 操作

4. 🏷️ **公共 API = PanguPay 命名空间**
   - 使用 `window.PanguPay.xxx` 调用公共 API
   - 禁止新增 `window.xxx` 全局变量

5. 🎯 **事件处理 = 事件委托**
   - 使用 `data-action` 属性
   - 禁止内联 `onclick`

6. 🔒 **DOM 渲染 = view.ts**
   - 使用 `html` 模板和 `renderInto()`
   - 禁止直接拼接 `innerHTML`

7. 🔍 **提交前 = 类型检查**
   - 运行 `npm run typecheck`
   - 修复所有错误

---

*最后更新: 2025年12月*

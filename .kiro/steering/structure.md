# Project Structure

```
TransferAreaInterface/
├── index.html              # Main SPA entry point
├── sw.js                   # Service Worker (offline support)
├── package.json            # npm configuration
├── vite.config.js          # Vite build configuration
├── tsconfig.json           # TypeScript configuration
├── jsconfig.json           # JavaScript type checking
├── go.mod                  # Go module definition
├── IMPROVEMENT_REPORT.md   # Detailed optimization report
│
├── css/                    # Modular CSS files (通过 js/app.js 导入)
│   ├── index.css           # 🆕 CSS 入口文件 (统一管理所有样式导入)
│   ├── base.css            # Reset, variables, layout
│   ├── animations.css      # Keyframe animations
│   ├── components.css      # Reusable UI components
│   ├── utilities.css       # Utility classes
│   ├── p2-improvements.css # P2 optimizations (A11y, Loading, etc.)
│   ├── header.css          # Top navigation bar
│   ├── footer.css          # Footer styles
│   ├── welcome.css         # Landing page
│   ├── wallet.css          # Wallet view
│   ├── wallet_struct_styles.css # Wallet structure visualization
│   ├── transaction.css     # Transfer form
│   ├── login.css           # Login page
│   ├── new-user.css        # Registration page
│   ├── import-wallet.css   # Import wallet page
│   ├── join-group.css      # Join guarantor org
│   ├── group.css           # Group detail page
│   ├── entry.css           # Wallet management entry
│   ├── toast.css           # Toast notifications
│   ├── history.css         # Transaction history
│   ├── inquiry.css         # Inquiry/search page
│   ├── profile.css         # User profile
│   ├── energy-saving.css   # Energy saving mode
│   │
│   └── main-v2/            # 🆕 Main V2 模块化拆分 (从 main-v2.css 拆分)
│       ├── index.css       # Main V2 入口文件
│       ├── variables.css   # 设计变量 (颜色、阴影、圆角等)
│       ├── animations.css  # 动画定义
│       ├── layout.css      # 布局样式
│       ├── wallet-panel.css    # 钱包面板
│       ├── balance-chart.css   # 余额曲线图
│       ├── address-list.css    # 地址列表
│       ├── address-card.css    # 地址卡片
│       ├── transfer-panel.css  # 转账面板
│       ├── transfer-flow.css   # 转账流程
│       ├── recipients.css      # 收款方模块
│       ├── advanced-options.css # 高级选项
│       ├── toggle-switch.css   # 开关组件
│       ├── custom-select.css   # 自定义选择器
│       ├── org-panel.css       # 担保组织面板
│       ├── struct-section.css  # 结构体区域
│       ├── no-org-warning.css  # 未加入组织警告
│       ├── tx-detail.css       # 交易详情
│       ├── skeleton.css        # 🆕 骨架屏样式
│       ├── utilities.css       # 工具类
│       ├── responsive.css      # 响应式适配
│       └── dark-mode.css       # 深色模式
│
├── js/                     # Frontend code (JS/TS mixed)
│   ├── app.js              # 兼容层入口 (全局导出)
│   ├── bootstrap.ts        # 🆕 应用启动和生命周期管理 (TS)
│   ├── router.ts           # 🆕 路由系统 (TS，从 router.js 迁移)
│   ├── types.js            # JSDoc type definitions
│   ├── globals.d.ts        # Global TypeScript declarations
│   │
│   ├── core/               # 🆕 核心模块 (命名空间 + 事件委托)
│   │   ├── index.ts        # 模块导出入口
│   │   ├── namespace.ts    # PanguPay 命名空间定义
│   │   ├── eventDelegate.ts # 全局事件委托系统
│   │   └── types.ts        # 命名空间类型定义
│   │
│   ├── api/                # API client modules (TypeScript only)
│   │   ├── client.ts       # Base API client with secureFetch
│   │   ├── account.ts      # Account-related API endpoints
│   │   ├── transaction.ts  # Transaction-related API endpoints
│   │   ├── wallet.ts       # Wallet-related API endpoints
│   │   └── types.ts        # API request/response type definitions
│   │
│   ├── config/             # Configuration
│   │   ├── constants.ts    # App constants and types (TS)
│   │   ├── domIds.ts       # 🆕 DOM ID 集中管理 (TS)
│   │   ├── pageTemplates.ts # Page template configuration (TS)
│   │   └── constants.js.backup # Original JS version
│   │
│   ├── i18n/               # Internationalization
│   │   ├── index.js        # i18n core functions
│   │   ├── zh-CN.js        # Chinese translations
│   │   └── en.js           # English translations
│   │
│   ├── pages/              # Page components (JS → TS migration)
│   │   ├── welcome.js      # Welcome page
│   │   ├── login.ts        # Login page (✅ 响应式绑定)
│   │   ├── newUser.js      # Registration page
│   │   ├── setPassword.ts  # Set password page (✅ 响应式绑定)
│   │   ├── entry.ts        # Wallet entry page (✅ 响应式绑定)
│   │   ├── import.ts       # Import wallet page (✅ 响应式绑定)
│   │   ├── main.js         # Main wallet page
│   │   ├── history.js      # Transaction history
│   │   ├── joinGroup.ts    # Join organization (✅ 响应式绑定)
│   │   └── groupDetail.js  # Organization details
│   │
│   ├── services/           # Business logic services (TS + JS)
│   │   ├── account.ts      # Account management (TS)
│   │   ├── transaction.ts  # Transaction building (TS)
│   │   ├── transfer.ts     # Transfer form logic (TS)
│   │   ├── transferDraft.ts # Transfer draft persistence (TS)
│   │   ├── wallet.ts       # Wallet operations (✅ 响应式绑定)
│   │   ├── walletStruct.js # Wallet structure display
│   │   ├── recipient.js    # Recipient management
│   │   ├── account.js.backup # Original JS versions
│   │   ├── transaction.js.backup
│   │   └── transfer.js.backup
│   │
│   ├── ui/                 # UI components (JS → TS migration)
│   │   ├── header.ts       # Header component (✅ 响应式绑定)
│   │   ├── footer.js       # Footer component
│   │   ├── modal.ts        # Modal dialogs (✅ 响应式绑定)
│   │   ├── toast.js        # Toast notifications
│   │   ├── charts.js       # Balance charts
│   │   ├── networkChart.js # Network visualization
│   │   ├── profile.ts      # Profile component (✅ 响应式绑定)
│   │   ├── theme.js        # Theme management
│   │   └── walletStruct.js # Wallet structure UI
│   │
│   └── utils/              # Utility modules (mostly TS)
│       ├── crypto.ts       # Cryptography (TS)
│       ├── keyEncryption.ts # Key encryption core (TS)
│       ├── keyEncryptionUI.ts # Key encryption UI integration (TS)
│       ├── security.ts     # Security utilities (TS)
│       ├── storage.ts      # localStorage management (TS)
│       ├── statePersistence.ts # 🆕 Store 状态持久化 (TS)
│       ├── view.ts         # 🆕 安全 DOM 渲染 (lit-html 封装)
│       ├── accessibility.ts # A11y utilities (TS)
│       ├── loading.ts      # Loading state manager (TS)
│       ├── formValidator.ts # Form validation (TS)
│       ├── enhancedRouter.ts # Route guards (TS)
│       ├── lazyLoader.ts   # Lazy loading (TS)
│       ├── serviceWorker.ts # SW management (TS)
│       ├── transaction.ts  # Transaction helpers & auto-save (TS)
│       ├── reactive.ts     # 响应式 UI 绑定系统 (TS)
│       ├── screenLock.ts   # 🆕 屏幕锁定功能 (TS)
│       ├── walletSkeleton.ts # 🆕 骨架屏加载工具 (TS)
│       ├── store.js        # State management
│       ├── toast.js        # Toast helpers
│       ├── helpers.js      # General helpers
│       ├── eventUtils.js   # Event management
│       ├── performanceMode.js # Performance optimization
│       ├── performanceMonitor.js # Performance monitoring
│       ├── crypto.js.backup # Original JS versions
│       ├── keyEncryption.js.backup
│       ├── security.js.backup
│       └── storage.js.backup
│
├── backend/                # Go backend code
│   ├── core.go             # Common utilities, signing, serialization
│   ├── Account.go          # Account & Wallet structs
│   ├── NewAccount.go       # Account creation
│   ├── GetAddressMsg.go    # Address info queries
│   ├── JoinGroup.go        # Guarantor org membership
│   ├── SendTX.go           # Transaction building & sending
│   ├── Transaction.go      # Transaction struct definitions
│   ├── UTXO.go             # UTXO data structures
│   ├── TXCer.go            # Transaction certificates
│   │
│   ├── core/               # Reusable core package
│   │   ├── keyformat.go    # Key parsing & conversion
│   │   └── util.go         # String utilities
│   │
│   ├── cmd/webserver/      # HTTP server entry
│   │   └── main.go         # Server with static files + API
│   │
│   ├── test_serialize/     # Serialization testing
│   │   └── main.go
│   │
│   └── verify_tx/          # Transaction verification tools
│       ├── main.go
│       ├── test2.go
│       ├── verify_new.go
│       └── verify_real.go
│
├── assets/                 # Static assets (images)
│   ├── logo.png
│   ├── logo2.png
│   ├── logo3.png
│   └── avatar.png
│
├── scripts/                # Build scripts
│   └── copy-sw.js          # Post-build script to copy service worker
│
├── dist/                   # Build output (npm run build)
│
├── tests/                  # Test files
│   ├── sync.test.html
│   └── sync.test.js
│
└── .kiro/                  # Kiro IDE configuration
    ├── specs/              # Feature specifications
    │   ├── code-cleanup/
    │   ├── code-optimization/
    │   ├── performance-optimization/
    │   ├── ui-fixes/
    │   ├── dark-mode/
    │   ├── history-accordion-detail/
    │   ├── js-modularization/
    │   └── chart-responsive-fix/
    │
    ├── steering/           # Project documentation
    │   ├── product.md      # Product overview
    │   ├── structure.md    # Project structure (this file)
    │   └── tech.md         # Technology stack
    │
    └── review/             # Code review notes
        └── ui_improvement_suggestions.md
```

## Project Evolution

### TypeScript Migration Status

The project is undergoing a **gradual migration** from JavaScript to TypeScript:

**Completed (TypeScript):**
- ✅ All utility modules (`js/utils/*.ts`)
- ✅ Core services (`js/services/account.ts`, `transaction.ts`, `transfer.ts`, `transferDraft.ts`)
- ✅ Configuration (`js/config/constants.ts`)

**In Progress (JavaScript):**
- 🔄 Page components (`js/pages/welcome.js`, `newUser.js`, `main.js`, `history.js`, `groupDetail.js`)
- 🔄 UI components (`js/ui/footer.js`, `toast.js`, `charts.js`, `networkChart.js`, `theme.js`, `walletStruct.js`)
- 🔄 Remaining services (`walletStruct.js`, `recipient.js`)
- 🔄 i18n system (`js/i18n/*.js`)

**Migration Strategy:**
- Keep `.backup` files for rollback safety
- Disable `checkJs` in both `tsconfig.json` and `jsconfig.json` to prevent false errors
- Migrate critical/reusable modules first (utils, services)
- Migrate UI/pages last (less reusable, more DOM-dependent)

### Recent Additions

**Transfer Draft Persistence (2024):**
- Auto-save transfer form state every 15 seconds
- Structured draft format with versioning
- Restore on page refresh/reload
- Clear on successful transaction

**Enhanced Key Encryption (2024):**
- UI integration for password prompts
- Automatic migration from legacy plaintext storage
- Password confirmation for new encryptions
- Secure key retrieval workflow

**Performance Monitoring (2024):**
- Performance mode toggles
- Metrics tracking and reporting
- Optimization suggestions

**Core Architecture Refactoring (2025):** ✅ 已完成
- `router.js` → `router.ts` - 路由系统 TypeScript 化
- `app.js` 拆分为 `app.js` (兼容层) + `bootstrap.ts` (启动逻辑)
- 新增 `js/core/` 目录 - 命名空间 + 事件委托系统
- 新增 `js/utils/statePersistence.ts` - 解决状态管理"脑裂"问题
- 新增 `js/utils/view.ts` - 安全 DOM 渲染 (lit-html 封装)

**Reactive UI Binding (2025):** ✅ 已完成
- `js/utils/reactive.ts` - 轻量级响应式绑定系统 (456 行)
- 声明式 UI 绑定，状态变化自动同步 DOM
- 动画序列支持，简化复杂动画逻辑
- 事件绑定重置机制，解决路由切换后事件失效问题
- 已迁移文件（共 6,553 行 TypeScript）：

| 文件 | 原 JS 行数 | 新 TS 行数 | 说明 |
|------|-----------|-----------|------|
| `js/utils/reactive.ts` | - | 456 | 核心响应式绑定系统 |
| `js/pages/login.ts` | 568 | 770 | 登录页面 |
| `js/pages/import.ts` | 397 | 649 | 导入钱包页面 |
| `js/pages/joinGroup.ts` | 513 | 811 | 加入组织页面 |
| `js/pages/setPassword.ts` | 357 | 496 | 设置密码页面 |
| `js/pages/entry.ts` | 184 | 358 | 钱包入口页面 |
| `js/ui/header.ts` | 473 | 678 | 头部组件 |
| `js/ui/modal.ts` | 249 | 382 | 模态对话框 |
| `js/ui/profile.ts` | 622 | 702 | 用户资料页面 |
| `js/services/wallet.ts` | 1,273 | 1,251 | 钱包服务模块 |

**不需要迁移的文件（保持 JavaScript）：**
- `js/pages/welcome.js` - 简单欢迎页，无复杂状态
- `js/pages/main.js` - 主要调用其他模块，本身逻辑简单
- `js/pages/newUser.js` - 注册页面，使用频率低
- `js/pages/history.js` - 历史记录，主要是列表渲染
- `js/pages/groupDetail.js` - 简单详情展示
- `js/ui/charts.js` - Canvas 图表，不适合响应式绑定
- `js/ui/networkChart.js` - Canvas 绑定，不适合响应式绑定
- `js/ui/footer.js` - 几乎是静态内容
- `js/ui/theme.js` - 简单主题切换
- `js/services/recipient.js` - 收款人管理，逻辑独立
- `js/services/walletStruct.js` - 钱包结构可视化
- `js/i18n/*.js` - 纯数据文件

## Architecture Notes

### Frontend (SPA)

- Single `index.html` with hash-based routing (`#/login`, `#/main`, etc.)
- **Build Tool**: Vite for development and production builds
- **Language**: TypeScript + JavaScript mixed (gradual migration in progress)
- CSS split by feature/page for maintainability (25+ CSS files)
- Service Worker for offline support with cache-first strategy

### Module Organization

| Directory | Purpose | Language | Status |
|-----------|---------|----------|--------|
| `js/core/` | 命名空间 + 事件委托 | **TypeScript only** | 🆕 New |
| `js/api/` | API client modules | **TypeScript only** | ✅ Migrated |
| `js/config/` | Configuration constants | TypeScript | ✅ Migrated |
| `js/services/` | Business logic | TypeScript | ✅ Migrated |
| `js/utils/` | Utility functions | TypeScript | ✅ Migrated |
| `js/pages/` | Page components | TS + JS | 🔄 Partial |
| `js/ui/` | UI components | TS + JS | 🔄 Partial |
| `js/i18n/` | Translations | JavaScript | 保持现状 |

**Important Notes:**
- 🆕 `js/core/` - **核心模块：命名空间定义 + 事件委托系统** (TypeScript only)
- 🆕 `js/bootstrap.ts` - **应用启动和生命周期管理**
- 🆕 `js/router.ts` - **路由系统 (从 router.js 迁移)**
- ✅ All new code MUST be written in TypeScript
- 🔄 Existing JavaScript files can remain as-is until major refactoring

### Backend (Go)

- Main package in root `backend/` for domain logic
- Reusable utilities in `backend/core/` sub-package
- Web server in `backend/cmd/webserver/` serves both API and static files

### Key Files to Know

| File | Purpose |
|------|---------|
| `js/app.js` | 兼容层入口，全局导出 |
| `js/bootstrap.ts` | 🆕 应用启动和生命周期管理 |
| `js/router.ts` | 🆕 路由系统 (TypeScript) |
| **`js/core/namespace.ts`** | **🆕 PanguPay 命名空间定义** |
| **`js/core/eventDelegate.ts`** | **🆕 全局事件委托系统** |
| **`js/core/types.ts`** | **🆕 命名空间类型定义** |
| `js/api/client.ts` | Base API client with secureFetch |
| `js/api/account.ts` | Account API endpoints |
| `js/api/types.ts` | API request/response types |
| `js/config/constants.ts` | All configuration constants and types |
| **`js/config/domIds.ts`** | **🆕 DOM ID 集中管理** |
| `js/utils/security.ts` | Security utilities (XSS, CSRF, validation) |
| `js/utils/storage.ts` | localStorage operations |
| **`js/utils/statePersistence.ts`** | **🆕 Store 状态持久化** |
| **`js/utils/view.ts`** | **🆕 安全 DOM 渲染 (lit-html)** |
| `js/utils/keyEncryption.ts` | Private key encryption core logic |
| `js/utils/keyEncryptionUI.ts` | Private key encryption UI integration |
| `js/utils/transaction.ts` | Transaction helpers and auto-save |
| `js/utils/reactive.ts` | 响应式 UI 绑定系统 |
| **`js/utils/walletSkeleton.ts`** | **🆕 骨架屏加载工具** |
| `js/services/account.ts` | Account management business logic |
| `js/services/transaction.ts` | Transaction building |
| `js/services/transferDraft.ts` | Transfer form state persistence |
| `vite.config.js` | Build configuration |
| `tsconfig.json` | TypeScript configuration |
| `jsconfig.json` | JavaScript configuration (checkJs: false) |
| `sw.js` | Service Worker for offline support |
| `backend/core.go` | Signing, hashing, serialization utilities |
| `backend/Account.go` | Account/Wallet/Address data structures |
| `backend/Transaction.go` | Transaction struct and methods |

**🆕 New API Integration Pattern:**
- All API calls should go through `js/api/` modules
- Use `apiClient` from `js/api/client.ts` for all HTTP requests
- Define request/response types in `js/api/types.ts`
- Business logic in `js/services/` should import from `js/api/`

**🆕 PanguPay Namespace Pattern (2025):**
- 所有公共 API 通过 `window.PanguPay` 命名空间暴露
- API 按功能分组：`router`, `i18n`, `theme`, `account`, `storage`, `wallet`, `ui`, `crypto`
- 旧的 `window.xxx` 别名保留用于兼容，新代码使用命名空间

**🆕 Event Delegation Pattern (2025):**
- 动态生成的 HTML 使用 `data-action` 属性指定动作
- 通过 `registerAction()` 注册处理器
- 禁止在动态 HTML 中使用内联 `onclick`

**🆕 State Persistence Pattern (2025):**
- Store 是唯一的事实来源 (Single Source of Truth)
- localStorage 仅用于启动时水合 + 持久化
- 使用 `initUserPersistence()` 自动同步 Store 到 localStorage

### Backup Files

Files with `.backup` extension are original JavaScript versions before TypeScript migration. These are kept for reference and rollback purposes:

**Utils:**
- `js/utils/crypto.js.backup`
- `js/utils/keyEncryption.js.backup`
- `js/utils/security.js.backup`
- `js/utils/storage.js.backup`

**Services:**
- `js/services/account.js.backup`
- `js/services/transaction.js.backup`
- `js/services/transfer.js.backup`

**Config:**
- `js/config/constants.js.backup`

> **Note:** 响应式绑定重构相关的 backup 文件已在 2025 年 12 月删除（重构完成并测试通过后）。

### New Features & Modules

**Transfer Draft Persistence:**
- `js/services/transferDraft.ts` - Persists transfer form state across page refreshes
- `js/utils/transaction.ts` - Auto-save utilities for forms and structured data

**Enhanced Key Encryption:**
- `js/utils/keyEncryption.ts` - Core encryption/decryption logic
- `js/utils/keyEncryptionUI.ts` - UI integration with password prompts and migration workflows

**Performance Monitoring:**
- `js/utils/performanceMode.js` - Performance optimization modes
- `js/utils/performanceMonitor.js` - Performance metrics tracking

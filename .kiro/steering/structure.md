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
│       ├── utilities.css       # 工具类
│       ├── responsive.css      # 响应式适配
│       └── dark-mode.css       # 深色模式
│
├── js/                     # Frontend code (JS/TS mixed)
│   ├── app.js              # Application entry point
│   ├── router.js           # Hash-based routing
│   ├── types.js            # JSDoc type definitions
│   ├── globals.d.ts        # Global TypeScript declarations
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
│   │   └── constants.js.backup # Original JS version
│   │
│   ├── i18n/               # Internationalization
│   │   ├── index.js        # i18n core functions
│   │   ├── zh-CN.js        # Chinese translations
│   │   └── en.js           # English translations
│   │
│   ├── pages/              # Page components (JS → TS migration)
│   │   ├── welcome.js      # Welcome page
│   │   ├── login.ts        # Login page (✅ 已迁移到响应式绑定)
│   │   ├── login.js.backup # Login page (原始 JS 版本)
│   │   ├── newUser.js      # Registration page
│   │   ├── entry.js        # Wallet entry page
│   │   ├── import.ts       # Import wallet page (✅ 已迁移到响应式绑定)
│   │   ├── import.js.backup # Import wallet page (原始 JS 版本)
│   │   ├── main.js         # Main wallet page
│   │   ├── history.js      # Transaction history
│   │   ├── joinGroup.ts    # Join organization (✅ 已迁移到响应式绑定)
│   │   ├── joinGroup.js.backup # Join organization (原始 JS 版本)
│   │   └── groupDetail.js  # Organization details
│   │
│   ├── services/           # Business logic services (TS + JS)
│   │   ├── account.ts      # Account management (TS)
│   │   ├── transaction.ts  # Transaction building (TS)
│   │   ├── transfer.ts     # Transfer form logic (TS)
│   │   ├── transferDraft.ts # Transfer draft persistence (TS)
│   │   ├── wallet.js       # Wallet operations
│   │   ├── walletStruct.js # Wallet structure display
│   │   ├── recipient.js    # Recipient management
│   │   ├── account.js.backup # Original JS versions
│   │   ├── transaction.js.backup
│   │   └── transfer.js.backup
│   │
│   ├── ui/                 # UI components (JS → TS migration)
│   │   ├── header.ts       # Header component (✅ 已迁移到响应式绑定)
│   │   ├── header.js.backup # Header component (原始 JS 版本)
│   │   ├── footer.js       # Footer component
│   │   ├── modal.js        # Modal dialogs
│   │   ├── toast.js        # Toast notifications
│   │   ├── charts.js       # Balance charts
│   │   ├── networkChart.js # Network visualization
│   │   ├── profile.js      # Profile component
│   │   ├── theme.js        # Theme management
│   │   └── walletStruct.js # Wallet structure UI
│   │
│   └── utils/              # Utility modules (mostly TS)
│       ├── crypto.ts       # Cryptography (TS)
│       ├── keyEncryption.ts # Key encryption core (TS)
│       ├── keyEncryptionUI.ts # Key encryption UI integration (TS)
│       ├── security.ts     # Security utilities (TS)
│       ├── storage.ts      # localStorage management (TS)
│       ├── accessibility.ts # A11y utilities (TS)
│       ├── loading.ts      # Loading state manager (TS)
│       ├── formValidator.ts # Form validation (TS)
│       ├── enhancedRouter.ts # Route guards (TS)
│       ├── lazyLoader.ts   # Lazy loading (TS)
│       ├── serviceWorker.ts # SW management (TS)
│       ├── transaction.ts  # Transaction helpers & auto-save (TS)
│       ├── reactive.ts     # 🆕 响应式 UI 绑定系统 (TS)
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
- 🔄 Page components (`js/pages/*.js`)
- 🔄 UI components (`js/ui/*.js`)
- 🔄 Remaining services (`wallet.js`, `walletStruct.js`, `recipient.js`)
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

**Reactive UI Binding (2025):**
- `js/utils/reactive.ts` - 轻量级响应式绑定系统
- 声明式 UI 绑定，状态变化自动同步 DOM
- 动画序列支持，简化复杂动画逻辑
- 已迁移文件：
  - `js/pages/login.ts` - 登录页面
  - `js/pages/import.ts` - 导入钱包页面
  - `js/pages/joinGroup.ts` - 加入组织页面
  - `js/ui/header.ts` - 头部组件

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
| `js/api/` | API client modules (frontend-backend integration) | **TypeScript only** | 🆕 New |
| `js/config/` | Configuration constants | TypeScript | ✅ Migrated |
| `js/services/` | Business logic | TypeScript | ✅ Migrated |
| `js/utils/` | Utility functions | TypeScript | ✅ Migrated |
| `js/pages/` | Page components | JavaScript | 🔄 To migrate |
| `js/ui/` | UI components | JavaScript | 🔄 To migrate |
| `js/i18n/` | Translations | JavaScript | 🔄 To migrate |

**Important Notes:**
- 🆕 `js/api/` - **NEW directory for all API integration code** (TypeScript only)
- ✅ All new code MUST be written in TypeScript
- 🔄 Existing JavaScript files can remain as-is until major refactoring

### Backend (Go)

- Main package in root `backend/` for domain logic
- Reusable utilities in `backend/core/` sub-package
- Web server in `backend/cmd/webserver/` serves both API and static files

### Key Files to Know

| File | Purpose |
|------|---------|
| `js/app.js` | Application entry, routing, initialization |
| `js/router.js` | Hash-based routing system |
| **`js/api/client.ts`** | **🆕 Base API client with secureFetch (NEW)** |
| **`js/api/account.ts`** | **🆕 Account API endpoints (NEW)** |
| **`js/api/types.ts`** | **🆕 API request/response types (NEW)** |
| `js/config/constants.ts` | All configuration constants and types |
| `js/utils/security.ts` | Security utilities (XSS, CSRF, validation) |
| `js/utils/storage.ts` | localStorage operations |
| `js/utils/keyEncryption.ts` | Private key encryption core logic |
| `js/utils/keyEncryptionUI.ts` | Private key encryption UI integration |
| `js/utils/transaction.ts` | Transaction helpers and auto-save |
| **`js/utils/reactive.ts`** | **🆕 响应式 UI 绑定系统 (NEW)** |
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

**Pages:**
- `js/pages/login.js.backup`
- `js/pages/import.js.backup`
- `js/pages/joinGroup.js.backup`

**UI:**
- `js/ui/header.js.backup`

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

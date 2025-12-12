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
npm run build      # Build to dist/ directory
npm run preview    # Preview production build
```

### Type Checking

```bash
npm run typecheck  # Run TypeScript type checking
```

### Run Go Tests (if any)

```bash
go test ./...
```

### Build Backend

```bash
go build ./backend/cmd/webserver
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
- **JS Support**: `allowJs: true`, `checkJs: true`

### Key Files
- `tsconfig.json` - TypeScript compiler options
- `jsconfig.json` - JavaScript type checking (legacy)
- `js/globals.d.ts` - Global type declarations
- `js/types.js` - JSDoc type definitions

### TypeScript Modules (已迁移)
- `js/config/constants.ts` - 配置常量和类型定义
- `js/utils/crypto.ts` - 加密/哈希/签名工具
- `js/utils/keyEncryption.ts` - 私钥加密模块
- `js/utils/security.ts` - 安全工具 (XSS, CSRF, 验证)
- `js/utils/storage.ts` - 本地存储管理
- `js/utils/accessibility.ts` - 无障碍工具
- `js/utils/loading.ts` - 加载状态管理
- `js/utils/formValidator.ts` - 表单验证器
- `js/utils/enhancedRouter.ts` - 增强路由系统
- `js/utils/lazyLoader.ts` - 懒加载管理
- `js/utils/serviceWorker.ts` - Service Worker 管理
- `js/utils/transaction.ts` - 事务操作
- `js/services/account.ts` - 账户服务
- `js/services/transaction.ts` - 交易服务
- `js/services/transfer.ts` - 转账服务

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
- **Module**: `js/utils/keyEncryption.ts`

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

## Environment Variables

- `PORT`: Server port (default: 8081 for Go, 3000 for Vite)

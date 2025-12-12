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
├── css/                    # Modular CSS files
│   ├── base.css            # Reset, variables, layout
│   ├── animations.css      # Keyframe animations
│   ├── components.css      # Reusable UI components
│   ├── p2-improvements.css # P2 optimizations (A11y, Loading, etc.)
│   ├── header.css          # Top navigation bar
│   ├── welcome.css         # Landing page
│   ├── wallet.css          # Main wallet view
│   ├── transaction.css     # Transfer form
│   ├── login.css           # Login page
│   ├── new-user.css        # Registration page
│   ├── import-wallet.css   # Import wallet page
│   ├── join-group.css      # Join guarantor org
│   ├── entry.css           # Wallet management entry
│   ├── toast.css           # Toast notifications
│   ├── history.css         # Transaction history
│   ├── profile.css         # User profile
│   ├── energy-saving.css   # Energy saving mode
│   └── utilities.css       # Utility classes
│
├── js/                     # Frontend code (JS/TS mixed)
│   ├── app.js              # Application entry point
│   ├── router.js           # Hash-based routing
│   ├── types.js            # JSDoc type definitions
│   ├── globals.d.ts        # Global TypeScript declarations
│   │
│   ├── config/             # Configuration
│   │   └── constants.ts    # App constants and types (TS)
│   │
│   ├── i18n/               # Internationalization
│   │   ├── index.js        # i18n core functions
│   │   ├── zh-CN.js        # Chinese translations
│   │   └── en.js           # English translations
│   │
│   ├── pages/              # Page components
│   │   ├── welcome.js      # Welcome page
│   │   ├── login.js        # Login page
│   │   ├── newUser.js      # Registration page
│   │   ├── entry.js        # Wallet entry page
│   │   ├── import.js       # Import wallet page
│   │   ├── main.js         # Main wallet page
│   │   ├── history.js      # Transaction history
│   │   ├── joinGroup.js    # Join organization
│   │   └── groupDetail.js  # Organization details
│   │
│   ├── services/           # Business logic services
│   │   ├── account.ts      # Account management (TS)
│   │   ├── transaction.ts  # Transaction building (TS)
│   │   ├── transfer.ts     # Transfer form logic (TS)
│   │   ├── wallet.js       # Wallet operations
│   │   ├── walletStruct.js # Wallet structure display
│   │   └── recipient.js    # Recipient management
│   │
│   ├── ui/                 # UI components
│   │   ├── header.js       # Header component
│   │   ├── footer.js       # Footer component
│   │   ├── modal.js        # Modal dialogs
│   │   ├── toast.js        # Toast notifications
│   │   ├── charts.js       # Balance charts
│   │   ├── networkChart.js # Network visualization
│   │   ├── profile.js      # Profile component
│   │   ├── theme.js        # Theme management
│   │   └── walletStruct.js # Wallet structure UI
│   │
│   └── utils/              # Utility modules
│       ├── crypto.ts       # Cryptography (TS)
│       ├── keyEncryption.ts # Key encryption (TS)
│       ├── security.ts     # Security utilities (TS)
│       ├── storage.ts      # localStorage management (TS)
│       ├── accessibility.ts # A11y utilities (TS)
│       ├── loading.ts      # Loading state manager (TS)
│       ├── formValidator.ts # Form validation (TS)
│       ├── enhancedRouter.ts # Route guards (TS)
│       ├── lazyLoader.ts   # Lazy loading (TS)
│       ├── serviceWorker.ts # SW management (TS)
│       ├── transaction.ts  # Transaction helpers (TS)
│       ├── store.js        # State management
│       ├── toast.js        # Toast helpers
│       ├── helpers.js      # General helpers
│       ├── eventUtils.js   # Event management
│       ├── performanceMode.js # Performance optimization
│       └── performanceMonitor.js # Performance monitoring
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
│   └── cmd/webserver/      # HTTP server entry
│       └── main.go         # Server with static files + API
│
├── assets/                 # Static assets (images)
│   ├── logo.png
│   ├── logo2.png
│   ├── logo3.png
│   └── avatar.png
│
├── dist/                   # Build output (npm run build)
│
└── tests/                  # Test files
    ├── sync.test.html
    └── sync.test.js
```

## Architecture Notes

### Frontend (SPA)

- Single `index.html` with hash-based routing (`#/login`, `#/main`, etc.)
- **Build Tool**: Vite for development and production builds
- **Language**: TypeScript + JavaScript mixed (gradual migration)
- CSS split by feature/page for maintainability
- Service Worker for offline support

### Module Organization

| Directory | Purpose | Language |
|-----------|---------|----------|
| `js/config/` | Configuration constants | TypeScript |
| `js/services/` | Business logic | TypeScript (migrated) |
| `js/utils/` | Utility functions | TypeScript (migrated) |
| `js/pages/` | Page components | JavaScript |
| `js/ui/` | UI components | JavaScript |
| `js/i18n/` | Translations | JavaScript |

### Backend (Go)

- Main package in root `backend/` for domain logic
- Reusable utilities in `backend/core/` sub-package
- Web server in `backend/cmd/webserver/` serves both API and static files

### Key Files to Know

| File | Purpose |
|------|---------|
| `js/app.js` | Application entry, routing, initialization |
| `js/config/constants.ts` | All configuration constants and types |
| `js/utils/security.ts` | Security utilities (XSS, CSRF, validation) |
| `js/utils/storage.ts` | localStorage operations |
| `js/services/account.ts` | Account management |
| `js/services/transaction.ts` | Transaction building |
| `vite.config.js` | Build configuration |
| `tsconfig.json` | TypeScript configuration |
| `sw.js` | Service Worker for offline support |
| `backend/core.go` | Signing, hashing, serialization utilities |
| `backend/Account.go` | Account/Wallet/Address data structures |
| `backend/Transaction.go` | Transaction struct and methods |

### Backup Files

Files with `.backup` extension are original JavaScript versions before TypeScript migration:
- `js/utils/crypto.js.backup`
- `js/utils/keyEncryption.js.backup`
- `js/utils/security.js.backup`
- `js/utils/storage.js.backup`
- `js/services/account.js.backup`
- `js/services/transaction.js.backup`
- `js/services/transfer.js.backup`
- `js/config/constants.js.backup`

# Design Document: JavaScript Modularization

## Overview

This design document outlines the architecture for refactoring the monolithic `app.js` file (8591 lines) into a modular ES6 structure. The refactoring will split the code into logical modules organized by function while maintaining complete functional equivalence with the original implementation.

The modularization follows a layered architecture:
- **Config Layer**: Constants and configuration
- **I18n Layer**: Internationalization system
- **Utils Layer**: Reusable utility functions
- **Services Layer**: Business logic
- **UI Layer**: UI components and interactions
- **Pages Layer**: Page-specific logic
- **Router**: Navigation and routing

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        index.html                            │
│                  <script type="module">                      │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                      js/app.js                               │
│                   (Entry Point)                              │
│  - Initialize i18n, theme, router                           │
│  - Set up global event listeners                            │
│  - Export global functions to window                        │
└─────────────────────────┬───────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│  js/router  │   │  js/i18n/   │   │ js/config/  │
│             │   │  index.js   │   │ constants   │
└──────┬──────┘   └──────┬──────┘   └─────────────┘
       │                 │
       ▼                 ▼
┌─────────────────────────────────────────────────────────────┐
│                      js/pages/                               │
│  welcome.js | entry.js | login.js | newUser.js | import.js  │
│  main.js | joinGroup.js | groupDetail.js | profile.js       │
└─────────────────────────┬───────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│   js/ui/    │   │js/services/ │   │  js/utils/  │
│ header.js   │   │ account.js  │   │ crypto.js   │
│ modal.js    │   │ wallet.js   │   │ storage.js  │
│ profile.js  │   │transaction.js│  │ toast.js    │
│ charts.js   │   │             │   │ helpers.js  │
└─────────────┘   └─────────────┘   └─────────────┘
```

## Components and Interfaces

### 1. Config Module (`js/config/constants.js`)

**Purpose**: Centralize all configuration constants.

**Exports**:
```javascript
// Storage keys
export const STORAGE_KEY = 'walletAccount';
export const I18N_STORAGE_KEY = 'appLanguage';
export const THEME_STORAGE_KEY = 'appTheme';
export const PROFILE_STORAGE_KEY = 'userProfile';

// Default values
export const DEFAULT_GROUP = { 
  groupID: '10000000', 
  aggreNode: '39012088', 
  assignNode: '17770032', 
  pledgeAddress: '5bd548d76dcb3f9db1d213db01464406bef5dd09' 
};
export const GROUP_LIST = [DEFAULT_GROUP];
export const BASE_LIFT = 20;

// Coin types
export const COIN_TYPES = { PGC: 0, BTC: 1, ETH: 2 };

// Exchange rates
export const EXCHANGE_RATES = { PGC_TO_USDT: 1, BTC_TO_USDT: 100, ETH_TO_USDT: 10 };
```

### 2. I18n Module (`js/i18n/`)

**Structure**:
- `zh-CN.js` - Chinese translations (default export object)
- `en.js` - English translations (default export object)
- `index.js` - Core i18n logic

**Interface** (`js/i18n/index.js`):
```javascript
export function getCurrentLanguage(): string;
export function setLanguage(lang: string): boolean;
export function t(key: string, params?: object): string;
export function updatePageTranslations(): void;
export function loadLanguageSetting(): string;
export function saveLanguageSetting(lang: string): void;
export function updateLanguageSelectorUI(): void;
```

### 3. Utils Modules (`js/utils/`)

#### 3.1 Crypto Utils (`js/utils/crypto.js`)
```javascript
// Base64 encoding/decoding
export function base64urlToBytes(b64url: string): Uint8Array;
export function bytesToBase64url(bytes: Uint8Array): string;

// Hex conversion
export function bytesToHex(bytes: Uint8Array): string;
export function hexToBytes(hex: string): Uint8Array;

// CRC32
export function crc32(bytes: Uint8Array): number;
export function generate8DigitFromInputHex(hex: string): string;

// ECDSA signing (WebCrypto)
export async function ecdsaSignData(privKeyHex, data, pubXHex, pubYHex): Promise<object>;
export async function ecdsaSignHash(privKeyHex, hashBytes, pubXHex, pubYHex): Promise<object>;
```

#### 3.2 Storage Utils (`js/utils/storage.js`)
```javascript
// Account data
export function loadUser(): object | null;
export function saveUser(user: object): void;
export function toAccount(basic: object, prev: object): object;
export function clearAccountStorage(): void;

// Profile data
export function loadUserProfile(): object;
export function saveUserProfile(profile: object): void;

// Organization data
export function getJoinedGroup(): object | null;
export function saveGuarChoice(choice: object): void;
export function resetOrgSelectionForNewUser(): void;
```

#### 3.3 Toast Utils (`js/utils/toast.js`)
```javascript
export function showToast(message, type, title, duration): HTMLElement;
export function removeToast(toast: HTMLElement): void;
export function showErrorToast(message, title): HTMLElement;
export function showSuccessToast(message, title): HTMLElement;
export function showWarningToast(message, title): HTMLElement;
export function showInfoToast(message, title): HTMLElement;
export function showMiniToast(message, type): void;
```

#### 3.4 Helper Utils (`js/utils/helpers.js`)
```javascript
export function wait(ms: number): Promise<void>;
export function toFiniteNumber(val: any): number | null;
export function readAddressInterest(meta: object): number;
```

### 4. Services Modules (`js/services/`)

#### 4.1 Account Service (`js/services/account.js`)
```javascript
export async function newUser(): Promise<object>;
export async function importFromPrivHex(privHex: string): Promise<object>;
export async function importLocallyFromPrivHex(privHex: string): Promise<object>;
export async function addNewSubWallet(): Promise<void>;
```

#### 4.2 Wallet Service (`js/services/wallet.js`)
```javascript
export function renderWallet(): void;
export function updateWalletBrief(): void;
export function refreshOrgPanel(): void;
export function computeCurrentOrgId(): string;
```

#### 4.3 Transaction Service (`js/services/transaction.js`)
```javascript
export async function buildNewTX(buildTXInfo, userAccount): Promise<object>;
export async function getTXOutputHash(output): Promise<Uint8Array>;
export async function getTXHash(tx): Promise<Uint8Array>;
export async function getTXID(tx): Promise<string>;
export async function getTXUserSignature(tx, privateKeyHex, pubXHex, pubYHex): Promise<object>;
export function getTXOutputSerializedData(output): Uint8Array;
export function getTXSerializedData(tx): Uint8Array;
```

### 5. UI Modules (`js/ui/`)

#### 5.1 Header UI (`js/ui/header.js`)
```javascript
export function updateHeaderUser(user: object): void;
export function initUserMenu(): void;
export function updateAddressPopup(addresses: object): void;
export function updateBalanceDisplay(balance: object): void;
```

#### 5.2 Modal UI (`js/ui/modal.js`)
```javascript
export function showUnifiedLoading(text: string): void;
export function showUnifiedSuccess(title, text, onOk, onCancel, isError): void;
export function hideUnifiedOverlay(): void;
export function showModalTip(title, html, isError): void;
export function showConfirmModal(title, html, okText, cancelText): Promise<boolean>;
export function getActionModalElements(): object;
```

#### 5.3 Profile UI (`js/ui/profile.js`)
```javascript
export function initProfilePage(): void;
export function bindProfileEvents(): void;
export function handleAvatarFileSelect(e: Event): void;
export function compressImage(dataUrl, maxWidth, maxHeight, quality, callback): void;
export function updateAvatarPreview(avatarUrl: string): void;
export function handleAvatarRemove(): void;
export function handleProfileSave(): void;
export function updateProfileDisplay(): void;
export function updateProfilePageAccess(): void;
```

#### 5.4 Charts UI (`js/ui/charts.js`)
```javascript
export function initBalanceChart(): void;
export function updateBalanceChart(user: object): void;
export function initNetworkChart(): void;
export function updateWalletStruct(): void;
```

### 6. Page Modules (`js/pages/`)

Each page module exports an initialization function:

```javascript
// js/pages/welcome.js
export function initWelcomePage(): void;
export function updateWelcomeButtons(): void;

// js/pages/entry.js
export function initEntryPage(): void;
export function updateWalletBrief(): void;

// js/pages/login.js
export function initLoginPage(): void;
export function resetLoginPageState(): void;

// js/pages/newUser.js
export function initNewUserPage(): void;
export async function handleCreate(showToast: boolean): Promise<void>;

// js/pages/import.js
export function initImportPage(): void;

// js/pages/main.js
export function initMainPage(): void;
export function renderWallet(): void;

// js/pages/joinGroup.js
export function initJoinGroupPage(): void;

// js/pages/groupDetail.js
export function initGroupDetailPage(): void;
```

### 7. Router Module (`js/router.js`)

```javascript
export function router(): void;
export function routeTo(hash: string): void;
export function showCard(card: HTMLElement): void;
export function initRouter(): void;

// Route configuration
export const routes = {
  '/welcome': 'welcomeCard',
  '/entry': 'entryCard',
  '/new': 'newUserCard',
  '/login': 'loginCard',
  '/import': 'importCard',
  '/main': 'walletCard',
  '/join-group': 'nextCard',
  '/group-detail': 'groupDetailCard',
  '/profile': 'profileCard',
  '/inquiry': 'inquiryCard'
};
```

### 8. Theme Module (`js/ui/theme.js`)

```javascript
export function getCurrentTheme(): string;
export function setTheme(theme: string, showNotification?: boolean): void;
export function toggleTheme(): void;
export function loadThemeSetting(): void;
export function updateThemeSelectorUI(): void;
export function initThemeSelector(): void;
```

## Data Models

### User Account Model
```javascript
{
  accountId: string,        // 8-digit account ID
  address: string,          // Main address (40 hex chars)
  orgNumber: string,        // Guarantor organization ID
  flowOrigin: string,       // Flow origin identifier
  keys: {
    privHex: string,        // Private key (64 hex chars)
    pubXHex: string,        // Public key X coordinate
    pubYHex: string         // Public key Y coordinate
  },
  wallet: {
    addressMsg: object,     // Sub-addresses map
    totalTXCers: object,    // Transaction certificates
    totalValue: number,     // Total balance
    valueDivision: {        // Balance by coin type
      0: number,            // PGC
      1: number,            // BTC
      2: number             // ETH
    },
    updateTime: number,
    updateBlock: number,
    history: array
  },
  guarGroup: object         // Joined guarantor group
}
```

### User Profile Model
```javascript
{
  nickname: string,         // Display name (max 20 chars)
  avatar: string | null,    // Base64 encoded avatar image
  signature: string         // Bio/signature (max 50 chars)
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Based on the prework analysis, the following correctness properties have been identified:

### Property 1: Translation Function Equivalence
*For any* translation key and language setting, the `t(key, params)` function in the modularized code SHALL return the identical string as the original implementation.
**Validates: Requirements 3.4**

### Property 2: Crypto Utility Function Equivalence
*For any* valid input to crypto utility functions (bytesToHex, hexToBytes, crc32, generate8DigitFromInputHex), the modularized implementation SHALL produce identical output to the original implementation.
**Validates: Requirements 4.5**

### Property 3: Storage Data Format Consistency
*For any* user account data stored via `saveUser()`, the localStorage key and JSON format SHALL be identical to the original implementation, ensuring data can be read by either version.
**Validates: Requirements 11.3**

### Property 4: Router Navigation Equivalence
*For any* valid route hash, the router SHALL display the same page/card as the original implementation.
**Validates: Requirements 8.2**

### Property 5: Global Function Invocation Equivalence
*For any* function exposed on the `window` object for HTML onclick compatibility, invoking that function SHALL produce identical behavior to the original implementation.
**Validates: Requirements 9.2**

### Property 6: Overall Functional Equivalence
*For any* user action sequence that was valid in the original implementation, the modularized version SHALL produce identical observable results (UI state, localStorage state, network requests).
**Validates: Requirements 11.2**

## Error Handling

### Module Loading Errors
- If a module fails to load, the error will be caught and logged to console
- Critical modules (router, i18n) will show a user-friendly error message
- Non-critical modules will degrade gracefully

### Import/Export Errors
- All exports are validated at module load time
- Missing exports will throw clear error messages identifying the missing function

### Runtime Errors
- Error handling behavior is preserved from original implementation
- Toast notifications for user-facing errors
- Console logging for developer debugging

## Testing Strategy

### Dual Testing Approach

The testing strategy employs both unit tests and property-based tests:

1. **Unit Tests**: Verify specific examples and edge cases
2. **Property-Based Tests**: Verify universal properties across all inputs

### Property-Based Testing Framework

**Framework**: fast-check (JavaScript property-based testing library)

**Configuration**: Minimum 100 iterations per property test

### Test Categories

#### 1. Module Structure Tests (Unit)
- Verify all expected files exist
- Verify all expected exports are present
- Verify ES6 import/export syntax is used

#### 2. Functional Equivalence Tests (Property-Based)
- Translation function equivalence
- Crypto utility function equivalence
- Storage format consistency
- Router navigation equivalence

#### 3. Integration Tests (Unit)
- Application initialization
- Route navigation flow
- User action sequences

### Test File Organization
```
tests/
├── unit/
│   ├── config.test.js
│   ├── i18n.test.js
│   ├── utils/
│   │   ├── crypto.test.js
│   │   ├── storage.test.js
│   │   └── toast.test.js
│   ├── services/
│   │   ├── account.test.js
│   │   └── wallet.test.js
│   └── router.test.js
├── property/
│   ├── i18n.property.test.js
│   ├── crypto.property.test.js
│   ├── storage.property.test.js
│   └── router.property.test.js
└── integration/
    └── app.integration.test.js
```

### Test Annotations
Each property-based test will be annotated with:
```javascript
// **Feature: js-modularization, Property 1: Translation Function Equivalence**
// **Validates: Requirements 3.4**
```
